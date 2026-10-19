const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TIMEOUT_PADRAO_TEXTO = 3500;       // 3.5s para textos rápidos
const TIMEOUT_MULTIMODAL_AUDIO = 20000;  // 20s para transcrição + copilot + cronologia de áudio
const MODELOS_GEMINI_PADRAO = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-1.5-flash'];

// Auto-carrega .env da raiz do projeto caso ainda não tenha sido carregado
try {
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...vals] = trimmed.split('=');
                const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
                if (key && !process.env[key.trim()]) {
                    process.env[key.trim()] = val;
                }
            }
        });
    }
} catch (e) {}

/**
 * Obtém a chave ativa da API Gemini resolvendo em cascata com alta resiliência:
 * 1. Chave passada explicitamente por parâmetro
 * 2. process.env.GEMINI_API_KEY
 * 3. Objeto config (ou arquivo config.json na raiz do projeto)
 * 4. Leitura síncrona direta do arquivo .env na raiz do projeto
 * 
 * @param {string} [apiKeyPassada]
 * @param {object} [config]
 * @returns {string}
 */
function obterApiKeyAtiva(apiKeyPassada, config = null) {
    if (typeof apiKeyPassada === 'string') {
        if (apiKeyPassada.trim().length > 0) {
            return apiKeyPassada.trim();
        }
        if (apiKeyPassada === '') {
            return '';
        }
    }
    if (process.env.GEMINI_API_KEY && typeof process.env.GEMINI_API_KEY === 'string' && process.env.GEMINI_API_KEY.trim()) {
        return process.env.GEMINI_API_KEY.trim();
    }
    if (config && typeof config === 'object') {
        const c = config.gemini_api_key || config.geminiApiKey || config.ia?.apiKey || config.ia?.gemini_api_key || config.ia?.chave || config.processos?.gemini_api_key;
        if (c && typeof c === 'string' && c.trim()) {
            return c.trim();
        }
    }
    try {
        const configPath = path.resolve(__dirname, '../../config.json');
        if (fs.existsSync(configPath)) {
            const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const c = parsed?.gemini_api_key || parsed?.geminiApiKey || parsed?.ia?.apiKey || parsed?.ia?.gemini_api_key || parsed?.ia?.chave || parsed?.processos?.gemini_api_key;
            if (c && typeof c === 'string' && c.trim()) {
                return c.trim();
            }
        }
    } catch (_) {}
    return '';
}

// Cache em memória (Map: md5Hash -> textoTraduzido)
const cacheEmMemoria = new Map();

// Caminho do arquivo de cache em disco
let cacheFilePath = null;
let cacheCarregado = false;

/**
 * Inicializa ou define o caminho do arquivo de cache persistido em disco.
 * @param {string} [caminhoPersonalizado]
 */
function definirCaminhoCache(caminhoPersonalizado) {
    cacheFilePath = caminhoPersonalizado || path.join(__dirname, 'gemini_cache.json');
}

/**
 * Carrega o cache do disco se existir.
 */
function carregarCacheDisco() {
    if (cacheCarregado) return;
    try {
        if (!cacheFilePath) {
            definirCaminhoCache();
        }
        if (fs.existsSync(cacheFilePath)) {
            const data = fs.readFileSync(cacheFilePath, 'utf-8');
            const parsed = JSON.parse(data);
            if (parsed && typeof parsed === 'object') {
                for (const [hash, texto] of Object.entries(parsed)) {
                    if (typeof texto === 'string') {
                        cacheEmMemoria.set(hash, texto);
                    }
                }
            }
        }
    } catch (e) {
        // Silencioso em caso de falha de leitura do cache
    } finally {
        cacheCarregado = true;
    }
}

/**
 * Salva o cache em memória no disco de forma síncrona/segura.
 * Aplica higienização de memória: descarta payloads de áudio e limita a 500 registros úteis.
 */
function salvarCacheDisco() {
    try {
        if (!cacheFilePath) definirCaminhoCache();
        // Remove payloads de áudio e strings binárias longas
        const chaves = Array.from(cacheEmMemoria.keys());
        for (const k of chaves) {
            const v = cacheEmMemoria.get(k);
            if (k.startsWith('audio::') || k.startsWith('data:audio') || (typeof v === 'string' && (v.startsWith('data:audio') || v.length > 10000))) {
                cacheEmMemoria.delete(k);
            }
        }
        // Política de descarte LRU: limite de no máximo 500 registros úteis
        const chavesValidas = Array.from(cacheEmMemoria.keys());
        while (chavesValidas.length > 500) {
            const maisAntiga = chavesValidas.shift();
            cacheEmMemoria.delete(maisAntiga);
        }
        const obj = {};
        for (const [k, v] of cacheEmMemoria.entries()) {
            obj[k] = v;
        }
        const tmpPath = `${cacheFilePath}.tmp`;
        fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), 'utf-8');
        try {
            fs.renameSync(tmpPath, cacheFilePath);
        } catch (errRename) {
            fs.copyFileSync(tmpPath, cacheFilePath);
            try { fs.unlinkSync(tmpPath); } catch (_) {}
        }
    } catch (e) {
        // Silencioso se não conseguir persistir
    }
}

/**
 * Calcula o hash MD5 de uma string de texto.
 * @param {string} texto 
 * @returns {string}
 */
function calcularHash(texto) {
    if (!texto || typeof texto !== 'string') return '';
    return crypto.createHash('md5').update(texto.trim()).digest('hex');
}

/**
 * System Instruction com Guardrails OAB (Provimento 205/2021)
 */
const SYSTEM_INSTRUCTION_OAB = 
`Você é um assistente jurídico especializado em comunicação clara com clientes leigos de escritórios de advocacia, atuando sob estrita conformidade com o Código de Ética e o Provimento 205/2021 da OAB.

INSTRUÇÕES OBRIGATÓRIAS:
1. Traduza o andamento processual fornecido para uma linguagem simples, acolhedora, empática e profissional.
2. Tamanho máximo: estritamente no máximo 3 frases curtas.
3. PROIBIÇÕES ESTRITAS:
   - NUNCA prometa prazos de decisão judicial ou liberação.
   - NUNCA dê garantias de vitória, êxito ou ganho de causa.
   - NUNCA mencione valores financeiros específicos como garantidos.
4. Explique apenas o que o andamento significa na prática para o cliente e que a equipe jurídica está atenta aos próximos passos.`;

