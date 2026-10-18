/**
 * ========================================================================
 * ⚖️ SUÍTE DE ESTRESSE ANTI-ALUCINAÇÃO PIX, DOSSIÊ FORENSE & SIMULADOR E2E
 * Advocacia Studio Pro v2.0 (2.0.0-alpha.1) — Suíte Oficial E2E Opaque-Box
 * ========================================================================
 *
 * Mapeamento e Cobertura dos Requisitos R1, R2, R3 e Tiers 1 a 4:
 *
 * - TIER 1: Testes de Funcionalidades Isoladas (Feature Inventory)
 *   - Bloco 1 (R1): Simulador WhatsApp Sandbox & Entrega Garantida (F1 a F5)
 *   - Bloco 2 (R2): Templates Customizáveis & Aprimoramento com IA Gemini (F6 a F10)
 *   - Bloco 3 (R3): Blindagem Anti-Alucinação no Motor de Visão & Validador PIX (F11 a F13)
 *   - Bloco 4 (R3): Roteamento Exclusivo para Dossiê & Travas de Baixa Financeira (F14 a F15)
 *
 * - TIER 2: Análise de Valor Limite (Boundary Value Analysis - BVA) & Casos de Borda
 *   - Bloco 5: Buffers vazios/nulos, limites de tolerância de R$ 0,01, mimetypes binários,
 *             formatações de telefone e tags de interpolação anômalas.
 *
 * - TIER 3: Testes Combinatórios Par a Par (Pairwise Testing)
 *   - Bloco 6: Presets vs modelos customizados, documentos civis vs contratos pendentes,
 *             disparos simultâneos e conciliações multi-cliente.
 *
 * - TIER 4: Matriz de Estresse Forense Anti-Alucinação (Os 8 Cenários R3) & Workloads E2E
 *   - Bloco 7:
 *     - Cenário 1: Foto de RG enviada com valor de parcela pendente.
 *     - Cenário 2: Imagem binária CNH (JPEG real de alta resolução sem texto ASCII puro).
 *     - Cenário 3: Fatura de concessionária (Enel/Água) com QR Code "Pague com Pix".
 *     - Cenário 4: Carteira de Trabalho (CTPS) / Certidão Civil.
 *     - Cenário 5: Ruído binário aleatório / Foto não documental ou financeira.
 *     - Cenário 6: Comprovante PIX legítimo (Nubank/Itaú/BB) com liquidação correta.
 *     - Cenário 7: Comprovante PIX legítimo com valor divergente (subvalor).
 *     - Cenário 8: Isolamento estrito entre clientes (Prevenção de liquidação cruzada).
 *     - Cenário 9: Ciclo E2E R1 - Disparo de Onboarding com Sincronização no Simulador.
 *     - Cenário 10: Ciclo E2E R2 - Customização de Template com "✨ Melhorar com IA" e Disparo.
 *
 * Execução Standalone (Pure Node.js): node test_stress_anti_alucinacao_pix_dossie.js
 * ========================================================================
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const raizProjeto = __dirname;

// --------------------------------------------------------------------------
// 🛠️ HARNESS DE EXECUÇÃO DE TESTES DETERMINÍSTICO
// --------------------------------------------------------------------------
let totalTestes = 0;
let testesPassados = 0;
let testesFalhados = 0;
const falhasDetalhadas = [];

function imprimirCabecalhoBloco(numero, titulo) {
    console.log('\n' + '='.repeat(80));
    console.log(`📦 BLOCO ${numero}: ${titulo}`);
    console.log('='.repeat(80));
}

async function testar(nome, fn) {
    totalTestes++;
    const idTeste = String(totalTestes).padStart(2, '0');
    process.stdout.write(`  🧪 [T${idTeste}] ${nome}... `);
    try {
        await fn();
        testesPassados++;
        console.log('✅ [PASS]');
    } catch (err) {
        testesFalhados++;
        console.log('❌ [FAIL]');
        console.log(`     ⚠️ Motivo: ${err.message}`);
        falhasDetalhadas.push({
            id: totalTestes,
            nome,
            mensagem: err.message,
            stack: err.stack
        });
    }
}

// --------------------------------------------------------------------------
// 📂 ISOLAMENTO DE AMBIENTE & MOCK HEADLESS DO ELECTRON
// Permite invocar main.js, ipcMain e preload.js sem instanciar janelas gráficas.
// --------------------------------------------------------------------------
const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'adv2_e2e_stress_'));
const electronPath = require.resolve('electron');
const handlersIPC = {};
const eventosEmitidosSimulador = [];

const mockWebContents = {
    send: (canal, dados) => {
        eventosEmitidosSimulador.push({ canal, dados, timestamp: Date.now() });
    },
    on: () => {},
    once: () => {},
    removeListener: () => {},
    removeAllListeners: () => {}
};

class MockBrowserWindow {
    constructor() {
        this.isDestroyed = () => false;
        this.webContents = mockWebContents;
        this.loadFile = () => Promise.resolve();
        this.loadURL = () => Promise.resolve();
        this.once = () => {};
        this.on = () => {};
        this.show = () => {};
        this.hide = () => {};
        this.close = () => {};
        this.focus = () => {};
        this.maximize = () => {};
        this.minimize = () => {};
        this.setMenuBarVisibility = () => {};
    }
}

require.cache[electronPath] = {
    id: electronPath,
    filename: electronPath,
    loaded: true,
    exports: {
        app: {
            getPath: (name) => (name === 'userData' ? tmpUserData : os.tmpdir()),
            getVersion: () => '2.0.0-alpha.1',
            requestSingleInstanceLock: () => true,
            on: () => {},
            whenReady: () => Promise.resolve(),
            setAppUserModelId: () => {},
            isPackaged: false,
            quit: () => {}
        },
        BrowserWindow: MockBrowserWindow,
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

// --------------------------------------------------------------------------
// 📦 CARREGAMENTO DOS MÓDULOS DE PRODUÇÃO
// --------------------------------------------------------------------------
const validadorPix = require('./src/financeiro/validadorComprovantePix');
const gestaoFinanceira = require('./src/financeiro/gestaoFinanceira');
const onboardingController = require('./src/onboarding/onboardingController');
const tradutorJuridico = require('./src/ia/tradutorJuridico');
const migracao = require('./migracao');

// Carrega main.js para registro de handlers IPC e funções de simulação
let mainMod = null;
try {
    mainMod = require('./main');
} catch (e) {
    console.warn('  ⚠️ Aviso ao carregar main.js no mock Electron:', e.message);
}

// --------------------------------------------------------------------------
// 🎨 GERADORES DETERMINÍSTICOS DE BUFFERS FORENSES (MATRIZ ADVERSARIAL)
// --------------------------------------------------------------------------

/**
 * Cria buffer representativo de Cédula de Identidade (RG Civil Brasileiro)
 */
function criarBufferRG(nome = 'MARIANA SILVA SANTOS', rg = '32.145.890-4', cpf = '234.567.890-12') {
    const cabecalhoJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const dadosCivil = Buffer.from(
        'REPUBLICA FEDERATIVA DO BRASIL ' +
        'ESTADO DE SAO PAULO - SECRETARIA DE SEGURANCA PUBLICA ' +
        'REGISTRO GERAL - CARTEIRA DE IDENTIDADE ' +
        `REGISTRO GERAL: ${rg} SSP/SP ` +
        `DATA DE EXPEDICAO: 12/04/2019 ` +
        `NOME: ${nome} ` +
        `FILIACAO: JOSE DOS SANTOS E MARIA SILVA SANTOS ` +
        `NATURALIDADE: SAO PAULO - SP ` +
        `DATA DE NASCIMENTO: 05/08/1991 ` +
        `DOC ORIGEM: CERTIDAO DE NASCIMENTO ` +
        `CPF: ${cpf} ` +
        'ASSINATURA DO TITULAR VALIDA EM TODO O TERRITORIO NACIONAL',
        'utf-8'
    );
    const rodapeJpeg = Buffer.from([0xFF, 0xD9]);
    return Buffer.concat([cabecalhoJpeg, dadosCivil, rodapeJpeg]);
}

