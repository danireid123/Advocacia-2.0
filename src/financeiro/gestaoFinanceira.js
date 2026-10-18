/**
 * =========================================================================
 * ADVOCACIA STUDIO PRO v2.0 - MOTOR FINANCEIRO & RÉGUA DE COBRANÇA PIX
 * =========================================================================
 * Gerencia contratos, parcelas de honorários, filtro semanal de cobrança,
 * geração de mensagens PIX Copia-e-Cola com delay anti-ban e liquidação
 * automática via leitura multimodal de comprovantes.
 */

const { auditarComprovantePix } = require('./validadorComprovantePix');

const MAPA_DIAS_SEMANA = {
    0: 'DOMINGO',
    1: 'SEGUNDA',
    2: 'TERCA',
    3: 'QUARTA',
    4: 'QUINTA',
    5: 'SEXTA',
    6: 'SABADO'
};

function normalizarDiaSemana(dia) {
    if (!dia) return '';
    return String(dia)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/-FEIRA/g, '')
        .trim();
}

function apenasNumeros(str) {
    return String(str || '').replace(/\D/g, '');
}

function formatarMoedaBR(valor) {
    const num = Number(valor || 0);
    if (isNaN(num)) return '0,00';
    return num.toFixed(2).replace('.', ',');
}

function garantirEstruturaFinanceira(config) {
    if (!config || typeof config !== 'object') return;
    if (!config.configuracaoCobranca || typeof config.configuracaoCobranca !== 'object') {
        config.configuracaoCobranca = {
            chavePix: 'pix@escritorio.adv.br',
            tipoChave: 'E-MAIL',
            beneficiario: 'Advocacia Studio Pro',
            frequenciaSemanal: 2,
            diasDaSemana: ['TERCA', 'QUINTA'],
            horarioEnvio: '09:30',
            delayMinimoSegundos: 15,
            delayMaximoSegundos: 30,
            modoAprovacao: 'MANUAL_ADVOGADO'
        };
    }
    if (!Array.isArray(config.configuracaoCobranca.diasDaSemana)) {
        config.configuracaoCobranca.diasDaSemana = ['TERCA', 'QUINTA'];
    }
    if (!config.financeiro || typeof config.financeiro !== 'object') {
        config.financeiro = {
            contratos: [],
            parcelas: [],
            comprovantesRecebidos: []
        };
    }
    if (!Array.isArray(config.financeiro.parcelas)) config.financeiro.parcelas = [];
    if (!Array.isArray(config.financeiro.contratos)) config.financeiro.contratos = [];
    if (!Array.isArray(config.financeiro.comprovantesRecebidos)) config.financeiro.comprovantesRecebidos = [];
}

/**
 * Filtra as parcelas elegíveis para cobrança na data de referência,
 * respeitando a frequência semanal e os dias da semana configurados.
 */
function filtrarParcelasElegiveis(config, dataReferencia = null, ignorarDiaSemana = false) {
    if (!config || typeof config !== 'object') return [];
    garantirEstruturaFinanceira(config);

    const cfgCob = config.configuracaoCobranca;
    const parcelas = config.financeiro.parcelas || [];

    if (!ignorarDiaSemana && dataReferencia) {
        const dt = dataReferencia instanceof Date ? dataReferencia : new Date(dataReferencia);
        if (!isNaN(dt.getTime())) {
            const indiceDia = dt.getUTCDay();
            const nomeDiaHoje = MAPA_DIAS_SEMANA[indiceDia];
            const diasConfigurados = (cfgCob.diasDaSemana || []).map(normalizarDiaSemana);
            if (diasConfigurados.length > 0 && !diasConfigurados.includes(nomeDiaHoje)) {
                return [];
            }
        }
    }

    const freqMaxima = Number(cfgCob.frequenciaSemanal || 2);

    return parcelas.filter(p => {
        if (!p || typeof p !== 'object') return false;
        const status = String(p.status || 'PENDENTE').toUpperCase();
        if (status === 'PAGO' || status === 'QUITADO' || status === 'CANCELADO') return false;

        const cobrancasSemana = Number(p.cobrancasNaSemana || 0);
        if (freqMaxima > 0 && cobrancasSemana >= freqMaxima) return false;

        return true;
    });
}

/**
 * Gera mensagem cordial e personalizada de cobrança com chave PIX Copia-e-Cola.
 */