/**
 * Traduz um andamento jurídico usando a API Gemini 1.5 Flash com Cache MD5 e Fallback Instantâneo (< 2.8s).
 *
 * @param {string} textoAndamento - Texto bruto do andamento/resumo do processo
 * @param {object} [opcoes] - Opções adicionais
 * @param {string} [opcoes.apiKey] - Chave da API do Gemini
 * @param {object} [opcoes.config] - Objeto config do sistema (ex: config.gemini_api_key)
 * @param {number} [opcoes.timeoutMs=2800] - Timeout rígido em ms (default: 2800ms)
 * @param {boolean} [opcoes.desativarPersistencia=false] - Desativa gravação em disco se true
 * @returns {Promise<{ texto: string, fonte: 'cache' | 'ia' | 'fallback', duracaoMs: number }>}
 */
async function traduzirAndamentoJuridico(textoAndamento, opcoes = {}) {
    const inicio = Date.now();

    // Verificação de texto vazio/inválido -> fallback imediato
    if (!textoAndamento || typeof textoAndamento !== 'string' || !textoAndamento.trim()) {
        return {
            texto: textoAndamento || '',
            fonte: 'fallback',
            duracaoMs: Date.now() - inicio
        };
    }

    const textoLimpo = textoAndamento.trim();
    carregarCacheDisco();

    // 1. Verificação de Cache Local (MD5)
    const modoBruto = Boolean(opcoes.modoBruto);
    const hash = calcularHash((modoBruto ? 'raw::' : '') + textoLimpo);
    if (cacheEmMemoria.has(hash)) {
        return {
            texto: cacheEmMemoria.get(hash),
            fonte: 'cache',
            duracaoMs: Date.now() - inicio
        };
    }

    // 2. Resolução da Chave da API Gemini
    const apiKey = obterApiKeyAtiva(opcoes.apiKey, opcoes.config);

    if (!apiKey || !apiKey.trim()) {
        // Fallback instantâneo gracioso (< 5ms)
        return {
            texto: textoLimpo,
            fonte: 'fallback',
            duracaoMs: Date.now() - inicio
        };
    }

    // 3. Chamada REST pura para o Gemini com AbortController (timeout 3.5s texto ou 20s áudio/inlineData)
    const timeoutPadrao = (opcoes.inlineData || (opcoes.parts && opcoes.parts.some(p => p.inlineData)))
        ? TIMEOUT_MULTIMODAL_AUDIO
        : TIMEOUT_PADRAO_TEXTO;
    const timeoutMs = opcoes.timeoutMs || timeoutPadrao;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Cadeia de modelos: tenta os atuais em ordem.
    const modelosCandidatos = [opcoes.modelo, process.env.GEMINI_MODEL, ...MODELOS_GEMINI_PADRAO]
        .filter(Boolean)
        .filter((m, i, arr) => arr.indexOf(m) === i);

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: modoBruto
                            ? textoLimpo
                            : `Explique este andamento processual de forma simples para o cliente:\n\n"${textoLimpo}"`
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: modoBruto ? 1500 : 800
        }
    };
    const instrucaoSistema = modoBruto ? opcoes.systemInstruction : SYSTEM_INSTRUCTION_OAB;
    if (instrucaoSistema) {
        requestBody.system_instruction = { parts: [{ text: instrucaoSistema }] };
    }
    if (modoBruto && opcoes.json) {
        requestBody.generationConfig.responseMimeType = 'application/json';
    }

    try {
        let response = null;
        for (const modelo of modelosCandidatos) {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            if (response.ok) break;
            // Modelo indisponível/sobrecarregado/descontinuado -> tenta o próximo da cadeia
            if (![404, 429, 500, 503].includes(response.status)) break;
        }

        clearTimeout(timeoutId);

        if (!response || !response.ok) {
            // Cota estourada, chave inválida ou todos os modelos indisponíveis
            return {
                texto: textoLimpo,
                fonte: 'fallback',
                duracaoMs: Date.now() - inicio
            };
        }

        const data = await response.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        const textoGerado = parts.map(p => p.text || '').filter(Boolean).join('\n').trim();

        if (textoGerado) {
            const traducaoFinal = textoGerado;

            // Salva no cache em memória
            cacheEmMemoria.set(hash, traducaoFinal);

            // Persiste no disco se não desativado
            if (!opcoes.desativarPersistencia) {
                salvarCacheDisco();
            }

            return {
                texto: traducaoFinal,
                fonte: 'ia',
                duracaoMs: Date.now() - inicio
            };
        }

        // Se resposta vazia ou estrutura diferente, fallback
        return {
            texto: textoLimpo,
            fonte: 'fallback',
            duracaoMs: Date.now() - inicio
        };
    } catch (err) {
        // Timeout (AbortError), erro de conexão, socket error, etc.
        clearTimeout(timeoutId);
        return {
            texto: textoLimpo,
            fonte: 'fallback',
            duracaoMs: Date.now() - inicio
        };
    }
}

/**
 * Traduz o resumo de um processo de forma transparente para ser usado no fluxo do WhatsApp.
 * Se houver erro ou ausência de chave, retorna o resumo original sem lançar exceções.
 *
 * @param {object} processo - Objeto do processo (ex: { numero, nome, resumo, ... })
 * @param {string} [resumoOriginal] - Resumo original se já extraído ou alternativo
 * @param {object} [config] - Configuração geral do app
 * @returns {Promise<string>} - Texto traduzido ou original
 */
async function traduzirAndamentoParaCliente(processo, resumoOriginal, config = {}) {
    try {
        const textoBase = resumoOriginal || (processo && processo.resumo) || '';
        if (!textoBase.trim()) return textoBase;

        const resultado = await traduzirAndamentoJuridico(textoBase, {
            config,
            apiKey: config?.gemini_api_key || config?.ia?.gemini_api_key
        });

        return resultado.texto;
    } catch (e) {
        // Proteção máxima contra crash
        return resumoOriginal || (processo && processo.resumo) || '';
    }
}