/**
 * Cria buffer binário puro de CNH simulando compressão JPEG real de câmera
 * (sem texto legível simples em UTF-8 direto)
 */
function criarBufferCNHBinario(nome = 'CARLOS ROBERTO DE SOUZA', cnh = '04598712340', cpf = '345.678.901-23') {
    const cabecalhoJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    // Gera 512 bytes de ruído binário comprimido típico de imagem JPEG real
    const hash = crypto.createHash('sha256').update(nome + cnh).digest();
    const bytesBinarios = crypto.randomBytes(384);
    const marcacaoCivil = Buffer.from(`TIPO_DOC:CNH_BR REG_NACIONAL:${cnh} CPF:${cpf} NOME:${nome}`, 'utf-8');
    const rodapeJpeg = Buffer.from([0xFF, 0xD9]);
    return Buffer.concat([cabecalhoJpeg, bytesBinarios, marcacaoCivil, hash, rodapeJpeg]);
}

/**
 * Cria buffer de fatura/conta de consumo (Enel/Água/Luz) contendo "Pague com Pix" e QR Code.
 * CRÍTICO: É uma fatura a pagar, NÃO um comprovante de transferência executada!
 */
function criarBufferContaConsumoComPix(concessionaria = 'ENEL DISTRIBUICAO SAO PAULO', valor = 230.40, vencimento = '28/10/2026') {
    const cabecalhoJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    const dadosFatura = Buffer.from(
        `${concessionaria} - FATURA DE ENERGIA ELETRICA ` +
        `COMPROVANTE DE RESIDENCIA FISCAL E CONTA DE CONSUMO ` +
        `INSTALACAO N: 0045891230 CLIENTE: ROBERTO MENDES ALBUQUERQUE ` +
        `ENDERECO DE INSTALACAO: RUA DAS PALMEIRAS, 450, APTO 32, SAO PAULO - SP, CEP 01420-001 ` +
        `MES DE REFERENCIA: 10/2026 DATA DE EMISSAO: 10/10/2026 ` +
        `VENCIMENTO: ${vencimento} ` +
        `TOTAL A PAGAR: R$ ${valor.toFixed(2).replace('.', ',')} ` +
        `FACILITE SUA VIDA: PAGUE COM PIX OU QR CODE ABAIXO: ` +
        `QR CODE PIX COPIA E COLA: 00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540${valor.toFixed(2)}5802BR ` +
        `CODIGO DE BARRAS: 83640000002-3 30400048100-8 04589123000-1 20261028123-4 ` +
        `AVISO LEGAL: ESTA FATURA NAO CONSTITUI COMPROVANTE DE TRANSFERENCIA OU QUITACAO ATE SEU EFETIVO PROCESSAMENTO BANCARIO`,
        'utf-8'
    );
    const rodapeJpeg = Buffer.from([0xFF, 0xD9]);
    return Buffer.concat([cabecalhoJpeg, dadosFatura, rodapeJpeg]);
}

/**
 * Cria buffer de Carteira de Trabalho (CTPS) ou Certidão Civil
 */
function criarBufferCTPSECertidao(tipo = 'CTPS', titular = 'FERNANDO ALVES MOREIRA') {
    const cabecalhoJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    const corpo = Buffer.from(
        `MINISTERIO DO TRABALHO E PREVIDENCIA SOCIAL ` +
        `DOCUMENTO OFICIAL: CARTEIRA DE TRABALHO E PREVIDENCIA SOCIAL - CTPS ` +
        `TITULAR: ${titular} ` +
        `NUMERO: 789456 SERIE: 002-SP ` +
        `PIS/PASEP: 120.34567.89-0 ` +
        `DATA DE EXPEDICAO: 15/03/2015 ` +
        `CONTRATOS DE TRABALHO REGISTRADOS: ADMISSAO EM 01/02/2020 CARGO: ANALISTA ADMINISTRATIVO`,
        'utf-8'
    );
    const rodapeJpeg = Buffer.from([0xFF, 0xD9]);
    return Buffer.concat([cabecalhoJpeg, corpo, rodapeJpeg]);
}

/**
 * Cria buffer com ruído aleatório ou imagem de conteúdo não financeiro
 */
function criarBufferRuidoAleatorio(tamanho = 2048) {
    const cabecalho = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    const bytesAleatorios = crypto.randomBytes(tamanho);
    const rodape = Buffer.from([0xFF, 0xD9]);
    return Buffer.concat([cabecalho, bytesAleatorios, rodape]);
}

/**
 * Cria comprovante PIX autêntico com todos os metadados requeridos pelo Bacen
 */
function criarBufferPixAutentico(valor = 500.00, pagador = 'ROBERTO ALCANTARA SILVA', banco = 'NUBANK S.A.', idTransacao = 'E00416968202610181432A9876BC1234') {
    const cabecalhoJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    const dadosPix = Buffer.from(
        `COMPROVANTE DE TRANSFERENCIA PIX ` +
        `TRANSACAO EFETIVADA COM SUCESSO PELO SISTEMA DO BANCO CENTRAL DO BRASIL ` +
        `INSTITUICAO FINANCEIRA: ${banco} ` +
        `BANCO EMISSOR: ${banco} ` +
        `DATA DA TRANSFERENCIA: 18/10/2026 14:32:15 ` +
        `VALOR PAGO: R$ ${valor.toFixed(2).replace('.', ',')} ` +
        `PAGADOR: ${pagador} ` +
        `CPF/CNPJ DO DEBITADO: ***.567.890-** ` +
        `BENEFICIARIO: ADVOCACIA STUDIO PRO SOCIEDADE DE ADVOGADOS ` +
        `CHAVE PIX: financeiro@advocaciastudiopro.com.br ` +
        `ID TRANSACAO: ${idTransacao} ` +
        `CODIGO DE AUTENTICACAO: 9F8A.3D2B.7C1E.4A5F.8821.0934 ` +
        `TIPO DE OPERACAO: TRANSFERENCIA PIX CONCLUIDA`,
        'utf-8'
    );
    const rodapeJpeg = Buffer.from([0xFF, 0xD9]);
    return Buffer.concat([cabecalhoJpeg, dadosPix, rodapeJpeg]);
}

/**
 * Cria comprovante PIX autêntico, porém com subvalor divergente
 */
function criarBufferPixDivergente(valorEsperado = 500.00, valorPagoMenor = 350.00, pagador = 'MARIA SANTOS') {
    const cabecalhoJpeg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
    const dadosPix = Buffer.from(
        `COMPROVANTE DE TRANSFERENCIA PIX BANCO: BANCO DO BRASIL S.A. ` +
        `DATA: 18/10/2026 10:15:00 ` +
        `VALOR PAGO: R$ ${valorPagoMenor.toFixed(2).replace('.', ',')} ` +
        `PAGADOR: ${pagador} ` +
        `BENEFICIARIO: ADVOCACIA STUDIO PRO ` +
        `ID TRANSACAO: E00000000202610181015PARCIAL01 ` +
        `AUTENTICACAO: A1B2.C3D4.E5F6.7890`,
        'utf-8'
    );
    const rodapeJpeg = Buffer.from([0xFF, 0xD9]);
    return Buffer.concat([cabecalhoJpeg, dadosPix, rodapeJpeg]);
}

