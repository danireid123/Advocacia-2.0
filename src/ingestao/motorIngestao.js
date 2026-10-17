const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
let _pdfParse = null;
function getPdfParser() {
  if (!_pdfParse) {
    try {
      _pdfParse = require('pdf-parse');
    } catch (e) {
      console.warn('[Ingestao] Aviso ao carregar pdf-parse:', e.message);
    }
  }
  return _pdfParse;
}

let _mammoth = null;
function getMammoth() {
  if (!_mammoth) {
    try {
      _mammoth = require('mammoth');
    } catch (e) {
      console.warn('[Ingestao] Aviso ao carregar mammoth:', e.message);
    }
  }
  return _mammoth;
}

/**
 * Matriz de Normalização de Colunas por Sinônimos e Expressões Regulares
 */
const COLUMN_MAPPING_RULES = {
  data: [
    /^(data|dia|atualizado.*em|data.*movimenta|data.*andamento|dt.*mov|dia.*movimenta)/i,
    /data\b/i,
    /dia\b/i,
    /atualizado/i
  ],
  numeroProcesso: [
    /^(num.*processo|numero.*processo|n.*proc|autos|proc(esso)?|processo.*judicial|autos.*judiciais)$/i,
    /processo/i,
    /autos/i,
    /num_processo/i,
    /npu/i,
    /cnj/i
  ],
  cpf: [
    /^(cpf|doc|documento|cpf.*cnpj|cpf_cliente|doc_cliente|identidade)$/i,
    /cpf/i,
    /doc.*cliente/i,
    /documento/i
  ],
  nome: [
    /^(cliente|titular|nome|nome.*cliente|parte.*autora|autor|requerente|interessado)$/i,
    /titular/i,
    /cliente/i,
    /parte.*autora/i,
    /autor/i,
    /nome/i
  ],
  resumo: [
    /^(movimenta[cç][aã]o.*cartor[aá]ria|andamento.*recente|resumo|andamento|status|historico|fase|despacho|decis[aã]o)$/i,
    /cartor[aá]ri/i,
    /andamento/i,
    /movimenta/i,
    /resumo/i,
    /status/i,
    /fase/i
  ]
};

// Expressões regulares para busca de identificadores no texto
const REGEX_PATTERNS = {
  CNJ: /\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b|\b\d{20}\b/g,
  CPF: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|(?<!\d)\d{11}(?!\d)/g,
  DATA: /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g
};

/**
 * Validador de CPF da Receita Federal (Módulo 11)
 * @param {string} cpfRaw
 * @returns {boolean}
 */
function validarCPF(cpfRaw) {
  if (!cpfRaw) return false;
  const clean = String(cpfRaw).replace(/\D/g, '');
  if (clean.length !== 11 || /^(\d)\1{10}$/.test(clean)) return false;

  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(clean.substring(i - 1, i), 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(clean.substring(9, 10), 10)) return false;

  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(clean.substring(i - 1, i), 10) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(clean.substring(10, 11), 10);
}

/**
 * Validador Oficial de Número Processual do CNJ (Módulo 97 Base 10)
 * @param {string} cnjRaw
 * @returns {boolean}
 */
function validarCNJ(cnjRaw) {
  if (!cnjRaw) return false;
  const clean = String(cnjRaw).replace(/\D/g, '');
  if (clean.length !== 20) return false;

  const nup = clean.substring(0, 7);
  const digito = clean.substring(7, 9);
  const ano = clean.substring(9, 13);
  const jud = clean.substring(13, 14);
  const tr = clean.substring(14, 16);
  const origem = clean.substring(16, 20);

  try {
    const calcBase = BigInt(`${nup}${ano}${jud}${tr}${origem}00`);
    const remainder = Number(calcBase % 97n);
    const expectedCheck = 98 - remainder;
    return expectedCheck === parseInt(digito, 10);
  } catch (e) {
    return false;
  }
}

/**
 * Formata CPF para 11 dígitos com máscara padrão ou apenas números
 */
function sanitizarCPF(cpfRaw) {
  if (cpfRaw === null || cpfRaw === undefined) return "";
  const digits = String(cpfRaw).trim().replace(/\D/g, '');
  if (!digits) return "";
  if (digits.length <= 11) {
    return digits.padStart(11, '0');
  }
  return digits;
}

/**
 * Formata Processo no padrão CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO)
 */