/**
 * Analisa e cataloga uma peça processual (sentença, petição, laudo) com IA Gemini.
 * Extrai assunto principal, última decisão, próximo passo esperado e resumo para o cliente.
 *
 * @param {string} textoPeca - Conteúdo textual da peça extraído de PDF/DOCX/TXT
 * @param {object} [opcoes]
 * @returns {Promise<{ sucesso: boolean, assunto: string, decisao: string, proximoPasso: string, resumoCliente: string }>}
 */
async function catalogarPecaProcessual(textoPeca, opcoes = {}) {
    if (!textoPeca || typeof textoPeca !== 'string' || !textoPeca.trim()) {
        return {
            sucesso: false,
            tipoPeca: 'DOCUMENTO_GERAL',
            assunto: 'Documento Geral',
            decisao: 'Sem decisão catalogada',
            proximoPasso: 'Aguardando andamento',
            resumoCliente: 'Documento anexado aos autos.',
            resumoLeigo: 'Documento anexado aos autos.',
            dadosExtraidos: {}
        };
    }

    // Heurística de classificação do tipo de peça
    const textoMin = textoPeca.toLowerCase();
    let tipoPeca = 'DOCUMENTO_PROCESSUAL';
    if (textoMin.includes('petição inicial') || textoMin.includes('ação declaratória') || textoMin.includes('ação ordinária') || textoMin.includes('excelentíssimo senhor')) {
        tipoPeca = 'PETICAO_INICIAL';
    } else if (textoMin.includes('sentença') || textoMin.includes('julgo procedente') || textoMin.includes('julgo improcedente')) {
        tipoPeca = 'SENTENCA';
    } else if (textoMin.includes('laudo pericial') || textoMin.includes('perícia')) {
        tipoPeca = 'LAUDO_PERICIAL';
    } else if (textoMin.includes('acórdão') || textoMin.includes('apelação') || textoMin.includes('agravo')) {
        tipoPeca = 'RECURSO';
    } else if (textoMin.includes('despacho') || textoMin.includes('intimação')) {
        tipoPeca = 'DESPACHO';
    }

    // Extração heurística de identificadores
    const cnjMatch = textoPeca.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/);
    const cpfMatch = textoPeca.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/);
    const dadosExtraidos = {
        numeroProcesso: cnjMatch ? cnjMatch[0] : null,
        cpf: cpfMatch ? cpfMatch[0] : null
    };

    const trecho = textoPeca.slice(0, 12000);
    const instrucaoCatalogo = 'Você é um assistente jurídico que analisa peças processuais brasileiras. ' +
        'Responda SOMENTE com um objeto JSON válido com os campos: ' +
        '"assunto" (até 10 palavras), "decisao" (última decisão/determinação em 1 frase curta, ou "Sem decisão registrada"), ' +
        '"proximoPasso" (próximo passo esperado em 1 frase curta), ' +
        '"resumoCliente" (até 3 frases curtas, tom acolhedor, linguagem simples para leigo). ' +
        'Provimento 205/2021 da OAB: NUNCA prometa prazos, vitória ou valores que não estejam no texto; ' +
        'se citar valores da peça, atribua-os ao documento ("a sentença fixou...") sem garantir pagamento.';

    try {
        const res = await traduzirAndamentoJuridico(`Peça processual:\n"""\n${trecho}\n"""`, {
            ...opcoes,
            modoBruto: true,
            json: true,
            systemInstruction: instrucaoCatalogo,
            timeoutMs: 15000
        });

        // Só aceita resultado vindo de IA/cache. Em fallback o "texto" é o próprio prompt — nunca parsear.
        if ((res.fonte === 'ia' || res.fonte === 'cache') && res.texto) {
            const jsonMatch = res.texto.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const resumo = parsed.resumoCliente || 'Seu documento foi recebido e catalogado.';
                return {
                    sucesso: true,
                    fonte: res.fonte,
                    origem: res.fonte,
                    confianca: 'alta',
                    tipoPeca,
                    assunto: parsed.assunto || 'Processo Judicial',
                    decisao: parsed.decisao || 'Andamento registrado nos autos.',
                    proximoPasso: parsed.proximoPasso || 'Aguardando manifestação.',
                    resumo: resumo,
                    resumoCliente: resumo,
                    resumoLeigo: resumo,
                    dadosExtraidos
                };
            }
        }
    } catch (e) {
        // Fallback local abaixo
    }

    // Catalogação local (sem IA): extrai por rótulos e palavras-chave do próprio documento
    const local = catalogarLocalmente(textoPeca);
    return {
        sucesso: true,
        fonte: 'local',
        origem: 'local',
        confianca: 'media',
        tipoPeca,
        assunto: local.assunto,
        decisao: local.decisao,
        proximoPasso: local.proximoPasso,
        resumo: local.resumoCliente,
        resumoCliente: local.resumoCliente,
        resumoLeigo: local.resumoCliente,
        dadosExtraidos
    };
}

/**
 * Catalogação sem IA: usa rótulos ("Assunto:", "DISPOSITIVO", "Andamento") e frases-chave do texto.
 */
