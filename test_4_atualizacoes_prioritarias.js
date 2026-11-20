const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const {
    isMensagemCritica,
    detectarUrgenciaECronologiaLocal,
    sugerirRespostaFilaComIA
} = require('./src/ia/tradutorJuridico');

let passou = 0;
let falhou = 0;

async function testar(nome, fn) {
    try {
        await fn();
        console.log(`  ✅ [PASS] ${nome}`);
        passou++;
    } catch (err) {
        console.error(`  ❌ [FAIL] ${nome}: ${err.message}`);
        falhou++;
    }
}

async function executar() {
    console.log('\n=================================================================');
    console.log('🧪 BATERIA DE TESTES: 4 ATUALIZAÇÕES PRIORITÁRIAS');
    console.log('=================================================================\n');

    const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
    const preloadCode = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
    const serverCode = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    // --- 1. HISTÓRICO DE CONVERSAS E AUDITORIA FIEL ---
    await testar('1.1 main.js não trunca mensagens do robô em 180 chars nem sobrescreve nome com "🤖 Robô →"', () => {
        assert(!mainCode.includes("nome: '🤖 Robô → '"), 'main.js ainda sobrescreve nome com "🤖 Robô →"');
        assert(!mainCode.includes('.slice(0, 180)'), 'main.js ainda trunca respostaSimulada em 180 caracteres');
    });

    await testar('1.2 main.js emite bot-log com tipo/origem="robo" no Simulador/WhatsApp e tipo/origem="advogado" na Fila', () => {
        const ocorrenciasTipoRobo = (mainCode.match(/tipo:\s*'robo'/g) || []).length;
        const ocorrenciasOrigemRobo = (mainCode.match(/origem:\s*'robo'/g) || []).length;
        const ocorrenciasTipoAdv = (mainCode.match(/tipo:\s*'advogado'/g) || []).length;
        assert(ocorrenciasTipoRobo >= 2, `Esperado >= 2 emissões bot-log com tipo: 'robo', encontrado ${ocorrenciasTipoRobo}`);
        assert(ocorrenciasOrigemRobo >= 2, `Esperado >= 2 emissões bot-log com origem: 'robo', encontrado ${ocorrenciasOrigemRobo}`);
        assert(ocorrenciasTipoAdv >= 1, `Esperado >= 1 emissão bot-log com tipo: 'advogado', encontrado ${ocorrenciasTipoAdv}`);
    });

    await testar('1.3 index.html preserva nome real do cliente na lista lateral e filtra mensagens do robô em filtrarLogsLedgerUI', () => {
        assert(indexHtml.includes("const isRobo = (log.tipo === 'robo') || (log.origem === 'robo')"), 'Detecção explícita de tipo/origem robo ausente');
        assert(indexHtml.includes("!String(log.nome).startsWith('🤖')"), 'Proteção contra prefixo 🤖 no nome do contato ausente');
        assert(indexHtml.includes("div.setAttribute('data-tipo', isRobo ? 'robo' : 'cliente')"), 'Atributo data-tipo para filtro ausente');
        assert(indexHtml.includes("div.className = `log-entry-row flex w-full group ${isRobo ? 'justify-end' : 'justify-start'}`"), 'Alinhamento direita/esquerda ausente');
    });

    // --- 2. ANEXAR PDF/SENTENÇA ATUALIZAR RESUMO DO PROCESSO ---
    await testar('2.1 anexarArquivosAoProcesso atualiza proc.resumo, temAtualizacao=true e _resetarVistos=true', () => {
        const blocoAnexo = mainCode.slice(mainCode.indexOf('async function anexarArquivosAoProcesso'), mainCode.indexOf("ipcMain.handle('processo-anexar-pecas'"));
        assert(blocoAnexo.includes('proc.resumo ='), 'proc.resumo não é atualizado em anexarArquivosAoProcesso');
        assert(blocoAnexo.includes('proc.temAtualizacao = true'), 'proc.temAtualizacao não é marcado como true');
        assert(blocoAnexo.includes('proc._resetarVistos = true'), 'proc._resetarVistos não é resetado para nova peça');
    });

    await testar('2.2 index.html sincroniza formulário do processo após anexar pelo modal de Dossiê', () => {
        const blocoModal = indexHtml.slice(indexHtml.indexOf('if (btnDossieAnexarMais)'), indexHtml.indexOf("safeOn('btn-salvar-processo'"));
        assert(blocoModal.includes('selecionarProcessoNaLista(idProcessoSelecionado)'), 'selecionarProcessoNaLista não chamado após anexar no modal Dossiê');
    });

    // --- 3. FILA DO ADVOGADO: SUGESTÃO IA SOB DEMANDA & CONTROLE EXPLÍCITO DE PAUSA ---
    await testar('3.1 sugerirRespostaFilaComIA gera sugestão contextual em modo fallback quando IA externa está indisponível', async () => {
        const res = await sugerirRespostaFilaComIA({
            nome: 'Maria Silva',
            motivo: 'Urgência: delegacia',
            historicoMensagens: [{ de: 'cliente', texto: 'Meu marido está na delegacia em flagrante, preciso de ajuda!' }]
        }, { apiKey: '' });
        assert.strictEqual(res.sucesso, true);
        assert.strictEqual(res.fonte, 'fallback');
        assert(res.sugestao && res.sugestao.includes('Maria'), 'Sugestão fallback deve personalizar saudação com primeiro nome');
        assert(res.sugestao.length > 30, 'Sugestão fallback muito curta');
    });

    await testar('3.2 sugerirRespostaFilaComIA faz fallback elegante se fetch retornar erro HTTP 500', async () => {
        const fetchOriginal = global.fetch;
        global.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
        try {
            const res = await sugerirRespostaFilaComIA({
                nome: 'Carlos',
                motivo: 'Audiência urgente',
                historicoMensagens: [{ de: 'cliente', texto: 'Recebi uma intimação para audiência amanhã.' }]
            }, { apiKey: 'chave-teste-mock' });
            assert.strictEqual(res.sucesso, true);
            assert.strictEqual(res.fonte, 'fallback');
            assert(res.sugestao.length > 20);
        } finally {
            global.fetch = fetchOriginal;
        }
    });

    await testar('3.3 Paridade IPC: preload.js expõe sugerirRespostaFilaIA e main.js registra fila-sugerir-resposta-ia sem expor API key', () => {
        assert(preloadCode.includes("sugerirRespostaFilaIA: (dados) => ipcRenderer.invoke('fila-sugerir-resposta-ia', dados)"), 'preload.js sem sugerirRespostaFilaIA');
        assert(mainCode.includes("ipcMain.handle('fila-sugerir-resposta-ia'"), 'main.js sem handler fila-sugerir-resposta-ia');
        assert(!indexHtml.includes('GEMINI_API_KEY') && !indexHtml.includes('obterApiKeyAtiva'), 'Chave de IA não deve aparecer na UI');
    });

    await testar('3.4 responder-cliente-pausado mantém cliente pausado por padrão (despausar = false) e UI exige clique em "Liberar para o Robô"', () => {
        const blocoResponder = mainCode.slice(mainCode.indexOf("ipcMain.handle('responder-cliente-pausado'"), mainCode.indexOf("ipcMain.handle('fila-sugerir-resposta-ia'"));
        assert(blocoResponder.includes('despausar = false'), 'despausar deve ser false por padrão');
        assert(blocoResponder.includes('if (despausar) {'), 'Exclusão de contatosPausados deve ocorrer apenas se despausar for true');
        assert(indexHtml.includes('✨ Sugerir Resposta com IA'), 'Botão Sugerir Resposta com IA ausente no card da Fila');
        assert(indexHtml.includes('Liberar para o Robô'), 'Botão explícito Liberar para o Robô ausente no card da Fila');
        const blocoEnviarFila = indexHtml.slice(indexHtml.indexOf('window.enviarRespostaAdvogadoFila'), indexHtml.indexOf('window.reativarCliente'));
        assert(!blocoEnviarFila.includes('card.remove()'), 'enviarRespostaAdvogadoFila não pode remover o card automaticamente');
        assert(!blocoEnviarFila.includes('api.removerPausa'), 'enviarRespostaAdvogadoFila não pode chamar removerPausa');
    });

    // --- 4. PALAVRAS DE URGÊNCIA & ALERTA NOTURNO ---
    await testar('4.1 isMensagemCritica e detectarUrgenciaECronologiaLocal detectam "delegacia" e "flagrante" por padrão', () => {
        assert.strictEqual(isMensagemCritica('Preciso de advogado na delegacia agora'), true);
        assert.strictEqual(isMensagemCritica('Meu irmão foi preso em flagrante'), true);
        assert.strictEqual(detectarUrgenciaECronologiaLocal('Estou na delegacia').nivelUrgencia, 'CRITICA');
        assert.strictEqual(detectarUrgenciaECronologiaLocal('Prisão em flagrante').nivelUrgencia, 'CRITICA');
        assert.strictEqual(isMensagemCritica('Bom dia, gostaria de saber meu andamento'), false);
    });

    await testar('4.2 isMensagemCritica e detectarUrgenciaECronologiaLocal detectam palavras personalizadas do advogado (com normalização de acento)', () => {
        const cfgCustom = {
            agenda: {
                palavras_urgencia: 'audiência de custódia, penhora online, alvará urgente'
            }
        };
        assert.strictEqual(isMensagemCritica('Vai ter audiencia de custodia hoje', cfgCustom), true);
        assert.strictEqual(isMensagemCritica('Sofri uma penhora online na conta', cfgCustom), true);
        assert.strictEqual(detectarUrgenciaECronologiaLocal('Preciso de alvara urgente', { config: cfgCustom }).nivelUrgencia, 'CRITICA');
        assert.strictEqual(isMensagemCritica('Boa tarde, tudo bem?', cfgCustom), false);
    });

    await testar('4.3 index.html possui campo #agenda-palavras-urgencia com anti-freeze e persistência em configGlobal.agenda', () => {
        assert(indexHtml.includes('id="agenda-palavras-urgencia"'), 'Input #agenda-palavras-urgencia ausente em #aba-agenda');
        assert(indexHtml.includes('document.activeElement !== elPalavrasUrgencia'), 'Proteção activeElement ausente para #agenda-palavras-urgencia');
        assert(indexHtml.includes("configGlobal.agenda.palavras_urgencia = e.target.value"), 'Listener input para palavras_urgencia ausente');
    });

    await testar('4.4 server.js importa isMensagemCritica e intercepta mensagens críticas com nivelUrgencia CRITICA', () => {
        assert(serverCode.includes('isMensagemCritica'), 'server.js não usa isMensagemCritica');
        assert(serverCode.includes("nivelUrgencia: 'CRITICA'"), 'server.js não marca nivelUrgencia: CRITICA na fila humana');
    });

    // --- 5. VALIDAÇÃO SINTÁTICA DE TODOS OS SCRIPTS ---
    await testar('5.1 Todos os blocos <script> do index.html compilam perfeitamente via vm.Script', () => {
        const scripts = [...indexHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(s => s.trim());
        assert(scripts.length > 0, 'Nenhum script encontrado em index.html');
        scripts.forEach((s, i) => new vm.Script(s, { filename: `index_script_${i}.js` }));
    });

    console.log('\n=================================================================');
    console.log(`📊 RESULTADO: ${passou} Passaram | ${falhou} Falharam`);
    console.log('=================================================================\n');
    if (falhou > 0) process.exit(1);
}

executar().catch(err => {
    console.error('Erro fatal na suíte:', err);
    process.exit(1);
});
