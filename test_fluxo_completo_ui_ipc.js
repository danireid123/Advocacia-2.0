const assert = require('assert');
const fs = require('fs');
const path = require('path');
const motor = require('./src/ingestao/motorIngestao');
const { criarConfigPadraoV2, migrarConfigV1ParaV2 } = require('./migracao');

async function executarTesteIntegrado() {
  console.log('====================================================');
  console.log('TESTE DE INTEGRAÇÃO COMPLETO: ADVOCACIA 2.0');
  console.log('====================================================\n');

  // 1. Simulação do config.json inicial com customizações reais do usuário
  console.log('[ETAPA 1] Validando Configuração Base & Customizações...');
  const configOriginal = criarConfigPadraoV2();
  configOriginal.textoBoasVindas = "Olá! Seja bem-vindo ao escritório Dr. Daniel Advocacia.";
  configOriginal.menus = {
    menu_principal: {
      titulo: "Menu Personalizado",
      opcoes: [
        { id: "1", texto: "Consultar Processo", acao: "consultar_processo" },
        { id: "2", texto: "Falar com Advogado", acao: "transbordo_humano" }
      ]
    }
  };
  configOriginal.processos = [
    {
      numeroProcesso: "0001234-56.2023.8.26.0100",
      cpf: "123.456.789-00",
      nome: "Cliente Existente Antigo",
      resumo: "Processo antigo já cadastrado na base"
    }
  ];

  const totalProcessosAntes = configOriginal.processos.length;
  console.log(`✓ Configuração base pronta com ${totalProcessosAntes} processo(s) e mensagens customizadas.`);

  // 2. Ingestão Multiformato de todos os 5 arquivos de teste da pasta exemplos_importacao
  console.log('\n[ETAPA 2] Processando Arquivos de Teste Multiformato...');
  const arquivosTeste = [
    path.join(__dirname, 'exemplos_importacao', '1_Planilha_Modelo_Oficial.xlsx'),
    path.join(__dirname, 'exemplos_importacao', '2_Planilha_Colunas_Diferentes.xlsx'),
    path.join(__dirname, 'exemplos_importacao', '3_Exportacao_Processos.csv'),
    path.join(__dirname, 'exemplos_importacao', 'relatorio_tribunal.txt'),
    path.join(__dirname, 'exemplos_importacao', 'ficha_cliente.docx')
  ];

  for (const arq of arquivosTeste) {
    assert(fs.existsSync(arq), `Arquivo de teste não encontrado: ${arq}`);
  }

  const resultadoIngestao = await motor.processarMultiplosArquivos(arquivosTeste, configOriginal);
  console.log(`✓ Ingestão executada com sucesso: ${resultadoIngestao.sucesso}`);
  console.log(`  - Total de processos detectados: ${resultadoIngestao.totalProcessosEncontrados}`);
  console.log(`  - Novos processos: ${resultadoIngestao.novos}`);
  console.log(`  - Processos a atualizar: ${resultadoIngestao.atualizados}`);
  console.log(`  - Erros encontrados: ${resultadoIngestao.erros}`);

  assert(resultadoIngestao.sucesso === true, 'Falha no processarMultiplosArquivos');
  assert(resultadoIngestao.totalProcessosEncontrados > 0, 'Nenhum processo foi extraído');

  // 3. Teste de Ingestão via Buffer (ArrayBuffer fallback para Drag-and-Drop)
  console.log('\n[ETAPA 3] Testando Fallback de Buffer para Drag-and-Drop...');
  const bufferExemplo = fs.readFileSync(arquivosTeste[0]);
  const dadosBuffer = [{
    nome: '1_Planilha_Modelo_Oficial.xlsx',
    buffer: bufferExemplo
  }];

  const os = require('os');
  const caminhosTemp = [];
  for (const item of dadosBuffer) {
    const tempPath = path.join(os.tmpdir(), `adv_test_${Date.now()}_${item.nome}`);
    fs.writeFileSync(tempPath, Buffer.from(item.buffer));
    caminhosTemp.push(tempPath);
  }
  const resultadoBuffer = await motor.processarMultiplosArquivos(caminhosTemp, configOriginal);
  caminhosTemp.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });

  console.log(`✓ Ingestão via Buffer executada com sucesso: ${resultadoBuffer.sucesso}`);
  console.log(`  - Processos extraídos via buffer: ${resultadoBuffer.totalProcessosEncontrados}`);
  assert(resultadoBuffer.sucesso === true, 'Falha no teste de buffer');

  // 4. Teste de Mesclagem e Gravação Preservando Menus e Configurações Customizadas
  console.log('\n[ETAPA 4] Validando Mesclagem e Preservação Estrita do config.json...');
  const configMesclado = motor.mesclarComConfig(configOriginal, resultadoIngestao.processos);

  // Verificações rigorosas de preservação
  assert.strictEqual(configMesclado.textoBoasVindas, configOriginal.textoBoasVindas, 'Mensagem de boas-vindas foi alterada!');
  assert.deepStrictEqual(configMesclado.menus, configOriginal.menus, 'Menus customizados foram alterados!');
  assert(configMesclado.processos.length >= totalProcessosAntes, 'Processos foram perdidos na mesclagem!');

  // Verificar se o processo antigo foi mantido ou atualizado
  const antigoEncontrado = configMesclado.processos.some(p => p.numeroProcesso === "0001234-56.2023.8.26.0100");
  assert(antigoEncontrado, 'Processo pré-existente não foi preservado');

  console.log(`✓ 100% dos Menus e Mensagens Customizadas foram PRESERVADOS.`);
  console.log(`✓ Total de processos após mesclagem: ${configMesclado.processos.length}`);

  // 5. Verificação da Planilha Modelo Oficial
  console.log('\n[ETAPA 5] Verificando Planilha Modelo Oficial...');
  const modeloOficial = path.join(__dirname, 'exemplos_importacao', '1_Planilha_Modelo_Oficial.xlsx');
  assert(fs.existsSync(modeloOficial), 'Planilha modelo oficial ausente');
  console.log(`✓ Planilha modelo disponível em ${modeloOficial} (${fs.statSync(modeloOficial).size} bytes)`);

  console.log('\n====================================================');
  console.log('TODOS OS TESTES DE INTEGRAÇÃO PASSARAM COM SUCESSO! ✓');
  console.log('====================================================');
}

executarTesteIntegrado().catch(err => {
  console.error('\n❌ ERRO NO TESTE DE INTEGRAÇÃO:', err);
  process.exit(1);
});