function sanitizarNumeroProcesso(procRaw) {
  if (!procRaw) return "";
  const digits = String(procRaw).trim().replace(/\D/g, '');
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }
  return String(procRaw).trim();
}

/**
 * Normaliza datas para ISO YYYY-MM-DD
 */
function sanitizarData(dataRaw) {
  if (!dataRaw) {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  }
  if (dataRaw instanceof Date) {
    return dataRaw.toISOString().split('T')[0];
  }
  const str = String(dataRaw).trim();
  const brMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (brMatch) {
    const dia = brMatch[1].padStart(2, '0');
    const mes = brMatch[2].padStart(2, '0');
    let ano = brMatch[3];
    if (ano.length === 2) ano = `20${ano}`;
    return `${ano}-${mes}-${dia}`;
  }
  return str;
}

/**
 * Detecta correspondência de colunas em planilhas
 */
function mapearColunasPlanilha(headers) {
  const mapa = {
    numeroProcesso: null,
    cpf: null,
    nome: null,
    resumo: null,
    data: null
  };

  const colunasUsadas = new Set();

  for (const [campo, regexList] of Object.entries(COLUMN_MAPPING_RULES)) {
    for (const regex of regexList) {
      if (mapa[campo]) break;
      for (const col of headers) {
        if (!colunasUsadas.has(col) && regex.test(col.trim())) {
          mapa[campo] = col;
          colunasUsadas.add(col);
          break;
        }
      }
    }
  }

  return mapa;
}

/**
 * Parser de Planilhas (.xlsx, .xls, .csv, .ods)
 */
async function parseSpreadsheet(filePathOrBuffer, fileName = 'planilha.xlsx') {
  let workbook;
  if (Buffer.isBuffer(filePathOrBuffer)) {
    workbook = XLSX.read(filePathOrBuffer, { type: 'buffer', cellDates: true, dense: true });
  } else {
    workbook = XLSX.readFile(filePathOrBuffer, { cellDates: true, dense: true });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]);
  const mapa = mapearColunasPlanilha(headers);

  const processos = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let numProc = mapa.numeroProcesso ? row[mapa.numeroProcesso] : "";
    let cpf = mapa.cpf ? row[mapa.cpf] : "";
    let nome = mapa.nome ? row[mapa.nome] : "";
    let resumo = mapa.resumo ? row[mapa.resumo] : "";
    let data = mapa.data ? row[mapa.data] : "";

    // Fallback: busca por conteúdo caso colunas não estejam nomeadas
    if (!numProc || !cpf) {
      for (const val of Object.values(row)) {
        const strVal = String(val).trim();
        const clean = strVal.replace(/\D/g, '');
        if (!numProc && (clean.length === 20 || /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(strVal))) {
          numProc = strVal;
        } else if (!cpf && (clean.length === 11 || /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(strVal))) {
          cpf = strVal;
        }
      }
    }

    if (!numProc && !cpf && !resumo) continue;

    const procSanitizado = sanitizarNumeroProcesso(numProc);
    const cpfSanitizado = sanitizarCPF(cpf);

    processos.push({
      id: `proc_${Date.now()}_${i}`,
      numeroProcesso: procSanitizado,
      cpf: cpfSanitizado,
      nome: String(nome || "Cliente").trim(),
      resumo: String(resumo || "Processo em acompanhamento.").trim(),
      data: sanitizarData(data),
      validoCNJ: validarCNJ(procSanitizado),
      validoCPF: validarCPF(cpfSanitizado),
      origem: {
        tipo: 'PLANILHA',
        arquivo: path.basename(fileName)
      }
    });
  }

  return processos;
}

/**
 * Chunkeador Semântico por Bloco de CNJ para PDFs e Documentos de Tribunais
 * @param {string} fullText
 * @param {string} fileName
 * @returns {Array}
 */
