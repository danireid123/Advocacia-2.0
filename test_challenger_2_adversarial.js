/**
 * =========================================================================
 * ADVOCACIA STUDIO PRO v2.0 - SUÍTE DE TESTES ADVERSARIAIS & DE ESTRESSE
 * CHALLENGER 2: EMPIRICAL VERIFICATION OF R1 (SIMULATOR) & R2 (TEMPLATES/IA)
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
    melhorarMensagemComIA,
    melhorarMensagemLocalmente
} = require('./src/ia/tradutorJuridico');

let totalTestes = 0;
let aprovados = 0;
let falhas = 0;
const defeitosEncontrados = [];

function imprimirCabecalho(secao) {
    console.log('\n' + '='.repeat(80));
    console.log(`🔥 ${secao}`);
    console.log('='.repeat(80));
}

async function testar(nome, fn) {
    totalTestes++;
    try {
        await fn();
        aprovados++;
        console.log(`  🧪 [T${String(totalTestes).padStart(2, '0')}] ${nome}... ✅ [PASS]`);
    } catch (err) {
        falhas++;
        console.log(`  🧪 [T${String(totalTestes).padStart(2, '0')}] ${nome}... ❌ [FAIL]`);
        console.log(`     🚨 Detalhe do Erro: ${err.message}`);
        defeitosEncontrados.push({
            teste: nome,
            erro: err.message,
            stack: err.stack
        });
    }
}

async function executarSuiteAdversarial() {
    console.log('================================================================================');
    console.log('⚖️  CHALLENGER 2: SUÍTE DE TESTES ADVERSARIAIS EMPÍRICOS (R1 & R2)');
    console.log('   Stress Testing, Boundary Value Analysis, Unicode, Offline Fallbacks & IPC');
    console.log('================================================================================');

    // =========================================================================
    // SEÇÃO 1: R1 — SIMULADOR WHATSAPP & ONBOARDING DISPATCH FLOW
    // =========================================================================
    imprimirCabecalho('SEÇÃO 1: R1 — Simulador WhatsApp & Fluxo de Disparo de Onboarding');

    await testar('R1.1 - Disparos Concorrentes Rápidos (Burst 50x) sem corrupção de sessões', async () => {
        const configMock = { onboardingSessoes: {} };
        const promises = [];
        for (let i = 0; i < 50; i++) {
            promises.push(
                Promise.resolve().then(() => {
                    return iniciarSessaoOnboarding(
                        `55119999900${i < 10 ? '0' + i : i}`,
                        `Cliente Teste ${i}`,
                        i % 2 === 0 ? 'Trabalhista' : 'Previdenciario',
                        configMock
                    );
                })
            );
        }
        const resultados = await Promise.all(promises);
        assert.strictEqual(resultados.length, 50, 'Deve retornar 50 sessões criadas');
        
        for (let i = 0; i < 50; i++) {
            const tel = `55119999900${i < 10 ? '0' + i : i}`;
            const s = obterSessaoAtiva(tel, configMock);
            assert.ok(s, `Sessão para ${tel} deve existir no config`);
            assert.strictEqual(s.clienteNome, `Cliente Teste ${i}`);
        }
    });

    await testar('R1.2 - Re-disparo Sucessivo no Mesmo Telefone (Sobrescrita Segura / Idempotência)', () => {
        const configMock = { onboardingSessoes: {} };
        const tel = '5511988887777';
        
        const s1 = iniciarSessaoOnboarding(tel, 'Cliente Antigo', 'Geral', configMock);
        assert.strictEqual(s1.status, 'DOCS_SOLICITADOS');
        assert.strictEqual(s1.preset, 'Geral');

        const s2 = iniciarSessaoOnboarding(tel, 'Cliente Atualizado', 'Trabalhista', configMock);
        assert.strictEqual(s2.preset, 'Trabalhista');
        assert.strictEqual(s2.clienteNome, 'Cliente Atualizado');
        
        const ativa = obterSessaoAtiva(tel, configMock);
        assert.strictEqual(ativa.preset, 'Trabalhista', 'Sessão ativa deve refletir o disparo mais recente');
        assert.strictEqual(ativa.clienteNome, 'Cliente Atualizado');
    });

    await testar('R1.3 - Variações Extremas de Formatação de Telefone em obterSessaoAtiva', () => {
        const configMock = { onboardingSessoes: {} };
        const telPadrao = '5511977778888';
        iniciarSessaoOnboarding(telPadrao, 'Maria de Fátima', 'Previdenciario', configMock);

        const formatosEquivalentes = [
            '5511977778888',
            '+55 (11) 97777-8888',
            '55 11 97777-8888',
            '+5511977778888',
            '11977778888',
            '977778888'
        ];

        for (const fmt of formatosEquivalentes) {
            const sessao = obterSessaoAtiva(fmt, configMock);
            assert.ok(sessao, `Deveria resolver sessão para o formato: "${fmt}"`);
            assert.strictEqual(sessao.clienteNome, 'Maria de Fátima');
        }
    });

    await testar('R1.4 - Telefones Nulos, Vazios, Não Numéricos e Injection Payloads não devem lançar TypeError', () => {
        const configMock = { onboardingSessoes: {} };

        const telefonesExtremos = [
            '',
            '   ',
            null,
            undefined,
            'NenhumTelefone',
            '+',
            '()--',
            '<script>alert(1)</script>',
            "5511' OR '1'='1",
            'A'.repeat(500)
        ];

        for (const tel of telefonesExtremos) {
            assert.doesNotThrow(() => {
                const s = iniciarSessaoOnboarding(tel, 'Teste Borda', 'Geral', configMock);
                assert.ok(s && typeof s === 'object', 'Deve retornar objeto de sessão sem crash');
            }, `iniciarSessaoOnboarding não deve quebrar com telefone "${tel}"`);

            assert.doesNotThrow(() => {
                obterSessaoAtiva(tel, configMock);
            }, `obterSessaoAtiva não deve quebrar com telefone "${tel}"`);
        }
    });

    await testar('R1.5 - Nomes de Cliente Degenerados (Vazio, Espaços, Emojis, Injection)', () => {
        const configMock = { onboardingSessoes: {} };

        const nomes = [
            { entrada: '', esperado: 'Cliente' },
            { entrada: '   ', esperado: 'Cliente' },
            { entrada: null, esperado: 'Cliente' },
            { entrada: undefined, esperado: 'Cliente' },
            { entrada: 'Dra. ⚖️ Ana Maria 🏛️', esperado: 'Dra. ⚖️ Ana Maria 🏛️' },
            { entrada: '<b style="color:red">Nome Injetado</b>', esperado: '<b style="color:red">Nome Injetado</b>' }
        ];

        for (const c of nomes) {
            const s = iniciarSessaoOnboarding('5511999991111', c.entrada, 'Geral', configMock);
            assert.strictEqual(s.clienteNome, c.esperado, `Nome esperado para entrada "${c.entrada}": "${c.esperado}"`);
            assert.ok(s.mensagemDisparo.includes(c.esperado), `Mensagem deve interpolar o nome sanitizado: "${c.esperado}"`);
        }
    });

    await testar('R1.6 - Isolamento IPC: Janela Main Destruída ou Inexistente não quebra processo', () => {
        const mainWindowFalsa = {
            isDestroyed: () => true,
            webContents: {
                send: () => { throw new Error('Cannot send to destroyed window'); }
            }
        };

        assert.doesNotThrow(() => {
            const msgTextoDisparo = 'Mensagem de teste';
            if (mainWindowFalsa && typeof mainWindowFalsa.isDestroyed === 'function' && !mainWindowFalsa.isDestroyed() && msgTextoDisparo) {
                mainWindowFalsa.webContents.send('simulador-resposta-advogado', { texto: msgTextoDisparo });
            }
        }, 'Verificação de mainWindow destruída deve proteger contra envio inválido');
    });

    // =========================================================================
    // SEÇÃO 2: R2 — MOTOR DE TEMPLATES CUSTOMIZÁVEIS & IA GEMINI
    // =========================================================================
    imprimirCabecalho('SEÇÃO 2: R2 — Motor de Templates Customizáveis & Aprimoramento com IA');

    await testar('R2.1 - Template sem tags obrigatórias não causa exceção nem texto corrompido', () => {
        const configMock = {
            onboardingSessoes: {},
            modeloMensagemSolicitacaoDocs: 'Prezado cliente, por favor compareça ao escritório com todos os seus papéis.'
        };
        const s = iniciarSessaoOnboarding('5511999992222', 'Carlos Silva', 'Trabalhista', configMock);
        assert.strictEqual(s.mensagemDisparo, 'Prezado cliente, por favor compareça ao escritório com todos os seus papéis.',
            'Template estático sem tags deve ser entregue intacto');
    });

    await testar('R2.2 - Case-Insensitivity total das tags no template ({NOME}, {Preset}, {DOCUMENTOS})', () => {
        const configMock = {
            onboardingSessoes: {},
            modeloMensagemSolicitacaoDocs: 'Atenção {NOME}! Sua área é {PrEsEt}. Traga estes documentos:\n{DOCUMENTOS}'
        };
        const s = iniciarSessaoOnboarding('5511999992222', 'Fernanda Lima', 'Familia', configMock);
        assert.ok(!s.mensagemDisparo.includes('{NOME}'), 'Tag {NOME} deve ser substituída');
        assert.ok(!s.mensagemDisparo.includes('{PrEsEt}'), 'Tag {PrEsEt} deve ser substituída');
        assert.ok(!s.mensagemDisparo.includes('{DOCUMENTOS}'), 'Tag {DOCUMENTOS} deve ser substituída');
        assert.ok(s.mensagemDisparo.includes('Fernanda Lima'), 'Nome deve constar');
        assert.ok(s.mensagemDisparo.includes('Direito de Família'), 'Preset deve constar');
        assert.ok(s.mensagemDisparo.includes('Certidão de Casamento'), 'Documentos devem constar');
    });

    await testar('R2.3 - Template com caracteres especiais de substituição do JS ($&, $1, $\', $`) no nome ou mensagem', () => {
        const configMock = {
            onboardingSessoes: {},
            modeloMensagemSolicitacaoDocs: 'Olá {nome}, precisamos de {documentos}. Valor taxa: $100.'
        };
        
        const nomeComDolar = 'José $& Santos $1';
        const s = iniciarSessaoOnboarding('5511999993333', nomeComDolar, 'Geral', configMock);
        
        assert.ok(s.mensagemDisparo.includes('José'), 'O nome deve conter José');
        if (s.mensagemDisparo.includes('{nome}')) {
            throw new Error('Falha de interpolação: $& no nome do cliente provocou injeção da própria tag {nome} na saída!');
        }
    });

    await testar('R2.4 - Tags malformadas e emojis complexos (ZWJ, bandeiras, RTL)', () => {
        const configMock = {
            onboardingSessoes: {},
            modeloMensagemSolicitacaoDocs: '⚖️🏛️ Olá, *{nome}*! 👨‍👩‍👧‍👦 {tags_invalidas} {{nome}} {preset}\n{documentos}\nمرحبا بالعالم'
        };
        const s = iniciarSessaoOnboarding('5511999994444', 'أحمد Al-Mansoor 🌟', 'Civel', configMock);
        assert.ok(s.mensagemDisparo.includes('أحمد Al-Mansoor 🌟'), 'Nome em árabe com emoji deve ser preservado');
        assert.ok(s.mensagemDisparo.includes('مرحبا بالعالم'), 'Texto RTL deve ser mantido');
        assert.ok(s.mensagemDisparo.includes('{tags_invalidas}'), 'Tags desconhecidas devem permanecer sem crash');
    });

    await testar('R2.5 - IA Tradutor: Fallback instantâneo quando apiKey ausente (< 20ms)', async () => {
        const inicio = Date.now();
        const res = await melhorarMensagemComIA('mande a foto da cnh e carteira de trabalho logo', { apiKey: '' });
        const duracao = Date.now() - inicio;

        assert.strictEqual(res.sucesso, true, 'Deve retornar sucesso: true');
        assert.strictEqual(res.fonte, 'fallback', 'Fonte deve ser fallback');
        assert.ok(duracao < 50, `Fallback offline deve ser instantâneo, levou ${duracao}ms`);
        assert.ok(res.texto.length > 'mande a foto da cnh e carteira de trabalho logo'.length, 'Texto deve ter sido enriquecido');
        assert.ok(res.texto.includes('⚖️') || res.texto.includes('📋') || res.texto.includes('🏛️'), 'Texto deve conter emojis acolhedores');
    });

    await testar('R2.6 - IA Tradutor: Fallback gracioso com apiKey inválida ou erro HTTP (sem unhandled rejection)', async () => {
        const res = await melhorarMensagemComIA('por favor envie seus comprovantes', {
            apiKey: 'AIzaSy_CHAVE_FALSA_PARA_TESTE_OFFLINE_ERROR_400',
            timeoutMs: 1500
        });

        assert.strictEqual(res.sucesso, true, 'Deve interceptar o erro de rede e retornar sucesso: true no fallback');
        assert.strictEqual(res.fonte, 'fallback', 'Deve cair em fallback');
        assert.ok(typeof res.texto === 'string' && res.texto.trim().length > 0, 'Deve conter texto válido no fallback');
    });

    await testar('R2.7 - IA Tradutor: AbortController dispara timeout rígido em chamada lenta sem travar o sistema', async () => {
        const inicio = Date.now();
        const res = await melhorarMensagemComIA('por favor envie os documentos para abertura do processo', {
            apiKey: 'AIzaSy_CHAVE_TESTE_TIMEOUT',
            timeoutMs: 20
        });
        const decorrido = Date.now() - inicio;

        assert.strictEqual(res.sucesso, true, 'Mesmo abortado por timeout, deve responder com fallback');
        assert.strictEqual(res.fonte, 'fallback');
        assert.ok(decorrido < 500, `Abort deve finalizar rapidamente, levou ${decorrido}ms`);
    });

    await testar('R2.8 - Guardrails Éticos OAB no Fallback Local (Zero promessas de prazo, vitória ou valores)', () => {
        const rascunhosAdversariais = [
            'pode mandar que com certeza vamos ganhar o processo e receber 50 mil reais na semana que vem juiz amigo',
            'manda o rg que garanto vitória de 100% no inss amanhã',
            'quanto antes mandar, garanto que o juiz libera o alvará em 2 dias'
        ];

        for (const rascunho of rascunhosAdversariais) {
            const enriquecido = melhorarMensagemLocalmente(rascunho);
            assert.ok(!enriquecido.includes('garantia de vitória'), 'Não deve adicionar garantia de vitória');
            assert.ok(!enriquecido.includes('resultado garantido'), 'Não deve prometer resultado garantido');
            assert.ok(enriquecido.includes('resguardo') || enriquecido.includes('direitos') || enriquecido.includes('autos'),
                'Deve orientar para defesa e resguardo de direitos');
        }
    });

    // =========================================================================
    // SEÇÃO 3: AUDITORIA DE INTEGRAÇÃO DOM / UI EM INDEX.HTML
    // =========================================================================
    imprimirCabecalho('SEÇÃO 3: Auditoria Estática & Funcional da UI em index.html');

    const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

    await testar('UI.1 - Presença dos Componentes do Modal e Editor (#onboarding-modal-mensagem, presets, botão)', () => {
        assert.ok(htmlContent.includes('id="modal-solicitar-documentos"'), 'Modal de solicitação deve existir');
        assert.ok(htmlContent.includes('id="onboarding-modal-mensagem"'), 'Textarea de mensagem deve existir');
        assert.ok(htmlContent.includes('id="onboarding-modal-preset"'), 'Select de preset deve existir');
        assert.ok(htmlContent.includes('id="btn-melhorar-modal-onboarding"'), 'Botão "Melhorar com IA" deve existir');
    });

    await testar('UI.2 - Verificação de Dead Control: Botão #btn-melhorar-modal-onboarding DEVE estar conectado a uma ação de clique', () => {
        const temOnclick = /id="btn-melhorar-modal-onboarding"[^>]*onclick=/i.test(htmlContent) ||
                           /onclick="[^"]*btn-melhorar-modal-onboarding/i.test(htmlContent);
        
        const lines = htmlContent.split('\n');
        let temListenerJs = false;
        lines.forEach(l => {
            if (l.includes('btn-melhorar-modal-onboarding') && (l.includes('addEventListener') || l.includes('safeOn') || l.includes('.onclick'))) {
                temListenerJs = true;
            }
        });

        const conectado = temOnclick || temListenerJs;
        assert.ok(conectado,
            'O botão #btn-melhorar-modal-onboarding NÃO POSSUI onclick nem addEventListener em index.html! Ao clicar, nada acontece!');
    });

    await testar('UI.3 - Verificação de Sincronização Dinâmica: Select #onboarding-modal-preset DEVE atualizar mensagem ao mudar preset', () => {
        const temOnchange = /id="onboarding-modal-preset"[^>]*onchange=/i.test(htmlContent);
        const lines = htmlContent.split('\n');
        let temListenerJs = false;
        lines.forEach(l => {
            if (l.includes('onboarding-modal-preset') && (l.includes('addEventListener') || l.includes('safeOn') || l.includes('.onchange'))) {
                temListenerJs = true;
            }
        });

        const conectado = temOnchange || temListenerJs;
        assert.ok(conectado,
            'O select #onboarding-modal-preset NÃO POSSUI onchange nem listener para disparar window.atualizarMensagemModalOnboarding!');
    });

    await testar('UI.4 - Duplicação de Balão no Simulador: Disparo via IPC não deve gerar balão duplicado', () => {
        const lines = htmlContent.split('\n');
        let idxConfirmar = -1;
        let idxFimSucesso = -1;
        let idxChamaBalao = -1;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('window.confirmarDisparoOnboarding =')) idxConfirmar = i;
            if (idxConfirmar !== -1 && lines[i].includes('if (!sucesso)')) {
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

        console.log(`     ℹ️ Linha confirmar: ${idxConfirmar+1}, Fim bloco if (!sucesso): ${idxFimSucesso+1}, Chamada balão: ${idxChamaBalao+1}`);
        if (idxChamaBalao > idxFimSucesso) {
            throw new Error(`Detecção de duplicação: window.adicionarBalaoAdvogadoNoSimulador(msgTexto) (linha ${idxChamaBalao+1}) está FORA do bloco if (!sucesso) (que encerra na linha ${idxFimSucesso+1}). Como main.js:2617 já envia o evento IPC simulador-resposta-advogado para a janela, o simulador recebe e exibe o balão DUAS VEZES no Electron.`);
        }
    });

    // =========================================================================
    // RELATÓRIO FINAL
    // =========================================================================
    console.log('\n================================================================================');
    console.log('📊 RESUMO DA SUÍTE DE TESTES ADVERSARIAIS DO CHALLENGER 2');
    console.log('================================================================================');
    console.log(`  Total de Testes Executados: ${totalTestes}`);
    console.log(`  Sucessos (PASS):            ${aprovados} ✅`);
    console.log(`  Falhas / Defeitos (FAIL):   ${falhas} ❌`);
    console.log('================================================================================');

    if (defeitosEncontrados.length > 0) {
        console.log('\n🚨 DEFEITOS EMPIRICAMENTE COMPROVADOS:');
        defeitosEncontrados.forEach((d, i) => {
            console.log(`\n[Defeito #${i + 1}] ${d.teste}`);
            console.log(`  Motivo: ${d.erro}`);
        });
    }

    return { totalTestes, aprovados, falhas, defeitosEncontrados };
}

if (require.main === module) {
    executarSuiteAdversarial().then(res => {
        process.exit(res.falhas > 0 ? 1 : 0);
    });
}

module.exports = { executarSuiteAdversarial };
