/**
 * Challenger 3 Empirical Stress & Verification Suite
 * Role: teamwork_preview_challenger
 * 
 * Verifies non-PIX rejection (cash, cards, contracts, petitions, GRUs, CPF),
 * anti-baixa prevention, and replay attack resilience.
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

async function runChallenger3Suite() {
    console.log('================================================================================');
    console.log('🛡️  CHALLENGER 3: AUDITORIA FORENSE E STRESS TESTING AVANÇADO (R3 & REPLAY)');
    console.log('================================================================================\n');

    const passes = [];
    const failures = [];

    async function test(id, description, fn) {
        try {
            const res = await fn();
            if (res.pass) {
                console.log(`  ✅ [PASS] ${id} - ${description}: ${res.detail}`);
                passes.push({ id, description, detail: res.detail });
            } else {
                console.log(`  ❌ [FAIL] ${id} - ${description}: ${res.detail}`);
                failures.push({ id, description, detail: res.detail });
            }
        } catch (err) {
            console.log(`  💥 [ERROR] ${id} - ${description}: ${err.message}`);
            failures.push({ id, description, detail: `Exceção: ${err.message}` });
        }
    }

    // ==========================================================================
    // 1. RECIBOS EM DINHEIRO (CASH) & VOUCHERS DE CARTÃO
    // ==========================================================================
    console.log('📦 BLOCO 1: Recibos em Dinheiro e Vouchers de Cartão de Crédito/Débito');

    await test('CH3-01', 'Recibo de pagamento em dinheiro manual com valor explícito de R$ 1.200,00', async () => {
        const buf = Buffer.from(
            'RECIBO DE PAGAMENTO EM DINHEIRO VIVO\n' +
            'Recebi do Sr. Marcos Ferreira a quantia de R$ 1.200,00 referente a serviços de consultoria.\n' +
            'Data: 18/10/2026. Assinatura: Advogado.',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 1200, 'Marcos Ferreira');
        if (res.comprovanteValido) {
            return { pass: false, detail: 'Recibo em dinheiro classificado como PIX válido!' };
        }
        if (res.dadosLidos.idTransacao && res.dadosLidos.idTransacao.length > 0) {
            return { pass: false, detail: `ID falso gerado: ${res.dadosLidos.idTransacao}` };
        }
        return { pass: true, detail: `Rejeitado com sucesso como documento pessoal/não-PIX (tipo: ${res.tipoDetectado})` };
    });

    await test('CH3-02', 'Voucher de máquina POS Stone com cartão de débito Elo', async () => {
        const buf = Buffer.from(
            'STONE PAGAMENTOS S.A.\n' +
            'COMPROVANTE DE PAGAMENTO - CARTAO DE DEBITO\n' +
            'BANDEIRA ELO DEBITO\n' +
            'VALOR APROVADO: R$ 350,00\n' +
            'DOC: 112233 AUT: 998877\n',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 350, 'Cliente Teste');
        if (res.comprovanteValido) {
            return { pass: false, detail: 'Voucher de débito aprovado indevidamente como PIX!' };
        }
        return { pass: true, detail: 'Voucher de débito rejeitado com sucesso.' };
    });

    await test('CH3-03', 'Tentativa de baixa via processarComprovanteRecebido com recibo de cartão', async () => {
        const buf = Buffer.from(
            'REDE CARD - COMPROVANTE DE PAGAMENTO\n' +
            'VENDA CARTAO DE CREDITO MASTERCARD\n' +
            'VALOR: R$ 750,00\n' +
            'AUTORIZACAO: 543210\n',
            'utf-8'
        );
        const config = {
            financeiro: {
                parcelas: [{ id: 'p_cartao_1', clienteNome: 'Paula', clienteTelefone: '11988887777', valor: 750, status: 'PENDENTE' }],
                comprovantesRecebidos: []
            }
        };
        const proc = await processarComprovanteRecebido('11988887777', buf, 'image/jpeg', '', config);
        const baixou = config.financeiro.parcelas[0].status === 'PAGO';
        if (baixou || proc.parcelaBaixada) {
            return { pass: false, detail: 'Voucher de cartão de crédito deu baixa indevida na parcela!' };
        }
        if (!proc.rotearParaDossie && !proc.ehDocumentoCivil) {
            return { pass: false, detail: 'Documento de cartão não foi classificado como civil/dossiê.' };
        }
        return { pass: true, detail: 'Voucher de cartão impedido de quitar e marcado para dossiê.' };
    });

    // ==========================================================================
    // 2. CONTRATOS DE HONORÁRIOS & PEÇAS PROCESSUAIS (PETIÇÕES, PROCURAÇÕES)
    // ==========================================================================
    console.log('\n📦 BLOCO 2: Contratos de Honorários e Documentos Processuais');

    await test('CH3-04', 'Contrato de Honorários com valor de entrada de R$ 2.500,00', async () => {
        const buf = Buffer.from(
            'CONTRATO DE HONORÁRIOS ADVOCATÍCIOS E SERVIÇOS JURÍDICOS\n' +
            'Pelo presente instrumento, o Contratante pagará a quantia de R$ 2.500,00 de honorários iniciais.\n' +
            'São Paulo, 18 de Outubro de 2026.\n',
            'utf-8'
        );
        const config = {
            financeiro: {
                parcelas: [{ id: 'p_hon_1', clienteNome: 'Ricardo', clienteTelefone: '11977776666', valor: 2500, status: 'PENDENTE' }],
                comprovantesRecebidos: []
            }
        };
        const proc = await processarComprovanteRecebido('11977776666', buf, 'image/jpeg', '', config);
        const status = config.financeiro.parcelas[0].status;
        if (status === 'PAGO' || proc.parcelaBaixada) {
            return { pass: false, detail: `Contrato de honorários quitou a parcela! Status: ${status}` };
        }
        return { pass: true, detail: `Contrato de honorários rejeitado para quitação financeira (Status mantido: ${status}).` };
    });

    await test('CH3-05', 'Petição Inicial de Ação Trabalhista contendo valor da causa', async () => {
        const buf = Buffer.from(
            'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DA VARA DO TRABALHO DE SÃO PAULO\n' +
            'RECLAMAÇÃO TRABALHISTA COM PEDIDO DE TUTELA DE URGÊNCIA\n' +
            'Dá-se à causa o valor de R$ 15.000,00.\n' +
            'Requer a juntada do comprovante de pagamento das custas processuais.\n',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 15000, 'Reclamante');
        if (res.comprovanteValido) {
            return { pass: false, detail: 'Petição Inicial trabalhista aprovada como PIX válido!' };
        }
        return { pass: true, detail: `Petição rejeitada como não-PIX (ehDocumentoCivil: ${res.ehDocumentoCivil}).` };
    });

    await test('CH3-06', 'Procuração Ad Judicia contendo poderes para transigir e receber', async () => {
        const buf = Buffer.from(
            'PROCURAÇÃO AD JUDICIA ET EXTRA\n' +
            'Outorgante: Manoel da Nobrega, brasileiro, casado.\n' +
            'Outorgados: Advogados associados.\n' +
            'Poderes para dar e receber quitação de valores de até R$ 50.000,00.\n',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 50000, 'Manoel da Nobrega');
        if (res.comprovanteValido) {
            return { pass: false, detail: 'Procuração classificada como comprovante PIX!' };
        }
        return { pass: true, detail: 'Procuração devidamente isolada como documento civil.' };
    });

    // ==========================================================================
    // 3. DOCUMENTOS GOVERNAMENTAIS (GRU, CPF, RECEITA FEDERAL)
    // ==========================================================================
    console.log('\n📦 BLOCO 3: Documentos Governamentais (GRU, CPF, Receita)');

    await test('CH3-07', 'Guia de Recolhimento da União (GRU) do Ministério da Justiça / PF', async () => {
        const buf = Buffer.from(
            'MINISTÉRIO DA JUSTIÇA - POLÍCIA FEDERAL\n' +
            'GUIA DE RECOLHIMENTO DA UNIÃO - GRU COBRANÇA\n' +
            'CÓDIGO DE RECOLHIMENTO: 14050-3\n' +
            'VALOR PRINCIPAL: R$ 257,25\n' +
            'COMPROVANTE DE PAGAMENTO DE GUIA\n',
            'utf-8'
        );
        const config = {
            financeiro: {
                parcelas: [{ id: 'p_gru_1', clienteNome: 'Beatriz', clienteTelefone: '11966665555', valor: 257.25, status: 'PENDENTE' }],
                comprovantesRecebidos: []
            }
        };
        const proc = await processarComprovanteRecebido('11966665555', buf, 'image/jpeg', '', config);
        const baixou = config.financeiro.parcelas[0].status === 'PAGO';
        if (baixou) {
            return { pass: false, detail: 'GRU da Polícia Federal baixou indevidamente parcela de honorários!' };
        }
        return { pass: true, detail: 'GRU rejeitada para baixa e protegida contra quitação.' };
    });

    await test('CH3-08', 'Comprovante de Inscrição no CPF emitido pela Receita Federal', async () => {
        const buf = Buffer.from(
            'MINISTÉRIO DA FAZENDA - SECRETARIA DA RECEITA FEDERAL DO BRASIL\n' +
            'COMPROVANTE DE INSCRIÇÃO NO CPF\n' +
            'NÚMERO DE INSCRIÇÃO: 123.456.789-00\n' +
            'NOME: ROBERTO DA COSTA\n' +
            'NASCIMENTO: 01/01/1980\n',
            'utf-8'
        );
        const res = await auditarComprovantePix(buf, 'image/jpeg', '', 500, 'Roberto da Costa');
        if (res.comprovanteValido) {
            return { pass: false, detail: 'Cartão de CPF identificado como PIX válido!' };
        }
        return { pass: true, detail: 'Comprovante de CPF identificado com precisão como documento civil.' };
    });

    // ==========================================================================
    // 4. TESTES DE STRESS DE REPLAY ATTACK (ATAQUE DE REPETIÇÃO)
    // ==========================================================================
    console.log('\n📦 BLOCO 4: Auditoria de Replay Attacks (Variações de Caixa, Concorrência e Clientes)');

    await test('CH3-09', 'Replay Attack com variação de case (minúsculas vs maiúsculas no idTransacao)', async () => {
        const config = {
            financeiro: {
                parcelas: [
                    { id: 'parc_case_1', clienteNome: 'Alice', clienteTelefone: '11955554444', valor: 400, status: 'PENDENTE' },
                    { id: 'parc_case_2', clienteNome: 'Alice', clienteTelefone: '11955554444', valor: 400, status: 'PENDENTE' }
                ],
                comprovantesRecebidos: []
            }
        };

        const buf1 = Buffer.from(
            'COMPROVANTE DE TRANSFERÊNCIA PIX\n' +
            'BANCO ITAÚ UNIBANCO S.A.\n' +
            'ID DA TRANSAÇÃO: E6070119020261018CASEABC1234\n' +
            'PAGADOR: Alice\n' +
            'VALOR PAGO: R$ 400,00\n' +
            'DATA: 18/10/2026',
            'utf-8'
        );

        const buf2 = Buffer.from(
            'COMPROVANTE DE TRANSFERÊNCIA PIX\n' +
            'BANCO ITAÚ UNIBANCO S.A.\n' +
            'ID DA TRANSAÇÃO: e6070119020261018caseabc1234\n' +
            'PAGADOR: Alice\n' +
            'VALOR PAGO: R$ 400,00\n' +
            'DATA: 18/10/2026',
            'utf-8'
        );

        const res1 = await processarComprovanteRecebido('11955554444', buf1, 'image/jpeg', '', config);
        const res2 = await processarComprovanteRecebido('11955554444', buf2, 'image/jpeg', '', config);

        const p1Status = config.financeiro.parcelas[0].status;
        const p2Status = config.financeiro.parcelas[1].status;

        if (p1Status === 'PAGO' && p2Status === 'PAGO') {
            return { pass: false, detail: 'Replay com case variation conseguiu quitar a 2ª parcela!' };
        }
        if (res2.motivo !== 'COMPROVANTE_JA_PROCESSADO') {
            return { pass: false, detail: `Motivo inesperado para replay case: ${res2.motivo}` };
        }
        return { pass: true, detail: 'Replay case-insensitive bloqueado com sucesso (motivo COMPROVANTE_JA_PROCESSADO).' };
    });

    await test('CH3-10', 'Replay Attack cruzado entre clientes distintos (Cliente A usa comprovante de Cliente B)', async () => {
        const config = {
            financeiro: {
                parcelas: [
                    { id: 'parc_cl_b', clienteNome: 'Cliente B', clienteTelefone: '11944443333', valor: 600, status: 'PENDENTE' },
                    { id: 'parc_cl_a', clienteNome: 'Cliente A', clienteTelefone: '11933332222', valor: 600, status: 'PENDENTE' }
                ],
                comprovantesRecebidos: []
            }
        };

        const pixBuf = Buffer.from(
            'COMPROVANTE DE TRANSFERÊNCIA PIX\n' +
            'BANCO BRADESCO S.A.\n' +
            'ID DA TRANSAÇÃO: E0000000020261018CROSS123456\n' +
            'PAGADOR: Cliente B\n' +
            'VALOR PAGO: R$ 600,00\n' +
            'DATA: 18/10/2026',
            'utf-8'
        );

        // Cliente B envia e quita legitimamente
        await processarComprovanteRecebido('11944443333', pixBuf, 'image/jpeg', '', config);
        // Cliente A tenta reutilizar o mesmo comprovante de B
        const resA = await processarComprovanteRecebido('11933332222', pixBuf, 'image/jpeg', '', config);

        const pB = config.financeiro.parcelas.find(p => p.id === 'parc_cl_b');
        const pA = config.financeiro.parcelas.find(p => p.id === 'parc_cl_a');

        if (pA.status === 'PAGO') {
            return { pass: false, detail: 'Replay cross-client permitiu Cliente A quitar parcela com comprovante de B!' };
        }
        return { pass: true, detail: 'Replay entre clientes bloqueado pelo ID da transação no ledger financeiro.' };
    });

    await test('CH3-11', 'Tentativa de replay com comprovante pré-existente no histórico de parcelas', async () => {
        const config = {
            financeiro: {
                parcelas: [
                    { id: 'parc_antiga', clienteNome: 'Passado', clienteTelefone: '11922221111', valor: 300, status: 'PAGO', idTransacao: 'E1838274920261018HISTORICO99' },
                    { id: 'parc_nova', clienteNome: 'Novo', clienteTelefone: '11922221111', valor: 300, status: 'PENDENTE' }
                ],
                comprovantesRecebidos: []
            }
        };

        const pixBuf = Buffer.from(
            'COMPROVANTE DE TRANSFERÊNCIA PIX\n' +
            'BANCO DO BRASIL S.A.\n' +
            'ID DA TRANSAÇÃO: E1838274920261018HISTORICO99\n' +
            'PAGADOR: Novo\n' +
            'VALOR PAGO: R$ 300,00\n' +
            'DATA: 18/10/2026',
            'utf-8'
        );

        const res = await processarComprovanteRecebido('11922221111', pixBuf, 'image/jpeg', '', config);
        const parcNova = config.financeiro.parcelas.find(p => p.id === 'parc_nova');

        if (parcNova.status === 'PAGO') {
            return { pass: false, detail: 'Comprovante com ID histórico já liquidado conseguiu dar baixa em nova parcela!' };
        }
        return { pass: true, detail: 'ID pré-existente no histórico de parcelas bloqueou nova tentativa de baixa.' };
    });

    // ==========================================================================
    // 5. TESTES DE TRAVAS DETERMINÍSTICAS (BANCO / ID / VALOR)
    // ==========================================================================
    console.log('\n📦 BLOCO 5: Travas Determinísticas em validarDivergenciaPix');

    await test('CH3-12', 'PIX legítimo sem identificação de banco emissor deve falhar Trava 4', async () => {
        const dados = {
            ehComprovantePix: true,
            ehDocumentoCivil: false,
            tipoDetectado: 'COMPROVANTE_PIX',
            valorPago: 500,
            idTransacao: 'E12345678901234567890',
            bancoOrigem: '' // Sem banco
        };
        const res = validarDivergenciaPix(dados, 500, 'Cliente');
        if (res.comprovanteValido) {
            return { pass: false, detail: 'Comprovante sem banco emissor foi aprovado como válido!' };
        }
        if (!res.divergencia.includes('Instituição bancária emissora')) {
            return { pass: false, detail: `Mensagem de divergência inesperada: ${res.divergencia}` };
        }
        return { pass: true, detail: 'Trava 4 rejeitou comprovante sem instituição bancária.' };
    });

    await test('CH3-13', 'PIX com ID de transação curto (< 8 caracteres) deve falhar Trava 3', async () => {
        const dados = {
            ehComprovantePix: true,
            ehDocumentoCivil: false,
            tipoDetectado: 'COMPROVANTE_PIX',
            valorPago: 500,
            idTransacao: 'E1234', // < 8 caracteres
            bancoOrigem: 'Nubank'
        };
        const res = validarDivergenciaPix(dados, 500, 'Cliente');
        if (res.comprovanteValido) {
            return { pass: false, detail: 'Comprovante com ID < 8 caracteres foi aprovado!' };
        }
        if (!res.divergencia.includes('Identificador de transação')) {
            return { pass: false, detail: `Mensagem de divergência inesperada: ${res.divergencia}` };
        }
        return { pass: true, detail: 'Trava 3 rejeitou comprovante com ID curto ou inválido.' };
    });

    await test('CH3-14', 'PIX com valor pago zero ou negativo deve falhar Trava 2', async () => {
        const dados = {
            ehComprovantePix: true,
            ehDocumentoCivil: false,
            tipoDetectado: 'COMPROVANTE_PIX',
            valorPago: 0,
            idTransacao: 'E12345678901234567890',
            bancoOrigem: 'Nubank'
        };
        const res = validarDivergenciaPix(dados, 500, 'Cliente');
        if (res.comprovanteValido) {
            return { pass: false, detail: 'Comprovante com valor 0 foi aprovado!' };
        }
        return { pass: true, detail: 'Trava 2 rejeitou valor zero com sucesso.' };
    });

    console.log('\n================================================================================');
    console.log('📊 RESUMO DA AUDITORIA EMPÍRICA CHALLENGER 3');
    console.log('================================================================================');
    console.log(`  Total de Testes Executados: ${passes.length + failures.length}`);
    console.log(`  Comportamentos Seguros:     ${passes.length} ✅`);
    console.log(`  Vulnerabilidades Encontradas: ${failures.length} 🚨`);
    console.log('================================================================================\n');

    return { total: passes.length + failures.length, passed: passes.length, failed: failures.length, failures };
}

runChallenger3Suite().then(res => {
    if (res.failed > 0) {
        console.log(`🚨 VEREDICTO CHALLENGER 3: REQUEST_CHANGES (${res.failed} falhas encontradas)`);
        process.exit(1);
    } else {
        console.log(`✅ VEREDICTO CHALLENGER 3: APPROVE (100% de integridade verificada nos testes adicionais)`);
        process.exit(0);
    }
});