function gerarMensagemCobrancaPix(parcela, config = {}) {
    const p = parcela || {};
    const cfgCob = (config && config.configuracaoCobranca) ? config.configuracaoCobranca : {};

    const nomeCliente = (p.clienteNome || p.nome || 'Cliente').toString().trim();
    const valorFormatado = formatarMoedaBR(p.valor);
    const vencimento = (p.vencimento || 'em aberto').toString().trim();
    const chavePix = (cfgCob.chavePix || 'pix@escritorio.adv.br').toString().trim();
    const tipoChave = (cfgCob.tipoChave || 'PIX').toString().trim();
    const beneficiario = (cfgCob.beneficiario || 'Escritório de Advocacia').toString().trim();

    return (
        `⚖️ *Lembrete de Honorários — ${beneficiario}*\n\n` +
        `Olá, *${nomeCliente}*! Tudo bem?\n\n` +
        `Passando de forma cordial para lembrar da parcela referente aos seus honorários advocatícios:\n` +
        `• 💰 *Valor:* R$ ${valorFormatado}\n` +
        `• 📅 *Vencimento:* ${vencimento}\n\n` +
        `🔑 *Chave PIX Copia-e-Cola (${tipoChave}):*\n` +
        `${chavePix}\n\n` +
        `• 🏛️ *Beneficiário:* ${beneficiario}\n\n` +
        `Assim que realizar o pagamento, basta nos enviar a *foto ou print do comprovante* aqui mesmo nesta conversa para darmos baixa automática. Muito obrigado!`
    );
}

/**
 * Dispara a régua de cobrança com delay anti-ban configurável (15s-30s em prod,
 * ou customizável via opcoesEnvio para execução rápida em testes).
 */
async function dispararReguaCobranca(config, opcoesEnvio = {}) {
    garantirEstruturaFinanceira(config);

    const cfgCob = config.configuracaoCobranca;
    const dataRef = opcoesEnvio.dataReferencia || null;
    const ignorarDia = opcoesEnvio.ignorarDiaSemana !== undefined ? Boolean(opcoesEnvio.ignorarDiaSemana) : !dataRef;

    const elegiveis = Array.isArray(opcoesEnvio.parcelasAlvo)
        ? opcoesEnvio.parcelasAlvo
        : filtrarParcelasElegiveis(config, dataRef, ignorarDia);

    const delayMin = opcoesEnvio.delayMsOverride !== undefined
        ? Number(opcoesEnvio.delayMsOverride)
        : Math.max(0, Number(cfgCob.delayMinimoSegundos ?? 15)) * 1000;
    const delayMax = opcoesEnvio.delayMsOverride !== undefined
        ? Number(opcoesEnvio.delayMsOverride)
        : Math.max(delayMin, Number(cfgCob.delayMaximoSegundos ?? 30) * 1000);

    const funcaoEnvio = typeof opcoesEnvio.enviarMensagemWhatsApp === 'function'
        ? opcoesEnvio.enviarMensagemWhatsApp
        : async () => true;

    const resultados = [];

    for (let i = 0; i < elegiveis.length; i++) {
        const parcela = elegiveis[i];
        const mensagem = gerarMensagemCobrancaPix(parcela, config);
        const delayAplicadoMs = elegiveis.length > 1 && i > 0
            ? Math.floor(delayMin + Math.random() * (delayMax - delayMin + 1))
            : 0;

        if (delayAplicadoMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayAplicadoMs));
        }

        let enviado = false;
        let erroEnvio = null;
        try {
            const telefone = parcela.clienteTelefone || parcela.telefone || '';
            await funcaoEnvio(telefone, mensagem, parcela);
            enviado = true;
            parcela.ultimaCobrancaEm = new Date().toISOString();
            parcela.cobrancasNaSemana = Number(parcela.cobrancasNaSemana || 0) + 1;
        } catch (err) {
            erroEnvio = err.message || String(err);
        }

        resultados.push({
            parcelaId: parcela.id,
            clienteNome: parcela.clienteNome,
            telefone: parcela.clienteTelefone || parcela.telefone || '',
            valor: parcela.valor,
            enviado,
            erro: erroEnvio,
            delayAplicadoMs,
            mensagem
        });
    }

    return {
        success: true,
        totalElegiveis: elegiveis.length,
        totalEnviados: resultados.filter(r => r.enviado).length,
        resultados
    };
}

/**
 * Liquida (dá baixa) em uma parcela pelo seu ID e registra os dados do comprovante.
 */
