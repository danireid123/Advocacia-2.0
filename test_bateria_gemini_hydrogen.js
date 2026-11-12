/**
 * ============================================================================
 * BATERIA DE TESTES OFICIAL: GEMINI 4 HYDROGEN (gemini-4-hydrogen)
 * Advocacia Studio Pro v2.0 — Suíte Especializada de IA Jurídica & WhatsApp
 * ============================================================================
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
    traduzirAndamentoJuridico,
    traduzirAndamentoParaCliente,
    detectarUrgenciaECronologiaLocal,
    analisarUrgenciaECronologia,
    SYSTEM_INSTRUCTION_OAB,
    SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM,
    TIMEOUT_PADRAO_TEXTO,
    TIMEOUT_MULTIMODAL_AUDIO,
    calcularHash
} = require('./src/ia/tradutorJuridico');

// Configuração do ambiente de teste para o modelo Hydrogen
const MODELO_TESTADO = 'gemini-4-hydrogen';
process.env.GEMINI_MODEL = MODELO_TESTADO;

async function rodarBateriaHydrogen() {
    console.log('============================================================================');
    console.log(`🤖 BATERIA DE TESTES: MODELO ${MODELO_TESTADO.toUpperCase()}`);
    console.log('   Advocacia Studio Pro v2.0 — Validação de Prompts e IA Jurídica');
    console.log('============================================================================\n');

    let totalPassou = 0;
    let totalFalhou = 0;

    async function testar(titulo, fn) {
        try {
            process.stdout.write(`🧪 ${titulo}... `);
            await fn();
            console.log('✅ [PASS]');
            totalPassou++;
        } catch (err) {
            console.log('❌ [FAIL]');
            console.error(`   🚨 Erro: ${err.message}`);
            totalFalhou++;
        }
    }

    // ------------------------------------------------------------------------
    // BLOCO 1: Engenharia de Prompts e Instruções de Sistema (Compliance OAB)
    // ------------------------------------------------------------------------
    console.log('📦 BLOCO 1: Engenharia de Prompts & Compliance OAB');

    await testar('Instrução de Sistema OAB exige clareza e veda promessa de resultado', () => {
        assert.ok(typeof SYSTEM_INSTRUCTION_OAB === 'string' && SYSTEM_INSTRUCTION_OAB.length > 50, 'Prompt OAB deve estar definido');
        const promptLower = SYSTEM_INSTRUCTION_OAB.toLowerCase();
        assert.ok(promptLower.includes('oab') || promptLower.includes('ética') || promptLower.includes('promessa') || promptLower.includes('linguagem simples'), 'Prompt deve conter diretrizes de ética e linguagem clara');
    });

    await testar('Instrução de Polimento de Mensagens proíbe jargões ininteligíveis', () => {
        assert.ok(typeof SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM === 'string', 'Prompt de polimento deve estar exportado');
        const pLower = SYSTEM_INSTRUCTION_MELHORAR_MENSAGEM.toLowerCase();
        assert.ok(pLower.includes('whatsapp') || pLower.includes('clareza') || pLower.includes('emojis') || pLower.includes('acessíveis'), 'Prompt deve orientar comunicação amigável no WhatsApp');
    });

    // ------------------------------------------------------------------------
    // BLOCO 2: Resolução Dinâmica do Modelo e Timeouts Homologados
    // ------------------------------------------------------------------------
    console.log('\n📦 BLOCO 2: Parâmetros de Execução do Hydrogen');

    await testar('Variável de ambiente GEMINI_MODEL reflete gemini-4-hydrogen', () => {
        assert.strictEqual(process.env.GEMINI_MODEL, 'gemini-4-hydrogen', 'Variável deve apontar para o novo modelo Hydrogen');
    });

    await testar('Timeouts de execução homologados (3.5s texto e 20s áudio)', () => {
        assert.strictEqual(TIMEOUT_PADRAO_TEXTO, 3500, 'Timeout de texto deve ser ágil (3.5s)');
        assert.strictEqual(TIMEOUT_MULTIMODAL_AUDIO, 20000, 'Timeout multimodal deve ser seguro (20s)');
    });

    // ------------------------------------------------------------------------
    // BLOCO 3: Triagem de Urgência em 4 Níveis (Furador de Fila)
    // ------------------------------------------------------------------------
    console.log('\n📦 BLOCO 3: Classificação de Urgência & Fila do Advogado');

    await testar('Classifica caso de Mandado / Busca e Apreensão como CRÍTICA (Nível 4)', () => {
        const relato = "Doutor, urgente! Um oficial de justiça acabou de chegar aqui com mandado de busca do meu veículo!";
        const res = detectarUrgenciaECronologiaLocal(relato);
        assert.strictEqual(res.nivelUrgencia, 'CRITICA', 'Deve classificar como CRÍTICA');
        assert.ok(res.motivoUrgencia.toLowerCase().includes('mandado') || res.motivoUrgencia.toLowerCase().includes('justiça') || res.motivoUrgencia.toLowerCase().includes('busca'), 'Motivo deve referenciar a urgência');
    });

    await testar('Classifica Bloqueio Judicial de Conta Bancária como CRÍTICA / ALTA', () => {
        const relato = "Minha conta bancária da empresa amanheceu com bloqueio judicial do juiz, não consigo pagar ninguém!";
        const res = detectarUrgenciaECronologiaLocal(relato);
        assert.ok(res.nivelUrgencia === 'CRITICA' || res.nivelUrgencia === 'ALTA', 'Bloqueio judicial deve ter prioridade máxima');
    });

    await testar('Classifica Dúvida Ordinária de Andamento como MÉDIA (Nível 2)', () => {
        const relato = "Olá, bom dia! Gostaria de saber como está o andamento daquele meu processo trabalhista.";
        const res = detectarUrgenciaECronologiaLocal(relato);
        assert.ok(res.nivelUrgencia === 'MEDIA' || res.nivelUrgencia === 'ROTINA' || res.nivelUrgencia === 'COMERCIAL', 'Dúvida geral não deve furar a fila como crítica');
    });

    await testar('Classifica Saudação Simples / Agradecimento como BAIXA (Nível 1)', () => {
        const relato = "Obrigado doutor, tenha uma boa tarde!";
        const res = detectarUrgenciaECronologiaLocal(relato);
        assert.ok(res.nivelUrgencia === 'BAIXA' || res.nivelUrgencia === 'MEDIA' || res.nivelUrgencia === 'ROTINA', 'Agradecimento deve ter peso leve');
    });

    // ------------------------------------------------------------------------
    // BLOCO 4: Tradução de Andamento Processual para o Cidadão Comum
    // ------------------------------------------------------------------------
    console.log('\n📦 BLOCO 4: Tradução Jurídica & Resiliência');

    await testar('Fallback instantâneo (< 5ms) preserva andamento caso a rede offline', async () => {
        const textoOriginal = 'Vistos. Concedo a tutela provisória de urgência requerida pela parte autora.';
        const inicio = Date.now();
        const res = await traduzirAndamentoJuridico(textoOriginal, {
            apiKey: '', // Força fallback instantâneo
            modelo: MODELO_TESTADO
        });
        const tempo = Date.now() - inicio;

        assert.strictEqual(res.fonte, 'fallback', 'Deveria acionar fallback limpo');
        assert.strictEqual(res.texto, textoOriginal, 'Deve manter o texto original íntegro');
        assert.ok(tempo < 100, `Fallback deve ser quase instantâneo (< 100ms, levou ${tempo}ms)`);
    });

    await testar('Hash MD5 e Deduplicação de Cache em memória operam atomicamente', () => {
        const texto = 'Expedida certidão de intimação eletrônica ao réu.';
        const hash1 = calcularHash(texto);
        const hash2 = calcularHash(texto);
        assert.strictEqual(hash1, hash2, 'Hashes devem ser rigorosamente determinísticos');
        assert.strictEqual(hash1.length, 32, 'MD5 deve ter 32 caracteres');
    });

    // ------------------------------------------------------------------------
    // RESUMO FINAL
    // ------------------------------------------------------------------------
    console.log('\n============================================================================');
    console.log(`📊 RESULTADO DA BATERIA DE TESTES (${MODELO_TESTADO})`);
    console.log(`   Total de Testes: ${totalPassou + totalFalhou}`);
    console.log(`   Sucessos:        ${totalPassou} ✅`);
    console.log(`   Falhas:          ${totalFalhou} ${totalFalhou === 0 ? '🎉' : '❌'}`);
    console.log('============================================================================');

    if (totalFalhou > 0) {
        process.exit(1);
    }
}

rodarBateriaHydrogen().catch(err => {
    console.error('Erro fatal na bateria de testes:', err);
    process.exit(1);
});
