/**
 * =========================================================================
 * ADVOCACIA STUDIO PRO v2.0 - MOTOR FINANCEIRO & RÉGUA DE COBRANÇA PIX
 * =========================================================================
 * Gerencia contratos, parcelas de honorários, filtro semanal de cobrança,
 * geração de mensagens PIX Copia-e-Cola com delay anti-ban e liquidação
 * automática via leitura multimodal de comprovantes.
 */

const { auditarComprovantePix } = require('./validadorComprovantePix');
const { obterApiKeyAtiva } = require('../ia/tradutorJuridico');

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

function normalizarTelefoneBR(tel) {
    let d = apenasNumeros(tel);
    if (d.length >= 12 && d.startsWith('55')) {
        d = d.slice(2);
    }
    return d;
}

function telefonesEquivalentes(t1, t2) {
    const a = normalizarTelefoneBR(t1);
    const b = normalizarTelefoneBR(t2);
    if (!a || !b) return false;
    if (a === b) return true;
    // Trata nono dígito opcional quando o DDD (2 dígitos) coincide
    if (a.length >= 10 && b.length >= 10 && a.slice(0, 2) === b.slice(0, 2)) {
        return a.slice(-8) === b.slice(-8);
    }
    return false;
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
            chavePix: '',
            tipoChave: 'CNPJ',
            beneficiario: (config.nomeEscritorio || '').trim() || 'Escritório de Advocacia',
            frequenciaSemanal: 2,
            diasDaSemana: ['TERCA', 'QUINTA'],
            horarioEnvio: '09:30',
            delayMinimoSegundos: 15,
            delayMaximoSegundos: 30,
            modoAprovacao: 'MANUAL_ADVOGADO',
            aplicarJurosMulta: true,
            percentualMulta: 2.0,
            percentualJurosMes: 1.0
        };
    }
    if (!Array.isArray(config.configuracaoCobranca.diasDaSemana)) {
        config.configuracaoCobranca.diasDaSemana = ['TERCA', 'QUINTA'];
    }
    if (config.configuracaoCobranca.aplicarJurosMulta === undefined) {
        config.configuracaoCobranca.aplicarJurosMulta = true;
    }
    if (config.configuracaoCobranca.percentualMulta === undefined) {
        config.configuracaoCobranca.percentualMulta = 2.0;
    }
    if (config.configuracaoCobranca.percentualJurosMes === undefined) {
        config.configuracaoCobranca.percentualJurosMes = 1.0;
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
    const agoraRef = dataReferencia ? (dataReferencia instanceof Date ? dataReferencia : new Date(dataReferencia)) : new Date();
    agoraRef.setHours(23, 59, 59, 999);

    return parcelas.filter(p => {
        if (!p || typeof p !== 'object') return false;
        const status = String(p.status || 'PENDENTE').toUpperCase();
        if (status === 'PAGO' || status === 'QUITADO' || status === 'CANCELADO' || status === 'ARQUIVADO') return false;

        // Reset semanal automático: se mudou a semana civil desde o último disparo, reseta cobrancasNaSemana
        if (p.ultimoDisparoSemana) {
            const dtUltimo = new Date(p.ultimoDisparoSemana);
            if (!isNaN(dtUltimo.getTime())) {
                const diffDias = Math.floor((agoraRef.getTime() - dtUltimo.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDias >= 7) {
                    p.cobrancasNaSemana = 0;
                }
            }
        }

        const cobrancasSemana = Number(p.cobrancasNaSemana || 0);
        if (freqMaxima > 0 && cobrancasSemana >= freqMaxima) return false;

        // PROTEÇÃO CRÍTICA: Somente parcelas vencidas ou que vencem no dia de hoje (ou tolerância)
        if (p.vencimento) {
            let dtVenc = null;
            if (p.vencimento.includes('/')) {
                const partes = p.vencimento.split('/');
                if (partes.length === 3) {
                    dtVenc = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10), 23, 59, 59, 999);
                }
            } else if (p.vencimento.includes('-')) {
                const partes = p.vencimento.split('-');
                if (partes.length === 3) {
                    dtVenc = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10), 23, 59, 59, 999);
                }
            }

            if (dtVenc && !isNaN(dtVenc.getTime())) {
                // Se a parcela vence no futuro além de hoje, NÃO cobra na régua
                if (dtVenc.getTime() > agoraRef.getTime()) {
                    return false;
                }
            }
        }

        return true;
    });
}

