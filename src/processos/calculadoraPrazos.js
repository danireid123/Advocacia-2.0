'use strict';

/**
 * Calculadora Nativa de Prazos Processuais (CPC e CLT) — 100% Determinística (Node.js Puro)
 *
 * Regras implementadas:
 * - Art. 219, Art. 220 e Art. 224 do CPC (Lei 13.105/2015)
 * - Art. 775 e Art. 775-A da CLT (Redação da Lei 13.467/2017)
 * - Lei 11.419/2006, Art. 4º, §§ 3º e 4º (Disponibilização no DJEN vs Publicação)
 * - Feriados nacionais fixos (inclui 20/11 — Consciência Negra, Lei 14.759/2023)
 * - Feriados móveis dinâmicos via algoritmo da Páscoa (Carnaval Seg/Ter, Sexta-Feira Santa, Corpus Christi)
 * - Suspensão automática do Recesso Forense: 20/12 a 20/01 inclusive
 * - Suporte a feriados locais (DD/MM/YYYY ou YYYY-MM-DD)
 */

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function criarData(ano, mes, dia) {
  // Meio-dia local para imunidade contra horário de verão e deslocamentos UTC
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0);
}

function adicionarDias(data, qtdDias) {
  const nova = new Date(data.getFullYear(), data.getMonth(), data.getDate() + qtdDias, 12, 0, 0, 0);
  return nova;
}

function formatarDataISO(data) {
  return `${data.getFullYear()}-${pad2(data.getMonth() + 1)}-${pad2(data.getDate())}`;
}

function formatarDataBR(data) {
  return `${pad2(data.getDate())}/${pad2(data.getMonth() + 1)}/${data.getFullYear()}`;
}

function parseDataLocal(valor) {
  if (!valor) return null;
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return null;
    return criarData(valor.getFullYear(), valor.getMonth() + 1, valor.getDate());
  }

  const texto = String(valor).trim();
  if (!texto) return null;

  // Formato ISO: YYYY-MM-DD (aceita timestamp YYYY-MM-DDTHH:mm...)
  const matchISO = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (matchISO) {
    const ano = Number(matchISO[1]);
    const mes = Number(matchISO[2]);
    const dia = Number(matchISO[3]);
    const dt = criarData(ano, mes, dia);
    if (dt.getFullYear() === ano && dt.getMonth() + 1 === mes && dt.getDate() === dia) {
      return dt;
    }
    return null;
  }

  // Formato BR: DD/MM/YYYY
  const matchBR = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (matchBR) {
    const dia = Number(matchBR[1]);
    const mes = Number(matchBR[2]);
    const ano = Number(matchBR[3]);
    const dt = criarData(ano, mes, dia);
    if (dt.getFullYear() === ano && dt.getMonth() + 1 === mes && dt.getDate() === dia) {
      return dt;
    }
    return null;
  }

  return null;
}

/**
 * Algoritmo Gregoriano (Meeus/Jones/Butcher) para o Domingo de Páscoa de qualquer ano.
 */
function calcularPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return criarData(ano, mes, dia);
}

const cacheFeriadosPorAno = new Map();

/**
 * Retorna um Map<YYYY-MM-DD, nomeDoFeriado> com todos os feriados nacionais
 * fixos e móveis para o ano informado.
 */
function obterFeriadosNacionais(ano) {
  if (cacheFeriadosPorAno.has(ano)) {
    return cacheFeriadosPorAno.get(ano);
  }

  const mapa = new Map();
  const registrar = (dt, nome) => {
    mapa.set(formatarDataISO(dt), nome);
  };

  // Feriados nacionais fixos
  registrar(criarData(ano, 1, 1), 'Confraternização Universal');
  registrar(criarData(ano, 4, 21), 'Tiradentes');
  registrar(criarData(ano, 5, 1), 'Dia do Trabalho');
  registrar(criarData(ano, 9, 7), 'Independência do Brasil');
  registrar(criarData(ano, 10, 12), 'Nossa Senhora Aparecida');
  registrar(criarData(ano, 11, 2), 'Finados');
  registrar(criarData(ano, 11, 15), 'Proclamação da República');
  registrar(criarData(ano, 11, 20), 'Dia da Consciência Negra');
  registrar(criarData(ano, 12, 25), 'Natal');

  // Feriados móveis calculados a partir da Páscoa
  const pascoa = calcularPascoa(ano);
  registrar(adicionarDias(pascoa, -48), 'Segunda-feira de Carnaval');
  registrar(adicionarDias(pascoa, -47), 'Terça-feira de Carnaval');
  registrar(adicionarDias(pascoa, -2), 'Sexta-feira Santa');
  registrar(adicionarDias(pascoa, 60), 'Corpus Christi');

  cacheFeriadosPorAno.set(ano, mapa);
  return mapa;
}

/**
 * Verifica se a data está dentro do Recesso Forense (20/12 a 20/01 inclusive),
 * conforme Art. 220 do CPC e Art. 775-A da CLT.
 */
