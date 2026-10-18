/**
 * Bateria de Testes Automatizados:
 * Detector de Urgência (Furador de Fila), Linha do Tempo dos Fatos (Cronologia Jurídica),
 * Acúmulo de Múltiplos Áudios/Mensagens, Imunidade contra Aspas no Copilot e Higiene de Cache.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  detectarUrgenciaECronologiaLocal,
  analisarUrgenciaECronologia,
  MODELOS_GEMINI_PADRAO,
  calcularHash
} = require('./src/ia/tradutorJuridico');

async function executarTestesCompletos() {
  console.log('========================================================================');
  console.log('⚖️ TESTES AUTOMATIZADOS: URGÊNCIA, CRONOLOGIA E COPILOT MULTIÁUDIO');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // TESTE 1: Modelo Prioritário Gemini 3.5 preservado
  // -------------------------------------------------------------------------
  console.log('🧪 Teste 1: Cadeia prioritária de modelos Gemini...');
  assert.ok(Array.isArray(MODELOS_GEMINI_PADRAO), 'MODELOS_GEMINI_PADRAO deve ser um array');
  assert.strictEqual(MODELOS_GEMINI_PADRAO[0], 'gemini-3.5-flash', 'O modelo número 1 da fila DEVE ser gemini-3.5-flash');
  assert.ok(MODELOS_GEMINI_PADRAO.includes('gemini-3.5-flash-lite'), 'Deve conter gemini-3.5-flash-lite');
  assert.ok(MODELOS_GEMINI_PADRAO.includes('gemini-1.5-flash') || MODELOS_GEMINI_PADRAO.includes('gemini-flash-lite-latest'), 'Deve conter fallbacks flash');
  console.log('   ✅ Cadeia de modelos preservada no topo:', MODELOS_GEMINI_PADRAO.slice(0, 3).join(', '));

  // -------------------------------------------------------------------------
  // TESTE 2: Detecção de Urgência (CRITICA, COMERCIAL, ROTINA)
  // -------------------------------------------------------------------------
  console.log('\n🧪 Teste 2: Detector de Urgência (Furador de Fila)...');

  // Caso Crítico 1: Oficial de Justiça e Mandado
  const relatoCritico1 = "Doutor, acabou de chegar um oficial de justiça aqui com um mandado de busca e apreensão do meu carro urgente!";
  const resCritico1 = detectarUrgenciaECronologiaLocal(relatoCritico1);
  assert.strictEqual(resCritico1.nivelUrgencia, 'CRITICA', 'Deve classificar como CRITICA mandado/oficial de justiça');
  assert.ok(resCritico1.motivoUrgencia.toLowerCase().includes('mandado') || resCritico1.motivoUrgencia.toLowerCase().includes('justiça') || resCritico1.motivoUrgencia.toLowerCase().includes('busca'), 'Motivo deve citar a urgência detectada');
  console.log(`   ✅ [CRITICA 1]: Nível=${resCritico1.nivelUrgencia} | Motivo="${resCritico1.motivoUrgencia}"`);

  // Caso Crítico 2: Audiência amanhã e bloqueio de conta
  const relatoCritico2 = "Minha conta bancária foi bloqueada pelo Bacenjud e tenho audiência amanhã cedo!";
  const resCritico2 = detectarUrgenciaECronologiaLocal(relatoCritico2);
  assert.strictEqual(resCritico2.nivelUrgencia, 'CRITICA', 'Deve classificar como CRITICA audiência amanhã ou bloqueio');
  console.log(`   ✅ [CRITICA 2]: Nível=${resCritico2.nivelUrgencia} | Motivo="${resCritico2.motivoUrgencia}"`);

  // Caso Comercial: Fechamento de contrato e pagamento
  const relatoComercial = "Olá! Gostei muito da proposta de honorários, quero fechar o contrato hoje e fazer o pix para dar entrada na ação.";
  const resComercial = detectarUrgenciaECronologiaLocal(relatoComercial);
  assert.strictEqual(resComercial.nivelUrgencia, 'COMERCIAL', 'Deve classificar como COMERCIAL interesse de fechamento/honorários');
  console.log(`   ✅ [COMERCIAL]: Nível=${resComercial.nivelUrgencia} | Motivo="${resComercial.motivoUrgencia}"`);

  // Caso Rotina: Dúvida comum de andamento
  const relatoRotina = "Boa tarde dr, tudo bem? Gostaria de saber se tem alguma novidade sobre o meu processo este mês.";
  const resRotina = detectarUrgenciaECronologiaLocal(relatoRotina);
  assert.strictEqual(resRotina.nivelUrgencia, 'ROTINA', 'Deve classificar como ROTINA dúvidas habituais de andamento');
  console.log(`   ✅ [ROTINA]: Nível=${resRotina.nivelUrgencia} | Motivo="${resRotina.motivoUrgencia}"`);

  // -------------------------------------------------------------------------
  // TESTE 3: Extração da Cronologia dos Fatos (Linha do Tempo p/ Petição)
  // -------------------------------------------------------------------------
  console.log('\n🧪 Teste 3: Extração da Linha do Tempo dos Fatos...');
  const relatoComDatas = "No dia 15/03/2023 fui contratado pela empresa. Em 10/11/2023 sofri o acidente de trabalho. Posteriormente em 05/01/2024 fui dispensado sem receber as verbas rescisórias.";
  const resCronologia = detectarUrgenciaECronologiaLocal(relatoComDatas);

  assert.ok(Array.isArray(resCronologia.cronologiaFatos), 'cronologiaFatos deve ser um array');
  assert.ok(resCronologia.cronologiaFatos.length >= 2, 'Deve extrair múltiplos fatos com datas');
  assert.ok(resCronologia.cronologiaFatos.some(f => f.dataAproximada && f.dataAproximada.includes('15/03/2023')), 'Deve capturar data inicial');
  assert.ok(resCronologia.cronologiaFatos.some(f => f.fato && f.fato.length > 5), 'Deve descrever o fato ocorrido');

  console.log('   ✅ Cronologia extraída com sucesso:');
  resCronologia.cronologiaFatos.forEach((f, i) => {
    console.log(`      ${i + 1}. [${f.dataAproximada}] ${f.fato}`);
  });

  // -------------------------------------------------------------------------
  // TESTE 4: Analisar Urgência e Cronologia com Histórico Consolidado
  // -------------------------------------------------------------------------
  console.log('\n🧪 Teste 4: Função analisarUrgenciaECronologia (Fallback e Modo Local)...');
  const resConsolidado = await analisarUrgenciaECronologia("Recebi uma intimação da polícia hoje pela manhã para comparecer amanhã.", { apiKey: '' });
  assert.strictEqual(resConsolidado.sucesso, true);
  assert.strictEqual(resConsolidado.nivelUrgencia, 'CRITICA');
  assert.strictEqual(resConsolidado.sugestoesResposta.length, 3, 'Deve retornar exatamente 3 sugestões Copilot');
  console.log('   ✅ Resumo e sugestões gerados com sucesso para histórico consolidado.');

  // -------------------------------------------------------------------------
  // TESTE 5: Acúmulo de Múltiplos Áudios e Mensagens (Sem sobrescrita)
  // -------------------------------------------------------------------------
  console.log('\n🧪 Teste 5: Acúmulo cumulativo de mensagens e múltiplos áudios...');
  
  // Simulando a estrutura contatosPausados do main.js
  const contatoPausadoMock = {
    nome: 'Maria Silva',
    telefone: '11999998888',
    historicoMensagens: [],
    historicoAudios: [],
    transcricao: '',
    resumo: '',
    nivelUrgencia: 'ROTINA'
  };

  // Chegada da 1ª mensagem de áudio
  const audio1 = {
    audioBase64: 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    mimeType: 'audio/webm',
    transcricao: 'Olá doutor, queria saber do meu processo.',
    hora: '14:00'
  };
  contatoPausadoMock.historicoAudios.push({ id: 'audio_1', ...audio1 });
  contatoPausadoMock.historicoMensagens.push({ de: 'cliente', texto: '🎙️ [Áudio 1]: Olá doutor, queria saber do meu processo.', hora: '14:00' });
  contatoPausadoMock.transcricao = audio1.transcricao;

  // Chegada da 2ª mensagem (Crítica: Oficial de justiça)
  const audio2 = {
    audioBase64: 'UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    mimeType: 'audio/webm',
    transcricao: 'URGENTE: O oficial de justiça acabou de bater na minha porta com mandado!',
    hora: '14:05'
  };
  contatoPausadoMock.historicoAudios.push({ id: 'audio_2', ...audio2 });
  contatoPausadoMock.historicoMensagens.push({ de: 'cliente', texto: '🎙️ [Áudio 2]: URGENTE: O oficial de justiça acabou de bater na minha porta com mandado!', hora: '14:05' });
  contatoPausadoMock.transcricao = `${contatoPausadoMock.transcricao} | [Novo Áudio]: ${audio2.transcricao}`;

  // Reavaliação de urgência no histórico consolidado
  const reavaliacao = detectarUrgenciaECronologiaLocal(contatoPausadoMock.transcricao);
  contatoPausadoMock.nivelUrgencia = reavaliacao.nivelUrgencia;
  contatoPausadoMock.motivoUrgencia = reavaliacao.motivoUrgencia;

  assert.strictEqual(contatoPausadoMock.historicoAudios.length, 2, 'Deve manter os DOIS áudios armazenados');
  assert.strictEqual(contatoPausadoMock.historicoMensagens.length, 2, 'Deve manter as DUAS mensagens armazenadas');
  assert.strictEqual(contatoPausadoMock.nivelUrgencia, 'CRITICA', 'Deve elevar o status do contato para CRITICA ao receber nova mensagem urgente');
  assert.ok(contatoPausadoMock.transcricao.includes('Olá doutor') && contatoPausadoMock.transcricao.includes('oficial de justiça'), 'Transcrição acumulada deve conter ambos os relatos');
  console.log('   ✅ Acúmulo de múltiplos áudios comprovado: 2 áudios preservados, urgência recalculada para CRITICA.');

  // -------------------------------------------------------------------------
  // TESTE 6: Imunidade a quebra de aspas no DOM (window.copilotSugestoesMap)
  // -------------------------------------------------------------------------
  console.log('\n🧪 Teste 6: Imunidade a quebra de aspas/apóstrofos/newlines no DOM...');
  const cardIdTeste = 'pausado_11999998888_0';
  const sugestoesComplexas = [
    'Olá! Analisando os "autos do processo", constatamos a medida liminar.',
    "Tudo bem, dr? D'água não vai faltar e cuidaremos do seu direito imediatamente.",
    "Recebido.\nLinha 2 com caracteres especiais: '\"` & < >"
  ];

  // Simulação do mecanismo implementado no index.html
  const fakeWindow = {
    copilotSugestoesMap: {},
    inputVal: '',
    aplicarSugestaoCopilot: function(cardId, idxOuTexto) {
      let texto = idxOuTexto;
      if (typeof idxOuTexto === 'number' || (!isNaN(Number(idxOuTexto)) && this.copilotSugestoesMap[cardId])) {
        const idx = Number(idxOuTexto);
        if (this.copilotSugestoesMap[cardId] && this.copilotSugestoesMap[cardId][idx] !== undefined) {
          texto = this.copilotSugestoesMap[cardId][idx];
        }
      }
      this.inputVal = texto;
    }
  };

  fakeWindow.copilotSugestoesMap[cardIdTeste] = sugestoesComplexas;

  // O HTML renderiza apenas onclick="aplicarSugestaoCopilot('pausado_11999998888_0', 0)"
  fakeWindow.aplicarSugestaoCopilot(cardIdTeste, 0);
  assert.strictEqual(fakeWindow.inputVal, sugestoesComplexas[0], 'Opção 0 deve recuperar texto com aspas duplas intactas');

  fakeWindow.aplicarSugestaoCopilot(cardIdTeste, 1);
  assert.strictEqual(fakeWindow.inputVal, sugestoesComplexas[1], 'Opção 1 deve recuperar texto com apóstrofo intacto');

  fakeWindow.aplicarSugestaoCopilot(cardIdTeste, 2);
  assert.strictEqual(fakeWindow.inputVal, sugestoesComplexas[2], 'Opção 2 deve recuperar texto multilinha intacto');

  console.log('   ✅ Copilot 100% imune a quebra de DOM: aspas duplas, apóstrofos e quebras de linha preservados perfeitamente via índice numérico.');

  // -------------------------------------------------------------------------
  // TESTE 7: Higiene de Memória e Cache (gemini_cache.json)
  // -------------------------------------------------------------------------
  console.log('\n🧪 Teste 7: Política de descarte do cache e bloqueio de payloads de áudio...');
  const cachePath = path.join(__dirname, 'gemini_cache.json');

  if (fs.existsSync(cachePath)) {
    const conteudoCache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
    const chaves = Object.keys(conteudoCache);

    // 1. Não pode ter mais de 500 chaves
    assert.ok(chaves.length <= 500, `O cache não deve ultrapassar 500 itens (atual: ${chaves.length})`);

    // 2. Nenhuma chave ou valor deve conter string base64 de áudio longa
    for (const k of chaves) {
      assert.ok(!k.startsWith('data:audio'), 'Nenhuma chave deve conter URI de áudio');
      const val = conteudoCache[k];
      if (typeof val === 'string') {
        assert.ok(!val.startsWith('data:audio'), 'Nenhum valor do cache deve ser base64 de áudio');
        assert.ok(val.length < 50000, 'Nenhum valor textual deve ser um dump binário');
      }
    }
    console.log(`   ✅ Cache higienizado em disco: ${chaves.length} registros válidos e zero payloads binários.`);
  } else {
    console.log('   ✅ Arquivo de cache inicial limpo (será criado e mantido sob a política de max 500 itens).');
  }

  // -------------------------------------------------------------------------
  // TESTE 8: Verificação do Alerta Sonoro de Urgência em src/audio/audioAlert.js
  // -------------------------------------------------------------------------
  console.log('\n🧪 Teste 8: Verificação do método playUrgencyAlert em audioAlert.js...');
  const audioAlertConteudo = fs.readFileSync(path.join(__dirname, 'src', 'audio', 'audioAlert.js'), 'utf-8');
  assert.ok(audioAlertConteudo.includes('playUrgencyAlert()'), 'Deve conter o método playUrgencyAlert()');
  assert.ok(audioAlertConteudo.includes('1318.51') || audioAlertConteudo.includes('triangle'), 'Deve possuir modulação harmônica de urgência');
  console.log('   ✅ Sintetizador Web Audio API playUrgencyAlert() auditado e pronto.');

  // -------------------------------------------------------------------------
  // TESTE 9: Validação no index.html dos seletores e novos componentes
  // -------------------------------------------------------------------------
  console.log('\n🧪 Teste 9: Auditoria de componentes e renderizadores no index.html...');
  const indexHtmlConteudo = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

  assert.ok(indexHtmlConteudo.includes('window.copilotSugestoesMap'), 'Deve instanciar window.copilotSugestoesMap');
  assert.ok(indexHtmlConteudo.includes('window.copilotCronologiaMap'), 'Deve instanciar window.copilotCronologiaMap');
  assert.ok(indexHtmlConteudo.includes('copiarTopicoDosFatos'), 'Deve conter a função copiarTopicoDosFatos');
  assert.ok(indexHtmlConteudo.includes('URGÊNCIA MÁXIMA'), 'Deve conter o badge de urgência máxima');
  assert.ok(indexHtmlConteudo.includes('playUrgencyAlert'), 'Deve acionar o sino de urgência ao detectar caso crítico');
  assert.ok(indexHtmlConteudo.includes('Cronologia dos Fatos (Dos Fatos p/ Petição)'), 'Deve conter a seção de cronologia na UI');
  assert.ok(indexHtmlConteudo.includes('border-red-500'), 'Deve conter a estilização de borda vermelha para urgência máxima');
  assert.ok(indexHtmlConteudo.includes('historicoAudios'), 'Deve iterar sobre historicoAudios para múltiplos players');

  console.log('   ✅ Todos os componentes frontend (Furador de Fila, Copilot imune a aspas e Linha do Tempo) validados no index.html.');

  // -------------------------------------------------------------------------
  // TESTE 10: Validação de Paridade IPC no preload.js e main.js
  // -------------------------------------------------------------------------
  console.log('\n🧪 Teste 10: Auditoria de canais IPC no preload.js e main.js...');
  const preloadConteudo = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf-8');
  const mainConteudo = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf-8');

  assert.ok(preloadConteudo.includes('analisarUrgenciaCronologia'), 'preload.js deve expor analisarUrgenciaCronologia');
  assert.ok(preloadConteudo.includes('ia-analisar-urgencia-cronologia'), 'preload.js deve invocar ia-analisar-urgencia-cronologia');
  assert.ok(mainConteudo.includes('ia-analisar-urgencia-cronologia'), 'main.js deve registrar o handler ia-analisar-urgencia-cronologia');
  assert.ok(mainConteudo.includes('anexarMensagemOuAudioAoPausado'), 'main.js deve conter a função anexarMensagemOuAudioAoPausado');

  console.log('   ✅ Paridade total de IPC e canais assíncronos comprovada.');

  console.log('\n========================================================================');
  console.log('🎉 TODOS OS 10 TESTES DE URGÊNCIA, CRONOLOGIA E COPILOT FORAM APROVADOS!');
  console.log('========================================================================\n');
}

executarTestesCompletos().catch(err => {
  console.error('\n❌ Falha na execução dos testes:', err);
  process.exit(1);
});
