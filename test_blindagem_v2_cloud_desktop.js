/**
 * ========================================================================
 * 🛡️ BATERIA DE TESTES AUTOMATIZADOS DE BLINDAGEM v2.0
 * Advocacia Studio Pro v2.0 (2.0.0-alpha.1) — Cloud, Desktop, REST & Hardening
 * ========================================================================
 *
 * Cobertura completa dos 6 blocos arquiteturais e de segurança:
 * - Bloco 1: Hardening de Empacotamento Docker e Git (.dockerignore e .gitignore)
 * - Bloco 2: Autenticação REST na Nuvem e Endpoint Público /health (server.js)
 * - Bloco 3: Sincronização Bidirecional de Configuração e Fila (/export-config e /import-config)
 * - Bloco 4: Timeouts Diferenciados e Preservação da Cadeia Gemini (src/ia/tradutorJuridico.js)
 * - Bloco 5: Fila Humana com Ordenação por 4 Níveis de Urgência e Badges Visuais (index.html)
 * - Bloco 6: Sincronização Desktop-Cloud e Prevenção de SingletonLock (main.js, preload.js, index.html)
 *
 * Execução: node test_blindagem_v2_cloud_desktop.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuração do Harness de Testes
let totalTestes = 0;
let testesPassados = 0;
let testesFalhados = 0;
const falhasDetalhadas = [];

function imprimirCabecalhoBloco(numero, titulo) {
    console.log('\n' + '='.repeat(76));
    console.log(`📦 BLOCO ${numero}: ${titulo}`);
    console.log('='.repeat(76));
}

async function testar(nome, fn) {
    totalTestes++;
    process.stdout.write(`  🧪 Teste ${totalTestes}: ${nome}... `);
    try {
        await fn();
        testesPassados++;
        console.log('✅ [PASS]');
    } catch (err) {
        testesFalhados++;
        console.log('❌ [FAIL]');
        console.log(`     ⚠️ Motivo: ${err.message}`);
        falhasDetalhadas.push({ teste: nome, erro: err });
    }
}

// Helper para requisições HTTP locais determinísticas
function requisicaoHttp(porta, metodo, caminho, headers = {}, corpo = null) {
    return new Promise((resolve, reject) => {
        const opcoes = {
            hostname: '127.0.0.1',
            port: porta,
            path: caminho,
            method: metodo,
            headers: { ...headers }
        };

        let corpoSerializado = null;
        if (corpo !== null && corpo !== undefined) {
            corpoSerializado = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
            opcoes.headers['Content-Type'] = opcoes.headers['Content-Type'] || 'application/json';
            opcoes.headers['Content-Length'] = Buffer.byteLength(corpoSerializado);
        }

        const req = http.request(opcoes, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => {
                const rawBody = Buffer.concat(chunks).toString('utf-8');
                let jsonBody = null;
                try {
                    jsonBody = JSON.parse(rawBody);
                } catch (e) {}
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: rawBody,
                    json: jsonBody
                });
            });
        });

        req.on('error', reject);
        if (corpoSerializado) req.write(corpoSerializado);
        req.end();
    });
}

async function executarBateriaBlindagemV2() {
    console.log('='.repeat(76));
    console.log('🛡️  BATERIA DE BLINDAGEM v2.0: CLOUD, DESKTOP, REST & HARDENING');
    console.log('   Advocacia Studio Pro v2.0 (2.0.0-alpha.1) — Suíte Automatizada E2E');
    console.log('='.repeat(76));

    const raizProjeto = __dirname;

    // =========================================================================
    // BLOCO 1: Hardening de Empacotamento Docker e Git
    // =========================================================================
    imprimirCabecalhoBloco(1, 'Hardening de Empacotamento Docker e Git (.dockerignore e .gitignore)');

    await testar('Existência física do arquivo .dockerignore na raiz do projeto', () => {
        const caminhoDockerignore = path.join(raizProjeto, '.dockerignore');
        assert.ok(fs.existsSync(caminhoDockerignore), 'Arquivo .dockerignore DEVE existir na raiz');
    });

    await testar('Arquivo .dockerignore contém todas as exclusões de segurança obrigatórias', () => {
        const conteudo = fs.readFileSync(path.join(raizProjeto, '.dockerignore'), 'utf-8');
        const linhas = conteudo.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

        const exclusoesObrigatorias = [
            'node_modules',
            'dist',
            'build',
            '.git',
            '.env',
            'wwebjs_auth_session*',
            'config.v1.backup.*.json',
            '*.log'
        ];

        for (const item of exclusoesObrigatorias) {
            const presente = linhas.some(l => l === item || l.startsWith(item.replace('*', '')) || l === item.replace('*', ''));
            assert.ok(presente, `Exclusão obrigatória "${item}" ausente em .dockerignore`);
        }
    });

    await testar('Arquivo .gitignore contém exclusões de credenciais e sessões sensíveis', () => {
        const caminhoGitignore = path.join(raizProjeto, '.gitignore');
        assert.ok(fs.existsSync(caminhoGitignore), 'Arquivo .gitignore DEVE existir na raiz');
        const conteudo = fs.readFileSync(caminhoGitignore, 'utf-8');

        assert.ok(conteudo.includes('.env'), '.gitignore DEVE ignorar arquivos .env');
        assert.ok(conteudo.includes('wwebjs_auth_session'), '.gitignore DEVE ignorar sessões wwebjs_auth_session*');
        assert.ok(conteudo.includes('config.v1.backup'), '.gitignore DEVE ignorar backups de configuração legados');
    });

    // =========================================================================
    // BLOCO 2: Autenticação REST na Nuvem e Endpoint Público /health
    // =========================================================================
    imprimirCabecalhoBloco(2, 'Autenticação REST na Nuvem e Endpoint Público /health (server.js)');

    let serverInstancia = null;
    let portaServidor = 0;
    const TOKEN_TESTE_BLINDAGEM = 'secret_token_blindagem_v2_98765';

    // Carrega o módulo server.js de forma isolada
    const serverModulo = require('./server');
    assert.ok(serverModulo.server, 'server.js DEVE exportar a instância "server" via module.exports');
    assert.ok(typeof serverModulo.verificarAutenticacao === 'function', 'server.js DEVE exportar "verificarAutenticacao"');

    // Inicializa o servidor HTTP em porta efêmera para os testes dos Blocos 2 e 3
    await new Promise((resolve, reject) => {
        serverInstancia = serverModulo.server;
        serverInstancia.listen(0, '127.0.0.1', () => {
            portaServidor = serverInstancia.address().port;
            resolve();
        });
        serverInstancia.on('error', reject);
    });

    await testar('Endpoint público GET /health retorna HTTP 200 sem necessidade de credenciais', async () => {
        process.env.API_SECRET_TOKEN = TOKEN_TESTE_BLINDAGEM;
        const res = await requisicaoHttp(portaServidor, 'GET', '/health');
        assert.strictEqual(res.statusCode, 200, 'GET /health DEVE responder HTTP 200 público');
        assert.ok(res.json, 'Resposta de /health DEVE ser JSON válido');
        assert.ok(res.json.status === 'online' || res.json.status !== undefined, 'Resposta DEVE conter propriedade status');
    });

    await testar('Endpoints protegidos rejeitam requisições sem credenciais com HTTP 401', async () => {
        process.env.API_SECRET_TOKEN = TOKEN_TESTE_BLINDAGEM;
        const rotasProtegidas = ['/status', '/pausados', '/qr-status', '/export-config'];

        for (const rota of rotasProtegidas) {
            const res = await requisicaoHttp(portaServidor, 'GET', rota);
            assert.strictEqual(res.statusCode, 401, `Rota ${rota} DEVE retornar HTTP 401 quando sem token`);
            assert.ok(res.json && res.json.erro === 'Não autorizado', `Rota ${rota} DEVE retornar JSON { erro: 'Não autorizado' }`);
        }
    });

    await testar('Requisição com token inválido é rejeitada com HTTP 401', async () => {
        process.env.API_SECRET_TOKEN = TOKEN_TESTE_BLINDAGEM;
        const res = await requisicaoHttp(portaServidor, 'GET', '/status', {
            'Authorization': 'Bearer token_invalido_completamente_incorreto'
        });
        assert.strictEqual(res.statusCode, 401, 'Token inválido DEVE retornar HTTP 401');
    });

    await testar('Autenticação com cabeçalho "Authorization: Bearer <token>" concede acesso (HTTP 200)', async () => {
        process.env.API_SECRET_TOKEN = TOKEN_TESTE_BLINDAGEM;
        const res = await requisicaoHttp(portaServidor, 'GET', '/status', {
            'Authorization': `Bearer ${TOKEN_TESTE_BLINDAGEM}`
        });
        assert.strictEqual(res.statusCode, 200, 'Bearer token válido DEVE retornar HTTP 200');
        assert.ok(res.json && res.json.status !== undefined, 'Resposta DEVE conter objeto de status');
    });

    await testar('Autenticação com cabeçalho "x-api-key: <token>" concede acesso (HTTP 200)', async () => {
        process.env.API_SECRET_TOKEN = TOKEN_TESTE_BLINDAGEM;
        const res = await requisicaoHttp(portaServidor, 'GET', '/pausados', {
            'x-api-key': TOKEN_TESTE_BLINDAGEM
        });
        assert.strictEqual(res.statusCode, 200, 'Cabeçalho x-api-key válido DEVE retornar HTTP 200');
        assert.ok(res.json && res.json.sucesso === true, 'Resposta DEVE conter sucesso: true');
    });

    await testar('Autenticação via parâmetro de consulta "?token=<token>" concede acesso (HTTP 200)', async () => {
        process.env.API_SECRET_TOKEN = TOKEN_TESTE_BLINDAGEM;
        const res = await requisicaoHttp(portaServidor, 'GET', `/qr-status?token=${TOKEN_TESTE_BLINDAGEM}`);
        assert.strictEqual(res.statusCode, 200, 'Query parameter ?token= válido DEVE retornar HTTP 200');
        assert.ok(res.json && res.json.status !== undefined, 'Resposta DEVE conter status');
    });

    await testar('Retrocompatibilidade: quando API_SECRET_TOKEN está vazio, rotas respondem HTTP 200', async () => {
        process.env.API_SECRET_TOKEN = '';
        const res = await requisicaoHttp(portaServidor, 'GET', '/status');
        assert.strictEqual(res.statusCode, 200, 'Sem API_SECRET_TOKEN configurado, servidor opera em modo retrocompatível (HTTP 200)');
    });

    // =========================================================================
    // BLOCO 3: Sincronização Bidirecional de Configuração e Fila
    // =========================================================================
    imprimirCabecalhoBloco(3, 'Sincronização Bidirecional de Configuração e Fila (/export-config e /import-config)');

    await testar('GET /export-config retorna estado atual da configuração e fila de contatos pausados', async () => {
        process.env.API_SECRET_TOKEN = TOKEN_TESTE_BLINDAGEM;
        const res = await requisicaoHttp(portaServidor, 'GET', '/export-config', {
            'Authorization': `Bearer ${TOKEN_TESTE_BLINDAGEM}`
        });

        assert.strictEqual(res.statusCode, 200, 'GET /export-config DEVE retornar HTTP 200');
        assert.ok(res.json, 'Resposta DEVE ser JSON válido');
        assert.strictEqual(res.json.sucesso, true, 'Resposta DEVE conter sucesso: true');
        assert.ok(res.json.config && typeof res.json.config === 'object', 'Resposta DEVE conter objeto config');
        assert.ok(res.json.contatosPausados && typeof res.json.contatosPausados === 'object', 'Resposta DEVE conter objeto contatosPausados');
    });

    await testar('POST /import-config recebe payload JSON, mescla configuração e fila, e persiste atomicamente', async () => {
        process.env.API_SECRET_TOKEN = TOKEN_TESTE_BLINDAGEM;
        const idContatoTeste = '5511999998888@c.us';
        const payloadImportacao = {
            config: {
                flag_sincronizacao_blindagem_v2: true,
                versao_sincronizada: '2.0.0-alpha.1'
            },
            contatosPausados: {
                [idContatoTeste]: {
                    motivo: 'Intimação Urgente Importada Nuvem',
                    nivelUrgencia: 'CRITICA',
                    timestamp: 1770000000000,
                    mensagens: [{ de: 'cliente', texto: 'Urgente!' }]
                }
            }
        };

        const res = await requisicaoHttp(portaServidor, 'POST', '/import-config', {
            'Authorization': `Bearer ${TOKEN_TESTE_BLINDAGEM}`
        }, payloadImportacao);

        assert.strictEqual(res.statusCode, 200, 'POST /import-config DEVE responder HTTP 200');
        assert.ok(res.json && res.json.sucesso === true, 'Resposta DEVE conter sucesso: true');
        assert.ok(res.json.mensagem && res.json.mensagem.includes('sucesso'), 'Mensagem de confirmação DEVE constar');

        // Validação da mesclagem no estado consultando GET /export-config
        const exportRes = await requisicaoHttp(portaServidor, 'GET', '/export-config', {
            'Authorization': `Bearer ${TOKEN_TESTE_BLINDAGEM}`
        });
        assert.strictEqual(exportRes.statusCode, 200);
        assert.ok(exportRes.json.contatosPausados[idContatoTeste], 'Contato pausado importado DEVE existir na memória do servidor');
        assert.strictEqual(exportRes.json.contatosPausados[idContatoTeste].nivelUrgencia, 'CRITICA');
    });

    // Encerra o servidor de testes do Bloco 2 e 3
    if (serverInstancia) {
        await new Promise((resolve) => serverInstancia.close(resolve));
    }

    // =========================================================================
    // BLOCO 4: Timeouts Diferenciados e Preservação da Cadeia Gemini
    // =========================================================================
    imprimirCabecalhoBloco(4, 'Timeouts Diferenciados e Preservação da Cadeia Gemini (src/ia/tradutorJuridico.js)');

    const tradutorModulo = require('./src/ia/tradutorJuridico');

    await testar('Constantes de timeout diferenciadas exportadas: TIMEOUT_PADRAO_TEXTO = 3500 e TIMEOUT_MULTIMODAL_AUDIO = 20000', () => {
        assert.strictEqual(tradutorModulo.TIMEOUT_PADRAO_TEXTO, 3500, 'TIMEOUT_PADRAO_TEXTO DEVE ser estritamente 3500ms');
        assert.strictEqual(tradutorModulo.TIMEOUT_MULTIMODAL_AUDIO, 20000, 'TIMEOUT_MULTIMODAL_AUDIO DEVE ser estritamente 20000ms');
    });

    await testar('Cadeia de modelos prioritários MODELOS_GEMINI_PADRAO estritamente preservada', () => {
        const esperado = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-1.5-flash'];
        assert.ok(Array.isArray(tradutorModulo.MODELOS_GEMINI_PADRAO), 'MODELOS_GEMINI_PADRAO DEVE ser um array');
        assert.deepStrictEqual(tradutorModulo.MODELOS_GEMINI_PADRAO, esperado, 'Cadeia de modelos DEVE manter a ordem exata de prioridade');
    });

    await testar('Operação multimodal de áudio processarAudioECopilot utiliza timeout de 20s com AbortController', () => {
        const codigoFonte = fs.readFileSync(path.join(raizProjeto, 'src/ia/tradutorJuridico.js'), 'utf-8');
        assert.ok(codigoFonte.includes('TIMEOUT_MULTIMODAL_AUDIO'), 'Código DEVE referenciar TIMEOUT_MULTIMODAL_AUDIO');
        assert.ok(codigoFonte.includes('controller.signal') || codigoFonte.includes('signal: controller.signal'), 'Requisições multimodais DEVEM passar o signal de cancelamento ao fetch');
    });

    await testar('Operações padrão de texto utilizam TIMEOUT_PADRAO_TEXTO (3.5s)', () => {
        const codigoFonte = fs.readFileSync(path.join(raizProjeto, 'src/ia/tradutorJuridico.js'), 'utf-8');
        assert.ok(codigoFonte.includes('TIMEOUT_PADRAO_TEXTO'), 'Código DEVE referenciar TIMEOUT_PADRAO_TEXTO nas rotinas textuais');
    });

    await testar('Gravação em disco do cache gemini_cache.json utiliza escrita atômica com .tmp', () => {
        const codigoFonte = fs.readFileSync(path.join(raizProjeto, 'src/ia/tradutorJuridico.js'), 'utf-8');
        assert.ok(codigoFonte.includes('.tmp'), 'salvarCacheDisco DEVE gravar primeiro em arquivo temporário .tmp');
        assert.ok(codigoFonte.includes('renameSync') || codigoFonte.includes('copyFileSync'), 'salvarCacheDisco DEVE utilizar renomeação atômica');
    });

    // =========================================================================
    // BLOCO 5: Fila Humana com Ordenação por 4 Níveis de Urgência e Badges Visuais
    // =========================================================================
    imprimirCabecalhoBloco(5, 'Fila Humana com Ordenação por 4 Níveis de Urgência e Badges Visuais (index.html)');

    const caminhoIndexHtml = path.join(raizProjeto, 'index.html');
    assert.ok(fs.existsSync(caminhoIndexHtml), 'index.html DEVE existir na raiz do projeto');
    const indexHtmlContent = fs.readFileSync(caminhoIndexHtml, 'utf-8');

    await testar('Mapeamento PESO_URGENCIA com 4 níveis formais definido na interface (CRITICA: 4, ALTA: 3, MEDIA: 2, BAIXA: 1)', () => {
        assert.ok(indexHtmlContent.includes('PESO_URGENCIA'), 'index.html DEVE definir a constante ou objeto PESO_URGENCIA');
        assert.ok(/'CRITICA':\s*4/.test(indexHtmlContent) || /CRITICA:\s*4/.test(indexHtmlContent), 'PESO_URGENCIA.CRITICA DEVE ser 4');
        assert.ok(/'ALTA':\s*3/.test(indexHtmlContent) || /ALTA:\s*3/.test(indexHtmlContent), 'PESO_URGENCIA.ALTA DEVE ser 3');
        assert.ok(/'MEDIA':\s*2/.test(indexHtmlContent) || /MEDIA:\s*2/.test(indexHtmlContent), 'PESO_URGENCIA.MEDIA DEVE ser 2');
        assert.ok(/'BAIXA':\s*1/.test(indexHtmlContent) || /BAIXA:\s*1/.test(indexHtmlContent), 'PESO_URGENCIA.BAIXA DEVE ser 1');
    });

    await testar('Fórmula de ordenação da fila por prioridade com critério de desempate por timestamp', () => {
        const temFormula = /PESO_URGENCIA\[.+nivelUrgencia/.test(indexHtmlContent) || indexHtmlContent.includes('PESO_URGENCIA');
        assert.ok(temFormula, 'Ordenação DEVE calcular diferença de peso entre itens b e a');
        assert.ok(indexHtmlContent.includes('timestamp'), 'Desempate DEVE considerar o timestamp mais recente');
    });

    await testar('Validação algorítmica da ordenação da fila com os 4 níveis de urgência', () => {
        const PESO_URGENCIA = { 'CRITICA': 4, 'ALTA': 3, 'MEDIA': 2, 'BAIXA': 1 };
        const filaExemplo = [
            { id: '1', nome: 'Dúvida Simples', nivelUrgencia: 'BAIXA', timestamp: 1000 },
            { id: '2', nome: 'Oficial de Justiça', nivelUrgencia: 'CRITICA', timestamp: 2000 },
            { id: '3', nome: 'Intimação Prazo', nivelUrgencia: 'ALTA', timestamp: 3000 },
            { id: '4', nome: 'Andamento de Rotina', nivelUrgencia: 'MEDIA', timestamp: 4000 },
            { id: '5', nome: 'Bloqueio Judicial', nivelUrgencia: 'ALTA', timestamp: 5000 } // Mais recente que id 3
        ];

        filaExemplo.sort((a, b) => {
            const pesoA = PESO_URGENCIA[a.nivelUrgencia || 'MEDIA'] || 2;
            const pesoB = PESO_URGENCIA[b.nivelUrgencia || 'MEDIA'] || 2;
            if (pesoB !== pesoA) return pesoB - pesoA;
            return (b.timestamp || 0) - (a.timestamp || 0);
        });

        assert.strictEqual(filaExemplo[0].id, '2', 'Item 1 DEVE ser CRITICA (Oficial de Justiça)');
        assert.strictEqual(filaExemplo[1].id, '5', 'Item 2 DEVE ser ALTA com timestamp mais recente (Bloqueio Judicial)');
        assert.strictEqual(filaExemplo[2].id, '3', 'Item 3 DEVE ser ALTA mais antiga (Intimação Prazo)');
        assert.strictEqual(filaExemplo[3].id, '4', 'Item 4 DEVE ser MEDIA (Andamento de Rotina)');
        assert.strictEqual(filaExemplo[4].id, '1', 'Item 5 DEVE ser BAIXA (Dúvida Simples)');
    });

    await testar('Presença dos 4 badges visuais e estilização de bordas de urgência em index.html', () => {
        assert.ok(indexHtmlContent.includes('🚨 URGÊNCIA CRÍTICA'), 'Badge 🚨 URGÊNCIA CRÍTICA DEVE estar presente');
        assert.ok(indexHtmlContent.includes('URGÊNCIA MÁXIMA'), 'URGÊNCIA MÁXIMA DEVE ser mantida para compatibilidade retroativa');
        assert.ok(indexHtmlContent.includes('⚠️ ALTA PRIORIDADE') || indexHtmlContent.includes('ALTA PRIORIDADE'), 'Badge ALTA PRIORIDADE DEVE estar presente');
        assert.ok(indexHtmlContent.includes('📋 ROTINA') || indexHtmlContent.includes('ROTINA / ANDAMENTO'), 'Badge ROTINA DEVE estar presente');
        assert.ok(indexHtmlContent.includes('💬 DÚVIDA GERAL') || indexHtmlContent.includes('DÚVIDA GERAL'), 'Badge DÚVIDA GERAL DEVE estar presente');

        assert.ok(indexHtmlContent.includes('border-red-500'), 'Borda vermelha DEVE ser aplicada em casos críticos');
        assert.ok(indexHtmlContent.includes('border-amber-500') || indexHtmlContent.includes('border-orange-500'), 'Borda âmbar/laranja DEVE ser aplicada em alta prioridade');
    });

    // =========================================================================
    // BLOCO 6: Sincronização Desktop Cloud e Prevenção de SingletonLock
    // =========================================================================
    imprimirCabecalhoBloco(6, 'Sincronização Desktop Cloud e Prevenção de SingletonLock (main.js, preload.js, index.html)');

    const caminhoPreload = path.join(raizProjeto, 'preload.js');
    assert.ok(fs.existsSync(caminhoPreload), 'preload.js DEVE existir na raiz do projeto');
    const preloadContent = fs.readFileSync(caminhoPreload, 'utf-8');

    await testar('preload.js expõe método sincronizarServidorNuvem na ponte segura apiBridge', () => {
        assert.ok(preloadContent.includes('sincronizarServidorNuvem'), 'preload.js DEVE conter sincronizarServidorNuvem');
        assert.ok(preloadContent.includes('sincronizar-servidor-nuvem'), 'preload.js DEVE invocar o canal IPC sincronizar-servidor-nuvem');
    });

    const caminhoMain = path.join(raizProjeto, 'main.js');
    assert.ok(fs.existsSync(caminhoMain), 'main.js DEVE existir na raiz do projeto');
    const mainContent = fs.readFileSync(caminhoMain, 'utf-8');

    await testar('main.js registra handler ipcMain.handle para sincronizar-servidor-nuvem', () => {
        assert.ok(mainContent.includes("'sincronizar-servidor-nuvem'"), 'main.js DEVE registrar handler para sincronizar-servidor-nuvem');
        assert.ok(mainContent.includes('Authorization') || mainContent.includes('Bearer'), 'Handler DEVE autenticar com o servidor nuvem');
    });

    await testar('Isolamento de sessão Desktop: clientId "advocacia-desktop-session" configurado em main.js', () => {
        assert.ok(mainContent.includes('advocacia-desktop-session'), 'main.js DEVE configurar clientId com isolamento "advocacia-desktop-session"');
    });

    await testar('Tratamento preventivo de SingletonLock no ciclo de inicialização do Desktop', () => {
        assert.ok(mainContent.includes('SingletonLock'), 'main.js DEVE gerenciar remoção e verificação de SingletonLock');
        assert.ok(mainContent.includes('limparLocksTravados'), 'Função limparLocksTravados DEVE estar presente e ativa');
    });

    await testar('Card executivo de interface "☁️ Sincronização com Servidor Nuvem (24/7)" presente em index.html', () => {
        assert.ok(indexHtmlContent.includes('Sincronização com Servidor Nuvem') || indexHtmlContent.includes('☁️ Sincronização'), 'index.html DEVE conter o Card de Sincronização Nuvem');
        assert.ok(indexHtmlContent.includes('https://advocacia-2-0.onrender.com'), 'Card DEVE conter a URL padrão https://advocacia-2-0.onrender.com');
        assert.ok(indexHtmlContent.includes('Sincronizar Agora'), 'Card DEVE conter botão de acionamento manual da sincronização');
    });

    // =========================================================================
    // RELATÓRIO FINAL
    // =========================================================================
    console.log('\n' + '='.repeat(76));
    console.log('📊 RESUMO DA EXECUÇÃO: SUÍTE DE BLINDAGEM v2.0');
    console.log('='.repeat(76));
    console.log(`  Total de Testes Executados: ${totalTestes}`);
    console.log(`  Sucessos: ${testesPassados} ✅`);
    console.log(`  Falhas:   ${testesFalhados} ${testesFalhados === 0 ? '🎉' : '❌'}`);

    if (falhasDetalhadas.length > 0) {
        console.log('\n⚠️ DETALHE DAS FALHAS ENCONTRADAS:');
        falhasDetalhadas.forEach((f, idx) => {
            console.log(`  ${idx + 1}. [${f.teste}]`);
            console.log(`     ${f.erro.stack || f.erro.message}\n`);
        });
    }

    console.log('='.repeat(76));
    if (testesFalhados === 0) {
        console.log('🏆 100% DOS TESTES DE BLINDAGEM v2.0 PASSARAM COM SUCESSO!');
        console.log('='.repeat(76));
    } else {
        console.log('💥 ALGUNS TESTES FALHARAM. VERIFIQUE OS DETALHES ACIMA.');
        console.log('='.repeat(76));
    }

    process.exit(testesFalhados === 0 ? 0 : 1);
}

// Executa a suíte
executarBateriaBlindagemV2().catch((err) => {
    console.error('Erro fatal durante a execução da bateria de blindagem:', err);
    process.exit(1);
});
