const assert = require('assert');
const {
    garantirEstruturaFinanceira,
    salvarConfiguracaoCobranca,
    calcularEncargosParcela,
    gerarMensagemCobrancaPix,
    darBaixaParcela
} = require('./src/financeiro/gestaoFinanceira');

async function executarTestesJurosMulta() {
    console.log('🧪 Iniciando Bateria de Testes: Cálculo de Multa e Juros Editáveis...\n');

    // 1. Cenário: Valores padrão legais
    {
        const config = {};
        garantirEstruturaFinanceira(config);
        const cob = config.configuracaoCobranca;
        assert.strictEqual(cob.aplicarJurosMulta, true, 'aplicarJurosMulta deve ser true por padrão');
        assert.strictEqual(cob.percentualMulta, 2.0, 'Multa padrão deve ser 2.0%');
        assert.strictEqual(cob.percentualJurosMes, 1.0, 'Juros padrão deve ser 1.0% ao mês');
        console.log('  ✅ [PASSOU] 1. Inicialização garante padrões legais (Multa: 2%, Juros: 1%/mês, Ativado)');
    }

    // 2. Cenário: Edição customizada pelo usuário
    {
        const config = {};
        salvarConfiguracaoCobranca({
            aplicarJurosMulta: true,
            percentualMulta: 5.0, // Usuário definiu 5%
            percentualJurosMes: 2.0 // Usuário definiu 2%/mês
        }, config);

        const cob = config.configuracaoCobranca;
        assert.strictEqual(cob.percentualMulta, 5.0, 'Multa deve ter sido atualizada para 5%');
        assert.strictEqual(cob.percentualJurosMes, 2.0, 'Juros deve ter sido atualizado para 2%/mês');
        console.log('  ✅ [PASSOU] 2. Configuração é 100% editável e persistida com sucesso');
    }

    // 3. Cenário: Cálculo de 30 dias de atraso com padrão legal (2% multa + 1%/mês juros)
    {
        const config = {
            configuracaoCobranca: {
                aplicarJurosMulta: true,
                percentualMulta: 2.0,
                percentualJurosMes: 1.0
            }
        };

        const parcela = {
            id: 'parc_teste_1',
            valor: 1000.00,
            vencimento: '2026-01-01', // Venceu em 01/01/2026
            status: 'PENDENTE'
        };

        // Simula data de referência 30 dias após o vencimento (31/01/2026)
        const dataRef = new Date('2026-01-31T12:00:00');
        const calc = calcularEncargosParcela(parcela, config, dataRef);

        assert.strictEqual(calc.estaVencida, true, 'Deve identificar que está vencida');
        assert.strictEqual(calc.diasAtraso, 30, 'Deve calcular 30 dias de atraso');
        assert.strictEqual(calc.valorOriginal, 1000.00, 'Valor original R$ 1000');
        assert.strictEqual(calc.valorMulta, 20.00, 'Multa de 2% sobre R$ 1000 deve ser R$ 20,00');
        assert.strictEqual(calc.valorJuros, 10.00, 'Juros de 1% (30 dias) sobre R$ 1000 deve ser R$ 10,00');
        assert.strictEqual(calc.valorTotalAtualizado, 1030.00, 'Total deve ser R$ 1030,00');
        console.log('  ✅ [PASSOU] 3. Cálculo matemático exato com padrão legal (R$ 1000 + 20 multa + 10 juros = R$ 1030)');
    }

    // 4. Cenário: Cálculo com parâmetros customizados pelo advogado (Multa 3% + Juros 3%/mês com 60 dias)
    {
        const config = {
            configuracaoCobranca: {
                aplicarJurosMulta: true,
                percentualMulta: 3.0,
                percentualJurosMes: 3.0
            }
        };

        const parcela = {
            id: 'parc_teste_2',
            valor: 2000.00,
            vencimento: '2026-01-01',
            status: 'PENDENTE'
        };

        // 60 dias após vencimento
        const dataRef = new Date('2026-03-02T12:00:00');
        const calc = calcularEncargosParcela(parcela, config, dataRef);

        assert.strictEqual(calc.estaVencida, true);
        assert.strictEqual(calc.diasAtraso, 60);
        // Multa: 3% de 2000 = 60,00
        assert.strictEqual(calc.valorMulta, 60.00);
        // Juros: 3%/mês por 2 meses (60 dias) = 6% de 2000 = 120,00
        assert.strictEqual(calc.valorJuros, 120.00);
        assert.strictEqual(calc.valorTotalAtualizado, 2180.00);
        console.log('  ✅ [PASSOU] 4. Cálculo com parâmetros editados pelo advogado (3% multa + 3%/mês por 60d = R$ 2180)');
    }

    // 5. Cenário: Quando o advogado desativa encargos (aplicarJurosMulta: false)
    {
        const config = {
            configuracaoCobranca: {
                aplicarJurosMulta: false,
                percentualMulta: 2.0,
                percentualJurosMes: 1.0
            }
        };

        const parcela = {
            id: 'parc_teste_3',
            valor: 500.00,
            vencimento: '2025-01-01', // 1 ano atrasado
            status: 'PENDENTE'
        };

        const calc = calcularEncargosParcela(parcela, config, new Date('2026-01-01'));
        assert.strictEqual(calc.valorMulta, 0, 'Multa deve ser 0 quando desativado');
        assert.strictEqual(calc.valorJuros, 0, 'Juros deve ser 0 quando desativado');
        assert.strictEqual(calc.valorTotalAtualizado, 500.00, 'Total deve ser o valor nominal sem encargos');
        console.log('  ✅ [PASSOU] 5. Desativação de encargos respeita escolha do advogado (isentando encargos)');
    }

    // 6. Cenário: Parcela no prazo (não vencida)
    {
        const config = {
            configuracaoCobranca: {
                aplicarJurosMulta: true,
                percentualMulta: 2.0,
                percentualJurosMes: 1.0
            }
        };

        const parcela = {
            id: 'parc_teste_4',
            valor: 800.00,
            vencimento: '2026-12-31', // Futuro
            status: 'PENDENTE'
        };

        const calc = calcularEncargosParcela(parcela, config, new Date('2026-06-01'));
        assert.strictEqual(calc.estaVencida, false, 'Não deve estar vencida');
        assert.strictEqual(calc.diasAtraso, 0);
        assert.strictEqual(calc.valorMulta, 0);
        assert.strictEqual(calc.valorJuros, 0);
        assert.strictEqual(calc.valorTotalAtualizado, 800.00);
        console.log('  ✅ [PASSOU] 6. Parcela no prazo não recebe acréscimo de encargos');
    }

    // 7. Cenário: Mensagem PIX de cobrança detalhada e transparente
    {
        const config = {
            configuracaoCobranca: {
                chavePix: '12.345.678/0001-90',
                tipoChave: 'CNPJ',
                beneficiario: 'Advocacia Studio',
                aplicarJurosMulta: true,
                percentualMulta: 2.0,
                percentualJurosMes: 1.0
            }
        };

        const parcela = {
            id: 'parc_teste_5',
            clienteNome: 'Beatriz Ramos',
            valor: 1500.00,
            vencimento: '2026-01-01',
            status: 'PENDENTE'
        };

        const msg = gerarMensagemCobrancaPix(parcela, config, new Date('2026-01-31T12:00:00'));
        assert.ok(msg.includes('1545,00'), 'Deve conter o valor total atualizado');
        assert.ok(msg.includes('1500,00'), 'Deve detalhar o principal');
        assert.ok(msg.includes('30,00'), 'Deve detalhar a multa de 2%');
        assert.ok(msg.includes('15,00'), 'Deve detalhar os juros de 1%');
        assert.ok(msg.includes('em atraso há 30 dia(s)'), 'Deve indicar os dias em atraso');
        console.log('  ✅ [PASSOU] 7. Mensagem PIX gerada exibe discriminação transparente e cordial');
    }

    // 8. Cenário: Baixa na parcela registra os encargos aplicados
    {
        const config = {
            configuracaoCobranca: {
                aplicarJurosMulta: true,
                percentualMulta: 2.0,
                percentualJurosMes: 1.0
            },
            financeiro: {
                parcelas: [
                    {
                        id: 'parc_baixa_1',
                        clienteNome: 'Mariana Lima',
                        valor: 1000.00,
                        vencimento: '2026-01-01',
                        status: 'PENDENTE'
                    }
                ]
            }
        };

        const res = darBaixaParcela('parc_baixa_1', config, {
            dataPagamento: '2026-01-31T12:00:00'
        });

        assert.strictEqual(res.success, true);
        const p = res.parcela;
        assert.strictEqual(p.status, 'PAGO');
        assert.strictEqual(p.valorPago, 1030.00, 'Deve sugerir e dar baixa com encargos se não fornecido');
        assert.strictEqual(p.valorMulta, 20.00);
        assert.strictEqual(p.valorJuros, 10.00);
        assert.strictEqual(p.diasAtrasoNaBaixa, 30);
        console.log('  ✅ [PASSOU] 8. Baixa de parcela vencida arquiva valor pago com encargos de forma auditável');
    }

    console.log('\n=============================================================');
    console.log('📊 RESULTADO: 8/8 TESTES DE JUROS E MULTA EDITÁVEIS APROVADOS!');
    console.log('=============================================================\n');
}

executarTestesJurosMulta().catch(err => {
    console.error('❌ Falha nos testes de Juros e Multa:', err);
    process.exit(1);
});