function darBaixaParcela(parcelaId, config, dadosBaixa = {}) {
    garantirEstruturaFinanceira(config);
    const idAlvo = String(parcelaId || '').trim();
    const parcela = config.financeiro.parcelas.find(p => String(p.id) === idAlvo);

    if (!parcela) {
        return {
            success: false,
            erro: `Parcela '${idAlvo}' não localizada.`
        };
    }

    parcela.status = 'PAGO';
    parcela.dataPagamento = dadosBaixa.dataTransacao || dadosBaixa.dataPagamento || new Date().toISOString();
    parcela.valorPago = dadosBaixa.valorPago !== undefined ? Number(dadosBaixa.valorPago) : Number(parcela.valor || 0);
    parcela.idTransacao = dadosBaixa.idTransacao || parcela.idTransacao || `BAIXA_${Date.now()}`;
    parcela.bancoOrigem = dadosBaixa.bancoOrigem || parcela.bancoOrigem || 'Manual / Confirmado';
    parcela.nomePagador = dadosBaixa.nomePagador || parcela.clienteNome || '';

    return {
        success: true,
        parcela
    };
}

/**
 * Processa um comprovante recebido por imagem de um cliente no WhatsApp,
 * audita via visão computacional e, se válido, dá baixa automática na parcela.
 */
async function processarComprovanteRecebido(clienteTelefone, buffer, mimetype, apiKey, config) {
    garantirEstruturaFinanceira(config);
    const telLimpo = apenasNumeros(clienteTelefone);

    const parcelaPendente = config.financeiro.parcelas.find(p => {
        const status = String(p.status || 'PENDENTE').toUpperCase();
        if (status === 'PAGO') return false;
        const pTel = apenasNumeros(p.clienteTelefone || p.telefone || '');
        return !telLimpo || !pTel || pTel === telLimpo || pTel.endsWith(telLimpo) || telLimpo.endsWith(pTel);
    });

    const valorEsperado = parcelaPendente ? Number(parcelaPendente.valor || 0) : 0;
    const nomeCliente = parcelaPendente ? (parcelaPendente.clienteNome || 'Cliente') : 'Cliente';

    const laudo = await auditarComprovantePix(buffer, mimetype, apiKey, valorEsperado, nomeCliente);

    const registroComprovante = {
        id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        parcelaId: parcelaPendente ? parcelaPendente.id : null,
        clienteTelefone: telLimpo || clienteTelefone,
        clienteNome: nomeCliente,
        valorEsperado,
        comprovanteValido: laudo.comprovanteValido,
        dadosLidos: laudo.dadosLidos,
        divergencia: laudo.divergencia,
        recebidoEm: new Date().toISOString()
    };

    config.financeiro.comprovantesRecebidos.unshift(registroComprovante);

    let parcelaBaixada = null;
    if (laudo.comprovanteValido && parcelaPendente) {
        const resBaixa = darBaixaParcela(parcelaPendente.id, config, laudo.dadosLidos || {});
        if (resBaixa.success) {
            parcelaBaixada = resBaixa.parcela;
        }
    }

    return {
        success: true,
        comprovanteValido: laudo.comprovanteValido,
        laudo,
        parcelaBaixada,
        registroComprovante,
        mensagemFeedbackWhatsApp: laudo.mensagemFeedbackWhatsApp
    };
}

function adicionarParcela(dadosParcela, config) {
    garantirEstruturaFinanceira(config);
    const nova = {
        id: dadosParcela.id || `parc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clienteNome: String(dadosParcela.clienteNome || dadosParcela.nome || 'Cliente').trim(),
        clienteTelefone: String(dadosParcela.clienteTelefone || dadosParcela.telefone || '').trim(),
        descricao: String(dadosParcela.descricao || 'Honorários Advocatícios').trim(),
        valor: Number(dadosParcela.valor || 0),
        vencimento: String(dadosParcela.vencimento || new Date().toISOString().slice(0, 10)).trim(),
        status: String(dadosParcela.status || 'PENDENTE').toUpperCase(),
        cobrancasNaSemana: 0,
        criadoEm: new Date().toISOString()
    };
    config.financeiro.parcelas.push(nova);
    return nova;
}

function salvarConfiguracaoCobranca(novaConfigCobranca, config) {
    garantirEstruturaFinanceira(config);
    config.configuracaoCobranca = {
        ...config.configuracaoCobranca,
        ...(novaConfigCobranca || {})
    };
    if (novaConfigCobranca && Array.isArray(novaConfigCobranca.diasDaSemana)) {
        config.configuracaoCobranca.diasDaSemana = novaConfigCobranca.diasDaSemana.map(normalizarDiaSemana);
    }
    return config.configuracaoCobranca;
}

module.exports = {
    filtrarParcelasElegiveis,
    gerarMensagemCobrancaPix,
    dispararReguaCobranca,
    darBaixaParcela,
    processarComprovanteRecebido,
    adicionarParcela,
    salvarConfiguracaoCobranca,
    garantirEstruturaFinanceira
};
