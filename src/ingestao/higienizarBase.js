/**
 * Advocacia Studio Pro v2.0 - Higienizador de Base Local
 * Identifica e remove duplicidades históricas no config.json sem apagar configurações do escritório.
 */

const { normalizarChaveProcesso } = require('./motorIngestao');

/**
 * Higieniza a lista de processos de um objeto config, consolidando duplicidades.
 * Mantém os dados mais recentes, histórico de andamentos e documentos catalogados.
 * @param {Object} config - Configuração completa do escritório
 * @returns {{ configHigienizado: Object, totalOriginal: number, totalFinal: number, duplicatasRemovidas: number }}
 */
function higienizarBaseProcessos(config) {
  if (!config) return { configHigienizado: config, totalOriginal: 0, totalFinal: 0, duplicatasRemovidas: 0 };
  const cfg = JSON.parse(JSON.stringify(config));

  let listaOriginal = [];
  let isArrayRoot = false;
  if (Array.isArray(cfg.processos)) {
    listaOriginal = cfg.processos;
    isArrayRoot = true;
  } else if (cfg.processos && Array.isArray(cfg.processos.lista)) {
    listaOriginal = cfg.processos.lista;
  } else {
    return { configHigienizado: cfg, totalOriginal: 0, totalFinal: 0, duplicatasRemovidas: 0 };
  }

  const totalOriginal = listaOriginal.length;
  const mapaConsolidado = new Map();
  const listaHigienizada = [];

  listaOriginal.forEach((proc, idx) => {
    const num = proc.numero || proc.numeroProcesso || proc.processo || '';
    const cpf = proc.cpf || '';
    const norm = normalizarChaveProcesso(num, cpf);

    // Chave primária preferencial: CNJ limpo, senão CPF limpo + número, senão ID
    let chave = '';
    if (norm.cnjLimpo) {
      chave = `cnj_${norm.cnjLimpo}`;
    } else if (norm.cpfLimpo && num) {
      chave = `cpf_${norm.cpfLimpo}_${num.trim().toLowerCase()}`;
    } else if (norm.cpfLimpo) {
      chave = `cpf_${norm.cpfLimpo}`;
    } else {
      chave = proc.id || `idx_${idx}`;
    }

    if (mapaConsolidado.has(chave)) {
      // Já existe: mescla dados enriquecendo o registro
      const existente = mapaConsolidado.get(chave);

      // Mesclar histórico de andamentos
      const histExistente = Array.isArray(existente.historicoAndamentos) ? existente.historicoAndamentos : [];
      const histProc = Array.isArray(proc.historicoAndamentos) ? proc.historicoAndamentos : [];
      const histCombinado = [...histExistente];
      histProc.forEach(h => {
        if (!histCombinado.some(x => (x.textoBruto || x.resumo) === (h.textoBruto || h.resumo))) {
          histCombinado.push(h);
        }
      });

      // Se havia resumos distintos entre os registros duplicados, preserva no histórico
      if (existente.resumo && !histCombinado.some(x => (x.textoBruto || x.resumo) === existente.resumo)) {
        histCombinado.push({
          data: existente.data || existente.dataAtualizacaoTexto || new Date().toLocaleDateString('pt-BR'),
          textoBruto: existente.resumo,
          timestamp: Date.now()
        });
      }
      if (proc.resumo && !histCombinado.some(x => (x.textoBruto || x.resumo) === proc.resumo)) {
        histCombinado.unshift({
          data: proc.data || proc.dataAtualizacaoTexto || new Date().toLocaleDateString('pt-BR'),
          textoBruto: proc.resumo,
          timestamp: Date.now()
        });
      }

      // Mesclar documentos catalogados
      const docsExistentes = Array.isArray(existente.documentosCatalogados) ? existente.documentosCatalogados : [];
      const docsProc = Array.isArray(proc.documentosCatalogados) ? proc.documentosCatalogados : [];
      const docsCombinados = [...docsExistentes];
      docsProc.forEach(d => {
        if (!docsCombinados.some(x => x.nomeArquivo === d.nomeArquivo)) {
          docsCombinados.push(d);
        }
      });

      // Atualiza com dados mais recentes se disponíveis
      existente.nome = (proc.nome && proc.nome !== 'Cliente') ? proc.nome : existente.nome;
      existente.resumo = proc.resumo || existente.resumo;
      existente.resumoGlobalProcesso = proc.resumoGlobalProcesso || existente.resumoGlobalProcesso || existente.resumo;
      existente.historicoAndamentos = histCombinado;
      existente.documentosCatalogados = docsCombinados;
      existente.consultasPorContato = { ...(existente.consultasPorContato || {}), ...(proc.consultasPorContato || {}) };
    } else {
      const itemClonado = {
        ...proc,
        resumoGlobalProcesso: proc.resumoGlobalProcesso || proc.resumo || '',
        historicoAndamentos: Array.isArray(proc.historicoAndamentos) ? proc.historicoAndamentos : (proc.resumo ? [{
          data: proc.data || proc.dataAtualizacaoTexto || new Date().toLocaleDateString('pt-BR'),
          textoBruto: proc.resumo,
          timestamp: Date.now()
        }] : []),
        documentosCatalogados: Array.isArray(proc.documentosCatalogados) ? proc.documentosCatalogados : []
      };
      mapaConsolidado.set(chave, itemClonado);
      listaHigienizada.push(itemClonado);
    }
  });

  if (isArrayRoot) {
    cfg.processos = listaHigienizada;
  } else {
    cfg.processos.lista = listaHigienizada;
  }

  const totalFinal = listaHigienizada.length;
  const duplicatasRemovidas = totalOriginal - totalFinal;

  return {
    configHigienizado: cfg,
    totalOriginal,
    totalFinal,
    totalHigienizado: totalFinal,
    duplicatasRemovidas
  };
}

module.exports = {
  higienizarBaseProcessos
};
