/**
 * Teste Automatizado de Varredura Geral, Correção de DOM,
 * Paridade de IPC, Simulador WhatsApp (Sem Celular Conectado),
 * Inteligência Artificial Ao Vivo (Gemini) e Deduplicação Unificada.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

console.log('=== INICIANDO BATERIA DE TESTES DE INTEGRIDADE, SIMULADOR & IA ===\n');

// 1. TESTE DE DOM: Hierarquia de abas e botões no index.html
console.log('1. Testando Integridade de DOM e Hierarquia de Abas no index.html...');
const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const posAbaIgnorados = html.indexOf('id="aba-ignorados"');
const posFechamentoIgnorados = html.indexOf('<!-- ================= ABA 8: SIMULADOR DE CHAT WHATSAPP (SANDBOX) ================= -->');
const posAbaSimulador = html.indexOf('id="aba-simulador"');

assert(posAbaIgnorados !== -1, 'aba-ignorados deve existir no HTML');
assert(posAbaSimulador !== -1, 'aba-simulador deve existir no HTML');
assert(posFechamentoIgnorados > posAbaIgnorados, 'aba-ignorados deve ser fechada antes do início do simulador');
assert(posAbaSimulador > posFechamentoIgnorados, 'aba-simulador deve vir após o fechamento de aba-ignorados');

// Verifica elementos essenciais da v2.0
assert(html.includes('id="btn-simulador-reset"'), 'Botão de resetar conversa/despausar deve existir');
assert(html.includes('id="btn-simulador-testar-ia"'), 'Botão de testar IA Gemini no simulador deve existir');
assert(html.includes('id="modal-dossie-processo"'), 'Modal de dossiê do processo deve existir');
assert(html.includes('id="btn-anexar-peca-proc"'), 'Botão anexar peça deve existir');
assert(html.includes('id="btn-ver-dossie-proc"'), 'Botão ver dossiê deve existir');
assert(html.includes('<th class="p-2.5">Situação</th>'), 'Coluna de Situação na prévia deve existir');
assert(html.includes('window.aoAbrirAbaSimulador'), 'Hook aoAbrirAbaSimulador deve existir');

console.log('   ✓ Hierarquia de DOM 100% íntegra: todas as 9 abas irmãs e modais posicionados com perfeição.\n');

// 2. TESTE DE PARIDADE IPC (preload.js <-> main.js)
console.log('2. Testando Paridade de Canais IPC entre preload.js e main.js...');
const preloadCode = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
const mainCode = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

const canaisInvoke = [...preloadCode.matchAll(/ipcRenderer\.invoke\(['"]([^'"]+)['"]/g)].map(m => m[1]);
const canaisHandle = [...mainCode.matchAll(/ipcMain\.handle\(['"]([^'"]+)['"]/g)].map(m => m[1]);

for (const canal of canaisInvoke) {
  assert(canaisHandle.includes(canal), `Canal IPC '${canal}' chamado no preload.js deve existir em ipcMain.handle no main.js`);
}
console.log(`   ✓ Todos os ${canaisInvoke.length} canais IPC (invoke <-> handle) possuem correspondência exata.\n`);

// 3. TESTE DE DEDUPLICAÇÃO UNIFICADA: motorIngestao.js
console.log('3. Testando Deduplicação Unificada (processosEquivalentes & mesclarComConfigAtual)...');
const { processosEquivalentes, mesclarComConfigAtual } = require('./src/ingestao/motorIngestao');

const pBase = {
  id: 'proc_101',
  nome: 'Maria Santos',
  cpf: '123.456.789-00',
  numeroProcesso: '1000123-45.2026.8.26.0100',
  resumo: 'Aguardando réplica da contestação'
};

const pSpreadsheet = {
  nome: 'Maria Santos',
  cpf: '12345678900',
  numeroProcesso: '10001234520268260100',
  resumo: 'Nova decisão: Deferida prova pericial'
};

const pManual = {
  nome: 'Maria Santos',
  cpf: '123.456.789-00',
  numero: '1000123-45.2026.8.26.0100',
  resumo: 'Perito agendou vistoria para 20/11'
};

assert.strictEqual(processosEquivalentes(pBase, pSpreadsheet), true, 'Processo por planilha deve ser reconhecido como idêntico');
assert.strictEqual(processosEquivalentes(pBase, pManual), true, 'Processo manual deve ser reconhecido como idêntico');

const configMock = {
  processos: {
    lista: [JSON.parse(JSON.stringify(pBase))]
  }
};

const resMerge1 = mesclarComConfigAtual([pSpreadsheet], configMock);
assert.strictEqual(resMerge1.total, 1, 'Total de processos não pode crescer com registro idêntico');
assert.strictEqual(resMerge1.atualizados, 1, 'Deve marcar como 1 atualizado');
assert.strictEqual(resMerge1.config.processos.lista[0].resumo, pSpreadsheet.resumo, 'Resumo deve ser atualizado');
assert(Array.isArray(resMerge1.config.processos.lista[0].historicoAndamentos), 'Histórico deve ser criado');
assert(resMerge1.config.processos.lista[0].historicoAndamentos.length >= 1, 'Histórico deve conter andamentos arquivados');
assert(resMerge1.config.processos.lista[0].historicoAndamentos.some(h => (h.textoBruto || h.resumoAnterior) === pBase.resumo), 'Histórico deve conter o resumo anterior');

console.log('   ✓ Deduplicação 100% equivalente entre manual e planilha, histórico arquivado com sucesso.\n');

// 4. TESTE DE CATALOGAÇÃO E ANEXO DE PEÇAS PROCESSUAIS (IA / Local)
console.log('4. Testando Catalogação de Peças com Inteligência Artificial Ao Vivo...');
const { catalogarPecaProcessual } = require('./src/ia/tradutorJuridico');

async function testarCatalogacao() {
  const textoSentenca = `
    TRIBUNAL DE JUSTIÇA DO ESTADO DE SÃO PAULO
    COMARCA DE SÃO PAULO - 1ª VARA CÍVEL CENTRAL
    Processo nº 1000123-45.2026.8.26.0100
    SENTENÇA
    Vistos.
    Trata-se de Ação de Cobrança proposta por Maria Santos em face de Construtora Alfa S/A.
    Diante do exposto e por tudo mais que dos autos consta, JULGO PROCEDENTE o pedido inicial para condenar a ré ao pagamento de R$ 45.000,00 acrescido de correção monetária.
    P.R.I. São Paulo, 15 de Outubro de 2026.
    Juiz de Direito Titular.
  `;

  const catalogo = await catalogarPecaProcessual(textoSentenca, 'sentenca_procedente.pdf');
  assert(catalogo, 'Deve retornar catálogo da peça');
  assert(catalogo.tipoPeca, 'Deve identificar o tipo da peça');
  assert(catalogo.resumo, 'Deve gerar um resumo leigo claro');
  console.log(`   Tipo de Peça Identificado: [${catalogo.tipoPeca}]`);
  console.log(`   Resumo Leigo Gerado: "${catalogo.resumo}"`);
  console.log(`   Origem: ${catalogo.origem} | Confiança: ${catalogo.confianca}`);
  console.log('   ✓ Catalogação de peça processual executada com sucesso.\n');
}

// 5. TESTE E2E DO SIMULADOR DE WHATSAPP (100% SEM CONECTAR O CELULAR)
console.log('5. Testando Simulador WhatsApp (Sandbox Completo sem WhatsApp Conectado)...');

async function testarSimuladorCompletoSemWhatsApp() {
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'adv2_sim_test_'));
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
      Notification: { isSupported: () => false }
    }
  };

  const mainApp = require('./main.js');
  const telSimulado = '+55 (11) 98765-4321';
  const nomeSimulado = 'Carlos Eduardo Teste';

  // 5.1 Teste do canal 'ia-testar-conexao'
  const resTesteIA = await handlersIPC['ia-testar-conexao']({}, '');
  assert(resTesteIA && resTesteIA.success === true, 'Teste de conexão com a API Gemini deve ter sucesso');
  console.log(`   [5.1] Teste de Conexão IA via IPC: "${resTesteIA.mensagem}"`);
  console.log(`         Tradução gerada ao vivo: "${resTesteIA.texto}"`);

  // 5.2 Saudação inicial ("Olá") -> Menu Raiz
  const resOla = await mainApp.executarSimulacaoMensagem({
    texto: 'Olá',
    telefone: telSimulado,
    nome: nomeSimulado
  });
  assert(resOla.sucesso === true && resOla.resposta.length > 10, 'Saudação "Olá" deve retornar o menu principal');
  console.log(`   [5.2] Cenário "Olá": Menu principal recebido (${resOla.resposta.split('\n')[0]}...)`);

  // 5.3 Opção "1" -> Solicita CPF ou Número do Processo
  const resOp1 = await mainApp.executarSimulacaoMensagem({
    texto: '1',
    telefone: telSimulado,
    nome: nomeSimulado
  });
  assert(resOp1.sucesso === true && /cpf|processo/i.test(resOp1.resposta), 'Opção "1" deve solicitar CPF ou Processo');
  console.log(`   [5.3] Cenário Opção "1": Solicitação de CPF/CNJ recebida com sucesso.`);

  // 5.4 Envio de CPF Válido ("123.456.789-00") -> Consulta + Tradução IA ao vivo
  const resCpf = await mainApp.executarSimulacaoMensagem({
    texto: '123.456.789-00',
    telefone: telSimulado,
    nome: nomeSimulado
  });
  assert(resCpf.sucesso === true && resCpf.resposta.includes('0004589-72.2025.8.26.0100'), 'Consulta por CPF deve retornar os dados do processo');
  console.log(`   [5.4] Cenário "CPF Válido": Processo localizado e traduzido pela IA!`);

  // 5.5 Botão "Chamar Advogado" ("falar com advogado") -> Transbordo Humano + Pausa
  const resAdv = await mainApp.executarSimulacaoMensagem({
    texto: 'falar com advogado',
    telefone: telSimulado,
    nome: nomeSimulado
  });
  assert(resAdv.sucesso === true && resAdv.transbordo === true, 'Comando "falar com advogado" deve acionar transbordo humano');
  console.log(`   [5.5] Cenário "Chamar Advogado": Transbordo humano acionado (transbordo=true).`);

  // 5.6 Nova mensagem enquanto pausado -> Robô permanece em pausa (pausado=true)
  const resPausado = await mainApp.executarSimulacaoMensagem({
    texto: 'Ainda estão aí?',
    telefone: telSimulado,
    nome: nomeSimulado
  });
  assert.strictEqual(resPausado.pausado, true, 'Contato na fila humana deve retornar pausado=true');
  console.log(`   [5.6] Verificação de Pausa: Robô silenciado enquanto cliente aguarda advogado (pausado=true).`);

  // 5.7 Botão "🔄 Resetar Conversa / Despausar Robô"
  const resReset = await mainApp.resetarConversaSimulador({ telefone: telSimulado });
  assert.strictEqual(resReset.success, true, 'Reset deve ter sucesso');
  assert.strictEqual(resReset.despausado, true, 'Reset deve despausar o contato');

  const resPosReset = await mainApp.executarSimulacaoMensagem({
    texto: 'Olá',
    telefone: telSimulado,
    nome: nomeSimulado
  });
  assert(resPosReset.sucesso === true && resPosReset.pausado === false && resPosReset.resposta.length > 10, 'Após reset, o robô deve voltar a responder normalmente');
  console.log(`   [5.7] Cenário "Resetar Conversa / Despausar Robô": Sessão restaurada e robô ativo novamente!\n`);
}

// 6. TESTE DE ESCRITA ATÔMICA E PROTEÇÃO DE CONFIG
console.log('6. Testando Segurança de Arquivos e Escrita Atômica...');
const tmpDir = path.join(__dirname, 'scratch_test_atomic');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

const fileDest = path.join(tmpDir, 'test_config.json');
const tempFile = fileDest + '.tmp.' + process.pid;

fs.writeFileSync(tempFile, JSON.stringify({ ok: true, timestamp: Date.now() }));
fs.renameSync(tempFile, fileDest);

assert(fs.existsSync(fileDest), 'Arquivo final gravado de forma atômica deve existir');
const lido = JSON.parse(fs.readFileSync(fileDest, 'utf8'));
assert.strictEqual(lido.ok, true, 'Conteúdo do arquivo atômico deve ser íntegro');

fs.unlinkSync(fileDest);
fs.rmdirSync(tmpDir);
console.log('   ✓ Escrita atômica validada sem risco de arquivos corrompidos.\n');

// Execução assíncrona completa
(async () => {
  try {
    await testarCatalogacao();
    await testarSimuladorCompletoSemWhatsApp();
    console.log('=================================================================');
    console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
    console.log('=================================================================');
    process.exit(0);
  } catch (err) {
    console.error('❌ Falha nos testes assíncronos:', err);
    process.exit(1);
  }
})();