function isRecessoForense(data) {
  const mes = data.getMonth() + 1;
  const dia = data.getDate();
  return (mes === 12 && dia >= 20) || (mes === 1 && dia <= 20);
}

/**
 * Normaliza o parâmetro feriadosLocais (array ou string separada por vírgula/quebra de linha)
 * em um Map<YYYY-MM-DD, descricao>.
 */
function normalizarFeriadosLocais(feriadosLocais) {
  const mapa = new Map();
  if (!feriadosLocais) return mapa;

  let itens = [];
  if (Array.isArray(feriadosLocais)) {
    itens = feriadosLocais;
  } else if (typeof feriadosLocais === 'string') {
    itens = feriadosLocais.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  }

  for (const item of itens) {
    if (!item) continue;
    if (typeof item === 'object' && item.data) {
      const dt = parseDataLocal(item.data);
      if (dt) mapa.set(formatarDataISO(dt), item.descricao || 'Feriado Local');
    } else {
      const dt = parseDataLocal(item);
      if (dt) mapa.set(formatarDataISO(dt), 'Feriado Local');
    }
  }

  return mapa;
}

/**
 * Avalia se uma data é dia útil forense.
 * Retorna { util: boolean, motivo: string|null, categoria: string|null }.
 */
function verificarDiaUtil(data, mapaFeriadosLocais = new Map()) {
  const iso = formatarDataISO(data);
  const dow = data.getDay();

  // Recesso forense (20/12 a 20/01) suspende prazos processuais (Art. 220 CPC / Art. 775-A CLT)
  if (isRecessoForense(data)) {
    const feriadosNac = obterFeriadosNacionais(data.getFullYear());
    const feriadoNoRecesso = feriadosNac.get(iso);
    const motivo = feriadoNoRecesso
      ? `Recesso Forense (Art. 220 CPC / 775-A CLT) • ${feriadoNoRecesso}`
      : 'Recesso Forense (20/12 a 20/01 — Art. 220 CPC / 775-A CLT)';
    return { util: false, motivo, categoria: 'recessoForense' };
  }

  // Fim de semana
  if (dow === 0 || dow === 6) {
    return {
      util: false,
      motivo: dow === 0 ? 'Domingo' : 'Sábado',
      categoria: 'finsDeSemana'
    };
  }

  // Feriado nacional (fixo ou móvel)
  const feriadosNac = obterFeriadosNacionais(data.getFullYear());
  if (feriadosNac.has(iso)) {
    return {
      util: false,
      motivo: `Feriado Nacional (${feriadosNac.get(iso)})`,
      categoria: 'feriadosNacionais'
    };
  }

  // Feriado local informado pelo escritório
  if (mapaFeriadosLocais && mapaFeriadosLocais.has(iso)) {
    return {
      util: false,
      motivo: mapaFeriadosLocais.get(iso) || 'Feriado Local',
      categoria: 'feriadosLocais'
    };
  }

  return { util: true, motivo: null, categoria: null };
}

function isDiaUtil(data, feriadosLocais = []) {
  const dt = parseDataLocal(data);
  if (!dt) return false;
  const mapaLocais = feriadosLocais instanceof Map ? feriadosLocais : normalizarFeriadosLocais(feriadosLocais);
  return verificarDiaUtil(dt, mapaLocais).util;
}

/**
 * Avança a partir de `dataBase + 1 dia` até encontrar o próximo dia útil,
 * registrando quaisquer dias não úteis pulados no trajeto.
 */
function proximoDiaUtilApos(dataBase, mapaFeriadosLocais, diasPulados, fase) {
  let cursor = adicionarDias(dataBase, 1);
  let guarda = 0;
  while (guarda < 400) {
    guarda++;
    const check = verificarDiaUtil(cursor, mapaFeriadosLocais);
    if (check.util) {
      return cursor;
    }
    diasPulados.push({
      data: formatarDataBR(cursor),
      dataISO: formatarDataISO(cursor),
      diaSemana: DIAS_SEMANA[cursor.getDay()],
      motivo: check.motivo,
      categoria: check.categoria,
      fase
    });
    cursor = adicionarDias(cursor, 1);
  }
  throw new Error('Não foi possível localizar próximo dia útil dentro do limite de segurança.');
}

/**
 * Calcula o prazo processual em dias úteis segundo o CPC ou a CLT.
 *
 * @param {Object} params
 * @param {string|Date} params.dataDisponibilizacao - Data da disponibilização no DJEN ou da publicação/intimação (DD/MM/YYYY ou YYYY-MM-DD)
 * @param {'CPC'|'CLT'} [params.rito='CPC'] - Rito processual
 * @param {number} params.dias - Quantidade de dias úteis do prazo
 * @param {'disponibilizacao'|'publicacao'} [params.eventoInicial='disponibilizacao'] - Se a data é Disponibilização no DJEN ou Publicação/Intimação
 * @param {Array<string>|string} [params.feriadosLocais=[]] - Feriados locais adicionais (DD/MM/YYYY ou YYYY-MM-DD)
 */
