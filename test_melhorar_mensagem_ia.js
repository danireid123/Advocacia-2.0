const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    melhorarMensagemComIA,
    melhorarMensagemLocalmente,
    SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM,
    definirCaminhoCache,
    limparCacheMemoria
} = require('./src/ia/tradutorJuridico');

async function executarTestes() {
    console.log('========================================================================');
    console.log('⚖️ TESTES AUTOMATIZADOS: MELHORAR MENSAGENS COM IA (SUBAGENTE 2)');
    console.log('========================================================================\n');

    let totalPassos = 0;
    let passosSucesso = 0;

    function registrarSucesso(msg) {
        totalPassos++;
        passosSucesso++;
        console.log(`   ✅ [Passo ${totalPassos}] ${msg}`);
    }

    // Configura cache temporário para os testes
    const tempCachePath = path.join(__dirname, 'test_cache_melhorar_msg_temp.json');
    definirCaminhoCache(tempCachePath);
    if (fs.existsSync(tempCachePath)) fs.unlinkSync(tempCachePath);
    limparCacheMemoria();

    // -------------------------------------------------------------------------
    // TESTE 1: Exportação e Guardrails OAB no tradutorJuridico.js
    // -------------------------------------------------------------------------
    console.log('🧪 Teste 1: Validação de Exportação e Guardrails OAB...');
    assert.strictEqual(typeof melhorarMensagemComIA, 'function', 'melhorarMensagemComIA deve ser uma função');
    assert.strictEqual(typeof melhorarMensagemLocalmente, 'function', 'melhorarMensagemLocalmente deve ser uma função');
    assert.ok(typeof SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM === 'string', 'SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM deve ser uma string');
    assert.ok(SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM.includes('205/2021'), 'Instrução do sistema deve mencionar o Provimento 205/2021 da OAB');
    assert.ok(SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM.includes('WhatsApp'), 'Instrução deve focar no atendimento via WhatsApp');
    assert.ok(SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM.includes('autos'), 'Instrução deve direcionar para termos técnicos como autos');
    assert.ok(SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM.includes('emojis') || SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM.includes('⚖️'), 'Instrução deve requerer emojis adequados');
    registrarSucesso('Funções exportadas e Guardrails OAB (Provimento 205/2021) validados com rigor.');

    // -------------------------------------------------------------------------
    // TESTE 2: Execução em Modo Fallback Gracioso Local (Sem Internet / Sem Chave)
    // -------------------------------------------------------------------------
    console.log('\n🧪 Teste 2: Validação do Fallback Gracioso Local Inteligente...');
    
    // 2.1 Mensagem de exemplo leiga típica
    const textoLeigo = 'olá recebemos seu contato, vamos olhar o seu processo e dar entrada para garantir seus direitos.';
    const resFallback = await melhorarMensagemComIA(textoLeigo, {
        apiKey: '', // Sem chave para forçar fallback
        config: {}
    });

    assert.strictEqual(resFallback.sucesso, true, 'Fallback deve retornar sucesso: true');
    assert.strictEqual(resFallback.fonte, 'fallback', 'Fonte deve ser fallback');
    assert.ok(typeof resFallback.texto === 'string' && resFallback.texto.length > 0, 'Texto aprimorado não pode ser vazio');

    // Checagem de emojis
    const temEmojis = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(resFallback.texto);
    assert.ok(temEmojis, 'Texto aprimorado deve conter emojis expressivos');
    assert.ok(resFallback.texto.includes('⚖️') || resFallback.texto.includes('🏛️') || resFallback.texto.includes('🤝'), 'Texto deve conter emojis jurídicos (⚖️, 🏛️, 🤝)');

    // Checagem de termos técnicos acessíveis
    const textoMinusculo = resFallback.texto.toLowerCase();
    const temTermoTecnico = textoMinusculo.includes('autos') || 
                            textoMinusculo.includes('petição inicial') || 
                            textoMinusculo.includes('resguardo') ||
                            textoMinusculo.includes('probatória');
    assert.ok(temTermoTecnico, 'Texto no fallback deve incorporar termos técnicos acessíveis');

    // Checagem de interação / CTA (chamada para áudio ou documentos)
    const temCTA = /áudio|audio|documento|fotos|passos|disposição/i.test(resFallback.texto);
    assert.ok(temCTA, 'Texto deve sugerir interação gentil (áudio, documentos ou contato)');

    // Checagem de compatibilidade com serialização IPC (Structured Clone)
    const v8 = require('v8');
    assert.doesNotThrow(() => v8.serialize(resFallback), 'resFallback deve ser perfeitamente serializável por IPC sem falha de clone');
    assert.ok(typeof resFallback.texto === 'string' && resFallback.texto.length > 0, 'resFallback.texto deve ser string válida');

    registrarSucesso(`Fallback local comprovado com enriquecimento técnico, emojis e CTA:\n"${resFallback.texto.split('\n')[0]}..."`);

    // 2.2 Teste com texto vazio
    const resVazio = await melhorarMensagemComIA('', { apiKey: '' });
    assert.strictEqual(resVazio.sucesso, true, 'Texto vazio deve retornar sucesso');
    assert.strictEqual(resVazio.texto, '', 'Texto vazio deve retornar vazio');
    registrarSucesso('Tratamento resiliente de texto vazio sem exceção.');

    // -------------------------------------------------------------------------
    // TESTE 3: Chamada de API Gemini 1.5 Flash (Mock) + Cache Hit
    // -------------------------------------------------------------------------
    console.log('\n🧪 Teste 3: Mock da Chamada Gemini 1.5 Flash e Cache Hit...');
    const fetchOriginal = global.fetch;

    const textoRetornadoGemini = 
`⚖️ *Olá! Seja muito bem-vindo(a) ao nosso atendimento jurídico.* 🏛️

Recebemos sua solicitação com satisfação. Nossa equipe já iniciou a criteriosa *análise dos autos do processo*, avaliando a *instrução probatória* necessária para o pleno *resguardo e defesa dos seus direitos* ⚖️.

📲 *Como podemos agilizar seu atendimento:*
• Envie-nos uma breve mensagem de áudio relatando os fatos;
• Ou compartilhe os documentos pertinentes em PDF ou foto nítida.

Seguiremos com acompanhamento constante e atento ao seu caso! 🤝✨`;

    let contagemFetch = 0;
    let urlRequisicao = '';
    let bodyRequisicao = null;

    global.fetch = async (url, options) => {
        contagemFetch++;
        urlRequisicao = url;
        bodyRequisicao = JSON.parse(options.body);

        return {
            ok: true,
            status: 200,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: textoRetornadoGemini
                                }
                            ]
                        }
                    }
                ]
            })
        };
    };

    try {
        const textoOriginalPrompt = 'Precisamos dos seus documentos para entrar com a ação na justiça.';
        const resIA = await melhorarMensagemComIA(textoOriginalPrompt, {
            apiKey: 'AIzaSyFakeKeyParaTesteMelhorarMensagem123',
            desativarPersistencia: false
        });

        assert.strictEqual(resIA.sucesso, true, 'Chamada IA deve ter sucesso');
        assert.strictEqual(resIA.fonte, 'ia', 'Fonte deve ser "ia"');
        assert.strictEqual(resIA.texto, textoRetornadoGemini, 'Texto gerado deve ser idêntico ao retornado pelo modelo');
        assert.strictEqual(contagemFetch, 1, 'Deve ter chamado a API exatamente 1 vez');
        assert.ok(urlRequisicao.includes('generateContent'), 'Deve chamar o endpoint generateContent');
        assert.ok(urlRequisicao.includes('AIzaSyFakeKeyParaTesteMelhorarMensagem123'), 'Deve repassar a apiKey');
        assert.ok(bodyRequisicao.system_instruction, 'Deve enviar as system instructions com guardrails');
        registrarSucesso('Chamada REST para o Gemini 1.5 Flash mockada e executada com sucesso.');

        // 3.2 Cache Hit: Segunda chamada com mesmo texto deve vir do Cache
        const resCache = await melhorarMensagemComIA(textoOriginalPrompt, {
            apiKey: 'AIzaSyFakeKeyParaTesteMelhorarMensagem123'
        });
        assert.strictEqual(resCache.fonte, 'cache', 'Segunda chamada idêntica deve vir de "cache"');
        assert.strictEqual(resCache.texto, textoRetornadoGemini, 'Texto em cache deve ser preservado');
        assert.strictEqual(contagemFetch, 1, 'Não deve fazer nova chamada HTTP quando em cache');
        registrarSucesso('Sistema de Cache em memória e disco comprovado (0 requisições adicionais).');

    } finally {
        global.fetch = fetchOriginal;
    }

    // -------------------------------------------------------------------------
    // TESTE 4: Simulação de Timeout e Erro de API caindo em Fallback
    // -------------------------------------------------------------------------
    console.log('\n🧪 Teste 4: Resiliência contra Timeout e Erro de Servidor...');
    global.fetch = async () => {
        throw new Error('Falha simulada de conexão HTTP (ETIMEDOUT)');
    };

    try {
        const resComErro = await melhorarMensagemComIA('Por favor aguarde a decisão do juiz.', {
            apiKey: 'AIzaSyFakeKeyParaTesteFalha',
            timeoutMs: 100
        });
        assert.strictEqual(resComErro.sucesso, true, 'Mesmo com erro na API, sucesso deve ser true via fallback');
        assert.strictEqual(resComErro.fonte, 'fallback', 'Deve alternar suavemente para fallback');
        assert.ok(resComErro.texto.includes('⚖️'), 'Texto de fallback com erro de rede deve conter emojis');
        registrarSucesso('Recuperação transparente em caso de indisponibilidade externa (Zero crashes).');
    } finally {
        global.fetch = fetchOriginal;
    }

    // -------------------------------------------------------------------------
    // TESTE 5: Paridade IPC em preload.js e main.js
    // -------------------------------------------------------------------------
    console.log('\n🧪 Teste 5: Validação de Paridade IPC (preload.js <-> main.js)...');
    const conteudoPreload = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf-8');
    const conteudoMain = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf-8');

    assert.ok(
        conteudoPreload.includes('melhorarMensagemIA:'),
        'preload.js deve conter a declaração melhorarMensagemIA'
    );
    assert.ok(
        conteudoPreload.includes("ipcRenderer.invoke('ia-melhorar-mensagem'"),
        'preload.js deve mapear para o canal ia-melhorar-mensagem'
    );
    registrarSucesso("preload.js expõe 'melhorarMensagemIA' chamando o canal 'ia-melhorar-mensagem'.");

    assert.ok(
        conteudoMain.includes("ipcMain.handle('ia-melhorar-mensagem'"),
        "main.js deve registrar o handler do canal 'ia-melhorar-mensagem'"
    );
    assert.ok(
        conteudoMain.includes('melhorarMensagemComIA'),
        "main.js deve invocar melhorarMensagemComIA no canal 'ia-melhorar-mensagem'"
    );
    registrarSucesso("main.js possui o handler 'ia-melhorar-mensagem' devidamente registrado e acoplado.");

    // -------------------------------------------------------------------------
    // TESTE 6: Presença dos Botões e Funções no index.html
    // -------------------------------------------------------------------------
    console.log('\n🧪 Teste 6: Validação dos Elementos de Interface no index.html...');
    const conteudoIndex = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

    // 6.1 Botão no editor da etapa (ao lado da formatação WhatsApp)
    assert.ok(
        conteudoIndex.includes('id="btn-melhorar-msg-etapa"'),
        "index.html deve conter o botão 'btn-melhorar-msg-etapa' no editor de etapa"
    );
    assert.ok(
        conteudoIndex.includes('melhorarTextoAtendimentoEtapaComIA()'),
        "index.html deve vincular o clique a melhorarTextoAtendimentoEtapaComIA()"
    );
    registrarSucesso("Botão '✨ Melhorar com IA' presente no Editor de Etapa ao lado da Formatação WhatsApp.");

    // 6.2 Botão em renderizarOpcoesDaEtapa
    assert.ok(
        conteudoIndex.includes('btn-melhorar-opcao-ia'),
        "index.html deve renderizar o botão 'btn-melhorar-opcao-ia' em renderizarOpcoesDaEtapa"
    );
    registrarSucesso("Botão '✨ Melhorar com IA' dinamicamente inserido em cada opção de resposta em 'renderizarOpcoesDaEtapa'.");

    // 6.3 Botão em renderizarCentralAcoes
    assert.ok(
        conteudoIndex.includes('btn-melhorar-central-ia') || conteudoIndex.includes('melhorarMensagemCentralAcoesComIA'),
        "index.html deve renderizar o botão em renderizarCentralAcoes"
    );
    assert.ok(
        conteudoIndex.includes('melhorarMensagemCentralAcoesComIA('),
        "index.html deve chamar melhorarMensagemCentralAcoesComIA no evento de clique da central"
    );
    registrarSucesso("Botão '✨ Melhorar com IA' presente em cada textarea de resposta em 'renderizarCentralAcoes'.");

    // 6.4 Funções no script da interface
    assert.ok(
        conteudoIndex.includes('executarMelhoriaMensagemGenerica'),
        "index.html deve conter a função 'executarMelhoriaMensagemGenerica'"
    );
    assert.ok(
        conteudoIndex.includes('Aprimorando com IA...'),
        "index.html deve exibir o feedback visual '✨ Aprimorando com IA...'"
    );
    assert.ok(
        conteudoIndex.includes('marcarAlteracaoPendente'),
        "index.html deve acionar 'marcarAlteracaoPendente()'"
    );
    assert.ok(
        conteudoIndex.includes('Mensagem aprimorada com IA!'),
        "index.html deve disparar o toast de sucesso '✨ Mensagem aprimorada com IA!'"
    );
    registrarSucesso("Funções do cliente com loading, atualização de estado pendente e toast de sucesso validadas.");

    // Limpeza de cache temporário de teste
    if (fs.existsSync(tempCachePath)) {
        try { fs.unlinkSync(tempCachePath); } catch (e) {}
    }

    console.log('\n========================================================================');
    console.log(`🎉 TODOS OS ${passosSucesso}/${totalPassos} TESTES PASSARAM COM 100% DE SUCESSO!`);
    console.log('========================================================================');
}

executarTestes().catch(err => {
    console.error('\n❌ ERRO NOS TESTES:', err);
    process.exit(1);
});