/**
 * Calcula os encargos de mora (multa e juros) para uma parcela com base no seu vencimento
 * e nas configurações editáveis pelo usuário (percentualMulta e percentualJurosMes).
 * 
 * Regra legal (Art. 395 do Código Civil / CDC):
 * - Multa moratória: percentual fixo aplicado sobre o valor principal quando atrasado (ex: 2.0%).
 * - Juros de mora: percentual mensal calculado pro-rata die (ex: 1.0% / 30 dias por dia de atraso).
 * 
 * @param {Object} parcela - Objeto da parcela (valor, vencimento, etc)
 * @param {Object} config - Configuração geral do escritório
 * @param {Date|string} dataReferencia - Data para cálculo do atraso (default: agora)
 * @returns {Object} Encargos calculados com transparência
 */
function calcularEncargosParcela(parcela, config = {}, dataReferencia = null) {
    garantirEstruturaFinanceira(config);
    const p = parcela || {};
    const cfgCob = config.configuracaoCobranca || {};

    const valorOriginal = Number(p.valor || 0);
    const aplicarEncargos = cfgCob.aplicarJurosMulta !== false;
    const taxaMulta = Number(cfgCob.percentualMulta !== undefined ? cfgCob.percentualMulta : 2.0);
    const taxaJurosMes = Number(cfgCob.percentualJurosMes !== undefined ? cfgCob.percentualJurosMes : 1.0);

    const agora = dataReferencia ? new Date(dataReferencia) : new Date();
    agora.setHours(23, 59, 59, 999);

    let diasAtraso = 0;
    let estaVencida = false;

    if (p.vencimento) {
        let dtVenc = null;
        if (p.vencimento.includes('/')) {
            const partes = p.vencimento.split('/');
            if (partes.length === 3) {
                dtVenc = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10), 23, 59, 59, 999);
            }
        } else if (p.vencimento.includes('-')) {
            const partes = p.vencimento.split('-');
            if (partes.length === 3) {
                dtVenc = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10), 23, 59, 59, 999);
            }
        }

        if (dtVenc && !isNaN(dtVenc.getTime())) {
            const diffMs = agora.getTime() - dtVenc.getTime();
            if (diffMs > 0) {
                diasAtraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (diasAtraso > 0) {
                    estaVencida = true;
                }
            }
        }
    }

    if (String(p.status || '').toUpperCase() === 'PAGO') {
        estaVencida = false;
    }

    let valorMulta = 0;
    let valorJuros = 0;

    if (estaVencida && aplicarEncargos && valorOriginal > 0) {
        valorMulta = Number(((valorOriginal * taxaMulta) / 100).toFixed(2));
        const taxaDiaria = (taxaJurosMes / 30) / 100;
        valorJuros = Number((valorOriginal * taxaDiaria * diasAtraso).toFixed(2));
    }

    const valorTotalAtualizado = Number((valorOriginal + valorMulta + valorJuros).toFixed(2));

    return {
        estaVencida,
        diasAtraso,
        valorOriginal,
        valorMulta,
        valorJuros,
        valorTotalAtualizado,
        taxaMulta,
        taxaJurosMes,
        aplicarEncargos
    };
}

/**
 * Gera mensagem cordial e personalizada de cobrança com chave PIX Copia-e-Cola,
 * incorporando automaticamente encargos de mora editáveis se a parcela estiver vencida.
 */