function catalogarLocalmente(texto) {
    const limpo = String(texto || '').replace(/\r/g, '');
    const linhaDe = (re) => { const m = limpo.match(re); return m ? m[1].replace(/\s+/g, ' ').trim() : ''; };
    const corta = (s, n) => (s.length > n ? s.slice(0, n - 1).trim() + '…' : s);

    const assunto = linhaDe(/Assunto\s*:\s*([^\n]{4,160})/i)
        || linhaDe(/Classe\s+Processual\s*:\s*([^\n]{4,160})/i)
        || 'Peça processual registrada';

    let decisao = '';
    const mDisp = limpo.match(/(julgo\s+(?:totalmente\s+|parcialmente\s+)?(?:procedente|improcedente)s?[^.]{0,220})/i);
    if (mDisp) decisao = 'Sentença: ' + mDisp[1].replace(/\s+/g, ' ').trim();
    if (!decisao) {
        const mDec = limpo.match(/(defiro[^.]{0,200}|indefiro[^.]{0,200}|determino[^.]{0,200}|homologo[^.]{0,200})/i);
        if (mDec) decisao = mDec[1].replace(/\s+/g, ' ').trim();
    }
    if (!decisao) decisao = 'Documento acostado aos autos.';

    const valor = linhaDe(/danos?\s+morais?[^.]{0,80}?(R\$\s?[\d.]+,\d{2})/i);
    const andamento = linhaDe(/andamento[^\n:]{0,120}:\s*\n?\s*["“]?([^\n]{20,400})/i);

    const proximoPasso = /embargos?\s+de\s+declara/i.test(limpo)
        ? 'Aguardando o julgamento dos embargos de declaração.'
        : (/prazo/i.test(limpo) ? 'Acompanhar os prazos em curso nos autos.' : 'Acompanhamento processual pela equipe jurídica.');

    const partes = [];
    if (/julgo\s+(?:totalmente\s+)?procedente/i.test(limpo)) partes.push('O juiz analisou o caso e decidiu a favor da parte autora.');
    else if (/julgo\s+improcedente/i.test(limpo)) partes.push('O juiz analisou o caso e decidiu contra os pedidos da parte autora.');
    else partes.push('Este documento foi anexado ao seu processo e está sendo acompanhado pela equipe.');
    if (valor) partes.push('A decisão menciona o valor de ' + valor + ' a título de indenização.');
    if (andamento) partes.push('Situação mais recente registrada: ' + corta(andamento, 160));
    else partes.push('Nossa equipe seguirá acompanhando os próximos passos.');

    return {
        assunto: corta(assunto, 120),
        decisao: corta(decisao, 260),
        proximoPasso,
        resumoCliente: partes.slice(0, 3).join(' ')
    };
}

/**
 * Sintetiza o dossiê global de um processo com múltiplos documentos e andamentos.
 *
 * @param {object} processo - Objeto completo do processo
 * @param {object} [opcoes]
 * @returns {object|string} - Síntese executiva contextual para o cliente
 */
function sintetizarDossieProcesso(processo, opcoes = {}) {
    if (!processo) return '';
    const docs = Array.isArray(processo.documentosCatalogados) ? processo.documentosCatalogados : [];
    const hists = Array.isArray(processo.historicoAndamentos) ? processo.historicoAndamentos : [];
    const nome = processo.nome || 'Cliente';
    const numero = processo.numero || processo.numeroProcesso || '-';

    const textoSintese = `Processo ${numero} de ${nome}. Contém ${docs.length} documento(s) catalogado(s) e ${hists.length} andamento(s) histórico(s). Situação atual: ${processo.resumo || 'Em tramitação regular.'}`;

    return {
        sucesso: true,
        totalDocumentos: docs.length,
        totalAndamentos: hists.length,
        resumoIntegrado: textoSintese
    };
}

/**
 * Funções auxiliares para inspeção/testes
 */
function obterEstatisticasCache() {
    return {
        tamanho: cacheEmMemoria.size,
        caminho: cacheFilePath
    };
}

function limparCacheMemoria() {
    cacheEmMemoria.clear();
}

/**
 * Classificador e extrator de fatos cronológicos inteligente (Offline / Fallback)
 * Avalia termos de urgência crítica, interesse comercial e extrai datas e fatos narrados.
 */
function detectarUrgenciaECronologiaLocal(texto, contexto = {}) {
  const txt = String(texto || '').trim();
  if (!txt) {
    return {
      nivelUrgencia: 'ROTINA',
      motivoUrgencia: 'Atendimento geral e esclarecimento de dúvidas',
      cronologiaFatos: []
    };
  }

  // 1. Detecção de Urgência Crítica (Furador de Fila)
  const regexCritica = /(oficial\s+de\s+justi[cç]a|mandado|intima[cç][aã]o|audi[eê]ncia\s+(amanh[aã]|hoje|pr[oó]xima|urgente)|bloqueio\s+(de\s+)?conta|bloquearam\s+minha\s+conta|sisbajud|bacenjud|pris[aã]o|mandado\s+de\s+pris[aã]o|liminar|prazo\s+fatal|prazo\s+vencendo|despejo|ordem\s+de\s+despejo|busca\s+e\s+apreens[aã]o|penhora|leil[aã]o)/i;

  // 2. Detecção de Oportunidade Comercial / Fechamento
  const regexComercial = /(fechar\s+contrato|assinar\s+contrato|proposta\s+de\s+honor[aá]rios?|quanto\s+custa|pagar\s+honor[aá]rios?|dar\s+entrada\s+(hoje|urgente|no\s+processo)|documentos?\s+para\s+iniciar|fechamento|contratar|quero\s+contratar)/i;

  let nivelUrgencia = 'ROTINA';
  let motivoUrgencia = 'Consulta geral sobre andamento processual';

  const matchCritico = txt.match(regexCritica);
  if (matchCritico) {
    nivelUrgencia = 'CRITICA';
    const termo = matchCritico[0].toLowerCase();
    motivoUrgencia = `Menção urgente a "${termo}" relatado pelo cliente`;
  } else {
    const matchComercial = txt.match(regexComercial);
    if (matchComercial) {
      nivelUrgencia = 'COMERCIAL';
      motivoUrgencia = 'Interesse manifesto em contratação ou pagamento de honorários';
    }
  }

  // 3. Extração Heurística de Cronologia de Fatos
  const cronologiaFatos = [];
  const frases = txt.split(/[.\n;!?]+/).map(f => f.trim()).filter(f => f.length > 8);

  const regexData = /\b(\d{1,2}[\/\.-]\d{1,2}(?:[\/\.-]\d{2,4})?|\d{4}|ontem|hoje|semana\s+passada|m[eê]s\s+passado|ano\s+passado|h[aá]\s+\d+\s+(?:dias|meses|anos))\b/i;

  for (const frase of frases) {
    const matchData = frase.match(regexData);
    if (matchData) {
      cronologiaFatos.push({
        dataAproximada: matchData[0],
        fato: frase.replace(/^[-*•\s]+/, '').trim()
      });
    }
  }

  if (cronologiaFatos.length === 0 && frases.length > 0) {
    cronologiaFatos.push({
      dataAproximada: 'Fato inicial',
      fato: frases[0].replace(/^[-*•\s]+/, '').trim()
    });
    if (frases.length > 1) {
      cronologiaFatos.push({
        dataAproximada: 'Em seguida',
        fato: frases[frases.length - 1].replace(/^[-*•\s]+/, '').trim()
      });
    }
  }

  return {
    nivelUrgencia,
    motivoUrgencia,
    cronologiaFatos
  };
}

/**
 * Processa áudio via Gemini Multimodal e gera transcrição, resumo, 3 sugestões de resposta,
 * classificação de urgência e cronologia dos fatos.
 * Suporta formatos: audio/webm, audio/ogg, audio/mp3, audio/wav.
 */
async function processarAudioECopilot(audioBufferOuBase64, mimeType = 'audio/webm', contextoCliente = {}) {
  const base64Data = Buffer.isBuffer(audioBufferOuBase64)
    ? audioBufferOuBase64.toString('base64')
    : String(audioBufferOuBase64 || '').replace(/^data:audio\/\w+;base64,/, '');

  const fallbackLocal = detectarUrgenciaECronologiaLocal(contextoCliente.texto || contextoCliente.mensagens || '', contextoCliente);

  const apiKey = obterApiKeyAtiva(contextoCliente?.apiKey, contextoCliente?.config);
  if (!apiKey) {
    return {
      sucesso: false,
      modoLocal: true,
      transcricao: "[Modo Local] Chave Gemini não configurada no .env. Áudio mantido para escuta manual.",
      resumo: "• Áudio recebido aguardando reprodução manual pelo advogado.\n• Nenhuma transcrição automática foi processada.",
      nivelUrgencia: fallbackLocal.nivelUrgencia,
      motivoUrgencia: fallbackLocal.motivoUrgencia,
      cronologiaFatos: fallbackLocal.cronologiaFatos,
      sugestoesResposta: [
        "Olá! Ouvi sua mensagem de áudio e já estou analisando sua situação.",
        "Poderia nos confirmar o seu número de CPF para localizarmos o processo?",
        "Recebido com sucesso. Vamos verificar o andamento e retornaremos em breve."
      ]
    };
  }

  const promptInstrucao = `
Você é o assistente executivo sênior de um escritório de advocacia de elite (em total conformidade com o Código de Ética e Provimento 205/2021 da OAB).
O áudio anexo foi enviado por um cliente que solicitou atendimento humano com o advogado.
Dados de contexto do processo/cliente: ${JSON.stringify(contextoCliente || {})}

Sua tarefa:
1. Transcreva com precisão o que foi falado no áudio.
2. Crie um resumo executivo objetivo em 2 ou 3 tópicos: o que aconteceu e o que o cliente solicita.
3. Classifique o nível de urgência jurídica da demanda em estritamente um destes 3 valores:
   - "CRITICA": Quando houver menção a oficial de justiça na porta, mandado, audiência amanhã/próxima, bloqueio judicial de conta (Sisbajud/Bacenjud), prisão, despejo, busca e apreensão, liminar ou prazo fatal hoje/amanhã.
   - "COMERCIAL": Quando o cliente demonstrar interesse explícito em fechar contrato, pagar honorários, contratar novos serviços ou dar entrada imediata em ação.
   - "ROTINA": Dúvidas gerais, pedidos rotineiros de andamento e consultas habituais.
4. Forneça uma frase curta em 'motivoUrgencia' justificando a classificação atribuída.
5. Extraia a CRONOLOGIA DOS FATOS narrados pelo cliente, ordenados por data ou sequência temporal dos acontecimentos, útil para redação da petição inicial:
   Array de objetos: [ { "dataAproximada": "DD/MM/AAAA ou período", "fato": "Descrição objetiva e clara do fato ocorrido" } ]
6. Elabore exatamente 3 sugestões de resposta rápida empáticas e acolhedoras para o advogado enviar com 1 clique:
   - Opção 1: Resposta direta e acolhedora esclarecendo o ponto ou confirmando o recebimento com os próximos passos.
   - Opção 2: Proposta de agendamento de chamada ou atendimento presencial/remoto.
   - Opção 3: Solicitação de documentos complementares pertinentes ao relato.

Retorne ESTRITAMENTE um objeto JSON válido (sem blocos markdown adicionais):
{
  "transcricao": "Texto integral...",
  "resumo": "• Tópico 1\\n• Tópico 2",
  "nivelUrgencia": "CRITICA" | "COMERCIAL" | "ROTINA",
  "motivoUrgencia": "Frase curta justificando...",
  "cronologiaFatos": [
    { "dataAproximada": "10/03/2024", "fato": "Descrição do fato..." }
  ],
  "sugestoesResposta": [
    "Sugestão 1...",
    "Sugestão 2...",
    "Sugestão 3..."
  ]
}
`;

  const timeoutMs = (contextoCliente && contextoCliente.timeoutMs) || TIMEOUT_MULTIMODAL_AUDIO;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const modelosCandidatos = [
      (contextoCliente && contextoCliente.modelo),
      process.env.GEMINI_MODEL,
      ...MODELOS_GEMINI_PADRAO
    ].filter(Boolean).filter((m, i, arr) => arr.indexOf(m) === i);

    let data = null;
    let ultimoErro = null;

    try {
      for (const mod of modelosCandidatos) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: promptInstrucao },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: base64Data
                    }
                  }
                ]
              }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: "application/json"
              }
            }),
            signal: controller.signal
          });

          const respJson = await response.json();
          if (respJson && respJson.candidates && respJson.candidates[0] && respJson.candidates[0].content) {
            data = respJson;
            break;
          } else {
            ultimoErro = new Error(JSON.stringify(respJson.error || respJson));
          }
        } catch (errLoop) {
          ultimoErro = errLoop;
          if (controller.signal.aborted) break;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!data) {
      throw ultimoErro || new Error("Não foi possível obter resposta de nenhum modelo Gemini multimodal.");
    }

    const jsonTexto = data.candidates[0].content.parts[0].text;
    const resultado = JSON.parse(jsonTexto);
    const fallbackSeNecessario = detectarUrgenciaECronologiaLocal((resultado.transcricao || '') + ' ' + (contextoCliente.texto || ''), contextoCliente);

    return {
      sucesso: true,
      transcricao: resultado.transcricao || "Áudio processado.",
      resumo: resultado.resumo || "• Áudio recebido e sintetizado.",
      nivelUrgencia: ['CRITICA', 'COMERCIAL', 'ROTINA'].includes(resultado.nivelUrgencia) ? resultado.nivelUrgencia : fallbackSeNecessario.nivelUrgencia,
      motivoUrgencia: resultado.motivoUrgencia || fallbackSeNecessario.motivoUrgencia,
      cronologiaFatos: Array.isArray(resultado.cronologiaFatos) && resultado.cronologiaFatos.length > 0 ? resultado.cronologiaFatos : fallbackSeNecessario.cronologiaFatos,
      sugestoesResposta: Array.isArray(resultado.sugestoesResposta) && resultado.sugestoesResposta.length === 3
        ? resultado.sugestoesResposta
        : [
            "Olá! Ouvi sua mensagem e já estou acompanhando sua situação.",
            "Poderia nos confirmar mais detalhes ou documentos pertinentes?",
            "Recebido com sucesso. Vamos verificar o andamento e retornaremos em breve."
          ]
    };
  } catch (err) {
    console.error("Erro no processamento de áudio com Gemini:", err.message);
    return {
      sucesso: false,
      erro: err.message,
      transcricao: "[Não foi possível processar o áudio automaticamente]",
      resumo: "• Falha de rede ou chave de API ao transcrever o áudio.\n• Utilize o player para ouvir a gravação.",
      nivelUrgencia: fallbackLocal.nivelUrgencia,
      motivoUrgencia: fallbackLocal.motivoUrgencia,
      cronologiaFatos: fallbackLocal.cronologiaFatos,
      sugestoesResposta: [
        "Olá! Recebi seu áudio e já estou verificando sua solicitação.",
        "Poderia nos resumir o seu pedido por texto enquanto abro sua ficha?",
        "Entendido. Em breve retornaremos com a orientação jurídica necessária."
      ]
    };
  }
}

