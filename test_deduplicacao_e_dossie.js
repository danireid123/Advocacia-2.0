/**
 * BATERIA DE TESTES AUTOMATIZADOS:
 * - Deduplicação Inteligente (CNJ, CPF, ID)
 * - Higienização de Base Local
 * - Catalogação Profunda de Documentos Processuais (Multi-Doc)
 */

const assert = require('assert');
const { normalizarChaveProcesso, mesclarComConfigAtual } = require('./src/ingestao/motorIngestao');
const { higienizarBaseProcessos } = require('./src/ingestao/higienizarBase');
const { catalogarPecaProcessual, sintetizarDossieProcesso } = require('./src/ia/tradutorJuridico');

console.log('🧪 Iniciando Bateria de Testes: Deduplicação, Higienização e Dossiê...\n');

let falhas = 0;
let sucessos = 0;

function test(descricao, fn) {
    try {
        fn();
        console.log(`  ✅ [PASSOU] ${descricao}`);
        sucessos++;
    } catch (err) {
        console.error(`  ❌ [FALHOU] ${descricao}:`, err.message);
        falhas++;
    }
}

async function testAsync(descricao, fn) {
    try {
        await fn();
        console.log(`  ✅ [PASSOU] ${descricao}`);
        sucessos++;
    } catch (err) {
        console.error(`  ❌ [FALHOU] ${descricao}:`, err.message);
        falhas++;
    }
}

