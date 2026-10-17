const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

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

  const data = await pdfParse(buffer);
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

  const result = await mammoth.extractRawText({ buffer });
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
 * Converte a lista extraída para a estrutura oficial do config.json (compatível v1.8 e v2.0)
 * @param {Array} novosProcessos
 * @param {Object} configAtual
 * @returns {Object}
 */
function mesclarComConfigAtual(novosProcessos, configAtual = {}) {
  const cfg = JSON.parse(JSON.stringify(configAtual));
  if (!cfg.processos) cfg.processos = { lista: [] };
  if (!Array.isArray(cfg.processos.lista)) cfg.processos.lista = [];

  const mapaExistentes = new Map();
  cfg.processos.lista.forEach((p, idx) => {
    const chave = p.processo || p.numeroProcesso || `idx_${idx}`;
    mapaExistentes.set(chave, idx);
  });

  let adicionados = 0;
  let atualizados = 0;

  novosProcessos.forEach((novo, i) => {
    const procKey = novo.numeroProcesso;
    const itemFormatado = {
      id: novo.id || `proc_${Date.now()}_${i}`,
      processo: novo.numeroProcesso,
      cpf: novo.cpf,
      nome: novo.nome || "Cliente",
      resumo: novo.resumo,
      data: novo.data,
      ultima_consulta: "",
      origem: novo.origem || { tipo: "IMPORTADO", arquivo: "manual" }
    };

    if (procKey && mapaExistentes.has(procKey)) {
      const idx = mapaExistentes.get(procKey);
      cfg.processos.lista[idx] = {
        ...cfg.processos.lista[idx],
        ...itemFormatado,
        id: cfg.processos.lista[idx].id // preserva ID original
      };
      atualizados++;
    } else {
      cfg.processos.lista.push(itemFormatado);
      if (procKey) mapaExistentes.set(procKey, cfg.processos.lista.length - 1);
      adicionados++;
    }
  });

  return {
    configAtualizado: cfg,
    adicionados,
    atualizados,
    totalProcessosNaBase: cfg.processos.lista.length
  };
}

module.exports = {
  validarCPF,
  validarCNJ,
  sanitizarCPF,
  sanitizarNumeroProcesso,
  sanitizarData,
  mapearColunasPlanilha,
  parseSpreadsheet,
  parsePdf,
  parseDocx,
  parseTxt,
  chunkTextByCNJ,
  processarArquivoIngestao,
  mesclarComConfigAtual,
  COLUMN_MAPPING_RULES
};