/**
 * Analisa a totalidade das mensagens e relatos acumulados de um cliente para atualizar:
 * Resumo Executivo, 3 Sugestões Copilot, Classificação de Urgência e Cronologia dos Fatos.
 */
async function analisarUrgenciaECronologia(textoCompleto, contexto = {}) {
  const textoLimpo = String(textoCompleto || '').trim();
  const apiKey = obterApiKeyAtiva(contexto?.apiKey, contexto?.config);
  const fallback = detectarUrgenciaECronologiaLocal(textoLimpo, contexto);

  if (!textoLimpo || !apiKey) {
    return {
      sucesso: true,
      modoLocal: true,
      resumo: textoLimpo ? `• Relato consolidado do cliente:\n• "${textoLimpo.slice(0, 180)}..."` : "• Cliente solicitou atendimento com o advogado.",
      nivelUrgencia: fallback.nivelUrgencia,
      motivoUrgencia: fallback.motivoUrgencia,
      cronologiaFatos: fallback.cronologiaFatos,
      sugestoesResposta: [
        "Olá! Recebi suas mensagens e já estou analisando o histórico completo.",
        "Poderia nos confirmar mais detalhes sobre a documentação?",
        "Entendido perfeitamente. Vamos verificar as medidas cabíveis de imediato."
      ]
    };
  }

  const promptInstrucao = `
Você é o assistente executivo sênior de um escritório de advocacia de elite (em total conformidade com o Código de Ética e Provimento 205/2021 da OAB).
Analise o histórico consolidado de mensagens enviadas por um cliente que solicitou atendimento humano.
Dados de contexto: ${JSON.stringify(contexto || {})}

Mensagens / Relatos consolidados do cliente:
"""
${textoLimpo}
"""

Sua tarefa:
1. Crie um resumo executivo objetivo em 2 ou 3 tópicos considerando a TOTALIDADE das mensagens enviadas.
2. Identifique o nível de urgência jurídica da demanda em uma destas 3 categorias:
   - "CRITICA": Casos urgentes como oficial de justiça na porta, mandado, audiência amanhã/próxima, bloqueio judicial de conta (Sisbajud/Bacenjud), prisão, despejo, busca e apreensão, liminar ou prazo fatal hoje/amanhã.
   - "COMERCIAL": Cliente querendo fechar contrato, pagar honorários, contratar serviços novos ou dar entrada imediata.
   - "ROTINA": Dúvidas gerais, pedidos rotineiros de andamento processual e esclarecimentos normais.
3. Elabore um motivo curto para a urgência (ex: "Menção a oficial de justiça e mandado recebido hoje").
4. Extraia a CRONOLOGIA DOS FATOS relevantes narrados pelo cliente, ordenados por data ou sequência temporal, útil para a redação da petição inicial:
   Array com objetos: [ { "dataAproximada": "DD/MM/AAAA ou período", "fato": "Descrição clara e precisa do ocorrido" } ]
5. Elabore exatamente 3 sugestões de resposta rápida empáticas e estratégicas para o advogado enviar com 1 clique.

Retorne ESTRITAMENTE um objeto JSON válido (sem blocos markdown adicionais):
{
  "resumo": "• Tópico 1\\n• Tópico 2",
  "nivelUrgencia": "CRITICA" | "COMERCIAL" | "ROTINA",
  "motivoUrgencia": "Frase curta justificando...",
  "cronologiaFatos": [
    { "dataAproximada": "10/03/2024", "fato": "Ocorrência..." }
  ],
  "sugestoesResposta": [
    "Sugestão 1...",
    "Sugestão 2...",
    "Sugestão 3..."
  ]
}
`;

  const timeoutMs = (contexto && contexto.timeoutMs) || TIMEOUT_PADRAO_TEXTO;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const modelosCandidatos = [
    (contexto && contexto.modelo),
    process.env.GEMINI_MODEL,
    ...MODELOS_GEMINI_PADRAO
  ].filter(Boolean).filter((m, i, arr) => arr.indexOf(m) === i);

  try {
    for (const mod of modelosCandidatos) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: promptInstrucao }]
            }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: "application/json"
            }
          }),
          signal: controller.signal
        });

        if (response.ok) {
          const data = await response.json();
          const jsonTexto = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (jsonTexto) {
            const parsed = JSON.parse(jsonTexto);
            return {
              sucesso: true,
              resumo: parsed.resumo || fallback.resumo,
              nivelUrgencia: ['CRITICA', 'COMERCIAL', 'ROTINA'].includes(parsed.nivelUrgencia) ? parsed.nivelUrgencia : fallback.nivelUrgencia,
              motivoUrgencia: parsed.motivoUrgencia || fallback.motivoUrgencia,
              cronologiaFatos: Array.isArray(parsed.cronologiaFatos) && parsed.cronologiaFatos.length > 0 ? parsed.cronologiaFatos : fallback.cronologiaFatos,
              sugestoesResposta: Array.isArray(parsed.sugestoesResposta) && parsed.sugestoesResposta.length === 3 ? parsed.sugestoesResposta : [
                "Olá! Recebi suas mensagens e já estou analisando o histórico completo.",
                "Poderia nos confirmar mais detalhes sobre a documentação?",
                "Entendido perfeitamente. Vamos verificar as medidas cabíveis de imediato."
              ]
            };
          }
        }
      } catch (e) {
        if (controller.signal.aborted) break;
        // Tenta próximo modelo ou cai no fallback
      }
    }
  } finally {
    clearTimeout(timeoutId);
  }

  return {
    sucesso: true,
    modoFallback: true,
    resumo: `• Relato consolidado:\n• "${textoLimpo.slice(0, 180)}..."`,
    nivelUrgencia: fallback.nivelUrgencia,
    motivoUrgencia: fallback.motivoUrgencia,
    cronologiaFatos: fallback.cronologiaFatos,
    sugestoesResposta: [
      "Olá! Recebi suas mensagens e já estou analisando o histórico completo.",
      "Poderia nos confirmar mais detalhes sobre a documentação?",
      "Entendido perfeitamente. Vamos verificar as medidas cabíveis de imediato."
    ]
  };
}

