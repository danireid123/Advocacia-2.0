/**
 * =========================================================================
 * ADVOCACIA STUDIO PRO v2.0 - CHALLENGER 4 INDEPENDENT DEEP ADVERSARIAL HARNESS
 * =========================================================================
 * Empirical, isolated verification of all remediation points:
 * 1. Real DOM bindings on #btn-melhorar-modal-onboarding and #btn-melhorar-template-onboarding
 * 2. Real DOM binding onchange on #onboarding-modal-preset
 * 3. Execution simulation of clicking buttons & changing presets
 * 4. Regex string interpolation with $, $&, $1, $', $`, $$, and arbitrary dollar patterns
 * 5. Degenerate client names (whitespace, empty, unicode, null, undefined)
 * 6. Balloon deduplication in Electron vs headless/web fallback (Empirical simulation)
 * 7. Verification that fake bank/fake ID is never synthesized
 * 8. Replay attack rejection in gestaoFinanceira.js
 * =========================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    iniciarSessaoOnboarding,
    obterSessaoAtiva
} = require('./src/onboarding/onboardingController');

const {
    auditarComprovantePix
} = require('./src/financeiro/validadorComprovantePix');

const {
    processarComprovanteRecebido
} = require('./src/financeiro/gestaoFinanceira');

let total = 0;
let pass = 0;
let fail = 0;
const failures = [];

function test(name, fn) {
    total++;
    try {
        fn();
        pass++;
        console.log(`  [PASS] #${total}: ${name}`);
    } catch (err) {
        fail++;
        console.log(`  [FAIL] #${total}: ${name}`);
        console.log(`         Error: ${err.message}`);
        failures.push({ name, err });
    }
}

async function testAsync(name, fn) {
    total++;
    try {
        await fn();
        pass++;
        console.log(`  [PASS] #${total}: ${name}`);
    } catch (err) {
        fail++;
        console.log(`  [FAIL] #${total}: ${name}`);
        console.log(`         Error: ${err.message}`);
        failures.push({ name, err });
    }
}

async function run() {
    console.log('='.repeat(80));
    console.log('CHALLENGER 4 — EMPIRICAL DEEP VERIFICATION HARNESS');
    console.log('='.repeat(80));

    const htmlPath = path.join(__dirname, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const lines = html.split('\n');

    // -------------------------------------------------------------------------
    // 1. DOM Static & AST Verification for Buttons & Selects
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Verification of Event Bindings in index.html ---');

    test('1.1 #btn-melhorar-template-onboarding has real onclick binding to executarMelhoriaMensagemGenerica', () => {
        const match = html.match(/id="btn-melhorar-template-onboarding"[^>]*onclick="([^"]+)"/i);
        assert.ok(match, 'Button #btn-melhorar-template-onboarding must have an onclick attribute');
        assert.ok(match[1].includes('executarMelhoriaMensagemGenerica'), 'onclick must call executarMelhoriaMensagemGenerica');
        assert.ok(match[1].includes('dossie-template-mensagem-docs'), 'onclick must pass dossie-template-mensagem-docs');
    });

    test('1.2 #btn-melhorar-modal-onboarding has real onclick binding to executarMelhoriaMensagemGenerica', () => {
        const match = html.match(/id="btn-melhorar-modal-onboarding"[^>]*onclick="([^"]+)"/i);
        assert.ok(match, 'Button #btn-melhorar-modal-onboarding must have an onclick attribute');
        assert.ok(match[1].includes('executarMelhoriaMensagemGenerica'), 'onclick must call executarMelhoriaMensagemGenerica');
        assert.ok(match[1].includes('onboarding-modal-mensagem'), 'onclick must pass onboarding-modal-mensagem');
    });

    test('1.3 #onboarding-modal-preset has real onchange binding to atualizarMensagemModalOnboarding', () => {
        const match = html.match(/id="onboarding-modal-preset"[^>]*onchange="([^"]+)"/i);
        assert.ok(match, 'Select #onboarding-modal-preset must have an onchange attribute');
        assert.ok(match[1].includes('atualizarMensagemModalOnboarding'), 'onchange must call atualizarMensagemModalOnboarding');
    });

    // -------------------------------------------------------------------------
    // 2. Behavioral Simulation of Clicking Buttons & Changing Presets
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Behavioral Simulation of UI Actions ---');

    await testAsync('2.1 Simulating click on #btn-melhorar-modal-onboarding updates textarea via executarMelhoriaMensagemGenerica', async () => {
        const mockTextarea = { value: 'mande a foto da cnh e ctps para o processo' };
        const mockBtn = { disabled: false, innerHTML: 'Melhorar' };
        let toastMsg = '';

        // Extract functions from lines 3522-3568 and 3569-3636
        const fnLocalCode = lines.slice(3522, 3568).join('\n');
        const fnExecCode = lines.slice(3569, 3637).join('\n');

        const sandbox = {
            window: { api: null, configGlobal: {} },
            document: {
                getElementById: (id) => (id === 'proc-gemini-api-key' ? { value: '' } : null)
            },
            mostrarToast: (m) => { toastMsg = m; },
            marcarAlteracaoPendente: () => {}
        };

        // Evaluate both functions in sandbox context
        const setup = new Function('window', 'document', 'mostrarToast', 'marcarAlteracaoPendente',
            `${fnLocalCode}\n${fnExecCode}\nreturn window.executarMelhoriaMensagemGenerica;`
        );
        const executarMelhoria = setup(sandbox.window, sandbox.document, sandbox.mostrarToast, sandbox.marcarAlteracaoPendente);

        await executarMelhoria(mockTextarea, null, mockBtn);

        assert.ok(mockTextarea.value.length > 'mande a foto da cnh e ctps para o processo'.length, 'Textarea value must be enriched');
        assert.ok(mockTextarea.value.includes('⚖️') || mockTextarea.value.includes('📋') || mockTextarea.value.includes('🏛️'), 'Enriched text should have emojis');
        assert.strictEqual(toastMsg, "✨ Mensagem aprimorada com IA!");
    });

    test('2.2 Simulating onchange on #onboarding-modal-preset updates modal message', () => {
        const mockNome = { value: 'Dra. Fernanda Matos' };
        const mockPreset = { value: 'Trabalhista' };
        const mockMsg = { value: '' };

        const fnCode = lines.slice(5163, 5210).join('\n');

        const sandbox = {
            window: { configGlobal: {} },
            document: {
                getElementById: (id) => {
                    if (id === 'onboarding-modal-cliente-nome') return mockNome;
                    if (id === 'onboarding-modal-preset') return mockPreset;
                    if (id === 'onboarding-modal-mensagem') return mockMsg;
                    return null;
                }
            }
        };

        const setup = new Function('window', 'document',
            `${fnCode}\nreturn window.atualizarMensagemModalOnboarding;`
        );
        const atualizar = setup(sandbox.window, sandbox.document);

        atualizar();
        assert.ok(mockMsg.value.includes('Dra. Fernanda Matos'), 'Updated message must contain client name');
        assert.ok(mockMsg.value.includes('Trabalhista') || mockMsg.value.includes('Carteira de Trabalho'), 'Updated message must contain Trabalhista docs');

        // Change preset to Civel
        mockPreset.value = 'Civel';
        atualizar();
        assert.ok(mockMsg.value.includes('Cível') || mockMsg.value.includes('Comprovante de Endereço'), 'Message must dynamically change for Civel');
    });

    // -------------------------------------------------------------------------
    // 3. String Interpolation Stress Testing ($&, $1, $', $`, $$, etc.)
    // -------------------------------------------------------------------------
    console.log('\n--- 3. String Interpolation Stress Testing ---');

    test('3.1 Dollar signs and regex tokens in client name ($&, $1, $\', $`, $$, $100) do NOT corrupt output', () => {
        const adversarialNames = [
            'Carlos $& Silva',
            'Maria $1 Santos',
            'João $\' Souza',
            'Pedro $` Oliveira',
            'Ana $$ Pereira',
            'Taxa de $100 e $50',
            'Nome com $& e $1 e $\' e $` misturados'
        ];

        for (const name of adversarialNames) {
            const config = { onboardingSessoes: {} };
            const res = iniciarSessaoOnboarding('5511999990000', name, 'Geral', config);
            assert.ok(!res.mensagemDisparo.includes('{nome}'), `Mensagem should not contain literal {nome} for name: ${name}`);
            assert.ok(res.mensagemDisparo.includes(name), `Mensagem must contain full verbatim name: "${name}"`);
        }
    });

    test('3.2 Dollar signs and regex tokens in template base text do NOT corrupt interpolation', () => {
        const config = {
            onboardingSessoes: {},
            modeloMensagemSolicitacaoDocs: 'Prezado(a) {nome}, o valor do serviço é $100 (ou $$200 com taxa $&). Documentos: {documentos}'
        };
        const res = iniciarSessaoOnboarding('5511999990000', 'Roberta Matos', 'Geral', config);
        assert.ok(!res.mensagemDisparo.includes('{nome}'));
        assert.ok(res.mensagemDisparo.includes('Roberta Matos'));
        assert.ok(res.mensagemDisparo.includes('$100 (ou $$200 com taxa $&)'));
    });

    // -------------------------------------------------------------------------
    // 4. Degenerate and Whitespace Client Names
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Whitespace and Degenerate Client Names ---');

    test('4.1 Whitespace-only names ("   ", "\\t\\n  ") fall back to "Cliente"', () => {
        const whitespaceVariants = ['   ', '\t', '\n', ' \t \n ', '         '];
        for (const ws of whitespaceVariants) {
            const config = { onboardingSessoes: {} };
            const res = iniciarSessaoOnboarding('5511999990000', ws, 'Geral', config);
            assert.strictEqual(res.clienteNome, 'Cliente', `Expected "Cliente" for input ${JSON.stringify(ws)}`);
            assert.ok(res.mensagemDisparo.includes('Cliente'));
            assert.ok(!res.mensagemDisparo.includes('Olá, **!'));
        }
    });

    test('4.2 Null and undefined client names fall back to "Cliente"', () => {
        for (const v of [null, undefined, '']) {
            const config = { onboardingSessoes: {} };
            const res = iniciarSessaoOnboarding('5511999990000', v, 'Geral', config);
            assert.strictEqual(res.clienteNome, 'Cliente');
            assert.ok(res.mensagemDisparo.includes('Cliente'));
        }
    });

    // -------------------------------------------------------------------------
    // 5. Balloon Deduplication Logic Verification
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Balloon Deduplication Verification ---');

    test('5.1 Static verification: adicionarBalaoAdvogadoNoSimulador is strictly located inside if (!sucesso)', () => {
        let idxConfirmar = -1;
        let idxIfSucesso = -1;
        let idxFimSucesso = -1;
        let idxChamaBalao = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('window.confirmarDisparoOnboarding =')) idxConfirmar = i;
            if (idxConfirmar !== -1 && lines[i].includes('if (!sucesso)')) {
                idxIfSucesso = i;
                for (let j = i + 1; j < i + 40; j++) {
                    if (lines[j].trim() === '}') {
                        idxFimSucesso = j;
                        break;
                    }
                }
            }
            if (idxConfirmar !== -1 && idxChamaBalao === -1 && lines[i].includes('window.adicionarBalaoAdvogadoNoSimulador(msgTexto)')) {
                idxChamaBalao = i;
            }
            if (idxConfirmar !== -1 && lines[i].includes('window.solicitarDocsClienteDossieAtual')) break;
        }

        assert.ok(idxConfirmar !== -1, 'confirmarDisparoOnboarding must exist');
        assert.ok(idxIfSucesso !== -1, 'if (!sucesso) must exist');
        assert.ok(idxChamaBalao !== -1, 'adicionarBalaoAdvogadoNoSimulador must exist');
        assert.ok(idxChamaBalao > idxIfSucesso && idxChamaBalao < idxFimSucesso,
            `Chamada do balão (linha ${idxChamaBalao + 1}) deve estar DENTRO do if (!sucesso) (linhas ${idxIfSucesso + 1} a ${idxFimSucesso + 1})`);
    });

    await testAsync('5.2 Behavioral verification: Electron IPC success does NOT trigger local balloon (zero duplicates)', async () => {
        const fnCode = lines.slice(5234, 5299).join('\n');

        let localBalloonCalls = 0;
        const sandbox = {
            window: {
                api: {
                    iniciarOnboarding: async () => ({ sucesso: true, mensagemDisparo: 'Msg via IPC' })
                },
                adicionarBalaoAdvogadoNoSimulador: () => { localBalloonCalls++; },
                carregarERenderizarDossies: () => {}
            },
            document: {
                getElementById: (id) => ({ value: 'teste' })
            },
            mostrarToast: () => {},
            fecharModalSolicitarDocumentos: () => {},
            marcarAlteracaoPendente: () => {},
            configGlobal: {}
        };

        const setup = new Function('window', 'document', 'mostrarToast', 'fecharModalSolicitarDocumentos', 'marcarAlteracaoPendente', 'configGlobal',
            `${fnCode}\nreturn window.confirmarDisparoOnboarding;`
        );
        const confirmar = setup(sandbox.window, sandbox.document, sandbox.mostrarToast, sandbox.fecharModalSolicitarDocumentos, sandbox.marcarAlteracaoPendente, sandbox.configGlobal);

        await confirmar();

        assert.strictEqual(localBalloonCalls, 0, 'When IPC succeeds, local balloon MUST NOT be called (IPC event in main.js handles it)');
    });

    await testAsync('5.3 Behavioral verification: Web/Headless fallback triggers local balloon exactly once', async () => {
        const fnCode = lines.slice(5234, 5299).join('\n');

        let localBalloonCalls = 0;
        const sandbox = {
            window: {
                api: null, // Web/Headless mode
                adicionarBalaoAdvogadoNoSimulador: () => { localBalloonCalls++; },
                carregarERenderizarDossies: () => {}
            },
            document: {
                getElementById: (id) => ({ value: 'teste' })
            },
            mostrarToast: () => {},
            fecharModalSolicitarDocumentos: () => {},
            marcarAlteracaoPendente: () => {},
            configGlobal: {}
        };

        const setup = new Function('window', 'document', 'mostrarToast', 'fecharModalSolicitarDocumentos', 'marcarAlteracaoPendente', 'configGlobal',
            `${fnCode}\nreturn window.confirmarDisparoOnboarding;`
        );
        const confirmar = setup(sandbox.window, sandbox.document, sandbox.mostrarToast, sandbox.fecharModalSolicitarDocumentos, sandbox.marcarAlteracaoPendente, sandbox.configGlobal);

        await confirmar();

        assert.strictEqual(localBalloonCalls, 1, 'In Web/Headless mode without window.api, local balloon MUST be called once as fallback');
    });

    // -------------------------------------------------------------------------
    // 6. Anti-Hallucination & No Synthetic Fallbacks
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Anti-Hallucination & No Synthetic Fallbacks ---');

    await testAsync('6.1 auditarComprovantePix NEVER invents bancoOrigem or idTransacao for non-PIX text/image', async () => {
        const textSample = "Recibo comum de honorarios advocatícios pago em espécie valor 250 reais";
        const laudo = await auditarComprovantePix(Buffer.from(textSample), 'image/jpeg', '', 250, 'Cliente');

        assert.strictEqual(laudo.comprovanteValido, false, 'Non-PIX must not be valid');
        assert.strictEqual(laudo.dadosLidos.bancoOrigem, '', 'bancoOrigem must NOT be fabricated');
        assert.strictEqual(laudo.dadosLidos.idTransacao, '', 'idTransacao must NOT be fabricated');
        assert.notStrictEqual(laudo.dadosLidos.bancoOrigem, 'Instituição Financeira PIX');
    });

    await testAsync('6.2 Legal documents (contratos, procurações, petições) are classified as civil documents', async () => {
        const legalTexts = [
            "PROCURAÇÃO AD JUDICIA ET EXTRA outorga poderes amplos para o foro em geral",
            "PETIÇÃO INICIAL EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO",
            "CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS E HONORÁRIOS",
            "GUIA DE RECOLHIMENTO DA UNIÃO GRU POLÍCIA FEDERAL TAXA"
        ];

        for (const txt of legalTexts) {
            const laudo = await auditarComprovantePix(Buffer.from(txt), 'image/jpeg', '', 500, 'Cliente');
            assert.strictEqual(laudo.comprovanteValido, false, `Must reject: ${txt.slice(0, 30)}`);
            assert.strictEqual(laudo.ehDocumentoCivil, true, `Must classify as ehDocumentoCivil: ${txt.slice(0, 30)}`);
            assert.strictEqual(laudo.dadosLidos.valorPago, 0, `valorPago must be 0 for civil doc: ${txt.slice(0, 30)}`);
        }
    });

    await testAsync('6.3 Replay attack protection in processarComprovanteRecebido', async () => {
        const configMock = {
            financeiro: {
                comprovantesRecebidos: [],
                parcelas: [
                    { id: 'parc_replay_1', clienteNome: 'Cliente Replay', clienteTelefone: '11999990002', valor: 500, status: 'PENDENTE' },
                    { id: 'parc_replay_2', clienteNome: 'Cliente Replay', clienteTelefone: '11999990002', valor: 500, status: 'PENDENTE' }
                ]
            }
        };

        const pixBuffer = Buffer.from(
            'COMPROVANTE DE TRANSFERÊNCIA PIX\n' +
            'BANCO NUBANK S.A.\n' +
            'ID DA TRANSAÇÃO: E00416968202610189999REPLAY1234\n' +
            'PAGADOR: Cliente Replay\n' +
            'VALOR PAGO: R$ 500,00\n' +
            'DATA: 18/10/2026',
            'utf-8'
        );

        // First submission
        const res1 = await processarComprovanteRecebido('11999990002', pixBuffer, 'image/jpeg', '', configMock);
        assert.strictEqual(res1.success, true, 'First submission should succeed');
        assert.strictEqual(configMock.financeiro.parcelas[0].status, 'PAGO', 'First installment should be paid');

        // Second submission of the EXACT SAME receipt
        const res2 = await processarComprovanteRecebido('11999990002', pixBuffer, 'image/jpeg', '', configMock);
        assert.strictEqual(res2.success, false, 'Second submission with same idTransacao MUST fail');
        assert.strictEqual(res2.motivo, 'COMPROVANTE_JA_PROCESSADO');
        assert.strictEqual(configMock.financeiro.parcelas[1].status, 'PENDENTE', 'Second installment must remain PENDENTE');
    });

    console.log('\n' + '='.repeat(80));
    console.log(`TOTAL TESTS: ${total}`);
    console.log(`PASS:        ${pass} [OK]`);
    console.log(`FAIL:        ${fail}`);
    console.log('='.repeat(80));

    if (failures.length > 0) {
        console.error('\nFAILURE DETAILS:');
        failures.forEach(f => console.error(`- ${f.name}: ${f.err.message}`));
        process.exit(1);
    } else {
        console.log('\nALL CHALLENGER 4 EMPIRICAL TESTS PASSED WITH 100% SUCCESS!');
        process.exit(0);
    }
}

run().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
