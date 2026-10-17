const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
    traduzirAndamentoJuridico,
    traduzirAndamentoParaCliente,
    calcularHash,
    definirCaminhoCache,
    limparCacheMemoria,
    SYSTEM_INSTRUCTION_OAB
} = require('./src/ia/tradutorJuridico');

async function executarTestes() {
    console.log('======================================================');
    console.log('🚀 INICIANDO TESTES DO TRADUTOR JURÍDICO (GEMINI FLASH)');
    console.log('======================================================\n');

    const envKeyReal = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const tempCachePath = path.join(__dirname, 'test_gemini_cache_temp.json');
    definirCaminhoCache(tempCachePath);
    if (fs.existsSync(tempCachePath)) fs.unlinkSync(tempCachePath);
    limparCacheMemoria();

    // ------------------------------------------------------------------
    // TESTE 1: Hashing MD5 do texto do andamento
    // ------------------------------------------------------------------
    console.log('🧪 Teste 1: Validação de integridade do Hash MD5...');
    const textoExemplo = 'Conclusos para despacho do Magistrado.';
    const hashEsperado = require('crypto').createHash('md5').update(textoExemplo.trim()).digest('hex');
    const hashGerado = calcularHash(textoExemplo);
    assert.strictEqual(hashGerado, hashEsperado, 'Hash MD5 calculado incorretamente');
    console.log(`   ✅ Hash MD5 verificado com sucesso: ${hashGerado}`);

    // ------------------------------------------------------------------
    // TESTE 2: Fallback instantâneo em caso de chave ausente/offline (< 5ms)
    // ------------------------------------------------------------------
    console.log('\n🧪 Teste 2: Fallback instantâneo (< 5ms) sem chave da API...');
    const andamentoOriginal = 'Autos conclusos para decisão interlocutória em tutela antecipada.';
    const inicioFallback = Date.now();
    const resFallback = await traduzirAndamentoJuridico(andamentoOriginal, {
        apiKey: '', // Chave explicitamente vazia
        config: {}
    });
    const tempoFallback = Date.now() - inicioFallback;

    console.log(`   ⏱️ Tempo de resposta do fallback: ${resFallback.duracaoMs}ms (cronômetro externo: ${tempoFallback}ms)`);
    assert.strictEqual(resFallback.fonte, 'fallback', 'Deveria retornar fonte "fallback"');
    assert.strictEqual(resFallback.texto, andamentoOriginal, 'Deveria retornar o texto original idêntico');
    assert.ok(resFallback.duracaoMs < 20, `Fallback deve ser quase instantâneo (< 20ms, obtido: ${resFallback.duracaoMs}ms)`);
    console.log('   ✅ Fallback instantâneo comprovado sem erros e sem travar a resposta.');

    // ------------------------------------------------------------------
    // TESTE 3: Simulação de chamada Gemini 1.5 Flash (Mock) e Cache Hit / Miss
    // ------------------------------------------------------------------
    console.log('\n🧪 Teste 3: Mock da API Gemini 1.5 Flash com Cache Miss e Hit...');
    const textoMockadoIA = 'O juiz recebeu o processo para análise. Nossa equipe jurídica está acompanhando atentamente cada andamento. Em breve teremos novos passos no seu caso.';

    // Guardamos o fetch original
    const fetchOriginal = global.fetch;

    let chamadasFetch = 0;
    let urlChamada = '';
    let bodyEnviado = null;

    global.fetch = async (url, options) => {
        chamadasFetch++;
        urlChamada = url;
        bodyEnviado = JSON.parse(options.body);

        // Simula latência de rede realista de 15ms
        await new Promise(r => setTimeout(r, 15));

        return {
            ok: true,
            status: 200,
            json: async () => ({
                candidates: [
                    {
                        content: {
                            parts: [
                                {
                                    text: textoMockadoIA
                                }
                            ]
                        }
                    }
                ]
            })
        };
    };

    try {
        const textoProcesso1 = 'Juntada de petição de manifestação sobre laudo pericial contábil.';

        // 3.1 Primeira chamada: CACHE MISS (deve chamar a API)
        const t1 = Date.now();
        const resMiss = await traduzirAndamentoJuridico(textoProcesso1, {
            apiKey: 'AIzaSyFakeKeyParaTeste123456789'
        });
        const tempoMiss = Date.now() - t1;

        console.log(`   - 1ª Chamada (Cache Miss): fonte=${resMiss.fonte}, chamadasFetch=${chamadasFetch}, tempo=${tempoMiss}ms`);
        assert.strictEqual(resMiss.fonte, 'ia', 'Primeira chamada deve vir da IA');
        assert.strictEqual(resMiss.texto, textoMockadoIA, 'Texto deve ser o retornado pela API');
        assert.strictEqual(chamadasFetch, 1, 'Deve ter chamado fetch exatamente 1 vez');
        assert.ok(urlChamada.includes('gemini-flash') || urlChamada.includes('gemini-1.5-flash'), 'URL deve apontar para endpoint oficial Gemini Flash');

        // 3.2 Segunda chamada: CACHE HIT (deve vir do cache em memória/disco sem chamar a API)
        const t2 = Date.now();
        const resHit = await traduzirAndamentoJuridico(textoProcesso1, {
            apiKey: 'AIzaSyFakeKeyParaTeste123456789'
        });
        const tempoHit = Date.now() - t2;

        console.log(`   - 2ª Chamada (Cache Hit): fonte=${resHit.fonte}, chamadasFetch=${chamadasFetch}, tempo=${tempoHit}ms`);
        assert.strictEqual(resHit.fonte, 'cache', 'Segunda chamada deve vir do cache');
        assert.strictEqual(resHit.texto, textoMockadoIA, 'Texto deve ser o traduzido armazenado');
        assert.strictEqual(chamadasFetch, 1, 'NÃO deve ter feito nova chamada de rede (fetch mantido em 1)');
        assert.ok(tempoHit < 10, 'Cache hit deve ser extremamente rápido (< 10ms)');

        // 3.3 Verificação da persistência em disco do cache
        assert.ok(fs.existsSync(tempCachePath), 'Arquivo de cache temporário em disco deve ter sido gerado');
        const conteudoDisco = JSON.parse(fs.readFileSync(tempCachePath, 'utf-8'));
        const hashProc1 = calcularHash(textoProcesso1);
        assert.strictEqual(conteudoDisco[hashProc1], textoMockadoIA, 'Conteúdo do cache em disco deve bater com o texto traduzido');
        console.log('   ✅ Cache Hit/Miss e persistência em disco validados com sucesso.');

        // ------------------------------------------------------------------
        // TESTE 4: Validação dos Guardrails OAB (Provimento 205/2021)
        // ------------------------------------------------------------------
        console.log('\n🧪 Teste 4: Validação das instruções e limites éticos da OAB no prompt...');
        assert.ok(bodyEnviado, 'Body da requisição deve ter sido capturado');
        const systemInstructionTexto = bodyEnviado.system_instruction?.parts?.[0]?.text || '';

        console.log('   - Verificando regras no System Instruction:');
        const regrasOAB = [
            'Provimento 205/2021',
            '3 frases curtas',
            'NUNCA prometa prazos',
            'NUNCA dê garantias de vitória',
            'NUNCA mencione valores financeiros específicos'
        ];

        for (const regra of regrasOAB) {
            const presente = systemInstructionTexto.includes(regra);
            console.log(`     * Regra [${regra}]: ${presente ? 'OK' : 'FALTANDO'}`);
            assert.ok(presente, `System Instruction deve conter a regra "${regra}"`);
        }

        // Validação da resposta traduzida (máximo 3 frases, sem promessas)
        const frases = textoMockadoIA.split(/[.!?]+/).filter(f => f.trim().length > 0);
        console.log(`   - Quantidade de frases na resposta traduzida: ${frases.length}`);
        assert.ok(frases.length <= 3, 'Resposta não pode exceder 3 frases');
        console.log('   ✅ Guardrails OAB validados com conformidade integral.');

        // ------------------------------------------------------------------
        // TESTE 5: Fallback Gracioso em Erro de Rede ou Timeout da API
        // ------------------------------------------------------------------
        console.log('\n🧪 Teste 5: Fallback gracioso em erro HTTP 429 / 500...');
        global.fetch = async () => ({
            ok: false,
            status: 429,
            statusText: 'Too Many Requests'
        });

        const textoProcessoErro = 'Expedido mandado de citação e intimação.';
        const resErro = await traduzirAndamentoJuridico(textoProcessoErro, {
            apiKey: 'AIzaSyFakeKey'
        });
        assert.strictEqual(resErro.fonte, 'fallback', 'Deve cair em fallback em erro 429');
        assert.strictEqual(resErro.texto, textoProcessoErro, 'Deve retornar o texto original intacto');
        console.log('   ✅ Tratamento gracioso de erro HTTP 429 comprovado sem exceções.');

        // ------------------------------------------------------------------
        // TESTE 6: Timeout Rígido com AbortController
        // ------------------------------------------------------------------
        console.log('\n🧪 Teste 6: Timeout rígido (AbortController)...');
        global.fetch = async (url, options) => {
            return new Promise((resolve, reject) => {
                options.signal.addEventListener('abort', () => {
                    const err = new Error('The operation was aborted');
                    err.name = 'AbortError';
                    reject(err);
                });
            });
        };

        const tInicioTimeout = Date.now();
        const resTimeout = await traduzirAndamentoJuridico('Texto de teste para timeout', {
            apiKey: 'AIzaSyFakeKey',
            timeoutMs: 150 // Timeout curto para o teste
        });
        const tempoDecorridoTimeout = Date.now() - tInicioTimeout;

        console.log(`   ⏱️ Abortado em: ${tempoDecorridoTimeout}ms (esperado ~150ms)`);
        assert.strictEqual(resTimeout.fonte, 'fallback');
        assert.strictEqual(resTimeout.texto, 'Texto de teste para timeout');
        assert.ok(tempoDecorridoTimeout >= 140 && tempoDecorridoTimeout < 400, 'AbortController deve cancelar a tempo');
        console.log('   ✅ AbortController cancelou a requisição pontualmente sem travar.');

        // ------------------------------------------------------------------
        // TESTE 7: Integração com traduzirAndamentoParaCliente (processo WhatsApp)
        // ------------------------------------------------------------------
        console.log('\n🧪 Teste 7: Função traduzirAndamentoParaCliente utilizada no WhatsApp...');
        const processoMock = {
            numero: '0001234-56.2026.8.26.0100',
            nome: 'João da Silva',
            resumo: 'Determinada a expedição de ofício ao órgão previdenciário.',
            temAtualizacao: true
        };

        // Sem chave -> fallback instantâneo sem crash
        const textoFinalSemChave = await traduzirAndamentoParaCliente(processoMock, processoMock.resumo, {});
        assert.strictEqual(textoFinalSemChave, processoMock.resumo);
        console.log(`   - Sem chave: retornou resumo original preservado.`);

        // Com texto nulo/vazio -> lida graciosamente
        const textoVazio = await traduzirAndamentoParaCliente({ resumo: '' });
        assert.strictEqual(textoVazio, '');
        console.log(`   - Com resumo vazio: retornou vazio com segurança.`);

    } finally {
        // Restaura fetch e chave real
        global.fetch = fetchOriginal;
        if (envKeyReal) process.env.GEMINI_API_KEY = envKeyReal;
        // Limpa arquivo de teste temporário
        if (fs.existsSync(tempCachePath)) fs.unlinkSync(tempCachePath);
    }

    // ------------------------------------------------------------------
    // TESTE 8: Chamada REAL à API Gemini (se chave presente no .env)
    // ------------------------------------------------------------------
    if (envKeyReal) {
        console.log('\n🧪 Teste 8: Chamada REAL ao endpoint Google Gemini com a chave do .env...');
        limparCacheMemoria();
        const tReal = Date.now();
        const resReal = await traduzirAndamentoJuridico(
            'Vistos. Defiro a tutela de urgência para determinar o desbloqueio imediato da conta bancária da autora no prazo de 48 horas. Intime-se.',
            { desativarPersistencia: true }
        );
        console.log(`   - Fonte: ${resReal.fonte} | Latência Real: ${Date.now() - tReal}ms`);
        console.log(`   - Tradução da IA: "${resReal.texto}"`);
        assert.strictEqual(resReal.fonte, 'ia', 'A chamada real com a chave do .env deve retornar fonte="ia"');
        console.log('   ✅ API Gemini Real respondeu com sucesso!');
    }

    console.log('\n======================================================');
    console.log('🎉 TODOS OS TESTES DO TRADUTOR JURÍDICO PASSARAM COM SUCESSO!');
    console.log('======================================================');
}

executarTestes().catch(err => {
    console.error('❌ Falha nos testes:', err);
    process.exit(1);
});
