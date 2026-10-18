/**
 * Advocacia Studio Pro v2.0
 * Teste Automatizado de Ações e Funções em Mensagens Pré-Programadas
 *
 * Valida:
 * 1. Elementos de UI (sub-abas, painéis, badge de ações, filtros).
 * 2. Funções do renderer (alternarSubAbaFluxo, renderizarCentralAcoes).
 * 3. Execução no backend/simulador:
 *    - Opção com ação "encaminharFilaHumana" + "motivoFila" + "aguardarAudioRelato"
 *    - Validação de envio de mensagem de texto com pausa e motivo na Fila de Espera
 *    - Validação de persistência e recebimento de mensagens e áudios subsequentes
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function executarTestesAcoesMensagens() {
    console.log('================================================================');
    console.log('TESTES: CENTRAL DE AÇÕES & FUNÇÕES DE MENSAGENS PRÉ-PROGRAMADAS');
    console.log('================================================================\n');

    let totalPassou = 0;

    // --- 1. Auditoria de Elementos e Interface no index.html ---
    console.log('--- 1. Auditoria de Elementos e Interface no index.html ---');
    const indexHTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    assert(indexHTML.includes('id="subtab-fluxo-editor"'), 'Deve possuir subaba do Editor de Menus');
    assert(indexHTML.includes('id="subtab-fluxo-acoes"'), 'Deve possuir subaba da Central de Ações');
    assert(indexHTML.includes('id="painel-fluxo-editor"'), 'Deve possuir container do painel editor');
    assert(indexHTML.includes('id="painel-fluxo-acoes"'), 'Deve possuir container do painel de ações');
    assert(indexHTML.includes('id="badge-total-acoes-ativas"'), 'Deve possuir badge de contagem de ações ativas');
    assert(indexHTML.includes('id="filtro-acoes-menu"'), 'Deve possuir filtro de menus na central de ações');
    assert(indexHTML.includes('id="lista-central-acoes"'), 'Deve possuir container para listagem das opções');
    assert(indexHTML.includes('alternarSubAbaFluxo'), 'Deve implementar alternarSubAbaFluxo');
    assert(indexHTML.includes('renderizarCentralAcoes'), 'Deve implementar renderizarCentralAcoes');
    assert(indexHTML.includes('toggleAcoesOpcao'), 'Deve implementar toggleAcoesOpcao');
    console.log('  ✅ [PASSOU] Todos os elementos visuais e de navegação de sub-abas estão íntegros no index.html.');
    totalPassou++;

    // --- 2. Setup de Mock Electron para Teste Backend ---
    const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'adv2_acoes_test_'));
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
            BrowserWindow: function() {
                return {
                    loadURL: () => {},
                    loadFile: () => {},
                    on: () => {},
                    isDestroyed: () => false,
                    webContents: { send: () => {} },
                    show: () => {}
                };
            },
            ipcMain: {
                handle: (canal, fn) => { handlersIPC[canal] = fn; },
                on: () => {}
            },
            nativeImage: { createFromPath: () => ({}) },
            dialog: {},
            Notification: { isSupported: () => false },
            Menu: { buildFromTemplate: () => ({ popup: () => {} }) }
        }
    };

    console.log('\n--- 2. Teste de Backend & Simulador com Ação de Fila + Áudio/IA ---');
    const mainApp = require('./main.js');

    // Resetar simulador
    await mainApp.resetarConversaSimulador();

    const config = await handlersIPC['obter-config']();
    config.fluxo.raiz.opcoes = [
        {
            gatilho: "1",
            rotulo: "Consultar Processo",
            tipo: "processo",
            destino: "",
            resposta: "Digite o CPF:"
        },
        {
            gatilho: "2",
            rotulo: "Novo Processo / Consulta",
            tipo: "texto",
            destino: "",
            resposta: "👨‍⚖️ Olá! Para iniciarmos sua consulta, por favor envie um resumo por escrito ou uma mensagem de voz explicando seu caso.",
            acoes: {
                encaminharFilaHumana: true,
                motivoFila: "Novo Processo / Consulta",
                aguardarAudioRelato: true,
                dispararAlertaSonoro: true
            }
        },
        {
            gatilho: "3",
            rotulo: "Informações Gerais",
            tipo: "texto",
            destino: "",
            resposta: "Nosso escritório atua em Direito Cível e Trabalhista.",
            acoes: {
                encaminharFilaHumana: false
            }
        }
    ];
    await handlersIPC['salvar-config']({}, config);

    // Cenário A: Cliente escolhe opção 3 (sem ação de fila)
    console.log('  [Cenário A] Cliente digita "3" (somente texto)');
    const res3 = await mainApp.executarSimulacaoMensagem({
        texto: "3",
        telefone: "5511999993333",
        nome: "Cliente Três"
    });
    assert(res3.resposta.includes("Direito Cível e Trabalhista"), 'Opção 3 deve responder texto normalmente');
    assert.strictEqual(res3.transbordo, false, 'Opção 3 não deve acionar transbordo');
    console.log('  ✅ [PASSOU] Opção padrão sem ação de fila responde texto sem pausar o robô.');
    totalPassou++;

    // Cenário B: Cliente escolhe opção 2 ("Novo Processo") com ações automatizadas
    console.log('  [Cenário B] Cliente digita "2" (Novo Processo com Ação de Fila + Áudio)');
    const res2 = await mainApp.executarSimulacaoMensagem({
        texto: "2",
        telefone: "5511999992222",
        nome: "Carlos Eduardo"
    });
    assert(res2.resposta.includes("envie um resumo por escrito ou uma mensagem de voz"), 'Deve responder a instrução pré-programada');
    assert.strictEqual(res2.transbordo, true, 'Deve acionar transbordo e pausar o robô');

    // Verificar se o contato está na Fila de Espera com o motivo correto
    const pausados = handlersIPC['obter-pausados'] ? await handlersIPC['obter-pausados']() : {};
    const itemPausado = pausados["5511999992222@c.us"] || pausados["5511999992222"];
    assert(itemPausado, 'Contato deve estar na lista de contatos pausados');
    assert.strictEqual(itemPausado.motivo, 'Novo Processo / Consulta', 'Motivo da pausa deve ser exatamente a tag configurada na opção');
    assert.strictEqual(itemPausado.aguardandoAudioRelato, true, 'Flag aguardandoAudioRelato deve ser true');
    console.log('  ✅ [PASSOU] Opção 2 enviou mensagem de orientação e colocou cliente na Fila com motivo e flag de áudio.');
    totalPassou++;

    // Cenário C: Cliente envia relato subsequente enquanto está na fila
    console.log('  [Cenário C] Cliente pausado envia o relato de caso em texto');
    const resRelato = await mainApp.executarSimulacaoMensagem({
        texto: "Sofri um acidente na empresa ontem e não recebi socorro. Preciso de auxílio jurídico urgente.",
        telefone: "5511999992222",
        nome: "Carlos Eduardo"
    });
    assert.strictEqual(resRelato.pausado, true, 'Robô deve permanecer pausado');

    const itemAposRelato = pausados["5511999992222@c.us"] || pausados["5511999992222"];
    assert(itemAposRelato.mensagens.some(m => m.texto.includes("Sofri um acidente")), 'Relato do caso deve ser anexado ao dossiê do cliente');
    console.log('  ✅ [PASSOU] Mensagem subsequente do cliente foi adicionada ao histórico da fila do advogado.');
    totalPassou++;

    console.log('\n================================================================');
    console.log(`RESULTADO: ${totalPassou}/4 BATERIAS PASSARAM COM SUCESSO!`);
    console.log('================================================================');
    process.exit(0);
}

executarTestesAcoesMensagens().catch(err => {
    console.error('❌ Falha no teste de ações e mensagens:', err);
    process.exit(1);
});