function gerarMensagemCobrancaPix(parcela, config = {}, dataReferencia = null) {
    const p = parcela || {};
    const cfgCob = (config && config.configuracaoCobranca) ? config.configuracaoCobranca : {};

    const encargos = calcularEncargosParcela(p, config, dataReferencia);
    const nomeCliente = (p.clienteNome || p.nome || 'Cliente').toString().trim();
    const vencimento = (p.vencimento || 'em aberto').toString().trim();
    const chavePix = (cfgCob.chavePix || '').toString().trim() || '[Chave PIX não configurada]';
    const tipoChave = (cfgCob.tipoChave || 'PIX').toString().trim();
    const beneficiario = (cfgCob.beneficiario || config?.nomeEscritorio || 'Escritório de Advocacia').toString().trim();

    let linhaValor = `• 💰 *Valor:* R$ ${formatarMoedaBR(encargos.valorOriginal)}`;
    if (encargos.estaVencida && (encargos.valorMulta > 0 || encargos.valorJuros > 0)) {
        linhaValor = `• 💰 *Valor Atualizado:* R$ ${formatarMoedaBR(encargos.valorTotalAtualizado)} _(Principal: R$ ${formatarMoedaBR(encargos.valorOriginal)} + Multa: R$ ${formatarMoedaBR(encargos.valorMulta)} + Juros (${encargos.diasAtraso}d): R$ ${formatarMoedaBR(encargos.valorJuros)})_`;
    }

    return (
        `⚖️ *Lembrete de Honorários — ${beneficiario}*\n\n` +
        `Olá, *${nomeCliente}*! Tudo bem?\n\n` +
        `Passando de forma cordial para lembrar da parcela referente aos seus honorários advocatícios:\n` +
        `${linhaValor}\n` +
        `• 📅 *Vencimento:* ${vencimento}${encargos.estaVencida ? ` *(em atraso há ${encargos.diasAtraso} dia(s))*` : ''}\n\n` +
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
async function dispararReguaCobranca(config, opcoesEnvio = {}, opcoesExtra = {}) {
    garantirEstruturaFinanceira(config);

    // Compatibilidade retroativa: aceita (config, enviarFn, opcoes) ou (config, opcoes)
    if (typeof opcoesEnvio === 'function') {
        opcoesEnvio = {
            ...(opcoesExtra && typeof opcoesExtra === 'object' ? opcoesExtra : {}),
            enviarMensagemWhatsApp: opcoesEnvio
        };
    }

    const cfgCob = config.configuracaoCobranca;
    const dataRef = opcoesEnvio.dataReferencia || null;
    const ignorarDia = opcoesEnvio.ignorarDiaSemana !== undefined
        ? Boolean(opcoesEnvio.ignorarDiaSemana)
        : (opcoesEnvio.ignorarDiaDaSemana !== undefined ? Boolean(opcoesEnvio.ignorarDiaDaSemana) : !dataRef);

    let elegiveis = Array.isArray(opcoesEnvio.parcelasAlvo)
        ? opcoesEnvio.parcelasAlvo
        : filtrarParcelasElegiveis(config, dataRef, ignorarDia);

    if (opcoesEnvio.apenasParcelaId) {
        elegiveis = elegiveis.filter(p => String(p.id) === String(opcoesEnvio.apenasParcelaId));
    }

    const delayMin = opcoesEnvio.delayMsOverride !== undefined
        ? Number(opcoesEnvio.delayMsOverride)
        : (opcoesEnvio.delayMs !== undefined
            ? Number(opcoesEnvio.delayMs)
            : Math.max(0, Number(cfgCob.delayMinimoSegundos ?? 15)) * 1000);
    const delayMax = opcoesEnvio.delayMsOverride !== undefined
        ? Number(opcoesEnvio.delayMsOverride)
        : (opcoesEnvio.delayMs !== undefined
            ? Number(opcoesEnvio.delayMs)
            : Math.max(delayMin, Number(cfgCob.delayMaximoSegundos ?? 30) * 1000));

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
            parcela.ultimoDisparoSemana = new Date().toISOString();
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

    const totalEnviados = resultados.filter(r => r.enviado).length;
    return {
        success: true,
        totalElegiveis: elegiveis.length,
        totalEnviados,
        enviados: totalEnviados,
        resultados
    };
}

/**
 * Liquida (dá baixa) em uma parcela pelo seu ID e registra os dados do comprovante.
 * Detecta quitação total do contrato quando todas as parcelas forem pagas.
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

    const dataPagamentoFinal = dadosBaixa.dataTransacao || dadosBaixa.dataPagamento || new Date().toISOString();
    const encargos = calcularEncargosParcela(parcela, config, dataPagamentoFinal);
    const valorOriginal = Number(parcela.valor || 0);
    const valorSugerido = (encargos.estaVencida && encargos.aplicarEncargos) ? encargos.valorTotalAtualizado : valorOriginal;

    parcela.status = 'PAGO';
    parcela.dataPagamento = dataPagamentoFinal;
    parcela.valorPago = dadosBaixa.valorPago !== undefined ? Number(dadosBaixa.valorPago) : valorSugerido;
    parcela.valorOriginal = valorOriginal;
    parcela.valorMulta = (encargos.estaVencida && encargos.aplicarEncargos) ? encargos.valorMulta : 0;
    parcela.valorJuros = (encargos.estaVencida && encargos.aplicarEncargos) ? encargos.valorJuros : 0;
    parcela.diasAtrasoNaBaixa = encargos.diasAtraso;
    parcela.idTransacao = dadosBaixa.idTransacao || parcela.idTransacao || (dadosBaixa.origem === 'IA_COMPROVANTE' ? `PIX_${Date.now()}` : `BAIXA_MANUAL_${Date.now()}`);
    parcela.bancoOrigem = dadosBaixa.bancoOrigem || parcela.bancoOrigem || 'Manual / Confirmado';
    parcela.nomePagador = dadosBaixa.nomePagador || parcela.clienteNome || '';
    parcela.origemPagamento = dadosBaixa.origem || parcela.origemPagamento || 'MANUAL';

    // Localiza todas as parcelas do mesmo contrato ou mesmo cliente
    const contratoId = parcela.contratoId;
    const clienteTel = apenasNumeros(parcela.clienteTelefone || parcela.telefone || '');
    
    const parcelasIrmas = config.financeiro.parcelas.filter(p => {
        if (p.status === 'ARQUIVADO') return false;
        if (contratoId && p.contratoId) return p.contratoId === contratoId;
        if (clienteTel) {
            const pTel = apenasNumeros(p.clienteTelefone || p.telefone || '');
            return pTel === clienteTel;
        }
        return false;
    });

    const totalParcelasContrato = parcelasIrmas.length || Number(parcela.totalParcelas || 1);
    const pagas = parcelasIrmas.filter(p => p.status === 'PAGO');
    const todasPagas = parcelasIrmas.length > 0 && parcelasIrmas.every(p => p.status === 'PAGO');
    const quitacaoTotal = todasPagas;

    if (todasPagas) {
        parcelasIrmas.forEach(p => {
            p.statusContrato = 'TOTALMENTE_QUITADO';
        });
    }

    const valorTotalContrato = parcelasIrmas.reduce((acc, curr) => acc + Number(curr.valor || 0), 0);
    const parcelaNum = parcela.parcelaNumero || (parcelasIrmas.indexOf(parcela) + 1);

    return {
        success: true,
        sucesso: true,
        parcela,
        quitacaoTotal,
        contratoId: contratoId || `cont_${clienteTel || 'geral'}`,
        clienteNome: parcela.clienteNome,
        clienteTelefone: parcela.clienteTelefone,
        valorPago: parcela.valorPago,
        totalContrato: valorTotalContrato,
        parcelasPagas: pagas.length,
        totalParcelas: totalParcelasContrato,
        parcelaNumero: parcelaNum,
        mensagemNotificacao: quitacaoTotal
            ? `🎉 CONTRATO TOTALMENTE QUITADO (100% PAGO)! ${parcela.clienteNome} quitou todas as ${totalParcelasContrato} parcelas (Total: R$ ${formatarMoedaBR(valorTotalContrato)})`
            : `💰 Pagamento Recebido: ${parcela.clienteNome} pagou R$ ${formatarMoedaBR(parcela.valorPago)} (Parcela ${parcelaNum} de ${totalParcelasContrato})`
    };
}

/**
 * Processa um comprovante recebido por imagem de um cliente no WhatsApp,
 * audita via visão computacional e, se válido, dá baixa automática na parcela.
 */
async function processarComprovanteRecebido(clienteTelefoneOuObj, bufferArg, mimetypeArg, apiKeyArg, configArg) {
    let clienteTelefone = '';
    let clienteNome = '';
    let buffer = null;
    let mimetype = 'image/jpeg';
    let apiKey = '';
    let config = null;

    if (clienteTelefoneOuObj && typeof clienteTelefoneOuObj === 'object' && !Buffer.isBuffer(clienteTelefoneOuObj)) {
        clienteTelefone = clienteTelefoneOuObj.clienteTelefone || clienteTelefoneOuObj.telefone || '';
        clienteNome = clienteTelefoneOuObj.clienteNome || clienteTelefoneOuObj.nome || '';
        buffer = clienteTelefoneOuObj.buffer;
        mimetype = clienteTelefoneOuObj.mimetype || clienteTelefoneOuObj.mimeType || 'image/jpeg';
        apiKey = clienteTelefoneOuObj.apiKey || '';
        config = bufferArg || clienteTelefoneOuObj.config || configArg;
    } else {
        clienteTelefone = clienteTelefoneOuObj || '';
        buffer = bufferArg;
        mimetype = mimetypeArg || 'image/jpeg';
        apiKey = apiKeyArg || '';
        config = configArg;
    }

    garantirEstruturaFinanceira(config);
    const telLimpo = apenasNumeros(clienteTelefone);

    const parcelaPendente = config.financeiro.parcelas.find(p => {
        const status = String(p.status || 'PENDENTE').toUpperCase();
        if (status === 'PAGO' || status === 'ARQUIVADO') return false;
        const pTel = p.clienteTelefone || p.telefone || '';
        return telefonesEquivalentes(pTel, clienteTelefone);
    });

    const valorEsperado = parcelaPendente ? Number(parcelaPendente.valor || 0) : 0;
    const nomeCliente = clienteNome || (parcelaPendente ? (parcelaPendente.clienteNome || 'Cliente') : 'Cliente');

    const chaveAtiva = obterApiKeyAtiva(apiKey, config);
    const laudo = await auditarComprovantePix(buffer, mimetype, chaveAtiva, valorEsperado, nomeCliente);

    // Deduplicação determinística de comprovante PIX (Prevenção de Replay Attack)
    const idTx = String(laudo?.dadosLidos?.idTransacao || '').trim();
    if (idTx && idTx.length >= 8) {
        const jaProcessado = (config.financeiro.comprovantesRecebidos || []).some(c => {
            const cId = String(c?.dadosLidos?.idTransacao || c?.idTransacao || '').trim();
            return cId && cId.toLowerCase() === idTx.toLowerCase();
        }) || (config.financeiro.parcelas || []).some(p => {
            const pId = String(p?.idTransacao || '').trim();
            return pId && pId.toLowerCase() === idTx.toLowerCase();
        });

        if (jaProcessado) {
            return {
                success: false,
                sucesso: false,
                motivo: 'COMPROVANTE_JA_PROCESSADO',
                comprovanteValido: false,
                divergencia: 'COMPROVANTE_JA_PROCESSADO',
                ehDocumentoCivil: false,
                rotearParaDossie: false,
                laudo: {
                    ...(laudo || {}),
                    comprovanteValido: false,
                    divergencia: 'COMPROVANTE_JA_PROCESSADO'
                },
                parcelaBaixada: null,
                resultadoBaixa: null,
                feedbackWhatsApp: `⚠️ Este comprovante PIX (ID: ${idTx}) já foi processado anteriormente em nosso sistema e não pode ser reutilizado para quitação.`
            };
        }
    }

    const ehDocCivil = Boolean(
        laudo.ehDocumentoCivil ||
        laudo.dadosLidos?.ehDocumentoCivil ||
        laudo.tipoDetectado === 'DOCUMENTO_PESSOAL' ||
        laudo.tipoDetectado === 'DOCUMENTO_CIVIL' ||
        laudo.divergencia === 'DOCUMENTO_PESSOAL_NAO_PIX'
    );

    let registroComprovante = null;
    let parcelaBaixada = null;
    let resultadoBaixa = null;

    // Se NÃO for documento civil e o comprovante for válido, registra e dá baixa
    if (!ehDocCivil && laudo.comprovanteValido) {
        registroComprovante = {
            id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            parcelaId: parcelaPendente ? parcelaPendente.id : null,
            clienteTelefone: telLimpo || clienteTelefone,
            clienteNome: nomeCliente,
            valorEsperado,
            comprovanteValido: true,
            dadosLidos: laudo.dadosLidos,
            divergencia: laudo.divergencia,
            recebidoEm: new Date().toISOString()
        };
        config.financeiro.comprovantesRecebidos.unshift(registroComprovante);

        if (parcelaPendente) {
            resultadoBaixa = darBaixaParcela(parcelaPendente.id, config, {
                ...(laudo.dadosLidos || {}),
                origem: 'IA_COMPROVANTE'
            });
            if (resultadoBaixa.success) {
                parcelaBaixada = resultadoBaixa.parcela;
            }
        }
    } else if (!ehDocCivil && laudo.ehComprovantePix !== false) {
        // Comprovante PIX inválido ou com divergência financeira (registrado para histórico)
        registroComprovante = {
            id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            parcelaId: parcelaPendente ? parcelaPendente.id : null,
            clienteTelefone: telLimpo || clienteTelefone,
            clienteNome: nomeCliente,
            valorEsperado,
            comprovanteValido: false,
            dadosLidos: laudo.dadosLidos,
            divergencia: laudo.divergencia,
            recebidoEm: new Date().toISOString()
        };
        config.financeiro.comprovantesRecebidos.unshift(registroComprovante);
    }

    return {
        success: true,
        sucesso: true,
        comprovanteValido: Boolean(laudo.comprovanteValido && !ehDocCivil),
        ehDocumentoCivil: ehDocCivil,
        rotearParaDossie: ehDocCivil,
        laudo,
        parcelaBaixada,
        resultadoBaixa,
        registroComprovante,
        mensagemFeedbackWhatsApp: laudo.mensagemFeedbackWhatsApp
    };
}

/**
 * Adiciona uma ou múltiplas parcelas (X de Y) para um contrato de honorários.
 */
function adicionarParcela(dadosParcela, config) {
    garantirEstruturaFinanceira(config);
    const totalParcelas = Math.max(1, parseInt(dadosParcela.totalParcelas || dadosParcela.parcelasQtd || 1, 10));
    const contratoId = dadosParcela.contratoId || `cont_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const valorTotal = Number(dadosParcela.valor || 0);
    const parcelasCriadas = [];

    // Normalização amigável de telefone: se o advogado digitar (11) 99999-9999, converte para 5511...
    let telRaw = String(dadosParcela.clienteTelefone || dadosParcela.telefone || '').trim();
    const digitosTel = telRaw.replace(/\D/g, '');
    let telNormalizado = telRaw;
    if (digitosTel.length === 10 || digitosTel.length === 11) {
        telNormalizado = `55${digitosTel}`;
    } else if (digitosTel.length === 12 || digitosTel.length === 13) {
        telNormalizado = digitosTel;
    }

    // Se o usuário solicitou criar todas as N parcelas de uma vez
    if (totalParcelas > 1 && dadosParcela.criarTodasParcelas) {
        const valorPorParcela = dadosParcela.modoValor === 'PARCELA'
            ? Number(valorTotal.toFixed(2))
            : Number((valorTotal / totalParcelas).toFixed(2));
        const dtBase = dadosParcela.vencimento ? new Date(dadosParcela.vencimento) : new Date();

        for (let i = 1; i <= totalParcelas; i++) {
            const dtVenc = new Date(dtBase);
            dtVenc.setMonth(dtVenc.getMonth() + (i - 1));
            const nova = {
                id: `parc_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
                contratoId,
                parcelaNumero: i,
                totalParcelas,
                clienteNome: String(dadosParcela.clienteNome || dadosParcela.nome || 'Cliente').trim(),
                clienteTelefone: telNormalizado,
                descricao: String(dadosParcela.descricao || 'Honorários Advocatícios').trim(),
                valor: valorPorParcela,
                vencimento: dtVenc.toISOString().slice(0, 10),
                status: 'PENDENTE',
                statusContrato: 'EM_ANDAMENTO',
                cobrancasNaSemana: 0,
                criadoEm: new Date().toISOString()
            };
            config.financeiro.parcelas.push(nova);
            parcelasCriadas.push(nova);
        }
        return parcelasCriadas[0];
    }

    const nova = {
        id: dadosParcela.id || `parc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        contratoId,
        parcelaNumero: parseInt(dadosParcela.parcelaNumero || 1, 10),
        totalParcelas,
        clienteNome: String(dadosParcela.clienteNome || dadosParcela.nome || 'Cliente').trim(),
        clienteTelefone: telNormalizado,
        descricao: String(dadosParcela.descricao || 'Honorários Advocatícios').trim(),
        valor: valorTotal,
        vencimento: String(dadosParcela.vencimento || new Date().toISOString().slice(0, 10)).trim(),
        status: String(dadosParcela.status || 'PENDENTE').toUpperCase(),
        statusContrato: 'EM_ANDAMENTO',
        cobrancasNaSemana: 0,
        criadoEm: new Date().toISOString()
    };
    config.financeiro.parcelas.push(nova);
    return nova;
}

/**
 * Arquiva ou exclui com 1 clique todas as parcelas de um contrato totalmente quitado.
 */
function excluirContratoFinanceiro(identificador, config, arquivar = true) {
    garantirEstruturaFinanceira(config);
    const idLimpo = String(identificador || '').trim();
    const telLimpo = apenasNumeros(idLimpo);

    let parcelasAfetadas = 0;
    if (arquivar) {
        config.financeiro.parcelas.forEach(p => {
            const coincideContrato = p.contratoId && p.contratoId === idLimpo;
            const coincideId = p.id === idLimpo;
            const coincideTel = telLimpo && apenasNumeros(p.clienteTelefone || p.telefone || '') === telLimpo;
            if (coincideContrato || coincideId || coincideTel) {
                p.status = 'ARQUIVADO';
                p.arquivadoEm = new Date().toISOString();
                parcelasAfetadas++;
            }
        });
    } else {
        const antes = config.financeiro.parcelas.length;
        config.financeiro.parcelas = config.financeiro.parcelas.filter(p => {
            const coincideContrato = p.contratoId && p.contratoId === idLimpo;
            const coincideId = p.id === idLimpo;
            const coincideTel = telLimpo && apenasNumeros(p.clienteTelefone || p.telefone || '') === telLimpo;
            return !(coincideContrato || coincideId || coincideTel);
        });
        parcelasAfetadas = antes - config.financeiro.parcelas.length;
    }

    return {
        success: true,
        sucesso: true,
        arquivado: Boolean(arquivar),
        parcelasAfetadas
    };
}

/**
 * Calcula em tempo real os 4 KPIs do Dashboard Financeiro Executivo:
 * 1. Recebido na Última Semana (Cobrado via IA)
 * 2. A Receber Esta Semana (Segunda a Domingo corrente)
 * 3. Total a Receber (Geral)
 * 4. Total Já Arrecadado / Quitado (Acumulado)
 */
function obterMetricasFinanceiras(config, dataReferencia = null) {
    garantirEstruturaFinanceira(config);
    const parcelas = config.financeiro.parcelas || [];
    const agora = dataReferencia ? new Date(dataReferencia) : new Date();

    // Início e fim da semana corrente (segunda a domingo)
    const diaSemanaHoje = agora.getDay(); // 0 = Domingo, 1 = Segunda
    const diffParaSegunda = agora.getDate() - (diaSemanaHoje === 0 ? 6 : diaSemanaHoje - 1);
    const inicioSemana = new Date(agora);
    inicioSemana.setDate(diffParaSegunda);
    inicioSemana.setHours(0, 0, 0, 0);

    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(fimSemana.getDate() + 6);
    fimSemana.setHours(23, 59, 59, 999);

    const seteDiasAtras = new Date(agora.getTime() - (7 * 24 * 60 * 60 * 1000));

    let recebidoSemanaIA = 0;
    let aReceberEstaSemana = 0;
    let totalAReceberGeral = 0;
    let totalArrecadadoGeral = 0;
    let totalParcelasPagas = 0;
    let totalParcelasPendentes = 0;
    let contratosQuitados = 0;

    const contratosMap = {};

    parcelas.forEach(p => {
        if (!p || typeof p !== 'object' || p.status === 'ARQUIVADO') return;
        const status = String(p.status || 'PENDENTE').toUpperCase();
        const valor = Number(p.valor || 0);
        const valorPago = Number(p.valorPago !== undefined ? p.valorPago : valor);

        // Agrupamento por contrato para detecção de quitação
        const cId = p.contratoId || (p.clienteTelefone ? `tel_${apenasNumeros(p.clienteTelefone)}` : p.id);
        if (!contratosMap[cId]) contratosMap[cId] = [];
        contratosMap[cId].push(p);

        if (status === 'PAGO' || status === 'QUITADO') {
            totalArrecadadoGeral += valorPago;
            totalParcelasPagas++;

            // Recebido na última semana com intermediação de IA
            let dataPagto = p.dataPagamento ? new Date(p.dataPagamento) : null;
            if (!dataPagto || isNaN(dataPagto.getTime())) dataPagto = agora;

            const intermediadoIA = Boolean(
                p.origemPagamento === 'IA' ||
                p.origemPagamento === 'IA_COMPROVANTE' ||
                p.intermediadoIA === true ||
                (p.origemPagamento !== 'MANUAL' && p.cobrancasNaSemana > 0 && String(p.idTransacao || '').startsWith('PIX_'))
            );

            if (dataPagto >= seteDiasAtras && intermediadoIA) {
                recebidoSemanaIA += valorPago;
            }
        } else if (status === 'PENDENTE' || status === 'ATRASADO') {
            totalAReceberGeral += valor;
            totalParcelasPendentes++;

            if (p.vencimento) {
                let dtVenc = null;
                if (p.vencimento.includes('/')) {
                    const partes = p.vencimento.split('/');
                    if (partes.length === 3) {
                        dtVenc = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10), 12, 0, 0);
                    }
                } else if (p.vencimento.includes('-')) {
                    const partes = p.vencimento.split('-');
                    if (partes.length === 3) {
                        dtVenc = new Date(parseInt(partes[0], 10), parseInt(partes[1], 10) - 1, parseInt(partes[2], 10), 12, 0, 0);
                    }
                }
                if (dtVenc && !isNaN(dtVenc.getTime()) && dtVenc >= inicioSemana && dtVenc <= fimSemana) {
                    aReceberEstaSemana += valor;
                }
            }
        }
    });

    Object.values(contratosMap).forEach(lista => {
        if (lista.length > 0 && lista.every(item => item.status === 'PAGO' || item.status === 'QUITADO')) {
            contratosQuitados++;
        }
    });

    return {
        recebidoSemanaIA: Number(recebidoSemanaIA.toFixed(2)),
        aReceberEstaSemana: Number(aReceberEstaSemana.toFixed(2)),
        totalAReceberGeral: Number(totalAReceberGeral.toFixed(2)),
        totalArrecadadoGeral: Number(totalArrecadadoGeral.toFixed(2)),
        totalParcelasPagas,
        totalParcelasPendentes,
        contratosQuitados,
        formatados: {
            recebidoSemanaIA: formatarMoedaBR(recebidoSemanaIA),
            aReceberEstaSemana: formatarMoedaBR(aReceberEstaSemana),
            totalAReceberGeral: formatarMoedaBR(totalAReceberGeral),
            totalArrecadadoGeral: formatarMoedaBR(totalArrecadadoGeral)
        }
    };
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
    if (novaConfigCobranca) {
        if (novaConfigCobranca.aplicarJurosMulta !== undefined) {
            config.configuracaoCobranca.aplicarJurosMulta = Boolean(novaConfigCobranca.aplicarJurosMulta);
        }
        if (novaConfigCobranca.percentualMulta !== undefined) {
            config.configuracaoCobranca.percentualMulta = Math.max(0, Number(novaConfigCobranca.percentualMulta) || 0);
        }
        if (novaConfigCobranca.percentualJurosMes !== undefined) {
            config.configuracaoCobranca.percentualJurosMes = Math.max(0, Number(novaConfigCobranca.percentualJurosMes) || 0);
        }
    }
    return config.configuracaoCobranca;
}

module.exports = {
    filtrarParcelasElegiveis,
    calcularEncargosParcela,
    gerarMensagemCobrancaPix,
    dispararReguaCobranca,
    darBaixaParcela,
    processarComprovanteRecebido,
    adicionarParcela,
    excluirContratoFinanceiro,
    obterMetricasFinanceiras,
    salvarConfiguracaoCobranca,
    garantirEstruturaFinanceira
};