function chunkTextByCNJ(fullText, fileName = 'documento.pdf', tipoOrigem = 'PDF') {
  if (!fullText || typeof fullText !== 'string') return [];

  // Encontra todas as ocorrências de números de processo CNJ
  const matches = [];
  let match;
  const cnjRegex = new RegExp(REGEX_PATTERNS.CNJ.source, 'g');

  while ((match = cnjRegex.exec(fullText)) !== null) {
    matches.push({
      cnjBruto: match[0],
      index: match.index
    });
  }

  const resultados = [];

  // Se nenhum número de processo com formato CNJ for encontrado, procura por CPF e cria um bloco único
  if (matches.length === 0) {
    const cpfsEncontrados = fullText.match(REGEX_PATTERNS.CPF) || [];
    const primeiroCpf = cpfsEncontrados.find(c => validarCPF(c)) || cpfsEncontrados[0] || "";

    if (primeiroCpf || fullText.length > 30) {
      resultados.push({
        id: `doc_${Date.now()}_0`,
        numeroProcesso: "Não informado no documento",
        cpf: sanitizarCPF(primeiroCpf),
        nome: "Cliente Identificado",
        resumo: fullText.slice(0, 500).trim(),
        data: sanitizarData(new Date()),
        validoCNJ: false,
        validoCPF: validarCPF(primeiroCpf),
        origem: {
          tipo: tipoOrigem,
          arquivo: path.basename(fileName)
        }
      });
    }
    return resultados;
  }

  // Segmenta o texto em blocos baseando-se nas posições dos números CNJ
  for (let i = 0; i < matches.length; i++) {
    const atual = matches[i];
    const startIndex = atual.index;
    const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : fullText.length;
    const blocoTexto = fullText.substring(startIndex, endIndex).trim();

    // Extrai CPFs dentro do bloco do processo
    const cpfsNoBloco = blocoTexto.match(REGEX_PATTERNS.CPF) || [];
    let cpfValido = cpfsNoBloco.find(c => validarCPF(c)) || cpfsNoBloco[0] || "";

    // Extrai data mais recente no bloco
    const datasNoBloco = blocoTexto.match(REGEX_PATTERNS.DATA) || [];
    const dataExtraida = datasNoBloco[0] || new Date();

    // Extrai linhas relevantes como resumo
    const linhas = blocoTexto.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 5 && !l.includes(atual.cnjBruto));

    let resumoExtraido = linhas.slice(0, 4).join(' ');
    if (resumoExtraido.length > 350) {
      resumoExtraido = resumoExtraido.slice(0, 347) + '...';
    }

    const cnjSanitizado = sanitizarNumeroProcesso(atual.cnjBruto);
    const cpfSanitizado = sanitizarCPF(cpfValido);

    resultados.push({
      id: `proc_${Date.now()}_${i}`,
      numeroProcesso: cnjSanitizado,
      cpf: cpfSanitizado,
      nome: `Parte do Processo ${cnjSanitizado.slice(-4)}`,
      resumo: resumoExtraido || "Andamento processual registrado no tribunal.",
      data: sanitizarData(dataExtraida),
      validoCNJ: validarCNJ(cnjSanitizado),
      validoCPF: validarCPF(cpfSanitizado),
      origem: {
        tipo: tipoOrigem,
        arquivo: path.basename(fileName)
      }
    });
  }

  return resultados;
}

/**
 * Parser de Documentos PDF (.pdf)
 */
async function parsePdf(filePathOrBuffer, fileName = 'relatorio.pdf') {
  let buffer;
  if (Buffer.isBuffer(filePathOrBuffer)) {
    buffer = filePathOrBuffer;
  } else {
    buffer = await fs.promises.readFile(filePathOrBuffer);
  }

  const pdfParser = getPdfParser();
  if (!pdfParser) {
    throw new Error('Módulo de leitura de PDF indisponível no momento.');
  }

  const data = await pdfParser(buffer);
  const rawText = data.text || '';

  // Verificação de PDF escaneado (sem OCR)
  if (rawText.replace(/\s/g, '').length < 30 && data.numpages > 0) {
    return {
      alerta: 'AVISO_PDF_ESCANEADO',
      mensagem: 'O arquivo PDF parece ser uma digitalização ou imagem sem camada de texto pesquisável (OCR).',
      processos: []
    };
  }

  const processos = chunkTextByCNJ(rawText, fileName, 'PDF');
  return {
    alerta: null,
    processos
  };
}

/**
 * Parser de Documentos Word (.docx)
 */
async function parseDocx(filePathOrBuffer, fileName = 'documento.docx') {
  let buffer;
  if (Buffer.isBuffer(filePathOrBuffer)) {
    buffer = filePathOrBuffer;
  } else {
    buffer = await fs.promises.readFile(filePathOrBuffer);
  }

  const mammothLib = getMammoth();
  if (!mammothLib) {
    throw new Error('Módulo de leitura de DOCX indisponível no momento.');
  }

  const result = await mammothLib.extractRawText({ buffer });
  const rawText = result.value || '';
  const processos = chunkTextByCNJ(rawText, fileName, 'DOCX');
  return processos;
}

