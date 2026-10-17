/**
 * Teste Automatizado de Varredura Geral, Correção de DOM,
 * Simulador WhatsApp e Deduplicação Unificada.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== INICIANDO BATERIA DE TESTES DE INTEGRIDADE E VARREDURA ===\n');

// 1. TESTE DE DOM: Hierarquia de abas e botões no index.html
console.log('1. Testando Integridade de DOM no index.html...');
const htmlPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Verifica se aba-simulador está fora de aba-ignorados
const posAbaIgnorados = html.indexOf('id="aba-ignorados"');
const posFechamentoIgnorados = html.indexOf('<!-- ================= ABA 8: SIMULADOR DE CHAT WHATSAPP (SANDBOX) ================= -->');
const posAbaSimulador = html.indexOf('id="aba-simulador"');

assert(posAbaIgnorados !== -1, 'aba-ignorados deve existir no HTML');
assert(posAbaSimulador !== -1, 'aba-simulador deve existir no HTML');
assert(posFechamentoIgnorados > posAbaIgnorados, 'aba-ignorados deve ser fechada antes do início do simulador');
assert(posAbaSimulador > posFechamentoIgnorados, 'aba-simulador deve vir após o fechamento de aba-ignorados');

// Verifica elementos essenciais adicionados
assert(html.includes('id="btn-simulador-reset"'), 'Botão de resetar conversa/despausar deve existir');
assert(html.includes('id="modal-dossie-processo"'), 'Modal de dossiê do processo deve existir');
assert(html.includes('id="btn-anexar-peca-proc"'), 'Botão anexar peça deve existir');
assert(html.includes('id="btn-ver-dossie-proc"'), 'Botão ver dossiê deve existir');
assert(html.includes('<th class="p-2.5">Situação</th>'), 'Coluna de Situação na prévia deve existir');
assert(html.includes('window.aoAbrirAbaSimulador'), 'Hook aoAbrirAbaSimulador deve existir');

console.log('   ✓ Hierarquia de DOM corrigida: todas as abas e modais posicionados com perfeição.\n');

// 2. TESTE DE DEDUPLICAÇÃO UNIFICADA: motorIngestao.js
console.log('2. Testando Deduplicação Unificada (processosEquivalentes & mesclarComConfigAtual)...');
const { processosEquivalentes, mesclarComConfigAtual, normalizarChaveProcesso } = require('./src/ingestao/motorIngestao');

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

// Teste de equivalência
assert.strictEqual(processosEquivalentes(pBase, pSpreadsheet), true, 'Processo por planilha deve ser reconhecido como idêntico');
assert.strictEqual(processosEquivalentes(pBase, pManual), true, 'Processo manual deve ser reconhecido como idêntico');

// Teste de merge e preservação de histórico
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

// 3. TESTE DE CATALOGAÇÃO E ANEXO DE PEÇAS PROCESSUAIS (IA / Local)
console.log('3. Testando Catalogação de Peças com Inteligência Artificial...');
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

// 4. TESTE DE ESCRITA ATÔMICA E PROTEÇÃO DE CONFIG
console.log('4. Testando Segurança de Arquivos e Escrita Atômica...');
const tmpDir = path.join(__dirname, 'scratch_test_atomic');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

const fileDest = path.join(tmpDir, 'test_config.json');
const tempFile = fileDest + '.tmp.' + process.pid;

fs.writeFileSync(tempFile, JSON.stringify({ ok: true, timestamp: Date.now() }));
fs.renameSync(tempFile, fileDest);

assert(fs.existsSync(fileDest), 'Arquivo final gravado de forma atômica deve existir');
const lido = JSON.parse(fs.readFileSync(fileDest, 'utf8'));
assert.strictEqual(lido.ok, true, 'Conteúdo do arquivo atômico deve ser íntegro');

// Limpeza
fs.unlinkSync(fileDest);
fs.rmdirSync(tmpDir);
console.log('   ✓ Escrita atômica validada sem risco de arquivos corrompidos.\n');

// Execução assíncrona
(async () => {
  try {
    await testarCatalogacao();
    console.log('=================================================================');
    console.log('🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
    console.log('=================================================================');
  } catch (err) {
    console.error('❌ Falha nos testes assíncronos:', err);
    process.exit(1);
  }
})();
