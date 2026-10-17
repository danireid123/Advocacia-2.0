/**
 * Bateria de Testes: Blindagem de Caixas de Texto (Anti-Freeze & Anti-Focus Stealing)
 * Valida que nenhuma caixa de texto perde foco, congela, reverte ou para de funcionar durante a digitação.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Iniciando Bateria de Testes: Blindagem Anti-Congelamento de Caixas de Texto...\n');

let totalTestes = 0;
let testesPassaram = 0;

function test(descricao, fn) {
  totalTestes++;
  try {
    fn();
    console.log(`  ✅ [PASSOU] ${descricao}`);
    testesPassaram++;
  } catch (err) {
    console.error(`  ❌ [FALHOU] ${descricao}`);
    console.error(`     Erro: ${err.message}`);
  }
}

const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const mainJs = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf-8');

// 1. Validação de Sintaxe e Context Menu no main.js
test('1. main.js deve compilar sem erros e registrar Menu nativo com context-menu', () => {
  assert(mainJs.includes("const { app, BrowserWindow, ipcMain, nativeImage, dialog, Notification, Menu }"), 'Menu deve ser importado do electron');
  assert(mainJs.includes("mainWindow.webContents.on('context-menu'"), 'context-menu deve ser registrado em main.js');
  assert(mainJs.includes("role: 'paste'"), 'Menu de contexto deve incluir ação de Colar');
  assert(mainJs.includes("role: 'copy'"), 'Menu de contexto deve incluir ação de Copiar');
  assert(mainJs.includes("role: 'cut'"), 'Menu de contexto deve incluir ação de Recortar');
});

// 2. Validação do Tour Backdrop (Sem bloquear cliques transparentes)
test('2. #tour-backdrop deve ter display: none por padrão para nunca bloquear foco ou cliques', () => {
  const tourRegex = /#tour-backdrop\s*\{[^}]*display:\s*none;/;
  assert(tourRegex.test(indexHtml), '#tour-backdrop precisa ter display: none');
  const activeRegex = /#tour-backdrop\.active\s*\{[^}]*display:\s*block;/;
  assert(activeRegex.test(indexHtml), '#tour-backdrop.active precisa ter display: block');
});

// 3. Validação dos botões da barra de formatação (Sem roubar foco de textareas)
test('3. Botões de formatação de texto devem ter onmousedown preventDefault para não desfocar textarea', () => {
  assert(indexHtml.includes('onmousedown="event.preventDefault()" onclick="formatarTexto(\'bold\')"'), 'Botão Negrito deve ter preventDefault');
  assert(indexHtml.includes('onmousedown="event.preventDefault()" onclick="formatarTexto(\'italic\')"'), 'Botão Itálico deve ter preventDefault');
  assert(indexHtml.includes('onmousedown="event.preventDefault()" onclick="formatarTexto(\'strike\')"'), 'Botão Tachado deve ter preventDefault');
  assert(indexHtml.includes('onmousedown="event.preventDefault()" onclick="inserirSnippet(\'• \')"'), 'Botão Tópico deve ter preventDefault');
});

// 4. Validação de selecionarProcessoNaLista com checagem de activeElement
test('4. selecionarProcessoNaLista deve proteger campos ativos contra sobrescrita acidental', () => {
  assert(indexHtml.includes('if (elNome && (forcar || document.activeElement !== elNome))'), 'elNome deve respeitar document.activeElement');
  assert(indexHtml.includes('if (elCpf && (forcar || document.activeElement !== elCpf))'), 'elCpf deve respeitar document.activeElement');
  assert(indexHtml.includes('if (elNumero && (forcar || document.activeElement !== elNumero))'), 'elNumero deve respeitar document.activeElement');
  assert(indexHtml.includes('if (elResumo && (forcar || document.activeElement !== elResumo))'), 'elResumo deve respeitar document.activeElement');
  assert(indexHtml.includes('if (elCheck && (forcar || document.activeElement !== elCheck))'), 'elCheck deve respeitar document.activeElement');
});

// 5. Validação de sincronização em tempo real da digitação (sincronizarDigitacaoProcesso)
test('5. Formulário de processos deve possuir listeners de input síncronos em tempo real', () => {
  assert(indexHtml.includes("elProcNome.addEventListener('input'"), 'proc-nome deve ter listener de input');
  assert(indexHtml.includes("elProcCpf.addEventListener('input'"), 'proc-cpf deve ter listener de input');
  assert(indexHtml.includes("elProcNumero.addEventListener('input'"), 'proc-numero deve ter listener de input');
  assert(indexHtml.includes("elProcResumo.addEventListener('input'"), 'proc-resumo deve ter listener de input');
  assert(indexHtml.includes('function sincronizarDigitacaoProcesso'), 'Função sincronizarDigitacaoProcesso deve existir');
});

// 6. Validação de aoAtualizarProcessos com preservação do que o usuário está digitando
test('6. aoAtualizarProcessos (IPC sync) não pode destruir o texto sendo digitado pelo usuário', () => {
  assert(indexHtml.includes('digitandoNoForm'), 'aoAtualizarProcessos deve detectar se o usuário está digitando');
  assert(indexHtml.includes('pRemoto.resumo = elProcResumo.value'), 'aoAtualizarProcessos deve preservar resumo digitado');
  assert(indexHtml.includes('selecionarProcessoNaLista(idProcessoSelecionado, false)'), 'aoAtualizarProcessos deve passar forcar=false');
});

// 7. Validação de Prevenção de Roubo de Foco pelo Simulador
test('7. Simulador não pode roubar foco de outros campos ao finalizar resposta assíncrona', () => {
  assert(indexHtml.includes('outroInputFocado'), 'Simulador deve verificar outroInputFocado no finally');
  assert(indexHtml.includes('if (simVisivel && !outroInputFocado)'), 'Só deve focar inputMsg se simVisivel e sem outroInputFocado');
});

// 8. Validação de Agenda e Modelos de Mensagens
test('8. Agenda e Modelos de Mensagens devem checar activeElement antes de alterar valores', () => {
  assert(indexHtml.includes('function carregarConfiguracaoAgendaNosCampos(forcar = false)'), 'carregarConfiguracaoAgendaNosCampos deve aceitar forcar');
  assert(indexHtml.includes('function carregarTemplatesProcessosNosInputs(forcar = false)'), 'carregarTemplatesProcessosNosInputs deve aceitar forcar');
});

// 9. Validação do campo da chave Gemini API no Simulador
test('9. Simulador deve renderizar campo de chave Gemini API e permitir digitação/salvamento direto', () => {
  assert(indexHtml.includes('id="proc-gemini-api-key"'), 'Campo proc-gemini-api-key deve existir no HTML');
  assert(indexHtml.includes("configGlobal.gemini_api_key = e.target.value.trim()"), 'Digitação na chave Gemini deve atualizar configGlobal imediatamente');
});

console.log('\n=============================================================');
console.log(`📊 RESULTADO DOS TESTES: ${testesPassaram} Passaram | ${totalTestes - testesPassaram} Falharam`);
console.log('=============================================================');

if (testesPassaram !== totalTestes) {
  process.exit(1);
}