/**
 * Parser de Arquivos de Texto (.txt)
 */
async function parseTxt(filePathOrBuffer, fileName = 'documento.txt') {
  let rawText = '';
  if (Buffer.isBuffer(filePathOrBuffer)) {
    rawText = filePathOrBuffer.toString('utf-8');
  } else {
    rawText = await fs.promises.readFile(filePathOrBuffer, 'utf-8');
  }

  return chunkTextByCNJ(rawText, fileName, 'TXT');
}

/**
 * Motor Unificado de Ingestão: Roteia para o parser correto pelo tipo de arquivo
 * @param {string|Buffer} source
 * @param {string} fileName
 * @returns {Promise<{success: boolean, processos: Array, total: number, validosCNJ: number, validosCPF: number, alerta?: string}>}
 */
async function processarArquivoIngestao(source, fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  let lista = [];
  let alerta = null;

  try {
    switch (ext) {
      case '.xlsx':
      case '.xls':
      case '.csv':
      case '.ods':
        lista = await parseSpreadsheet(source, fileName);
        break;
      case '.pdf': {
        const res = await parsePdf(source, fileName);
        if (res.alerta) alerta = res.mensagem;
        lista = res.processos || [];
        break;
      }
      case '.docx':
        lista = await parseDocx(source, fileName);
        break;
      case '.txt':
      case '.log':
        lista = await parseTxt(source, fileName);
        break;
      default:
        throw new Error(`Extensão ${ext} não é suportada. Use XLSX, CSV, PDF, DOCX ou TXT.`);
    }

    const validosCNJ = lista.filter(p => p.validoCNJ).length;
    const validosCPF = lista.filter(p => p.validoCPF).length;

    return {
      success: true,
      processos: lista,
      total: lista.length,
      validosCNJ,
      validosCPF,
      alerta
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      processos: [],
      total: 0
    };
  }
}

/**
 * Normaliza número de processo e CPF para identificadores limpos e seguros
 */
function normalizarChaveProcesso(numeroProcesso, cpf) {
  const cnjLimpo = String(numeroProcesso || '').replace(/\D/g, '');
  const cpfLimpo = String(cpf || '').replace(/\D/g, '');
  const cnjValido = cnjLimpo.length >= 10 ? cnjLimpo : '';
  const cpfValido = cpfLimpo.length >= 11 ? cpfLimpo.slice(-11) : (cpfLimpo.length >= 5 ? cpfLimpo : '');
  const chaveStr = cnjValido ? `cnj_${cnjValido}` : (cpfValido ? `cpf_${cpfValido}` : '');
  return {
    cnjLimpo: cnjValido,
    cpfLimpo: cpfValido,
    chave: chaveStr,
    toString() { return chaveStr; },
    valueOf() { return chaveStr; }
  };
}

/**
 * Converte a lista extraída para a estrutura oficial do config.json (compatível v1.8 e v2.0)
 * Realiza Upsert e Deduplicação Inteligente:
 * - Mescla por CNJ idêntico (20 dígitos ou dígitos limpos)
 * - Mescla por CPF + Processo coincidente
 * - Mescla por ID se fornecido
 * - Preserva histórico de andamentos e documentos catalogados
 * @param {Array} novosProcessos
 * @param {Object} configAtual
 * @returns {Object}
 */
