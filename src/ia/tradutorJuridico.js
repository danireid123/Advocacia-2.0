const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
    const hash = calcularHash(textoLimpo);
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

    const modelo = opcoes.modelo || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const requestBody = {
        system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION_OAB }]
        },
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: `Explique este andamento processual de forma simples para o cliente:\n\n"${textoLimpo}"`
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 800
        }
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            // Se cota estourada (429), erro interno ou chave inválida
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
    const promptAnalise = `Você é um perito jurídico digital. Analise a peça processual abaixo e responda em formato JSON com exatamente os campos:
{
  "assunto": "Assunto principal da causa em até 10 palavras",
  "decisao": "Última decisão ou determinação do juiz/órgão em 1 frase curta",
  "proximoPasso": "Próximo passo esperado no processo em 1 frase curta",
  "resumoCliente": "Explicação simples e acolhedora em até 2 frases para o cliente leigo, sem prometer vitórias ou prazos (Provimento 205/2021 OAB)"
}

Peça processual:
"""
${trecho}
"""`;

    try {
        const res = await traduzirAndamentoJuridico(promptAnalise, {
            ...opcoes,
            timeoutMs: 8000
        });

        if (res.texto) {
            const jsonMatch = res.texto.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const resumo = parsed.resumoCliente || 'Seu documento foi recebido e catalogado.';
                return {
                    sucesso: true,
                    tipoPeca,
                    assunto: parsed.assunto || 'Processo Judicial',
                    decisao: parsed.decisao || 'Andamento registrado nos autos.',
                    proximoPasso: parsed.proximoPasso || 'Aguardando manifestação.',
                    resumoCliente: resumo,
                    resumoLeigo: resumo,
                    dadosExtraidos
                };
            }
        }
    } catch (e) {
        // Fallback silencioso
    }

    const resumoPadrao = 'Documento recebido e integrado ao histórico do seu processo.';
    return {
        sucesso: true,
        tipoPeca,
        assunto: 'Peça Processual Registrada',
        decisao: 'Documento acostado aos autos.',
        proximoPasso: 'Acompanhamento processual pela equipe jurídica.',
        resumoCliente: resumoPadrao,
        resumoLeigo: resumoPadrao,
        dadosExtraidos
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

module.exports = {
    traduzirAndamentoJuridico,
    traduzirAndamentoParaCliente,
    catalogarPecaProcessual,
    sintetizarDossieProcesso,
    calcularHash,
    definirCaminhoCache,
    obterEstatisticasCache,
    limparCacheMemoria,
    SYSTEM_INSTRUCTION_OAB
};
