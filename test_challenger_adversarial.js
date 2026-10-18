/**
 * Adversarial Challenger Test Suite — Forensic Verification
 * Author: Challenger 1 (teamwork_preview_challenger)
 * 
 * Verifies anti-hallucination, civil document classification, and financial guards
 * in src/financeiro/validadorComprovantePix.js and src/financeiro/gestaoFinanceira.js.
 */

const assert = require('assert');
const {
    auditarComprovantePix,
    extrairDadosPixLocal,
    validarDivergenciaPix,
    normalizarValorMonetario
} = require('./src/financeiro/validadorComprovantePix');
const {
    processarComprovanteRecebido,
    darBaixaParcela,
    garantirEstruturaFinanceira
} = require('./src/financeiro/gestaoFinanceira');

async function runAdversarialAudit() {
    console.log('==============================================================================');
    console.log('⚔️  ADVERSARIAL CHALLENGER HARNESS — AUDITORIA DE BLINDAGEM FINANCEIRA');
    console.log('==============================================================================\n');

    const failures = [];
    const passes = [];

    async function evaluate(id, title, testFn) {
        try {
            const result = await testFn();
            if (result.success) {
                console.log(`  ✅ [PASS] ${id} - ${title}: ${result.detail}`);
                passes.push({ id, title, detail: result.detail });
            } else {
                console.log(`  ❌ [VULNERABILITY CONFIRMED] ${id} - ${title}: ${result.detail}`);
                failures.push({ id, title, detail: result.detail });
            }
        } catch (err) {
            console.log(`  💥 [ERROR] ${id} - ${title}: ${err.message}`);
            failures.push({ id, title, detail: `Threw unexpected error: ${err.message}` });
        }
    }

    // --------------------------------------------------------------------------
    // CATEGORY 1: FABRICAÇÃO DE DADOS BANCÁRIOS E ID TRANSACIONAL NO FALLBACK
    // --------------------------------------------------------------------------
    console.log('📦 CATEGORIA 1: Fabricação de Fallback Fictício (Feature F11 / R3)');

    await evaluate('ADV-01', 'Id de transação e banco fictício fabricados para recibo em dinheiro', async () => {
        const buf = Buffer.from(
            'RECIBO DE PAGAMENTO\n' +
            'Recebi de Carlos Alberto a quantia de R$ 500,00 referente ao aluguel residencial.\n' +
            'Pagamento efetuado em dinheiro vivo.\n' +
            'São Paulo, 18 de Outubro de 2026.',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 500, 'Carlos Alberto');
        const idGerado = res.dadosLidos?.idTransacao;
        const bancoGerado = res.dadosLidos?.bancoOrigem;
        const fabricouDados = Boolean(idGerado && idGerado.startsWith('E') && bancoGerado === 'Instituição Financeira PIX');

        if (fabricouDados && res.comprovanteValido) {
            return {
                success: false,
                detail: `Recibo em dinheiro aprovado como PIX válido! idTransacao fabricado: '${idGerado}', bancoOrigem: '${bancoGerado}'`
            };
        }
        return { success: true, detail: `Recibo em dinheiro devidamente rejeitado como não-PIX.` };
    });

    await evaluate('ADV-02', 'Fabricação de PIX para comprovante de cartão de crédito/débito', async () => {
        const buf = Buffer.from(
            'CIELO - COMPROVANTE DE PAGAMENTO\n' +
            'VENDA CARTAO DE CREDITO VISA ELECTRON\n' +
            'VALOR: R$ 500,00\n' +
            'AUTORIZACAO: 987654\n',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 500, 'Cliente');
        if (res.comprovanteValido) {
            return {
                success: false,
                detail: `Voucher de cartão de crédito aprovado como PIX! idTransacao: '${res.dadosLidos?.idTransacao}', banco: '${res.dadosLidos?.bancoOrigem}'`
            };
        }
        return { success: true, detail: `Voucher de cartão rejeitado com sucesso.` };
    });

    // --------------------------------------------------------------------------
    // CATEGORY 2: FALSAS QUITAÇÕES DECORRENTES DE PEÇAS JURÍDICAS E CONTRATOS
    // --------------------------------------------------------------------------
    console.log('\n📦 CATEGORIA 2: Documentos Jurídicos e Cartorários Gerando Falsas Quitações');

    await evaluate('ADV-03', 'Contrato de Honorários Advocatícios enviado pelo cliente', async () => {
        const buf = Buffer.from(
            'CONTRATO DE PRESTAÇÃO DE SERVIÇOS ADVOCATÍCIOS\n' +
            'Cláusula Terceira: O pagamento dos serviços será efetuado no valor de R$ 500,00 mensais.\n' +
            'São Paulo, 18 de Outubro de 2026.',
            'utf-8'
        );
        const config = {
            financeiro: {
                parcelas: [{ id: 'p_contrato', clienteNome: 'Cliente', clienteTelefone: '11999990001', valor: 500, status: 'PENDENTE' }],
                comprovantesRecebidos: []
            }
        };
        const proc = await processarComprovanteRecebido('11999990001', buf, 'image/jpeg', '', config);
        const baixou = config.financeiro.parcelas[0].status === 'PAGO';

        if (baixou || proc.comprovanteValido) {
            return {
                success: false,
                detail: `Contrato de honorários gerou BAIXA INDEVIDA da parcela! Status: ${config.financeiro.parcelas[0].status}`
            };
        }
        return { success: true, detail: `Contrato não gerou baixa financeira.` };
    });

    await evaluate('ADV-04', 'Procuração Ad Judicia contendo valor de taxa processual', async () => {
        const buf = Buffer.from(
            'PROCURAÇÃO AD JUDICIA ET EXTRA\n' +
            'Outorgante: João da Silva\n' +
            'Comprovante de pagamento de taxa e custas de R$ 500,00.\n',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 500, 'João da Silva');
        if (res.comprovanteValido) {
            return {
                success: false,
                detail: `Procuração judicial classificada como PIX válido! idTransacao: ${res.dadosLidos?.idTransacao}`
            };
        }
        return { success: true, detail: `Procuração devidamente desclassificada de PIX.` };
    });

    await evaluate('ADV-05', 'Petição Inicial com requerimento de custas iniciais', async () => {
        const buf = Buffer.from(
            'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO\n' +
            'AÇÃO DE COBRANÇA\n' +
            'Requer a juntada do comprovante de pagamento de custas: R$ 500,00\n',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 500, 'Cliente');
        if (res.comprovanteValido) {
            return {
                success: false,
                detail: `Petição Inicial classificada como comprovante PIX válido!`
            };
        }
        return { success: true, detail: `Petição Inicial devidamente rejeitada.` };
    });

    await evaluate('ADV-06', 'Guia de Recolhimento da União (GRU) Passaporte Polícia Federal', async () => {
        const buf = Buffer.from(
            'MINISTÉRIO DA JUSTIÇA E SEGURANÇA PÚBLICA\n' +
            'DEPARTAMENTO DE POLÍCIA FEDERAL\n' +
            'GUIA DE RECOLHIMENTO DA UNIÃO - GRU\n' +
            'Taxa de Emissão de Passaporte\n' +
            'Valor Total: R$ 257,25\n' +
            'Comprovante de pagamento de GRU',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 257.25, 'Ana Clara');
        if (res.comprovanteValido) {
            return {
                success: false,
                detail: `Taxa GRU da Polícia Federal aprovada como PIX com banco inventado e ID fake!`
            };
        }
        return { success: true, detail: `Taxa GRU reconhecida como não-PIX.` };
    });

    await evaluate('ADV-07', 'Comprovante de Inscrição no CPF com taxa', async () => {
        const buf = Buffer.from(
            'MINISTÉRIO DA FAZENDA\n' +
            'SECRETARIA DA RECEITA FEDERAL DO BRASIL\n' +
            'COMPROVANTE DE INSCRIÇÃO NO CPF\n' +
            'Nome: Carlos Alberto\n' +
            'Comprovante de pagamento: R$ 500,00',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 500, 'Carlos Alberto');
        if (res.comprovanteValido) {
            return {
                success: false,
                detail: `Documento de CPF com taxa classificado como PIX válido!`
            };
        }
        return { success: true, detail: `Documento de CPF rejeitado como PIX.` };
    });

    // --------------------------------------------------------------------------
    // CATEGORY 3: REPLAY ATTACK / DUPLICIDADE DE COMPROVANTE PIX
    // --------------------------------------------------------------------------
    console.log('\n📦 CATEGORIA 3: Ataque de Repetição (Replay Attack) em gestaoFinanceira.js');

    await evaluate('ADV-08', 'Submissão duplicada do mesmo comprovante PIX quitando múltiplas parcelas', async () => {
        const config = {
            financeiro: {
                parcelas: [
                    { id: 'parc_replay_1', clienteNome: 'Cliente Replay', clienteTelefone: '11999990002', valor: 500, status: 'PENDENTE' },
                    { id: 'parc_replay_2', clienteNome: 'Cliente Replay', clienteTelefone: '11999990002', valor: 500, status: 'PENDENTE' }
                ],
                comprovantesRecebidos: []
            }
        };
        const pixBuffer = Buffer.from(
            'COMPROVANTE DE TRANSFERÊNCIA PIX\n' +
            'BANCO NUBANK S.A.\n' +
            'ID DA TRANSAÇÃO: E00416968202610189999REPLAY1234\n' +
            'PAGADOR: Cliente Replay\n' +
            'VALOR PAGO: R$ 500,00\n' +
            'DATA: 18/10/2026',
            'utf-8'
        );

        // Primeiro envio
        await processarComprovanteRecebido('11999990002', pixBuffer, 'image/jpeg', '', config);
        // Segundo envio (mesmíssimo buffer e ID de transação)
        const res2 = await processarComprovanteRecebido('11999990002', pixBuffer, 'image/jpeg', '', config);

        const parc1Status = config.financeiro.parcelas[0].status;
        const parc2Status = config.financeiro.parcelas[1].status;

        if (parc1Status === 'PAGO' && parc2Status === 'PAGO') {
            return {
                success: false,
                detail: `VULNERABILIDADE CRÍTICA DE REPLAY: O mesmo comprovante de R$ 500 quitou DUAS parcelas distintas (Total R$ 1.000)!`
            };
        }
        return { success: true, detail: `Comprovante repetido bloqueado contra dupla quitação.` };
    });

    console.log('\n==============================================================================');
    console.log('📊 RESUMO DA AUDITORIA ADVERSARIAL');
    console.log('==============================================================================');
    console.log(`  Total de Testes Adversariais: ${passes.length + failures.length}`);
    console.log(`  Comportamentos Seguros:       ${passes.length} ✅`);
    console.log(`  Vulnerabilidades Encontradas: ${failures.length} 🚨`);
    console.log('==============================================================================\n');

    return { total: passes.length + failures.length, passed: passes.length, failed: failures.length, failures };
}

runAdversarialAudit().then(res => {
    if (res.failed > 0) {
        console.log(`🚨 VEREDICTO DO CHALLENGER: REQUEST_CHANGES (${res.failed} falhas críticas de integridade financeira confirmadas)`);
        process.exit(1);
    } else {
        console.log(`✅ VEREDICTO DO CHALLENGER: APPROVE (Todos os testes adversariais passaram com sucesso)`);
        process.exit(0);
    }
});