function mesclarComConfigAtual(novosProcessos, configAtual = {}) {
  const cfg = JSON.parse(JSON.stringify(configAtual));
  let listaRef;
  if (Array.isArray(cfg.processos)) {
    listaRef = cfg.processos;
  } else {
    if (!cfg.processos) cfg.processos = { lista: [] };
    if (!Array.isArray(cfg.processos.lista)) cfg.processos.lista = [];
    listaRef = cfg.processos.lista;
  }

  let adicionados = 0;
  let atualizados = 0;

  novosProcessos.forEach((novo, i) => {
    const numNovo = novo.numero || novo.numeroProcesso || '';
    const cpfNovo = novo.cpf || '';
    const normNovo = normalizarChaveProcesso(numNovo, cpfNovo);

    // Encontra registro existente na base atual por múltiplos critérios de equivalência
    const idxExistente = listaRef.findIndex((p, pIdx) => {
      if (novo.id && p.id && novo.id === p.id) return true;
      const numExistente = p.numero || p.numeroProcesso || p.processo || '';
      const cpfExistente = p.cpf || '';
      const normExistente = normalizarChaveProcesso(numExistente, cpfExistente);

      // Critério 1: CNJ idêntico (se ambos tiverem ao menos 10 dígitos)
      if (normNovo.cnjLimpo && normExistente.cnjLimpo && normNovo.cnjLimpo === normExistente.cnjLimpo) {
        return true;
      }

      // Critério 2: Mesmo CPF e mesmo número de processo
      if (normNovo.cpfLimpo && normExistente.cpfLimpo && normNovo.cpfLimpo === normExistente.cpfLimpo) {
        if (normNovo.cnjLimpo && normExistente.cnjLimpo && normNovo.cnjLimpo === normExistente.cnjLimpo) {
          return true;
        }
        // Se ambos têm o mesmo CPF e o número é idêntico em string
        if (numNovo && numExistente && numNovo.trim().toLowerCase() === numExistente.trim().toLowerCase()) {
          return true;
        }
      }

      return false;
    });

    const dataAtual = novo.data || new Date().toLocaleDateString('pt-BR');
    const agoraIso = new Date().toISOString();
    const cnjFormatado = sanitizarNumeroProcesso(numNovo);
    const cpfFormatado = sanitizarCPF(cpfNovo);

    if (idxExistente !== -1) {
      // ATUALIZAÇÃO (MERGE / UPSERT PRESERVANDO DADOS EXISTENTES)
      const existente = listaRef[idxExistente];
      const historicoAnterior = Array.isArray(existente.historicoAndamentos) ? existente.historicoAndamentos : [];
      const docsAnteriores = Array.isArray(existente.documentosCatalogados) ? existente.documentosCatalogados : [];

      const novoAndamentoTexto = novo.resumo || novo.andamento || '';
      const historicoAtualizado = [...historicoAnterior];
      if (novoAndamentoTexto && !historicoAtualizado.some(h => (h.textoBruto || h.resumo) === novoAndamentoTexto)) {
        historicoAtualizado.unshift({
          data: dataAtual,
          textoBruto: novoAndamentoTexto,
          textoHumanizado: novo.resumoHumanizado || '',
          timestamp: Date.now()
        });
      }

      const docsNovos = Array.isArray(novo.documentosCatalogados) ? novo.documentosCatalogados : [];
      const docsAtualizados = [...docsAnteriores];
      docsNovos.forEach(docNovo => {
        if (!docsAtualizados.some(d => d.nomeArquivo === docNovo.nomeArquivo)) {
          docsAtualizados.push(docNovo);
        }
      });

      listaRef[idxExistente] = {
        ...existente,
        nome: novo.nome && novo.nome !== 'Cliente' ? novo.nome : (existente.nome || 'Cliente'),
        cpf: cpfFormatado || existente.cpf || '',
        numero: cnjFormatado || existente.numero || existente.numeroProcesso || '',
        numeroProcesso: cnjFormatado || existente.numeroProcesso || existente.numero || '',
        numeroProcessoFormatado: cnjFormatado || existente.numeroProcessoFormatado || '',
        resumo: novoAndamentoTexto || existente.resumo || '',
        resumoGlobalProcesso: novo.resumoGlobalProcesso || existente.resumoGlobalProcesso || novoAndamentoTexto || existente.resumo || '',
        temAtualizacao: novo.temAtualizacao !== undefined ? novo.temAtualizacao : true,
        data: dataAtual,
        dataAtualizacaoTexto: dataAtual,
        updatedAt: Date.now(),
        origem: novo.origem || existente.origem || { tipo: "IMPORTADO", arquivo: "multi" },
        historicoAndamentos: historicoAtualizado,
        documentosCatalogados: docsAtualizados,
        _resetarVistos: true
      };
      atualizados++;
    } else {
      // INSERÇÃO DE NOVO PROCESSO COM SCHEMA EXPANDIDO v2.0
      const novoId = novo.id || `proc_${Date.now()}_${i}`;
      const novoAndamentoTexto = novo.resumo || novo.andamento || '';
      const itemFormatado = {
        id: novoId,
        nome: novo.nome || "Cliente",
        cpf: cpfFormatado || '',
        numero: cnjFormatado || numNovo,
        numeroProcesso: cnjFormatado || numNovo,
        numeroProcessoFormatado: cnjFormatado || numNovo,
        resumo: novoAndamentoTexto,
        resumoGlobalProcesso: novo.resumoGlobalProcesso || novoAndamentoTexto || '',
        temAtualizacao: novo.temAtualizacao !== undefined ? novo.temAtualizacao : true,
        data: dataAtual,
        dataAtualizacaoTexto: dataAtual,
        createdAt: agoraIso,
        updatedAt: Date.now(),
        consultasPorContato: {},
        _resetarVistos: true,
        origem: novo.origem || { tipo: "IMPORTADO", arquivo: "multi" },
        dadosCadastrais: novo.dadosCadastrais || { vara: "", comarca: "" },
        documentosCatalogados: Array.isArray(novo.documentosCatalogados) ? novo.documentosCatalogados : [],
        historicoAndamentos: novoAndamentoTexto ? [
          {
            data: dataAtual,
            textoBruto: novoAndamentoTexto,
            textoHumanizado: novo.resumoHumanizado || '',
            timestamp: Date.now()
          }
        ] : []
      };

      listaRef.push(itemFormatado);
      adicionados++;
    }
  });

  return {
    configAtualizado: cfg,
    adicionados,
    atualizados,
    totalProcessosNaBase: listaRef.length
  };
}

