/**
 * =========================================================================
 * TESTE AUTOMATIZADO: DASHBOARD DE KPIS FINANCEIROS, QUITAÇÃO DE CONTRATOS,
 * NOTIFICAÇÕES NÃO INVASIVAS E SIMULADOR WHATSAPP RESILIENTE
 * =========================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuração do mock de Electron para carregamento de main.js em ambiente Node CLI
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'adv2_fin_test_'));
const electronPath = require.resolve('electron');
const handlersIPC = {};

require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
        app: {
            getPath: () => tmpUserData,
            getVersion: () => '2.0.0-alpha.1',
            requestSingleInstanceLock: () => true,
            on: () => {},
            whenReady: () => new Promise(() => {}),
            setAppUserModelId: () => {},
            isPackaged: false,
            quit: () => {}
        },
        BrowserWindow: function() {},
        ipcMain: {
            handle: (canal, fn) => { handlersIPC[canal] = fn; },
            on: () => {}
        },
        nativeImage: { createFromPath: () => ({}) },
        dialog: {},
        Notification: class {
            constructor() {}
            show() {}
            static isSupported() { return false; }
        }
    }
};

const {
    obterMetricasFinanceiras,
    darBaixaParcela,
    adicionarParcela,
    excluirContratoFinanceiro,
    garantirEstruturaFinanceira
} = require('./src/financeiro/gestaoFinanceira');

const { SoundAlert } = require('./src/audio/audioAlert');
const { executarSimulacaoMensagem, resetarConversaSimulador } = require('./main');

async function executarSuiteTestes() {
    console.log('\n=================================================================');
    console.log('🏛️ SUÍTE DE TESTES: KPIS FINANCEIROS, QUITAÇÃO & SIMULADOR');
    console.log('=================================================================\n');

    let totalPassos = 0;
    let passosComSucesso = 0;

    function asserir(condicao, descricao) {
        totalPassos++;
        if (condicao) {
            passosComSucesso++;
            console.log(`  ✅ [PASS] ${descricao}`);
        } else {
            console.error(`  ❌ [FAIL] ${descricao}`);
            throw new Error(`Falha no teste: ${descricao}`);
        }
    }

    // -------------------------------------------------------------------------
    // TESTE 1: Cálculo Preciso dos 4 KPIs Financeiros
    // -------------------------------------------------------------------------
    console.log('\n--- 1. CÁLCULO DOS 4 KPIS FINANCEIROS ---');

    const configTeste = {
        configuracaoCobranca: {
            chavePix: 'pix@escritorio.adv.br',
            frequenciaSemanal: 2,
            diasDaSemana: ['TERCA', 'QUINTA']
        },
        financeiro: {
            contratos: [],
            parcelas: []
        }
    };
    garantirEstruturaFinanceira(configTeste);

    // Hoje como quarta-feira fixa para testes determinísticos
    const dataHoje = new Date('2026-10-21T12:00:00.000Z'); // Quarta-feira
    // Início da semana: Segunda 2026-10-19 / Fim: Domingo 2026-10-25

    // Adiciona parcelas para teste
    // Parcela 1: Paga há 2 dias via IA (R$ 800,00) -> deve entrar em recebidoSemanaIA e totalArrecadadoGeral
    configTeste.financeiro.parcelas.push({
        id: 'parc_1',
        contratoId: 'contrato_alfa',
        clienteNome: 'Mariana Silva',
        clienteTelefone: '5511999991111',
        valor: 800,
        status: 'PAGO',
        parcelaNumero: 1,
        totalParcelas: 2,
        origemPagamento: 'IA_COMPROVANTE',
        dataPagamento: '2026-10-19T14:30:00.000Z'
    });

    // Parcela 2: Pendente com vencimento nesta quinta 2026-10-22 (R$ 800,00) -> aReceberEstaSemana e totalAReceberGeral
    configTeste.financeiro.parcelas.push({
        id: 'parc_2',
        contratoId: 'contrato_alfa',
        clienteNome: 'Mariana Silva',
        clienteTelefone: '5511999991111',
        valor: 800,
        status: 'PENDENTE',
        parcelaNumero: 2,
        totalParcelas: 2,
        vencimento: '2026-10-22'
    });

    // Parcela 3: Pendente com vencimento no mês seguinte (R$ 1500,00) -> totalAReceberGeral apenas (fora da semana)
    configTeste.financeiro.parcelas.push({
        id: 'parc_3',
        contratoId: 'contrato_beta',
        clienteNome: 'Roberto Santos',
        clienteTelefone: '5511988882222',
        valor: 1500,
        status: 'PENDENTE',
        parcelaNumero: 1,
        totalParcelas: 1,
        vencimento: '2026-11-15'
    });

    // Parcela 4: Paga há 30 dias manual (R$ 1000,00) -> totalArrecadadoGeral apenas
    configTeste.financeiro.parcelas.push({
        id: 'parc_4',
        contratoId: 'contrato_gama',
        clienteNome: 'Carla Dias',
        clienteTelefone: '5511977773333',
        valor: 1000,
        status: 'PAGO',
        parcelaNumero: 1,
        totalParcelas: 1,
        dataPagamento: '2026-09-10T10:00:00.000Z'
    });

    const metricas = obterMetricasFinanceiras(configTeste, dataHoje);

    asserir(metricas.recebidoSemanaIA === 800, 'KPI 1 (Recebido na Semana via IA) deve ser R$ 800,00');
    asserir(metricas.aReceberEstaSemana === 800, 'KPI 2 (A Receber Esta Semana) deve ser R$ 800,00');
    asserir(metricas.totalAReceberGeral === 2300, 'KPI 3 (Total a Receber Geral) deve ser R$ 2.300,00 (800 + 1500)');
    asserir(metricas.totalArrecadadoGeral === 1800, 'KPI 4 (Total Arrecadado Geral) deve ser R$ 1.800,00 (800 + 1000)');
    asserir(metricas.contratosQuitados === 1, 'Deve identificar 1 contrato 100% quitado (contrato_gama)');

    // -------------------------------------------------------------------------
    // TESTE 2: Detecção de Quitação Total de Contrato & Notificação
    // -------------------------------------------------------------------------
    console.log('\n--- 2. DETECÇÃO DE QUITAÇÃO TOTAL E NOTIFICAÇÃO ---');

    // Ao dar baixa na parcela 2 (última do contrato_alfa), o contrato deve ser 100% quitado
    const resultadoBaixa = darBaixaParcela('parc_2', configTeste, {
        origem: 'IA_COMPROVANTE',
        valorPago: 800
    });

    asserir(resultadoBaixa.success === true, 'Baixa na parcela deve ser concluída com sucesso');
    asserir(resultadoBaixa.quitacaoTotal === true, 'Deve detectar quitação total de todas as parcelas do contrato');
    asserir(resultadoBaixa.parcelasPagas === 2, 'Total de parcelas pagas do contrato deve ser 2');
    asserir(resultadoBaixa.totalParcelas === 2, 'Total de parcelas do contrato deve ser 2');
    asserir(typeof resultadoBaixa.mensagemNotificacao === 'string' && resultadoBaixa.mensagemNotificacao.includes('100%'), 'Mensagem comemorativa de quitação total deve estar presente');

    const metricasAposQuitacao = obterMetricasFinanceiras(configTeste, dataHoje);
    asserir(metricasAposQuitacao.contratosQuitados === 2, 'Agora deve haver 2 contratos 100% quitados (alfa e gama)');
    asserir(metricasAposQuitacao.totalAReceberGeral === 1500, 'Total a receber deve ter caído para R$ 1.500,00');

    // -------------------------------------------------------------------------
    // TESTE 3: Arquivamento / Exclusão de Contrato com 1 Clique
    // -------------------------------------------------------------------------
    console.log('\n--- 3. ARQUIVAMENTO / EXCLUSÃO DE CONTRATO EM 1 CLIQUE ---');

    const resultadoExclusao = excluirContratoFinanceiro('contrato_alfa', configTeste, true);
    asserir(resultadoExclusao.success === true, 'Exclusão/arquivamento do contrato deve retornar sucesso');
    asserir(resultadoExclusao.parcelasAfetadas === 2, 'Deve ter afetado as 2 parcelas do contrato arquivado');

    const metricasAposArquivar = obterMetricasFinanceiras(configTeste, dataHoje);
    asserir(metricasAposArquivar.contratosQuitados === 1, 'Contratos quitados ativos deve ser 1 (o contrato alfa foi arquivado)');

    // -------------------------------------------------------------------------
    // TESTE 4: Síntese Sonora Web Audio de Pagamento Recebido (Sino Sucesso)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. MÓDULO DE ÁUDIO EXECUTIVO (SINO DE SUCESSO) ---');

    const soundAlert = new SoundAlert();
    asserir(typeof soundAlert.playPaymentReceivedChime === 'function', 'Método playPaymentReceivedChime deve existir');
    asserir(typeof soundAlert.tocarSinoSucesso === 'function', 'Alias tocarSinoSucesso deve existir e estar mapeado');
    // Execução em ambiente Node (não dispara erro pois trata ausência de AudioContext defensivamente)
    soundAlert.tocarSinoSucesso();
    asserir(true, 'Chamada de tocarSinoSucesso não lança exceção em ambiente headless');

    // -------------------------------------------------------------------------
    // TESTE 5: Simulador de WhatsApp Sandboxed com Mídia/Documentos
    // -------------------------------------------------------------------------
    console.log('\n--- 5. SIMULADOR DE WHATSAPP: SANDBOX COM MÍDIA & RESET ---');

    // Resetar simulador para limpar histórico
    await resetarConversaSimulador({ telefone: '5511999998888' });

    // Envio de texto normal no simulador
    const resSimTexto = await executarSimulacaoMensagem({
        texto: 'Olá',
        telefone: '5511999998888',
        nome: 'Cliente Sandbox'
    });
    asserir(resSimTexto && (resSimTexto.sucesso || resSimTexto.resposta), 'Simulador responde mensagem de texto com sucesso');

    // Envio de mídia/documento simulado (imagem base64)
    const bufferFalso = Buffer.from('FAKE_IMAGE_DATA_FOR_SIMULATION_PURPOSES');
    const resSimMidia = await executarSimulacaoMensagem({
        texto: 'Envio de comprovante',
        telefone: '5511999998888',
        nome: 'Cliente Sandbox',
        midia: {
            base64: bufferFalso.toString('base64'),
            mimetype: 'image/jpeg',
            filename: 'comprovante_pix_teste.jpg'
        }
    });
    asserir(resSimMidia && resSimMidia.sucesso === true, 'Simulador processa mídia com sucesso sem travar ou congelar');
    asserir(typeof resSimMidia.resposta === 'string', 'Simulador devolve feedback acolhedor');

    // -------------------------------------------------------------------------
    // TESTE 6: Auditoria DOM do index.html (KPIs, Banner, Simulator buttons)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. AUDITORIA DOS ELEMENTOS DOM NO INDEX.HTML ---');

    const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    asserir(htmlContent.includes('id="kpi-recebido-semana-ia"'), 'Card KPI 1 presente no index.html');
    asserir(htmlContent.includes('id="kpi-a-receber-semana"'), 'Card KPI 2 presente no index.html');
    asserir(htmlContent.includes('id="kpi-total-a-receber"'), 'Card KPI 3 presente no index.html');
    asserir(htmlContent.includes('id="kpi-total-arrecadado"'), 'Card KPI 4 presente no index.html');
    asserir(htmlContent.includes('id="banner-container-pagamento"'), 'Container de notificações de pagamento presente');
    asserir(htmlContent.includes('id="btn-simulador-anexo-doc"'), 'Botão de anexo de documentos no simulador presente');
    asserir(htmlContent.includes('id="simulador-doc-file"'), 'Input de arquivo de documentos no simulador presente');
    asserir(htmlContent.includes('onmousedown="event.preventDefault()"'), 'Botões rápidos do simulador possuem anti-blur preventDefault');
    asserir(htmlContent.includes('exibirNotificacaoPagamento'), 'Função de exibição não invasiva de pagamentos presente');
    asserir(htmlContent.includes('excluirContratoFinanceiroUI'), 'Função de exclusão/arquivamento de contrato presente');

    console.log('\n=================================================================');
    console.log(`🏆 RESULTADO FINAL: ${passosComSucesso}/${totalPassos} TESTES PASSARAM COM SUCESSO! (100%)`);
    console.log('=================================================================\n');

    // Limpeza de diretório temporário
    try {
        fs.rmSync(tmpUserData, { recursive: true, force: true });
    } catch (e) {}

    process.exit(0);
}

executarSuiteTestes().catch(err => {
    console.error('❌ Erro fatal na suíte de testes:', err);
    process.exit(1);
});
