const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
 */
function salvarCacheDisco() {
    try {
        if (!cacheFilePath) definirCaminhoCache();
        const obj = {};
        for (const [k, v] of cacheEmMemoria.entries()) {
            obj[k] = v;
        }
        fs.writeFileSync(cacheFilePath, JSON.stringify(obj, null, 2), 'utf-8');
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
const MODELOS_GEMINI_PADRAO = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];

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
    const apiKey = opcoes.apiKey || 
                   (opcoes.config && (opcoes.config.gemini_api_key || (opcoes.config.ia && opcoes.config.ia.gemini_api_key))) ||
                   process.env.GEMINI_API_KEY ||
                   '';

    if (!apiKey || !apiKey.trim()) {
        // Fallback instantâneo gracioso (< 5ms)
        return {
            texto: textoLimpo,
            fonte: 'fallback',
            duracaoMs: Date.now() - inicio
        };
    }

    // 3. Chamada REST pura para o Gemini 1.5 Flash com AbortController (timeout 2.8s)
    const timeoutMs = opcoes.timeoutMs || 7000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Cadeia de modelos: o 1.5/2.0 foram descontinuados na API; tenta os atuais em ordem.
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
        resumoIntegrado: textoSintese,
        toString() { return textoSintese; },
        valueOf() { return textoSintese; }
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
 * Processa áudio via Gemini Multimodal e gera transcrição, resumo e 3 sugestões de resposta.
 * Suporta formatos: audio/webm, audio/ogg, audio/mp3, audio/wav.
 */
async function processarAudioECopilot(audioBufferOuBase64, mimeType = 'audio/webm', contextoCliente = {}) {
  const base64Data = Buffer.isBuffer(audioBufferOuBase64)
    ? audioBufferOuBase64.toString('base64')
    : String(audioBufferOuBase64 || '').replace(/^data:audio\/\w+;base64,/, '');

  const apiKey = (contextoCliente && contextoCliente.apiKey) || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      sucesso: false,
      modoLocal: true,
      transcricao: "[Modo Local] Chave Gemini não configurada no .env. Áudio mantido para escuta manual.",
      resumo: "• Áudio recebido aguardando reprodução manual pelo advogado.\n• Nenhuma transcrição automática foi processada.",
      sugestoesResposta: [
        "Olá! Ouvi sua mensagem de áudio e já estou analisando sua situação.",
        "Poderia nos confirmar o seu número de CPF para localizarmos o processo?",
        "Recebido com sucesso. Vamos verificar o andamento e retornaremos em breve."
      ]
    };
  }

  const promptInstrucao = `
Você é o assistente executivo de um escritório de advocacia de elite (em total conformidade com o Código de Ética e Provimento 205/2021 da OAB).
O áudio anexo foi enviado por um cliente que solicitou atendimento humano com o advogado.
Dados de contexto do processo/cliente: ${JSON.stringify(contextoCliente || {})}

Sua tarefa:
1. Transcreva com precisão o que foi falado no áudio.
2. Crie um resumo executivo objetivo em 2 ou 3 tópicos: o que aconteceu e o que o cliente solicita.
3. Elabore exatamente 3 sugestões de resposta rápida para o advogado enviar com 1 clique:
   - Opção 1: Resposta direta e acolhedora esclarecendo o ponto ou confirmando o recebimento com os próximos passos.
   - Opção 2: Proposta de agendamento de chamada ou atendimento presencial/remoto.
   - Opção 3: Solicitação de documentos complementares pertinentes ao relato.

Retorne ESTRITAMENTE um objeto JSON válido (sem blocos markdown adicionais):
{
  "transcricao": "Texto integral...",
  "resumo": "• Tópico 1\\n• Tópico 2",
  "sugestoesResposta": [
    "Sugestão 1...",
    "Sugestão 2...",
    "Sugestão 3..."
  ]
}
`;

  try {
    const modelosCandidatos = [
      process.env.GEMINI_MODEL,
      'gemini-1.5-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash-lite',
      'gemini-flash-lite-latest'
    ].filter(Boolean).filter((m, i, arr) => arr.indexOf(m) === i);

    let data = null;
    let ultimoErro = null;

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
          })
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
      }
    }

    if (!data) {
      throw ultimoErro || new Error("Não foi possível obter resposta de nenhum modelo Gemini multimodal.");
    }

    const jsonTexto = data.candidates[0].content.parts[0].text;
    const resultado = JSON.parse(jsonTexto);
    return {
      sucesso: true,
      transcricao: resultado.transcricao || "Áudio processado.",
      resumo: resultado.resumo || "• Áudio recebido e sintetizado.",
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
      sugestoesResposta: [
        "Olá! Recebi seu áudio e já estou verificando sua solicitação.",
        "Poderia nos resumir o seu pedido por texto enquanto abro sua ficha?",
        "Entendido. Em breve retornaremos com a orientação jurídica necessária."
      ]
    };
  }
}

module.exports = {
    traduzirAndamentoJuridico,
    traduzirAndamentoParaCliente,
    catalogarPecaProcessual,
    catalogarLocalmente,
    sintetizarDossieProcesso,
    processarAudioECopilot,
    MODELOS_GEMINI_PADRAO,
    calcularHash,
    definirCaminhoCache,
    obterEstatisticasCache,
    limparCacheMemoria,
    SYSTEM_INSTRUCTION_OAB
};