/**
 * Processa múltiplos arquivos de uma só vez e calcula métricas comparando com o config atual
 * @param {Array<string>} filePaths
 * @param {Object} configAtual
 * @returns {Promise<{processos: Array, novos: number, atualizados: number, total: number, validosCNJ: number, validosCPF: number, alerta?: string}>}
 */
async function processarMultiplosArquivos(filePaths, configAtual = {}) {
  let acumulado = [];
  let alertaGeral = null;

  for (const caminho of filePaths) {
    if (!caminho || typeof caminho !== 'string') continue;
    const res = await processarArquivoIngestao(caminho, path.basename(caminho));
    if (res.success && Array.isArray(res.processos)) {
      acumulado = acumulado.concat(res.processos);
      if (res.alerta) alertaGeral = res.alerta;
    }
  }

  let listaExistentes = [];
  if (configAtual && configAtual.processos) {
    if (Array.isArray(configAtual.processos)) {
      listaExistentes = configAtual.processos;
    } else if (Array.isArray(configAtual.processos.lista)) {
      listaExistentes = configAtual.processos.lista;
    }
  }

  let novos = 0;
  let atualizados = 0;

  acumulado.forEach(novo => {
    const normNovo = normalizarChaveProcesso(novo.numeroProcesso || novo.numero, novo.cpf);
    const existe = listaExistentes.some(p => {
      const normP = normalizarChaveProcesso(p.numeroProcesso || p.processo || p.numero, p.cpf);
      if (normNovo.cnjLimpo && normP.cnjLimpo && normNovo.cnjLimpo === normP.cnjLimpo) return true;
      if (normNovo.cpfLimpo && normP.cpfLimpo && normNovo.cpfLimpo === normP.cpfLimpo) {
        if (normNovo.cnjLimpo && normP.cnjLimpo && normNovo.cnjLimpo === normP.cnjLimpo) return true;
      }
      return false;
    });

    if (existe) {
      atualizados++;
    } else {
      novos++;
    }
  });

  const validosCNJ = acumulado.filter(p => p.validoCNJ).length;
  const validosCPF = acumulado.filter(p => p.validoCPF).length;

  return {
    sucesso: true,
    processos: acumulado,
    novos,
    atualizados,
    erros: 0,
    total: acumulado.length,
    totalProcessosEncontrados: acumulado.length,
    validosCNJ,
    validosCPF,
    alerta: alertaGeral
  };
}

// Alias de mesclagem para compatibilidade total
function mesclarComConfig(configAtual, novosProcessos) {
  const { configAtualizado } = mesclarComConfigAtual(novosProcessos, configAtual);
  return configAtualizado;
}

module.exports = {
  validarCPF,
  validarCNJ,
  sanitizarCPF,
  sanitizarNumeroProcesso,
  normalizarChaveProcesso,
  sanitizarData,
  mapearColunasPlanilha,
  parseSpreadsheet,
  parsePdf,
  parseDocx,
  parseTxt,
  chunkTextByCNJ,
  processarArquivoIngestao,
  processarMultiplosArquivos,
  mesclarComConfigAtual,
  mesclarComConfig,
  COLUMN_MAPPING_RULES
};

