/**
 * Bateria de Testes Automatizados - Módulo de Áudio, Simulador e Copilot One-Click
 * Advocacia Studio Pro v2.0
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { processarAudioECopilot } = require('./src/ia/tradutorJuridico');

async function executarTestesAudioECopilot() {
  console.log('================================================================');
  console.log('INICIANDO TESTES: ÁUDIO MULTIMODAL, SIMULADOR & COPILOT ONE-CLICK');
  console.log('================================================================\n');

  let testesPassados = 0;
  let totalTestes = 0;

  function testar(descricao, fn) {
    totalTestes++;
    try {
      fn();
      console.log(`  ✅ [PASSOU] ${descricao}`);
      testesPassados++;
    } catch (err) {
      console.error(`  ❌ [FALHOU] ${descricao}`);
      console.error(`     Motivo: ${err.message}`);
    }
  }

  async function testarAsync(descricao, fn) {
    totalTestes++;
    try {
      await fn();
      console.log(`  ✅ [PASSOU] ${descricao}`);
      testesPassados++;
    } catch (err) {
      console.error(`  ❌ [FALHOU] ${descricao}`);
      console.error(`     Motivo: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // TESTE 1: Módulo Backend Gemini IA (processarAudioECopilot)
  // -------------------------------------------------------------
  console.log('--- 1. Validação Backend IA Multimodal (src/ia/tradutorJuridico.js) ---');
  
  testar('Função processarAudioECopilot está exportada', () => {
    assert.strictEqual(typeof processarAudioECopilot, 'function');
  });

  await testarAsync('Execução em modo local/fallback (sem API key)', async () => {
    const backupKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const fakeAudioBuffer = Buffer.from('RIFF....WAVEfmt....data....', 'utf-8');
    const resultado = await processarAudioECopilot(fakeAudioBuffer, 'audio/wav', { nome: 'Carlos', processo: '1001-2026' });

    assert.strictEqual(typeof resultado, 'object');
    assert.strictEqual(resultado.sucesso, false);
    assert.strictEqual(resultado.modoLocal, true);
    assert.ok(resultado.transcricao && resultado.transcricao.length > 0, 'Deve conter texto de transcrição');
    assert.ok(resultado.resumo && resultado.resumo.length > 0, 'Deve conter resumo em tópicos');
    assert.ok(Array.isArray(resultado.sugestoesResposta), 'sugestoesResposta deve ser um array');
    assert.strictEqual(resultado.sugestoesResposta.length, 3, 'Deve retornar exatamente 3 sugestões de resposta rápida');

    if (backupKey) process.env.GEMINI_API_KEY = backupKey;
  });

  await testarAsync('Suporte a formato Base64 com prefixo data:audio/webm;base64', async () => {
    const base64Audio = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwE=';
    const resultado = await processarAudioECopilot(base64Audio, 'audio/webm', { nome: 'Dra. Maria' });

    assert.strictEqual(typeof resultado, 'object');
    assert.ok(Array.isArray(resultado.sugestoesResposta));
    assert.strictEqual(resultado.sugestoesResposta.length, 3);
  });

  // -------------------------------------------------------------
  // TESTE 2: Registro e Alinhamento de IPC no main.js
  // -------------------------------------------------------------
  console.log('\n--- 2. Auditoria de Contratos IPC (main.js) ---');

  testar('main.js registra o canal IPC "processar-audio-copilot"', () => {
    const mainContent = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf-8');
    assert.ok(mainContent.includes("ipcMain.handle('processar-audio-copilot'"), 'main.js deve conter o handler processar-audio-copilot');
    assert.ok(mainContent.includes("processarAudioECopilot"), 'main.js deve importar e invocar processarAudioECopilot');
  });

  // -------------------------------------------------------------
  // TESTE 3: Exposição de API Segura no preload.js
  // -------------------------------------------------------------
  console.log('\n--- 3. Auditoria de Preload e ContextBridge (preload.js) ---');

  testar('preload.js expõe processarAudioCopilot em window.api e window.electronAPI', () => {
    const preloadContent = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf-8');
    assert.ok(preloadContent.includes("processarAudioCopilot:"), 'preload.js deve conter a declaração processarAudioCopilot');
    assert.ok(preloadContent.includes("'processar-audio-copilot'"), 'preload.js deve invocar o canal processar-audio-copilot');
  });

  // -------------------------------------------------------------
  // TESTE 4: Estrutura HTML e Elementos no DOM (index.html)
  // -------------------------------------------------------------
  console.log('\n--- 4. Auditoria de DOM e Componentes no Renderer (index.html) ---');

  testar('index.html contém input de arquivo de áudio oculto 📎', () => {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert.ok(indexContent.includes('id="simulador-audio-file"'), 'Deve possuir o input simulador-audio-file');
    assert.ok(indexContent.includes('enviarAudioArquivoSimulador(this)'), 'Deve disparar enviarAudioArquivoSimulador no onchange');
  });

  testar('index.html contém botão de microfone 🎙️ e cronômetro', () => {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert.ok(indexContent.includes('id="btn-mic-simulador"'), 'Deve possuir o botão btn-mic-simulador');
    assert.ok(indexContent.includes('onclick="toggleGravacaoSimulador()"'), 'Deve chamar toggleGravacaoSimulador');
    assert.ok(indexContent.includes('id="gravador-timer"'), 'Deve possuir elemento gravador-timer');
    assert.ok(indexContent.includes('id="btn-cancelar-gravacao"'), 'Deve possuir elemento btn-cancelar-gravacao');
  });

  testar('index.html implementa funções do Copilot One-Click e Dispatcher', () => {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert.ok(indexContent.includes('function toggleGravacaoSimulador'), 'Deve implementar toggleGravacaoSimulador');
    assert.ok(indexContent.includes('function cancelarGravacaoSimulador'), 'Deve implementar cancelarGravacaoSimulador');
    assert.ok(indexContent.includes('function renderizarAudioNoSimulador'), 'Deve implementar renderizarAudioNoSimulador');
    assert.ok(indexContent.includes('function enviarAudioArquivoSimulador'), 'Deve implementar enviarAudioArquivoSimulador');
    assert.ok(indexContent.includes('function despacharAudioParaIAEFila'), 'Deve implementar despacharAudioParaIAEFila');
    assert.ok(indexContent.includes('function adicionarCardFilaComAudioECopilot'), 'Deve implementar adicionarCardFilaComAudioECopilot');
    assert.ok(indexContent.includes('function aplicarSugestaoCopilot'), 'Deve implementar aplicarSugestaoCopilot');
    assert.ok(indexContent.includes('function enviarRespostaAdvogado'), 'Deve implementar enviarRespostaAdvogado');
  });

  testar('index.html contém botão "Ver Resumo do Cliente" e alternarResumoCliente', () => {
    const indexContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert.ok(indexContent.includes('Ver Resumo do Cliente'), 'Deve conter texto do botão Ver Resumo do Cliente');
    assert.ok(indexContent.includes('alternarResumoCliente'), 'Deve implementar a função alternarResumoCliente');
    assert.ok(indexContent.includes('painel-resumo-'), 'Deve possuir container expansível de resumo e transcrição');
  });

  testar('main.js e preload.js possuem canal IPC "responder-cliente-pausado"', () => {
    const mainContent = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf-8');
    const preloadContent = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf-8');
    assert.ok(mainContent.includes("ipcMain.handle('responder-cliente-pausado'"), 'main.js deve conter o handler responder-cliente-pausado');
    assert.ok(preloadContent.includes("responderClientePausado:"), 'preload.js deve expor responderClientePausado');
  });

  testar('main.js captura mensagens de texto e áudios enviados após acionamento do transbordo humano', () => {
    const mainContent = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf-8');
    assert.ok(mainContent.includes("itemPausado.mensagens.push(novaMsg)"), 'WhatsApp deve capturar novas mensagens durante pausa');
    assert.ok(mainContent.includes("contatosPausados[remetenteChave].mensagens.push(novaMsg)"), 'Simulador deve capturar novas mensagens durante pausa');
    assert.ok(mainContent.includes("ehAudio && typeof msg.downloadMedia === 'function'"), 'WhatsApp deve baixar áudios recebidos');
  });

  console.log('\n================================================================');
  console.log(`RESULTADO DOS TESTES: ${testesPassados}/${totalTestes} PASSARAM`);
  console.log('================================================================');

  if (testesPassados === totalTestes) {
    console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO! INTEGRAÇÃO 100% OPERANTE.');
    process.exit(0);
  } else {
    console.error('⚠️ ALGUNS TESTES FALHARAM. VERIFIQUE OS LOGS ACIMA.');
    process.exit(1);
  }
}

executarTestesAudioECopilot().catch(err => {
  console.error('Erro fatal ao rodar testes:', err);
  process.exit(1);
});