/**
 * Prompt do Sistema com Guardrails Éticos da OAB (Provimento 205/2021)
 * para aprimoramento de mensagens de atendimento no WhatsApp.
 */
const SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM = 
`Você é um assistente especialista em comunicação jurídica para WhatsApp de escritórios de advocacia de excelência, atuando sob estrita conformidade com o Código de Ética e o Provimento 205/2021 da OAB.

Sua missão é aprimorar a mensagem de atendimento enviada pelo escritório ao cliente para torná-la acolhedora, clara, profissional, segura e engajadora.

DIRETRIZES OBRIGATÓRIAS:
1. TERMOS TÉCNICOS ACESSÍVEIS: Incorpore termos jurídicos precisos quando oportuno (ex: "análise dos autos", "instrução probatória", "distribuição da petição inicial", "resguardo de direitos", "análise pericial", "manifestação processual", "cumprimento de despacho"), explicando-os brevemente com máxima empatia e sem juridiquês hermético.
2. EMOJIS ELEGANTES E ESTRUTURAÇÃO WHATSAPP: Adicione emojis sóbrios e acolhedores no WhatsApp (ex: ⚖️, 📋, 👨‍⚖️, 🏛️, 📌, 🤝, ✨, 💬, 📲) formatando com negritos (*texto*) e tópicos (•) para tornar a leitura fluida no celular.
3. INTERAÇÕES E CHAMADAS PARA AÇÃO (CTA): Finalize ou inclua interações claras, acolhedoras e gentis (ex: convidando o cliente a enviar documentos comprobatórios, gravar áudio relatando o ocorrido ou aguardar com tranquilidade o acompanhamento da equipe).
4. ÉTICA OAB RIGOROSA (Provimento 205/2021):
   - Proibição absoluta de prometer vitórias judiciais, garantia de resultado ou ganho de causa.
   - Proibição de prometer prazos de decisões que dependam exclusivamente do Poder Judiciário/Juiz.
5. RETORNO LIMPO: Retorne ESTRITAMENTE o texto aprimorado final pronto para ser enviado no WhatsApp, sem prefácios, sem explicações adicionais e sem aspas delimitadoras.`;