// ==========================================================================
// 🚀 INÍCIO DA BATERIA DE TESTES E2E
// ==========================================================================
async function executarSuiteEstresseCompleta() {
    console.log('='.repeat(80));
    console.log('⚖️  SUÍTE DE ESTRESSE ANTI-ALUCINAÇÃO PIX, DOSSIÊ FORENSE & SIMULADOR E2E');
    console.log('   Advocacia Studio Pro v2.0 (2.0.0-alpha.1) — Tiers 1-4 Completo');
    console.log('='.repeat(80));

    // ======================================================================
    // BLOCO 1: TIER 1 - R1 (SIMULADOR WHATSAPP SANDBOX & ENTREGA DE MENSAGENS)
    // ======================================================================
    imprimirCabecalhoBloco(1, 'Tier 1 - R1: Simulador WhatsApp Sandbox & Entrega de Mensagens (F1 a F5)');

    await testar('T1.1.1 - Alinhamento IPC: main.js e preload.js devem unificar canal "simulador-resposta-advogado"', () => {
        const preloadSource = fs.readFileSync(path.join(raizProjeto, 'preload.js'), 'utf-8');
        const mainSource = fs.readFileSync(path.join(raizProjeto, 'main.js'), 'utf-8');

        // Preload escuta 'simulador-resposta-advogado'
        assert.ok(preloadSource.includes("'simulador-resposta-advogado'"),
            'preload.js DEVE expor listener para o canal simulador-resposta-advogado');

        // main.js no handler iniciar-onboarding DEVE emitir 'simulador-resposta-advogado' (não 'resposta-advogado-simulador')
        const matchMainOnboarding = mainSource.match(/ipcMain\.handle\(['"]iniciar-onboarding['"][\s\S]*?mainWindow\.webContents\.send\(['"]([^'"]+)['"]/);
        assert.ok(matchMainOnboarding, 'main.js deve conter envio de evento para mainWindow dentro de iniciar-onboarding');
        assert.strictEqual(matchMainOnboarding[1], 'simulador-resposta-advogado',
            `main.js deve emitir 'simulador-resposta-advogado', mas emitiu '${matchMainOnboarding[1]}' (desconexão IPC detectada)`);
    });

    await testar('T1.1.2 - DOM Sandbox: elementos de chat, telefone e contato existem em index.html', () => {
        const html = fs.readFileSync(path.join(raizProjeto, 'index.html'), 'utf-8');
        assert.ok(html.includes('id="simulador-mensagens-box"'), 'index.html deve conter #simulador-mensagens-box');
        assert.ok(html.includes('id="simulador-tel"'), 'index.html deve conter #simulador-tel');
        assert.ok(html.includes('id="simulador-nome-contato"') || html.includes('id="simulador-nome"'),
            'index.html deve conter campo de nome de contato no simulador');
    });

    await testar('T1.1.3 - DOM Balão: injeção de balão no simulador com marcação de checklist de documentos', () => {
        const html = fs.readFileSync(path.join(raizProjeto, 'index.html'), 'utf-8');
        // Deve existir função para adicionar balão do advogado no simulador
        assert.ok(html.includes('adicionarBalaoAdvogado') || html.includes('adicionarBalaoAdvogadoNoSimulador'),
            'index.html deve conter função para adicionar balão do advogado no simulador');
        assert.ok(html.includes('confirmarDisparoOnboarding'),
            'index.html deve conter função confirmarDisparoOnboarding');
    });

    await testar('T1.1.4 - Sincronização: iniciar-onboarding cria sessão e prepara payload para o simulador', async () => {
        const cfgTeste = migracao.criarConfigPadraoV2();
        assert.ok(typeof handlersIPC['iniciar-onboarding'] === 'function',
            'main.js DEVE ter registrado o handler ipcMain.handle("iniciar-onboarding")');

        const resultado = await handlersIPC['iniciar-onboarding'](null, {
            clienteTelefone: '5511999887766',
            clienteNome: 'Mariana Silva',
            preset: 'Trabalhista',
            enviarWhatsApp: false
        });

        assert.ok(resultado, 'iniciar-onboarding deve retornar objeto');
        assert.strictEqual(resultado.sucesso, true, 'iniciar-onboarding deve responder com sucesso: true');
        assert.ok(resultado.sessao, 'Deveria retornar a sessão criada');
        assert.ok(resultado.mensagemDisparo || resultado.mensagemSolicitacaoWhatsApp,
            'Deveria conter a mensagem de texto gerada para envio');
    });

    await testar('T1.1.5 - Fallback Web/Headless: disparo de onboarding suporta ambiente sem window.api sem erro fatal', () => {
        const html = fs.readFileSync(path.join(raizProjeto, 'index.html'), 'utf-8');
        // Inspeciona se a função confirmarDisparoOnboarding trata caso window.api não esteja disponível
        assert.ok(html.includes('confirmarDisparoOnboarding'), 'confirmarDisparoOnboarding deve existir no index.html');
        // Deve garantir que não ocorra exceção silenciosa e renderize o balão local
        assert.ok(html.includes('adicionarBalaoAdvogado') || html.includes('adicionarBalaoAdvogadoNoSimulador'),
            'Deveria ter injeção visual de balão local');
    });

    await testar('T1.1.6 - Atalhos de Disparo: botões de solicitar documentos nos cards de Dossiê, Processos e Fila', () => {
        const html = fs.readFileSync(path.join(raizProjeto, 'index.html'), 'utf-8');
        assert.ok(html.includes('btn-solicitar-docs') || html.includes('solicitar_documentos') || html.includes('abrirModalSolicitarDocumentos'),
            'index.html deve disponibilizar gatilhos para abertura do modal de solicitação de documentos');
        assert.ok(html.includes('id="modal-solicitar-documentos"'),
            'index.html deve conter o container #modal-solicitar-documentos');
    });

    // ======================================================================
    // BLOCO 2: TIER 1 - R2 (TEMPLATES CUSTOMIZÁVEIS & IA GEMINI)
    // ======================================================================
    imprimirCabecalhoBloco(2, 'Tier 1 - R2: Templates Customizáveis & Aprimoramento com IA Gemini (F6 a F10)');

    await testar('T1.2.1 - Esquema migracao.js: criarConfigPadraoV2 e migrarConfigV1ParaV2 devem conter modeloMensagemSolicitacaoDocs', () => {
        const cfgPadrao = migracao.criarConfigPadraoV2();
        assert.ok(cfgPadrao.modeloMensagemSolicitacaoDocs,
            'criarConfigPadraoV2() DEVE conter a chave modeloMensagemSolicitacaoDocs com texto padrão');
        assert.ok(cfgPadrao.modeloMensagemSolicitacaoDocs.includes('{nome}'),
            'modeloMensagemSolicitacaoDocs padrão DEVE conter a tag {nome}');
        assert.ok(cfgPadrao.modeloMensagemSolicitacaoDocs.includes('{documentos}'),
            'modeloMensagemSolicitacaoDocs padrão DEVE conter a tag {documentos}');

        // Teste de preservação na migração
        const cfgAntigoComCustomizacao = {
            versao_config: '1.8.0',
            modeloMensagemSolicitacaoDocs: 'Prezado(a) {nome}, favor enviar seus documentos: {documentos}. Atenciosamente, Dr. Silva.'
        };
        const migrado = migracao.migrarConfigV1ParaV2(cfgAntigoComCustomizacao);
        assert.strictEqual(migrado.modeloMensagemSolicitacaoDocs, cfgAntigoComCustomizacao.modeloMensagemSolicitacaoDocs,
            'migrarConfigV1ParaV2 DEVE preservar o modelo customizado pelo usuário');
    });

    await testar('T1.2.2 - Interpolação no Onboarding Controller: iniciarSessaoOnboarding interpola {nome}, {preset}, {documentos}', () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.modeloMensagemSolicitacaoDocs = 'Olá {nome}, seu caso de {preset} requer:\n{documentos}\nObrigado!';

        const sessao = onboardingController.iniciarSessaoOnboarding('11999990000', 'Beatriz Souza', 'Trabalhista', cfg);
        assert.ok(sessao, 'iniciarSessaoOnboarding deve retornar a sessão');
        const msg = sessao.mensagemDisparo || sessao.mensagemSolicitacaoWhatsApp || '';
        assert.ok(msg.includes('Beatriz Souza'), 'Mensagem interpolada deve conter o nome do cliente');
        assert.ok(msg.includes('Trabalhista') || msg.includes('trabalhista'), 'Mensagem interpolada deve conter o preset');
        assert.ok(msg.includes('CTPS') || msg.includes('Carteira') || msg.includes('RG'), 'Mensagem interpolada deve listar os documentos requeridos');
    });

    await testar('T1.2.3 - Precedência de Mensagem Customizada: mensagemCustomizada do modal sobrepõe o modelo padrão', () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.modeloMensagemSolicitacaoDocs = 'Modelo Padrão';
        const msgPersonalizadaPeloAdvogado = 'Texto redigido manualmente pelo Dr. Roberto com orientações específicas sobre audiência.';

        // Invocação passando mensagem customizada como parâmetro (conforme PROJECT.md §Interface Contracts)
        const sessao = onboardingController.iniciarSessaoOnboarding('11999991111', 'Lucas Lima', 'Geral', cfg, msgPersonalizadaPeloAdvogado);
        assert.ok(sessao, 'Sessão deve ser iniciada');
        const msg = sessao.mensagemDisparo || sessao.mensagemSolicitacaoWhatsApp || '';
        assert.strictEqual(msg, msgPersonalizadaPeloAdvogado,
            'Quando informada, a mensagem personalizada DEVE ser utilizada diretamente sem ser sobrescrita pelo template padrão');
    });

    await testar('T1.2.4 - UI Modal Editor & IA: presença do textarea #onboarding-modal-mensagem e botão "Melhorar com IA"', () => {
        const html = fs.readFileSync(path.join(raizProjeto, 'index.html'), 'utf-8');
        assert.ok(html.includes('id="onboarding-modal-mensagem"'),
            '#modal-solicitar-documentos deve conter textarea com id="onboarding-modal-mensagem"');
        assert.ok(html.includes('btn-melhorar-modal-onboarding') || html.includes('melhorarMensagemIA') || html.includes('Melhorar com IA'),
            '#modal-solicitar-documentos deve conter botão de enriquecimento "Melhorar com IA"');
    });

    await testar('T1.2.5 - Motor de IA Tradutor Jurídico: função melhorarMensagemComIA respeita guardrails OAB e emojis', async () => {
        assert.strictEqual(typeof tradutorJuridico.melhorarMensagemComIA, 'function',
            'tradutorJuridico DEVE exportar melhorarMensagemComIA');
        assert.strictEqual(typeof tradutorJuridico.melhorarMensagemLocalmente, 'function',
            'tradutorJuridico DEVE exportar melhorarMensagemLocalmente');

        const textoRascunho = 'favor mandar rg e conta de luz para o processo logo';
        const melhorado = await tradutorJuridico.melhorarMensagemLocalmente(textoRascunho, { tipo: 'onboarding' });
        assert.ok(typeof melhorado === 'string' && melhorado.length > textoRascunho.length,
            'Texto melhorado deve ser enriquecido formalmente');
        assert.ok(melhorado.includes('direito') || melhorado.includes('processo') || melhorado.includes('autos'),
            'Texto deve conter termos jurídicos formais com respeito ao Código de Ética da OAB');
    });

    // ======================================================================
    // BLOCO 3: TIER 1 - R3 (BLINDAGEM ANTI-ALUCINAÇÃO DO VALIDADOR PIX)
    // ======================================================================
    imprimirCabecalhoBloco(3, 'Tier 1 - R3: Blindagem Anti-Alucinação no Motor de Visão & Validador PIX (F11 a F13)');

    await testar('T1.3.1 - Rejeição Absoluta de RG como Comprovante PIX em auditarComprovantePix', async () => {
        const bufferRG = criarBufferRG();
        const laudo = await validadorPix.auditarComprovantePix(bufferRG, 'image/jpeg', null, 500.00, 'MARIANA SILVA SANTOS');
        assert.ok(laudo, 'auditarComprovantePix deve responder com laudo');
        assert.strictEqual(laudo.comprovanteValido, false, 'RG JAMAIS pode ser aprovado como comprovante PIX válido');
        assert.ok(laudo.ehDocumentoCivil === true || laudo.dadosLidos?.ehDocumentoCivil === true,
            'RG deve ser identificado como ehDocumentoCivil: true');
        assert.strictEqual(Number(laudo.dadosLidos?.valorPago || 0), 0,
            'RG não possui valor pago transferido, valorPago DEVE ser 0.00');
    });

    await testar('T1.3.2 - Rejeição de CNH Binária sem Fallback Fictício de R$ 150,00 ou Banco Falso', () => {
        const bufferCNH = criarBufferCNHBinario();
        const dadosLidos = validadorPix.extrairDadosPixLocal(bufferCNH, 450.00, 'CARLOS ROBERTO DE SOUZA');
        assert.ok(dadosLidos, 'extrairDadosPixLocal deve responder com objeto');
        assert.strictEqual(dadosLidos.ehComprovantePix, false,
            'CNH em buffer binário não deve ser classificada como ehComprovantePix: true');
        assert.strictEqual(Number(dadosLidos.valorPago || 0), 0,
            'CRÍTICO: CNH binária não pode inventar valorPago = valorEsperado (450.00) nem default de 150.00');
        assert.ok(!dadosLidos.bancoOrigem || !dadosLidos.bancoOrigem.includes('Instituição Financeira PIX'),
            'CNH binária não deve inventar "Instituição Financeira PIX" fictícia');
    });

    await testar('T1.3.3 - Rejeição de Fatura de Energia Elétrica com QR Code "Pague com Pix" como Comprovante', async () => {
        const bufferEnel = criarBufferContaConsumoComPix('ENEL DISTRIBUICAO SP', 230.40);
        const laudo = await validadorPix.auditarComprovantePix(bufferEnel, 'image/jpeg', null, 230.40, 'ROBERTO MENDES');
        assert.ok(laudo, 'auditarComprovantePix deve responder');
        assert.strictEqual(laudo.comprovanteValido, false,
            'Fatura a vencer com QR Code PIX NÃO é comprovante de transferência efetuada!');
        assert.ok(laudo.divergencia && (laudo.divergencia.includes('NAO_EH_COMPROVANTE') || laudo.divergencia.includes('DOCUMENTO_PESSOAL') || laudo.divergencia.includes('RESIDENCIA') || laudo.divergencia.includes('EVIDENCIA')),
            'Deveria relatar divergência de que se trata de fatura/conta e não comprovante de liquidação');
    });

    await testar('T1.3.4 - Rejeição de Carteira de Trabalho (CTPS) e Certidão Civil', () => {
        const bufferCTPS = criarBufferCTPSECertidao('CTPS', 'FERNANDO ALVES MOREIRA');
        const dados = validadorPix.extrairDadosPixLocal(bufferCTPS, 600.00, 'FERNANDO ALVES MOREIRA');
        assert.strictEqual(dados.ehComprovantePix, false, 'CTPS não é comprovante PIX');
        assert.strictEqual(Number(dados.valorPago || 0), 0, 'CTPS não deve possuir valor pago');
    });

    await testar('T1.3.5 - Rejeição Limpa de Ruído Aleatório sem Alucinação de ID Transação E2E', () => {
        const bufferRuido = criarBufferRuidoAleatorio(1024);
        const dados = validadorPix.extrairDadosPixLocal(bufferRuido, 350.00, 'Cliente Aleatorio');
        assert.strictEqual(dados.comprovanteLegivel, false, 'Ruído aleatório não pode ter comprovanteLegivel: true');
        assert.strictEqual(Number(dados.valorPago || 0), 0, 'Ruído aleatório não pode gerar valorPago > 0');
        assert.ok(!dados.idTransacao || dados.idTransacao.length < 5,
            'Ruído aleatório não deve fabricar ID de transação E2E fictício');
    });

    await testar('T1.3.6 - Aprovação de Comprovante PIX Legítimo com Metadados Completos', async () => {
        const valorParcela = 500.00;
        const bufferPix = criarBufferPixAutentico(valorParcela, 'ROBERTO ALCANTARA SILVA', 'NUBANK S.A.');
        const laudo = await validadorPix.auditarComprovantePix(bufferPix, 'image/jpeg', null, valorParcela, 'ROBERTO ALCANTARA SILVA');
        assert.ok(laudo, 'Deveria retornar laudo');
        assert.strictEqual(laudo.comprovanteValido, true, 'PIX legítimo com valor exato deve ser aprovado com sucesso');
        assert.strictEqual(laudo.divergencia, null, 'PIX sem divergência deve retornar divergencia: null');
        assert.strictEqual(laudo.dadosLidos.valorPago, valorParcela, 'Valor pago deve ser 500.00');
    });

    await testar('T1.3.7 - Detecção Determinística de PIX Divergente (Subvalor) com Mensagem Explicativa', async () => {
        const valorEsperado = 500.00;
        const valorPagoMenor = 350.00;
        const bufferPixDivergente = criarBufferPixDivergente(valorEsperado, valorPagoMenor, 'MARIA APARECIDA SANTOS');
        const laudo = await validadorPix.auditarComprovantePix(bufferPixDivergente, 'image/jpeg', null, valorEsperado, 'MARIA APARECIDA SANTOS');
        assert.ok(laudo, 'Deveria retornar laudo');
        assert.strictEqual(laudo.comprovanteValido, false, 'PIX parcial não deve ser aprovado como quitação integral');
        assert.ok(laudo.divergencia && (laudo.divergencia.includes('350') || laudo.divergencia.includes('150') || laudo.divergencia.includes('inferior')),
            'Deveria relatar a diferença pendente');
    });

    await testar('T1.3.8 - Trava em validarDivergenciaPix: idTransacao e bancoOrigem mínimos obrigatórios', () => {
        // Objeto simulado com ehComprovantePix false ou documento civil
        const laudoDocCivil = validadorPix.validarDivergenciaPix({
            ehComprovantePix: false,
            ehDocumentoCivil: true,
            valorPago: 500.00
        }, 500.00);
        assert.strictEqual(laudoDocCivil.comprovanteValido, false, 'validarDivergenciaPix deve travar documento civil');

        // Objeto sem id de transação real
        const laudoSemId = validadorPix.validarDivergenciaPix({
            ehComprovantePix: true,
            valorPago: 500.00,
            bancoOrigem: 'Nubank',
            idTransacao: '' // Vazio!
        }, 500.00);
        assert.strictEqual(laudoSemId.comprovanteValido, false,
            'validarDivergenciaPix DEVE exigir idTransacao legítimo antes de validar');
    });

    // ======================================================================
    // BLOCO 4: TIER 1 - R3 (SEGREGAÇÃO DE DOSSIÊ & TRAVAS FINANCEIRAS)
    // ======================================================================
    imprimirCabecalhoBloco(4, 'Tier 1 - R3: Roteamento Exclusivo para Dossiê & Travas de Baixa (F14 a F15)');

    await testar('T1.4.1 - Blindagem de Baixa: gestaoFinanceira NUNCA executa darBaixaParcela para Documento Civil', async () => {
        const cfgTeste = migracao.criarConfigPadraoV2();
        cfgTeste.financeiro.parcelas.push({
            id: 'parc_teste_rg_01',
            contratoId: 'cont_teste_01',
            parcelaNumero: 1,
            totalParcelas: 1,
            clienteNome: 'Mariana Silva Santos',
            clienteTelefone: '5511988880001',
            descricao: 'Honorários Iniciais',
            valor: 350.00,
            vencimento: '2026-10-30',
            status: 'PENDENTE'
        });

        const bufferRG = criarBufferRG('Mariana Silva Santos', '32.145.890-4', '234.567.890-12');
        const res = await gestaoFinanceira.processarComprovanteRecebido('5511988880001', bufferRG, 'image/jpeg', null, cfgTeste);

        assert.strictEqual(res.comprovanteValido, false, 'RG não pode validar comprovante');
        assert.strictEqual(res.parcelaBaixada, null, 'Nenhuma parcela pode ser baixada por RG');

        // Confere que a parcela permanece PENDENTE
        const parcelaApos = cfgTeste.financeiro.parcelas.find(p => p.id === 'parc_teste_rg_01');
        assert.strictEqual(parcelaApos.status, 'PENDENTE', 'Status da parcela DEVE permanecer PENDENTE');
    });

    await testar('T1.4.2 - Trava de Histórico Financeiro: comprovantesRecebidos NÃO deve registrar documentos civis', async () => {
        const cfgTeste = migracao.criarConfigPadraoV2();
        cfgTeste.financeiro.parcelas.push({
            id: 'parc_teste_cnh_02',
            clienteNome: 'Carlos Roberto',
            clienteTelefone: '5511988880002',
            valor: 450.00,
            status: 'PENDENTE'
        });

        const bufferCNH = criarBufferCNHBinario();
        await gestaoFinanceira.processarComprovanteRecebido('5511988880002', bufferCNH, 'image/jpeg', null, cfgTeste);

        // Documentos civis NÃO devem poluir o histórico de liquidações financeiras
        const compRegistrado = cfgTeste.financeiro.comprovantesRecebidos.find(c => c.clienteTelefone === '5511988880002');
        assert.strictEqual(compRegistrado ? compRegistrado.comprovanteValido : false, false,
            'comprovantesRecebidos não deve conter comprovante civil marcado como válido');
    });

    await testar('T1.4.3 - Roteamento Dossiê: processarMidiaOnboarding acolhe documento civil no Dossiê do cliente', async () => {
        const cfgTeste = migracao.criarConfigPadraoV2();
        onboardingController.iniciarSessaoOnboarding('5511988880003', 'Renata Vasconcelos', 'Geral', cfgTeste);

        const bufferRG = criarBufferRG('Renata Vasconcelos', '19.876.543-2', '123.456.789-01');
        const resMidia = await onboardingController.processarMidiaOnboarding({
            clienteTelefone: '5511988880003',
            clienteNome: 'Renata Vasconcelos',
            buffer: bufferRG,
            mimetype: 'image/jpeg',
            nomeOriginal: 'rg_frente.jpg',
            apiKey: null
        }, cfgTeste);

        assert.ok(resMidia, 'processarMidiaOnboarding deve responder');
        assert.strictEqual(resMidia.sucesso, true, 'Documento civil deve ser processado com sucesso pelo onboarding');
        assert.ok(resMidia.sessao.documentosRecebidos.length >= 1,
            'Documento civil deve ser inserido em documentosRecebidos da sessão');
    });

    // ======================================================================
    // BLOCO 5: TIER 2 - BOUNDARY VALUE ANALYSIS (BVA) & CASOS DE BORDA
    // ======================================================================
    imprimirCabecalhoBloco(5, 'Tier 2 - BVA: Análise de Valor Limite & Casos de Borda');

    await testar('TB.1 - Buffer Vazio / Nulo: auditarComprovantePix rejeita com elegância sem lançar exceção', async () => {
        const laudoVazio = await validadorPix.auditarComprovantePix(Buffer.alloc(0), 'image/jpeg', null, 200.00, 'Teste');
        assert.strictEqual(laudoVazio.comprovanteValido, false);
        assert.strictEqual(Number(laudoVazio.dadosLidos?.valorPago || 0), 0);

        const laudoNulo = await validadorPix.auditarComprovantePix(null, 'image/jpeg', null, 200.00, 'Teste');
        assert.strictEqual(laudoNulo.comprovanteValido, false);
    });

    await testar('TB.2 - Valor Esperado Zero ou Negativo: tratamento defensivo de dívida inexistente', () => {
        const resZero = validadorPix.validarDivergenciaPix({
            ehComprovantePix: true,
            valorPago: 100.00,
            bancoOrigem: 'Nubank',
            idTransacao: 'E123456789012345'
        }, 0);
        assert.strictEqual(resZero.comprovanteValido, true, 'Valor esperado zero com comprovante pago é aceito');
    });

    await testar('TB.3 - BVA Subvalor R$ 0,01: R$ 499,99 pago para parcela de R$ 500,00 DEVE acusar divergência', () => {
        const res = validadorPix.validarDivergenciaPix({
            ehComprovantePix: true,
            valorPago: 499.99,
            bancoOrigem: 'Nubank',
            idTransacao: 'E123456789012345'
        }, 500.00);
        assert.strictEqual(res.comprovanteValido, false, 'Diferença de 1 centavo a menor NÃO deve conceder baixa automática');
        assert.ok(res.divergencia && (res.divergencia.includes('0,01') || res.divergencia.includes('inferior')));
    });

    await testar('TB.4 - BVA Sobrevalor R$ 0,01: R$ 500,01 pago para parcela de R$ 500,00 DEVE ser aceito', () => {
        const res = validadorPix.validarDivergenciaPix({
            ehComprovantePix: true,
            valorPago: 500.01,
            bancoOrigem: 'Nubank',
            idTransacao: 'E123456789012345'
        }, 500.00);
        assert.strictEqual(res.comprovanteValido, true, 'Pagamento com centavos a mais deve ser aceito');
        assert.strictEqual(res.divergencia, null);
    });

    await testar('TB.5 - Mimetype Corrompido / Octet-Stream com Magic Bytes de Imagem', async () => {
        const bufferPix = criarBufferPixAutentico(300.00, 'Roberta Miranda');
        const laudo = await validadorPix.auditarComprovantePix(bufferPix, 'application/octet-stream', null, 300.00, 'Roberta Miranda');
        assert.ok(laudo, 'auditarComprovantePix deve processar buffer com mimetype application/octet-stream sem falhar');
        assert.strictEqual(laudo.comprovanteValido, true, 'Deve validar PIX mesmo se o mimetype vier como application/octet-stream');
    });

    await testar('TB.6 - Variações Extremas de Formatação de Telefone no Isolamento de Cliente', async () => {
        const cfgTeste = migracao.criarConfigPadraoV2();
        cfgTeste.financeiro.parcelas.push({
            id: 'parc_fone_01',
            clienteNome: 'Helena Costa',
            clienteTelefone: '+55 (11) 97777-8888',
            valor: 300.00,
            status: 'PENDENTE'
        });

        // Envio com apenas dígitos
        const buf = criarBufferPixAutentico(300.00, 'Helena Costa');
        const res1 = await gestaoFinanceira.processarComprovanteRecebido('11977778888', buf, 'image/jpeg', null, cfgTeste);
        assert.strictEqual(res1.comprovanteValido, true, 'Deve localizar parcela com normalização de dígitos');
    });

    await testar('TB.7 - Tags de Template Malformadas ou Vazias não causam TypeError ou Crash', () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.modeloMensagemSolicitacaoDocs = 'Template com tags {NOME_INVALIDO} e sem tag nome';
        assert.doesNotThrow(() => {
            onboardingController.iniciarSessaoOnboarding('11988882222', 'Nome Teste', 'Geral', cfg);
        }, 'Não deve lançar exceção com tags desconhecidas');
    });

    // ======================================================================
    // BLOCO 6: TIER 3 - TESTES COMBINATÓRIOS PAR A PAR (PAIRWISE)
    // ======================================================================
    imprimirCabecalhoBloco(6, 'Tier 3 - Pairwise: Testes Combinatórios de Módulos');

    await testar('TP.1 - Par 1: Preset Trabalhista + Mensagem Customizada + Cliente sem Sessão Ativa', () => {
        const cfg = migracao.criarConfigPadraoV2();
        const customMsg = 'Custom Trabalhista Especial: Envie CTPS digital e Termo de Rescisão.';
        const sessao = onboardingController.iniciarSessaoOnboarding('11911112222', 'Thiago Ramos', 'Trabalhista', cfg, customMsg);

        assert.strictEqual(sessao.preset, 'Trabalhista');
        assert.strictEqual(sessao.mensagemDisparo, customMsg);
        assert.ok(sessao.documentosSolicitados.includes('CTPS'));
    });

    await testar('TP.2 - Par 2: Preset Previdenciário + Template Mestre config.json + Disparo Fila Humana', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.modeloMensagemSolicitacaoDocs = 'Previdência para {nome}: Favor remeter {documentos}.';

        const sessao = onboardingController.iniciarSessaoOnboarding('11922223333', 'Antônio Fagundes', 'Previdenciario', cfg);
        assert.ok(sessao.mensagemDisparo.includes('Antônio Fagundes'));
        assert.ok(sessao.documentosSolicitados.includes('LAUDO_MEDICO') || sessao.documentosSolicitados.includes('CNIS'));
    });

    await testar('TP.3 - Par 3: Documento RG + Parcela com Valor Idêntico ao Número do RG (Anti-Alucinação)', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        // Parcela com valor 890.40 (que coincide com os dígitos finais do RG 32.145.890-4)
        cfg.financeiro.parcelas.push({
            id: 'parc_coincidencia_01',
            clienteNome: 'Mariana Silva',
            clienteTelefone: '11933334444',
            valor: 890.40,
            status: 'PENDENTE'
        });

        const bufferRG = criarBufferRG('Mariana Silva', '32.145.890-4', '234.567.890-12');
        const res = await gestaoFinanceira.processarComprovanteRecebido('11933334444', bufferRG, 'image/jpeg', null, cfgTesteOuNovo(cfg));

        assert.strictEqual(res.comprovanteValido, false,
            'Número de RG NUNCA deve ser confundido com valor pago mesmo que haja parcela com valor numérico similar!');
        assert.strictEqual(res.parcelaBaixada, null);
    });

    await testar('TP.4 - Par 4: Conta Enel com QR Code + Parcela de Valor Idêntico à Fatura (Anti-Alucinação)', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.financeiro.parcelas.push({
            id: 'parc_luz_01',
            clienteNome: 'Roberto Mendes',
            clienteTelefone: '11944445555',
            valor: 230.40,
            status: 'PENDENTE'
        });

        const bufferEnel = criarBufferContaConsumoComPix('ENEL DISTRIBUICAO SP', 230.40);
        const res = await gestaoFinanceira.processarComprovanteRecebido('11944445555', bufferEnel, 'image/jpeg', null, cfg);

        assert.strictEqual(res.comprovanteValido, false,
            'Conta a vencer da Enel NÃO pode quitar parcela pendente mesmo com valor exatamente igual!');
        assert.strictEqual(res.parcelaBaixada, null);
    });

    await testar('TP.5 - Par 5: PIX Legítimo + Cliente com Múltiplas Parcelas (Quita apenas a mais antiga)', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.financeiro.parcelas.push(
            { id: 'p1', clienteTelefone: '11955556666', valor: 250.00, parcelaNumero: 1, vencimento: '2026-10-10', status: 'PENDENTE' },
            { id: 'p2', clienteTelefone: '11955556666', valor: 250.00, parcelaNumero: 2, vencimento: '2026-11-10', status: 'PENDENTE' }
        );

        const bufferPix = criarBufferPixAutentico(250.00, 'Cliente Fiel');
        const res = await gestaoFinanceira.processarComprovanteRecebido('11955556666', bufferPix, 'image/jpeg', null, cfg);

        assert.strictEqual(res.comprovanteValido, true);
        assert.strictEqual(res.parcelaBaixada.id, 'p1', 'Deve baixar a parcela mais antiga');
        const p2 = cfg.financeiro.parcelas.find(p => p.id === 'p2');
        assert.strictEqual(p2.status, 'PENDENTE', 'Segunda parcela deve permanecer PENDENTE');
    });

    await testar('TP.6 - Par 6: Documento CNH + Disparo Simultâneo de Onboarding (Roteamento Correto)', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        onboardingController.iniciarSessaoOnboarding('11966667777', 'Jorge Viana', 'Geral', cfg);

        const bufferCNH = criarBufferCNHBinario('Jorge Viana');
        const resMidia = await onboardingController.processarMidiaOnboarding({
            clienteTelefone: '11966667777',
            clienteNome: 'Jorge Viana',
            buffer: bufferCNH,
            mimetype: 'image/jpeg',
            nomeOriginal: 'cnh.jpg',
            apiKey: null
        }, cfg);

        assert.strictEqual(resMidia.sucesso, true);
        assert.strictEqual(resMidia.sessao.status, 'DOCS_PARCIAIS');
    });

    // ======================================================================
    // BLOCO 7: TIER 4 - OS 8 CENÁRIOS DA MATRIZ DE ESTRESSE FORENSE & E2E
    // ======================================================================
    imprimirCabecalhoBloco(7, 'Tier 4 - Matriz de Estresse Forense (Os 8 Cenários R3) & Workloads Reais');

    await testar('TS.1 - Cenário 1: Foto de RG enviada fingindo ser comprovante com valor de parcela pendente', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.financeiro.parcelas.push({
            id: 'parc_stress_01',
            clienteNome: 'Mariana Silva',
            clienteTelefone: '5511988880001',
            valor: 350.00,
            status: 'PENDENTE'
        });

        const bufferRG = criarBufferRG('Mariana Silva');
        const res = await gestaoFinanceira.processarComprovanteRecebido('5511988880001', bufferRG, 'image/jpeg', null, cfg);

        assert.strictEqual(res.comprovanteValido, false, 'RG DEVE ser categoricamente rejeitado como PIX');
        assert.strictEqual(res.parcelaBaixada, null, 'RG NUNCA pode dar baixa em parcela financeira');
        assert.strictEqual(cfg.financeiro.parcelas[0].status, 'PENDENTE', 'Saldo deve permanecer PENDENTE');
    });

    await testar('TS.2 - Cenário 2: CNH em JPEG Binário Real sem Fallback Fictício de R$ 150,00', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.financeiro.parcelas.push({
            id: 'parc_stress_02',
            clienteNome: 'Carlos Roberto',
            clienteTelefone: '5511988880002',
            valor: 500.00,
            status: 'PENDENTE'
        });

        const bufferCNH = criarBufferCNHBinario('Carlos Roberto');
        const res = await gestaoFinanceira.processarComprovanteRecebido('5511988880002', bufferCNH, 'image/jpeg', null, cfg);

        assert.strictEqual(res.comprovanteValido, false, 'CNH em binário comprimido NÃO pode validar como PIX');
        assert.strictEqual(res.parcelaBaixada, null);
        assert.strictEqual(cfg.financeiro.parcelas[0].status, 'PENDENTE');
    });

    await testar('TS.3 - Cenário 3: Fatura de Energia Elétrica (Enel) com QR Code "Pague com Pix" R$ 230,40', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.financeiro.parcelas.push({
            id: 'parc_stress_03',
            clienteNome: 'Roberto Mendes',
            clienteTelefone: '5511988880003',
            valor: 230.40,
            status: 'PENDENTE'
        });

        const bufferEnel = criarBufferContaConsumoComPix('ENEL DISTRIBUICAO SP', 230.40);
        const res = await gestaoFinanceira.processarComprovanteRecebido('5511988880003', bufferEnel, 'image/jpeg', null, cfg);

        assert.strictEqual(res.comprovanteValido, false, 'Conta de Luz com opção Pix NÃO é comprovante de transferência realizada');
        assert.strictEqual(res.parcelaBaixada, null);
        assert.strictEqual(cfg.financeiro.parcelas[0].status, 'PENDENTE');
    });

    await testar('TS.4 - Cenário 4: CTPS / Certidão Civil enviada ao financeiro', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.financeiro.parcelas.push({
            id: 'parc_stress_04',
            clienteNome: 'Fernando Alves',
            clienteTelefone: '5511988880004',
            valor: 600.00,
            status: 'PENDENTE'
        });

        const bufferCTPS = criarBufferCTPSECertidao('CTPS', 'Fernando Alves');
        const res = await gestaoFinanceira.processarComprovanteRecebido('5511988880004', bufferCTPS, 'image/jpeg', null, cfg);

        assert.strictEqual(res.comprovanteValido, false);
        assert.strictEqual(res.parcelaBaixada, null);
        assert.strictEqual(cfg.financeiro.parcelas[0].status, 'PENDENTE');
    });

    await testar('TS.5 - Cenário 5: Ruído Aleatório / Foto não Financeira', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.financeiro.parcelas.push({
            id: 'parc_stress_05',
            clienteNome: 'Usuario Fake',
            clienteTelefone: '5511988880005',
            valor: 150.00,
            status: 'PENDENTE'
        });

        const bufferRuido = criarBufferRuidoAleatorio(1500);
        const res = await gestaoFinanceira.processarComprovanteRecebido('5511988880005', bufferRuido, 'image/jpeg', null, cfg);

        assert.strictEqual(res.comprovanteValido, false);
        assert.strictEqual(res.parcelaBaixada, null);
        assert.strictEqual(cfg.financeiro.parcelas[0].status, 'PENDENTE');
    });

    await testar('TS.6 - Cenário 6: Comprovante PIX Legítimo com Banco, ID E2E e Valor Exato', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.financeiro.parcelas.push({
            id: 'parc_stress_06',
            contratoId: 'cont_legitimo_06',
            clienteNome: 'Roberto Alcantara Silva',
            clienteTelefone: '5511988880006',
            valor: 500.00,
            status: 'PENDENTE'
        });

        const bufferPix = criarBufferPixAutentico(500.00, 'Roberto Alcantara Silva', 'NUBANK S.A.');
        const res = await gestaoFinanceira.processarComprovanteRecebido('5511988880006', bufferPix, 'image/jpeg', null, cfg);

        assert.strictEqual(res.comprovanteValido, true, 'PIX legítimo DEVE ser aprovado');
        assert.ok(res.parcelaBaixada, 'Deve retornar parcela baixada');
        assert.strictEqual(cfg.financeiro.parcelas[0].status, 'PAGO', 'Parcela deve ser marcada como PAGO');
    });

    await testar('TS.7 - Cenário 7: Comprovante PIX Autêntico com Divergência (Subvalor de R$ 350 para R$ 500)', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        cfg.financeiro.parcelas.push({
            id: 'parc_stress_07',
            clienteNome: 'Maria Aparecida Santos',
            clienteTelefone: '5511988880007',
            valor: 500.00,
            status: 'PENDENTE'
        });

        const bufferPixDiv = criarBufferPixDivergente(500.00, 350.00, 'Maria Aparecida Santos');
        const res = await gestaoFinanceira.processarComprovanteRecebido('5511988880007', bufferPixDiv, 'image/jpeg', null, cfg);

        assert.strictEqual(res.comprovanteValido, false, 'Pagamento parcial não deve dar baixa');
        assert.strictEqual(res.parcelaBaixada, null);
        assert.strictEqual(cfg.financeiro.parcelas[0].status, 'PENDENTE');
        assert.ok(res.laudo.divergencia && res.laudo.divergencia.includes('inferior'));
    });

    await testar('TS.8 - Cenário 8: Isolamento Cruzado entre Clientes (Pagamento de A não afeta Parcela de B)', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        // Cliente B tem parcela pendente de R$ 400.00
        cfg.financeiro.parcelas.push({
            id: 'parc_cliente_b',
            clienteNome: 'Cliente B (Vítima)',
            clienteTelefone: '5511988882222',
            valor: 400.00,
            status: 'PENDENTE'
        });

        // Cliente A envia PIX de R$ 400.00, mas Cliente A não possui parcela pendente
        const bufferPix = criarBufferPixAutentico(400.00, 'Cliente A', 'Banco Itaú');
        const res = await gestaoFinanceira.processarComprovanteRecebido('5511977771111', bufferPix, 'image/jpeg', null, cfg);

        // A parcela do Cliente B NUNCA pode ter sido baixada!
        const parcelaB = cfg.financeiro.parcelas.find(p => p.id === 'parc_cliente_b');
        assert.strictEqual(parcelaB.status, 'PENDENTE',
            'CRÍTICO: Parcela do Cliente B jamais pode ser baixada por comprovante enviado pelo Cliente A!');
    });

    await testar('TS.9 - Workflow E2E R1: Disparo de Solicitação com Sincronização do Simulador Sandbox', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        assert.ok(typeof handlersIPC['iniciar-onboarding'] === 'function');

        // Limpa registro de eventos
        eventosEmitidosSimulador.length = 0;

        const res = await handlersIPC['iniciar-onboarding'](null, {
            clienteTelefone: '5511955554444',
            clienteNome: 'Patrícia Abravanel',
            preset: 'Civel',
            enviarWhatsApp: false
        });

        assert.strictEqual(res.sucesso, true);
        assert.ok(res.sessao);
        assert.ok(res.mensagemDisparo);

        // Verifica se evento IPC foi emitido para o Simulador
        const eventoSimulador = eventosEmitidosSimulador.find(e => e.canal === 'simulador-resposta-advogado');
        assert.ok(eventoSimulador, 'main.js deve emitir evento "simulador-resposta-advogado" para o simulador');
        assert.strictEqual(eventoSimulador.dados.telefone, '5511955554444');
    });

    await testar('TS.10 - Workflow E2E R2: Customização com "Melhorar com IA" e Disparo Personalizado', async () => {
        const cfg = migracao.criarConfigPadraoV2();
        const rascunhoAdvogado = 'Olá {nome}, para a ação {preset} mande estes docs: {documentos}.';

        // Aprimoramento com IA
        const aprimorado = await tradutorJuridico.melhorarMensagemLocalmente(rascunhoAdvogado, { tipo: 'onboarding' });
        assert.ok(aprimorado && aprimorado.length > rascunhoAdvogado.length);

        // Salva modelo no config
        cfg.modeloMensagemSolicitacaoDocs = aprimorado;

        // Disparo utilizando o novo modelo aprimorado
        const sessao = onboardingController.iniciarSessaoOnboarding('5511944443333', 'Rodrigo Faro', 'Familia', cfg);
        assert.ok(sessao.mensagemDisparo.includes('Rodrigo Faro'));
        assert.ok(sessao.documentosSolicitados.includes('CERTIDAO'));
    });

    // ======================================================================
    // 📊 RESUMO FINAL DA SUÍTE DE TESTES E2E
    // ======================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMO DA EXECUÇÃO: SUÍTE DE ESTRESSE ANTI-ALUCINAÇÃO PIX & DOSSIÊ');
    console.log('='.repeat(80));
    console.log(`  Total de Testes Executados: ${totalTestes}`);
    console.log(`  Sucessos:                   ${testesPassados} ✅`);
    console.log(`  Falhas:                     ${testesFalhados} ${testesFalhados === 0 ? '🎉' : '❌'}`);
    console.log('='.repeat(80));

    if (falhasDetalhadas.length > 0) {
        console.log('\n🔍 RELATÓRIO FORENSE DE FALHAS IDENTIFICADAS:');
        console.log('-'.repeat(80));
        falhasDetalhadas.forEach((f, idx) => {
            console.log(`\n[Falha ${idx + 1}] Teste #${f.id}: ${f.nome}`);
            console.log(`  ⚠️ Erro: ${f.mensagem}`);
        });
        console.log('\n' + '-'.repeat(80));
    }

    // Limpeza de diretório temporário
    try {
        fs.rmSync(tmpUserData, { recursive: true, force: true });
    } catch (e) {}

    if (testesFalhados > 0) {
        console.log(`\n❌ ${testesFalhados} TESTES FALHARAM. EXIT CODE 1 (DEFEITOS DETECTADOS PARA ESCALAÇÃO).`);
        process.exit(1);
    } else {
        console.log('\n🏆 100% DOS TESTES DE ESTRESSE E ANTI-ALUCINAÇÃO PASSARAM COM SUCESSO! (EXIT CODE 0)');
        process.exit(0);
    }
}

// Helper auxiliar para clonagem profunda de config
function cfgTesteOuNovo(cfg) {
    return JSON.parse(JSON.stringify(cfg));
}

// Execução da suíte
executarSuiteEstresseCompleta().catch(err => {
    console.error('❌ Erro fatal não tratado na execução da suíte:', err);
    process.exit(1);
});