function calcularPrazoProcessual({
  dataDisponibilizacao,
  rito = 'CPC',
  dias,
  eventoInicial = 'disponibilizacao',
  feriadosLocais = []
} = {}) {
  const dataBase = parseDataLocal(dataDisponibilizacao);
  if (!dataBase) {
    throw new Error('Data inicial inválida. Informe no formato DD/MM/YYYY ou YYYY-MM-DD.');
  }

  const diasInt = Number(dias);
  if (!Number.isInteger(diasInt) || diasInt <= 0 || diasInt > 1000) {
    throw new Error('A quantidade de dias úteis deve ser um número inteiro positivo (entre 1 e 1000).');
  }

  const ritoStr = String(rito || 'CPC').trim().toUpperCase();
  const ritoNormalizado = ritoStr.includes('CLT') || ritoStr.includes('TRAB') ? 'CLT' : 'CPC';

  const eventoStr = String(eventoInicial || 'disponibilizacao')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
  const modoEvento = (eventoStr.includes('pub') || eventoStr.includes('intim'))
    ? 'publicacao'
    : 'disponibilizacao';

  const mapaFeriadosLocais = normalizarFeriadosLocais(feriadosLocais);
  const diasPulados = [];

  let dataDisp = null;
  let dataPublicacao = null;

  if (modoEvento === 'disponibilizacao') {
    dataDisp = dataBase;
    // Art. 224, § 2º CPC / Art. 4º, § 3º Lei 11.419/2006: publicação no 1º dia útil seguinte à disponibilização
    dataPublicacao = proximoDiaUtilApos(dataDisp, mapaFeriadosLocais, diasPulados, 'entre_disponibilizacao_e_publicacao');
  } else {
    dataPublicacao = dataBase;
  }

  // Art. 224, § 3º CPC / Art. 775 CLT: início da contagem no 1º dia útil seguinte à publicação/intimação
  const dataInicioContagem = proximoDiaUtilApos(dataPublicacao, mapaFeriadosLocais, diasPulados, 'antes_do_inicio');

  // Contagem em dias úteis (Dia 1 = dataInicioContagem)
  let contados = 1;
  let cursor = dataInicioContagem;
  let guarda = 0;

  while (contados < diasInt) {
    guarda++;
    if (guarda > 4000) {
      throw new Error('Limite de iteração excedido ao calcular prazo processual.');
    }
    cursor = adicionarDias(cursor, 1);
    const check = verificarDiaUtil(cursor, mapaFeriadosLocais);
    if (check.util) {
      contados++;
    } else {
      diasPulados.push({
        data: formatarDataBR(cursor),
        dataISO: formatarDataISO(cursor),
        diaSemana: DIAS_SEMANA[cursor.getDay()],
        motivo: check.motivo,
        categoria: check.categoria,
        fase: 'durante_contagem'
      });
    }
  }

  const dataFinal = cursor;

  const resumoDiasPulados = {
    finsDeSemana: 0,
    feriadosNacionais: 0,
    recessoForense: 0,
    feriadosLocais: 0,
    total: diasPulados.length
  };

  for (const dp of diasPulados) {
    if (dp.categoria && Object.prototype.hasOwnProperty.call(resumoDiasPulados, dp.categoria)) {
      resumoDiasPulados[dp.categoria]++;
    }
  }

  const msPorDia = 24 * 60 * 60 * 1000;
  const totalDiasCorridos = Math.round((dataFinal.getTime() - dataBase.getTime()) / msPorDia);

  return {
    sucesso: true,
    rito: ritoNormalizado,
    fundamentoLegal: ritoNormalizado === 'CLT'
      ? 'Art. 775 e Art. 775-A da CLT (dias úteis e recesso 20/12 a 20/01)'
      : 'Art. 219, Art. 220 e Art. 224 do CPC (dias úteis e recesso 20/12 a 20/01)',
    eventoInicial: modoEvento,
    diasUteisSolicitados: diasInt,
    dataDisponibilizacao: dataDisp ? formatarDataBR(dataDisp) : null,
    dataDisponibilizacaoISO: dataDisp ? formatarDataISO(dataDisp) : null,
    dataPublicacao: formatarDataBR(dataPublicacao),
    dataPublicacaoISO: formatarDataISO(dataPublicacao),
    dataInicioContagem: formatarDataBR(dataInicioContagem),
    dataInicioContagemISO: formatarDataISO(dataInicioContagem),
    dataFinal: formatarDataBR(dataFinal),
    dataFinalISO: formatarDataISO(dataFinal),
    diaSemanaFinal: DIAS_SEMANA[dataFinal.getDay()],
    totalDiasCorridos,
    diasPulados,
    resumoDiasPulados,
    houveRecessoForense: resumoDiasPulados.recessoForense > 0
  };
}

module.exports = {
  calcularPrazoProcessual,
  calcularPascoa,
  obterFeriadosNacionais,
  isRecessoForense,
  isDiaUtil,
  verificarDiaUtil,
  parseDataLocal,
  formatarDataBR,
  formatarDataISO
};