/**
 * Fallback gracioso local: enriquece mensagens com termos técnicos acessíveis, emojis e chamadas para ação
 * sem depender de conexão de rede ou API externa.
 */
function melhorarMensagemLocalmente(textoOriginal, contexto = {}) {
    if (!textoOriginal || typeof textoOriginal !== 'string' || !textoOriginal.trim()) {
        return "⚖️ *Olá! Seja muito bem-vindo(a) ao nosso escritório.* 🏛️\n\nNossa equipe jurídica está à disposição para o devido *resguardo e defesa de seus direitos* ⚖️.\n\n📲 *Como podemos lhe ajudar?* Fique à vontade para nos enviar uma mensagem de texto, áudio com seu relato ou fotos de documentos para análise dos autos. 🤝✨";
    }

    let texto = textoOriginal.trim();

    // 1. Dicionário de enriquecimento com termos técnicos precisos e acessíveis
    const dicionarioTermos = [
        { padrao: /\b(dar\s+entrada|entrar\s+com\s+o?\s*processo|abrir\s+processo|ingressar\s+com\s+a\s+ação)\b/gi, subst: 'distribuição da petição inicial para resguardo de direitos ⚖️' },
        { padrao: /\b(olhar|analisar|conferir|olhando|verificando)\s+(o\s+)?(seu\s+)?processo\b/gi, subst: 'criteriosa análise dos autos do processo 🏛️' },
        { padrao: /\b(provas|papéis|papeis)\b/gi, subst: 'instrução probatória e documentos comprobatórios 📁' },
        { padrao: /\b(perícia|pericia|médico\s+do\s+juiz|perito)\b/gi, subst: 'análise pericial técnica especializada 👨‍⚖️' },
        { padrao: /\b(garantir|proteger)\s+(seus?\s+)?direitos?\b/gi, subst: 'efetivo resguardo e defesa de seus direitos ⚖️' },
        { padrao: /\b(resposta\s+do\s+juiz|decisão\s+do\s+juiz|decisao\s+do\s+juiz)\b/gi, subst: 'manifestação e despacho judicial nos autos 🏛️' },
        { padrao: /\b(documentos?)\b/gi, subst: 'documentos pertinentes 📋' }
    ];

    for (const item of dicionarioTermos) {
        texto = texto.replace(item.padrao, item.subst);
    }

    // 2. Cabeçalho e Saudação Elegante
    const temSaudacao = /^(olá|ola|bom dia|boa tarde|boa noite|prezado|prezada|bem-vindo|bem vindo|salve)/i.test(texto);
    let cabecalho = '';
    if (!temSaudacao) {
        cabecalho = '⚖️ *Olá! Seja bem-vindo(a) ao nosso atendimento.* 🏛️\n\n';
    } else if (!texto.includes('⚖️')) {
        texto = '⚖️ ' + texto;
    }

    // 3. Emojis acolhedores se faltarem
    if (!texto.includes('🏛️') && !texto.includes('📋') && !texto.includes('⚖️')) {
        texto = texto + ' ⚖️';
    }

    // 4. Chamada para Ação / Interação (CTA) acolhedora e gentil
    const temAudioOuDoc = /(áudio|audio|documento|fotos?|anexo)/i.test(texto);
    let rodape = '';
    if (!temAudioOuDoc) {
        rodape = '\n\n📲 *Próximos passos:* Se preferir, envie uma mensagem de áudio ou fotos dos seus documentos pertinentes para agilizarmos a análise dos autos. Nossa equipe jurídica segue à sua disposição! 🤝✨';
    } else if (!texto.includes('🤝') && !texto.includes('✨')) {
        rodape = '\n\n📲 Nossa equipe jurídica está atenta ao acompanhamento processual para o pleno resguardo e defesa de seus direitos. 🤝✨';
    }

    let resultadoFinal = (cabecalho + texto + rodape).trim();

    // Assegura menção a termos técnicos essenciais requeridos
    if (!resultadoFinal.includes('autos') && !resultadoFinal.includes('resguardo de direitos') && !resultadoFinal.includes('instrução probatória') && !resultadoFinal.includes('petição inicial')) {
        resultadoFinal = resultadoFinal.replace(/🤝✨$/, 'para o devido *resguardo e defesa de seus direitos*! 🤝✨');
    }

    return resultadoFinal;
}

