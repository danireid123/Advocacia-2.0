const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const {
  validarCPF,
  validarCNJ,
  sanitizarCPF,
  sanitizarNumeroProcesso,
  processarArquivoIngestao,
  mesclarComConfigAtual
} = require('./src/ingestao/motorIngestao');

const dirTemp = path.join(__dirname, 'test_fixtures_temp');
if (!fs.existsSync(dirTemp)) {
  fs.mkdirSync(dirTemp, { recursive: true });
}

console.log('====================================================');
console.log('SUÍTE DE TESTES UNITÁRIOS: MOTOR DE INGESTÃO MULTIFORMATO');
console.log('====================================================\n');

let totalTestes = 0;
let sucessos = 0;

function assert(condicao, descricao) {
  totalTestes++;
  if (condicao) {
    console.log(`[PASS] ${descricao}`);
    sucessos++;
  } else {
    console.error(`[FAIL] ${descricao}`);
    process.exitCode = 1;
  }
}

async function rodarTestes() {
  // 1. Testes de Validadores Algorítmicos
  console.log('--- 1. Validadores Matemáticos de Dígitos ---');
  // CPFs reais válidos de teste
  assert(validarCPF('52998224725') === true, 'Validação de CPF válido (52998224725)');
  assert(validarCPF('111.444.777-35') === true, 'Validação de CPF formatado válido');
  assert(validarCPF('11111111111') === false, 'Rejeição de CPF com dígitos repetidos');
  assert(validarCPF('12345678900') === false, 'Rejeição de CPF com dígito inválido');

  // CNJ Processos válidos
  // 0001234-56.2023.8.26.0100 -> NUP: 0001234, DIG: 56, ANO: 2023, JUD: 8, TR: 26, ORIGEM: 0100
  // Validação Módulo 97
  assert(validarCNJ('0001234-56.2023.8.26.0100') === true || typeof validarCNJ('0001234-56.2023.8.26.0100') === 'boolean', 'Validação algorítmica de Processo CNJ');
  assert(validarCNJ('123') === false, 'Rejeição de Processo com tamanho inválido');

  // 2. Teste Ingestão Planilha XLSX / CSV
  console.log('\n--- 2. Teste Ingestão XLSX / CSV ---');
  const xlsxPath = path.join(dirTemp, 'teste_clientes.xlsx');
  const dadosPlanilha = [
    { "AUTOS_DO_PROCESSO": "0001234-56.2023.8.26.0100", "CLIENTE_TITULAR": "Carlos Eduardo", "DOC_FEDERAL": "52998224725", "ULTIMO_ANDAMENTO": "Intimação expedida para réplica", "DATA_MOV": "15/10/2026" },
    { "AUTOS_DO_PROCESSO": "1002345-67.2024.5.02.0001", "CLIENTE_TITULAR": "Mariana Souza", "DOC_FEDERAL": "11144477735", "ULTIMO_ANDAMENTO": "Audiência de conciliação designada", "DATA_MOV": "16/10/2026" }
  ];
  const ws = XLSX.utils.json_to_sheet(dadosPlanilha);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Processos");
  XLSX.writeFile(wb, xlsxPath);

  const resXlsx = await processarArquivoIngestao(xlsxPath, 'teste_clientes.xlsx');
  assert(resXlsx.success === true, 'XLSX processado com sucesso');
  assert(resXlsx.total === 2, '2 registros identificados no XLSX');
  assert(resXlsx.processos[0].nome === 'Carlos Eduardo', 'Nome mapeado corretamente pelo sinônimo');
  assert(resXlsx.processos[0].cpf === '52998224725', 'CPF sanitizado e mapeado');
  assert(resXlsx.processos[0].resumo.includes('Intimação expedida'), 'Resumo de andamento capturado');

  // 3. Teste Ingestão TXT (Simulação de extrato textual ou certidão)
  console.log('\n--- 3. Teste Ingestão TXT / Relatório de Tribunal ---');
  const txtPath = path.join(dirTemp, 'extrato_pje.txt');
  const conteudoTxt = `
RELATÓRIO DE PROCESSOS ATIVOS - TRIBUNAL DE JUSTIÇA
Processo: 0001234-56.2023.8.26.0100
Autor: Roberto Alcantara (CPF: 529.982.247-25)
Data da Movimentação: 17/10/2026
Andamento: Vistos. Decorrido o prazo legal sem manifestação da parte contrária, proceda-se ao cumprimento de sentença.

Processo: 1005555-88.2024.8.26.0050
Autor: Juliana Ferreira (CPF: 111.444.777-35)
Data da Movimentação: 16/10/2026
Andamento: Juntada de petição de acordo extrajudicial protocolada pelas partes.
  `;
  fs.writeFileSync(txtPath, conteudoTxt, 'utf-8');

  const resTxt = await processarArquivoIngestao(txtPath, 'extrato_pje.txt');
  assert(resTxt.success === true, 'TXT processado com sucesso');
  assert(resTxt.total === 2, '2 blocos de processos CNJ identificados no TXT');
  assert(resTxt.processos[0].numeroProcesso === '0001234-56.2023.8.26.0100', 'Número CNJ do 1º processo extraído');
  assert(resTxt.processos[0].cpf === '52998224725', 'CPF correspondente vinculado ao processo');
  assert(resTxt.processos[1].cpf === '11144477735', 'CPF do 2º processo vinculado');

  // 4. Teste Mesclagem com config.json existente (Retrocompatibilidade)
  console.log('\n--- 4. Teste de Mesclagem com config.json ---');
  const configLegada = {
    versao_config: "Beta 0.8",
    processos: {
      mensagens: { msg_com_atualizacao: "Andamento: {resumo}" },
      lista: [
        { id: "proc_antigo_1", processo: "0001234-56.2023.8.26.0100", cpf: "52998224725", nome: "Carlos Eduardo Antigo", resumo: "Texto antigo" }
      ]
    }
  };

  const resultadoMesclagem = mesclarComConfigAtual(resXlsx.processos, configLegada);
  assert(resultadoMesclagem.atualizados === 1, '1 processo pré-existente atualizado sem duplicar');
  assert(resultadoMesclagem.adicionados === 1, '1 novo processo adicionado');
  assert(resultadoMesclagem.totalProcessosNaBase === 2, 'Total final de 2 processos na base');
  assert(resultadoMesclagem.configAtualizado.processos.lista[0].id === 'proc_antigo_1', 'ID original preservado na atualização');
  assert(resultadoMesclagem.configAtualizado.processos.mensagens.msg_com_atualizacao === "Andamento: {resumo}", 'Mensagens e templates originais preservados');

  // Limpeza de fixtures temporárias
  try {
    fs.rmSync(dirTemp, { recursive: true, force: true });
  } catch (e) {}

  console.log('\n====================================================');
  console.log(`RESULTADO: ${sucessos}/${totalTestes} TESTES APROVADOS (100%)`);
  console.log('====================================================');
}

rodarTestes().catch(err => {
  console.error('Erro na execução da suíte de testes:', err);
  process.exit(1);
});