(async () => {
    // 1. Teste de Normalização de Chave
    test('1. Normalização de CNJ com ou sem pontuação deve gerar chave idêntica', () => {
        const c1 = normalizarChaveProcesso('1000456-78.2026.8.26.0100', '123.456.789-00');
        const c2 = normalizarChaveProcesso('10004567820268260100', '12345678900');
        assert.strictEqual(c1.chave, c2.chave, 'As chaves devem coincidir');
        assert.ok(c1.chave.startsWith('cnj_10004567820268260100'));
    });

    test('2. Processo sem CNJ válido normaliza por CPF', () => {
        const res = normalizarChaveProcesso('', '123.456.789-00');
        assert.strictEqual(res.chave, 'cpf_12345678900');
    });

    // 2. Teste de Ingestão com Deduplicação (Merge & Upsert)
    test('3. Mesclar novos dados de processo já cadastrado deve atualizar e não duplicar', () => {
        const configOriginal = {
            processos: {
                mensagens: {},
                lista: [
                    {
                        id: 'proc_1',
                        numero: '1000456-78.2026.8.26.0100',
                        cpf: '123.456.789-00',
                        nome: 'João Silva',
                        resumo: 'Andamento antigo',
                        temAtualizacao: false,
                        historicoAndamentos: [
                            { data: '01/01/2026', resumo: 'Andamento antigo' }
                        ]
                    }
                ]
            }
        };

        const novosProcessos = [
            {
                numeroProcesso: '1000456-78.2026.8.26.0100',
                cpf: '123.456.789-00',
                nome: 'João Silva',
                resumo: 'Sentença favorável proferida!',
                data: '17/10/2026'
            }
        ];

        const { configAtualizado, adicionados, atualizados } = mesclarComConfigAtual(novosProcessos, configOriginal);

        assert.strictEqual(adicionados, 0, 'Não deve adicionar novo registro');
        assert.strictEqual(atualizados, 1, 'Deve atualizar o registro existente');
        assert.strictEqual(configAtualizado.processos.lista.length, 1, 'Lista deve manter tamanho 1');
        assert.strictEqual(configAtualizado.processos.lista[0].resumo, 'Sentença favorável proferida!');
        assert.strictEqual(configAtualizado.processos.lista[0].id, 'proc_1', 'ID original deve ser preservado');
        assert.ok(configAtualizado.processos.lista[0].historicoAndamentos.length >= 2, 'Histórico deve acumular andamentos');
    });

    // 3. Teste de Higienização de Base (Deduplicação de registros existentes)
    test('4. Higienização deve remover duplicidades históricas na base', () => {
        const configDuplicado = {
            processos: {
                lista: [
                    { id: '1', numero: '5001234-55.2026.8.21.0001', cpf: '999.888.777-66', nome: 'Maria Lima', resumo: 'Fase 1' },
                    { id: '2', numero: '50012345520268210001', cpf: '99988877766', nome: 'Maria Lima', resumo: 'Fase 2 mais recente' },
                    { id: '3', numero: '0000000-00.0000.0.00.0000', cpf: '111.222.333-44', nome: 'Carlos Souza', resumo: 'Outro caso' }
                ]
            }
        };

        const res = higienizarBaseProcessos(configDuplicado);

        assert.strictEqual(res.totalOriginal, 3);
        assert.strictEqual(res.totalHigienizado, 2);
        assert.strictEqual(res.duplicatasRemovidas, 1);

        const maria = res.configHigienizado.processos.lista.find(p => p.nome === 'Maria Lima');
        assert.ok(maria, 'Maria Lima deve constar na base');
        assert.strictEqual(maria.resumo, 'Fase 2 mais recente', 'Resumo mais recente deve prevalecer');
        assert.ok(maria.historicoAndamentos.length >= 2, 'Histórico deve conter as fases anteriores');
    });

    // 4. Teste de Catalogação Multi-Doc (Frente 3)
    await testAsync('5. Catalogar peça processual em modo local/fallback', async () => {
        const textoPeca = `
            EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 1ª VARA CÍVEL
            Processo nº 1000456-78.2026.8.26.0100
            Autor: Roberto Alencar (CPF: 333.444.555-66)
            Réu: Banco Exemplo S/A
            AÇÃO DECLARATÓRIA DE INEXISTÊNCIA DE DÉBITO C/C DANOS MORAIS
            Em face de cobrança indevida no valor de R$ 5.000,00...
        `;

        const resultado = await catalogarPecaProcessual(textoPeca, { nomeArquivo: 'peticao_inicial.pdf' });

        assert.ok(resultado, 'Resultado da catalogação deve existir');
        assert.ok(resultado.tipoPeca, 'Tipo de peça deve ser identificado');
        assert.strictEqual(resultado.tipoPeca, 'PETICAO_INICIAL');
        assert.ok(resultado.resumoLeigo, 'Deve conter resumo leigo');
        assert.ok(resultado.dadosExtraidos, 'Deve conter dados extraídos');
    });

    // 5. Teste de Síntese de Dossiê do Processo
    test('6. Síntese do dossiê do processo deve retornar visão unificada', () => {
        const processo = {
            numero: '1000456-78.2026.8.26.0100',
            cpf: '123.456.789-00',
            nome: 'Roberto Alencar',
            resumo: 'Aguardando decisão judicial',
            documentosCatalogados: [
                { nomeArquivo: 'inicial.pdf', tipoPeca: 'PETICAO_INICIAL', resumoLeigo: 'Início da ação' },
                { nomeArquivo: 'laudo.pdf', tipoPeca: 'LAUDO_PERICIAL', resumoLeigo: 'Perícia médica realizada' }
            ],
            historicoAndamentos: [
                { data: '10/01/2026', resumo: 'Distribuído' },
                { data: '15/02/2026', resumo: 'Perícia designada' }
            ]
        };

        const dossie = sintetizarDossieProcesso(processo);
        assert.ok(dossie, 'Dossiê deve ser gerado');
        assert.strictEqual(dossie.totalDocumentos, 2);
        assert.strictEqual(dossie.totalAndamentos, 2);
        assert.ok(dossie.resumoIntegrado.includes('Roberto Alencar'));
    });

    console.log(`\n=============================================================`);
    console.log(`📊 RESULTADO FINAL DOS TESTES: ${sucessos} Passaram | ${falhas} Falharam`);
    console.log(`=============================================================\n`);

    if (falhas > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
})();