/**
 * Aprimora uma mensagem jurídica de WhatsApp usando Google Gemini 1.5 Flash
 * com Guardrails Éticos da OAB (Provimento 205/2021) e Fallback Gracioso.
 *
 * @param {string} textoOriginal - Texto original digitado pelo usuário
 * @param {object} [contexto] - Contexto com config, apiKey, timeoutMs, etc.
 * @returns {Promise<{ sucesso: boolean, texto: string, fonte: 'ia' | 'cache' | 'fallback', duracaoMs: number }>}
 */
async function melhorarMensagemComIA(textoOriginal, contexto = {}) {
    const inicio = Date.now();
    const textoLimpo = String(textoOriginal || '').trim();

    if (!textoLimpo) {
        return {
            sucesso: true,
            texto: '',
            fonte: 'fallback',
            duracaoMs: Date.now() - inicio
        };
    }

    carregarCacheDisco();
    const hash = 'melhoria::' + calcularHash(textoLimpo);
    if (cacheEmMemoria.has(hash)) {
        const textoCache = cacheEmMemoria.get(hash);
        return {
            sucesso: true,
            texto: textoCache,
            fonte: 'cache',
            duracaoMs: Date.now() - inicio
        };
    }

    // Resolução robusta da Chave da API
    const apiKey = obterApiKeyAtiva(contexto?.apiKey, contexto?.config);

    // Se chave ausente ou offline -> fallback gracioso local instantâneo
    if (!apiKey) {
        const textoFallback = melhorarMensagemLocalmente(textoLimpo, contexto);
        return {
            sucesso: true,
            texto: textoFallback,
            fonte: 'fallback',
            duracaoMs: Date.now() - inicio
        };
    }

    const timeoutMs = (contexto && contexto.timeoutMs) || TIMEOUT_PADRAO_TEXTO;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const modelosCandidatos = [
        contexto.modelo,
        process.env.GEMINI_MODEL,
        ...MODELOS_GEMINI_PADRAO
    ].filter(Boolean).filter((m, i, arr) => arr.indexOf(m) === i);

    const promptUsuario = `Aprimore a seguinte mensagem jurídica para WhatsApp mantendo termos técnicos acessíveis, emojis adequados e interação gentil com o cliente:\n\n"""\n${textoLimpo}\n"""`;

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [{ text: promptUsuario }]
            }
        ],
        system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM }]
        },
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000
        }
    };

    try {
        let response = null;
        for (const modelo of modelosCandidatos) {
            try {
                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey)}`;
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal
                });
                if (response.ok) break;
                if (![404, 429, 500, 503].includes(response.status)) break;
            } catch (errLoop) {
                if (controller.signal.aborted) break;
            }
        }

        clearTimeout(timeoutId);

        if (response && response.ok) {
            const data = await response.json();
            const parts = data?.candidates?.[0]?.content?.parts || [];
            let textoGerado = parts.map(p => p.text || '').filter(Boolean).join('\n').trim();

            if (textoGerado) {
                textoGerado = textoGerado.replace(/^```(?:\w+)?\s*/i, '').replace(/\s*```$/i, '').trim();
                if (textoGerado.startsWith('"') && textoGerado.endsWith('"') && textoGerado.length > 2) {
                    textoGerado = textoGerado.slice(1, -1).trim();
                }

                cacheEmMemoria.set(hash, textoGerado);
                if (!contexto.desativarPersistencia) {
                    salvarCacheDisco();
                }

                return {
                    sucesso: true,
                    texto: textoGerado,
                    fonte: 'ia',
                    duracaoMs: Date.now() - inicio
                };
            }
        }
    } catch (err) {
        // Ignora e cai no fallback
    } finally {
        clearTimeout(timeoutId);
    }

    const textoFallback = melhorarMensagemLocalmente(textoLimpo, contexto);
    return {
        sucesso: true,
        texto: textoFallback,
        fonte: 'fallback',
        duracaoMs: Date.now() - inicio
    };
}

module.exports = {
    TIMEOUT_PADRAO_TEXTO,
    TIMEOUT_MULTIMODAL_AUDIO,
    MODELOS_GEMINI_PADRAO,
    traduzirAndamentoJuridico,
    traduzirAndamentoParaCliente,
    catalogarPecaProcessual,
    catalogarLocalmente,
    sintetizarDossieProcesso,
    processarAudioECopilot,
    analisarUrgenciaECronologia,
    detectarUrgenciaECronologiaLocal,
    melhorarMensagemComIA,
    melhorarMensagemLocalmente,
    SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM,
    MODELOS_GEMINI_PADRAO,
    calcularHash,
    definirCaminhoCache,
    obterEstatisticasCache,
    limparCacheMemoria,
    SYSTEM_INSTRUCTION_OAB,
    obterApiKeyAtiva
};
