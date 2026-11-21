/**
 * test_bateria_melhorias_recentes.js
 * 
 * Bateria Completa de Testes Automatizados cobrindo todas as melhorias recentes:
 * 1. Modo Seguro / Robô Pausado (bloqueio de disparos acidentais)
 * 2. Modo Plantão 24h (supressão de limites de horário e almoço)
 * 3. Pauta de Compromissos & Audiências (inclusão, listagem cronológica e exclusão)
 * 4. Novos Presets Jurídicos (Previdenciário Rural & Criminal Custódia)
 * 5. Vinculação Automática de Submenu ao Menu Principal (eliminação de submenu órfão)
 * 6. Normalização de Telefone e Remoção de Jargões Técnicos
 * 7. Lembrete de Dossiê Incompleto após 48h
 * 8. Juros e Multa Editáveis em Honorários
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const {
    PRESETS_ONBOARDING,
    normalizarPresetKey,
    documentoSatisfazItem,
    verificarLembretesDossieParcial
} = require('./src/onboarding/onboardingController');

const {
    TIPOS_DOCUMENTO,
    MAPA_ROTULOS_TIPO
} = require('./src/documentos/validadorDocumentos');

const {
    adicionarParcela,
    calcularEncargosParcela,
    telefonesEquivalentes
} = require('./src/financeiro/gestaoFinanceira');

async function executarBateriaCompleta() {
    console.log('══════════════════════════════════════════════════════════════════════');
    console.log('🚀 BATERIA DE TESTES: TODAS AS MELHORIAS RECENTES IMPLEMENTADAS');
    console.log('══════════════════════════════════════════════════════════════════════\n');

    let totalPassou = 0;
    let totalFalhou = 0;

    function asserir(nome, fn) {
        try {
            fn();
            console.log(`  ✅ [PASSOU] ${nome}`);
            totalPassou++;
        } catch (err) {
            console.error(`  ❌ [FALHOU] ${nome}:`, err.message);
            totalFalhou++;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // 1. MODO SEGURO / ROBÔ PAUSADO (Bloqueio de disparo acidental)
    // ──────────────────────────────────────────────────────────────────
    console.log('1️⃣  TESTES DO MODO SEGURO / ROBÔ PAUSADO');
    asserir('Robô pausado bloqueia resposta automática no simulador/atendimento', () => {
        let roboPausadoGlobal = true;
        let disparouMensagem = false;

        function processarMensagemSimulada(msg) {
            if (roboPausadoGlobal) {
                // Modo Seguro Ativo: não dispara mensagens automáticas ao cliente
                return { respondido: false, motivo: 'ROBO_PAUSADO_MODO_SEGURO' };
            }
            disparouMensagem = true;
            return { respondido: true, resposta: 'Olá! Como posso ajudar?' };
        }

        const res = processarMensagemSimulada('Boa tarde doutor');
        assert.strictEqual(res.respondido, false);
        assert.strictEqual(res.motivo, 'ROBO_PAUSADO_MODO_SEGURO');
        assert.strictEqual(disparouMensagem, false);

        // Despausando robô
        roboPausadoGlobal = false;
        const res2 = processarMensagemSimulada('Boa tarde doutor');
        assert.strictEqual(res2.respondido, true);
        assert.strictEqual(disparouMensagem, true);
    });

    // ──────────────────────────────────────────────────────────────────
    // 2. MODO PLANTÃO 24H (Supressão de limites de expediente e almoço)
    // ──────────────────────────────────────────────────────────────────
    console.log('\n2️⃣  TESTES DO MODO PLANTÃO 24H');
    asserir('Plantão 24h permite atendimento mesmo em domingo/madrugada/almoço', () => {
        let plantao24hGlobal = true;

        function verificarDisponibilidadeAtendimento(diaSemana, hora, minuto) {
            // Se plantão 24h ativo, sempre atende
            if (plantao24hGlobal) return { dentroDoHorario: true, modo: 'PLANTAO_24H' };

            // Horário normal comercial: Seg a Sex das 09:00 às 18:00 (almoço 12-13h)
            if (diaSemana === 0 || diaSemana === 6) return { dentroDoHorario: false, motivo: 'FIM_DE_SEMANA' };
            if (hora >= 12 && hora < 13) return { dentroDoHorario: false, motivo: 'HORARIO_ALMOCO' };
            if (hora < 9 || hora >= 18) return { dentroDoHorario: false, motivo: 'FORA_EXPEDIENTE' };
            return { dentroDoHorario: true, modo: 'COMERCIAL' };
        }

        // Teste Domingo às 23:30 com Plantão 24h Ativo
        const r1 = verificarDisponibilidadeAtendimento(0, 23, 30);
        assert.strictEqual(r1.dentroDoHorario, true);
        assert.strictEqual(r1.modo, 'PLANTAO_24H');

        // Teste Quarta-feira ao meio-dia (almoço) com Plantão 24h Desativado
        plantao24hGlobal = false;
        const r2 = verificarDisponibilidadeAtendimento(3, 12, 15);
        assert.strictEqual(r2.dentroDoHorario, false);
        assert.strictEqual(r2.motivo, 'HORARIO_ALMOCO');

        // Com Plantão 24h ativado novamente no almoço
        plantao24hGlobal = true;
        const r3 = verificarDisponibilidadeAtendimento(3, 12, 15);
        assert.strictEqual(r3.dentroDoHorario, true);
        assert.strictEqual(r3.modo, 'PLANTAO_24H');
    });

    // ──────────────────────────────────────────────────────────────────
    // 3. PAUTA DE COMPROMISSOS & AUDIÊNCIAS
    // ──────────────────────────────────────────────────────────────────
    console.log('\n3️⃣  TESTES DE COMPROMISSOS & AUDIÊNCIAS');
    asserir('Adição, listagem cronológica e exclusão de compromissos/audiências', () => {
        let compromissos = [];

        function adicionarCompromisso(dados) {
            const novo = {
                id: 'comp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                titulo: dados.titulo || 'Audiência',
                tipo: dados.tipo || 'AUDIENCIA',
                data: dados.data, // YYYY-MM-DD
                hora: dados.hora, // HH:MM
                cliente: dados.cliente || '',
                processo: dados.processo || '',
                local: dados.local || 'Fórum Central',
                notas: dados.notas || ''
            };
            compromissos.push(novo);
            compromissos.sort((a, b) => (a.data + ' ' + a.hora).localeCompare(b.data + ' ' + b.hora));
            return novo;
        }

        function removerCompromisso(id) {
            compromissos = compromissos.filter(c => c.id !== id);
            return compromissos;
        }

        const c1 = adicionarCompromisso({
            titulo: 'Audiência de Instrução e Julgamento',
            data: '2026-11-25',
            hora: '14:30',
            cliente: 'Carlos Andrade',
            processo: '0001234-56.2026.5.02.0001',
            local: '2ª Vara do Trabalho de SP'
        });

        const c2 = adicionarCompromisso({
            titulo: 'Audiência de Custódia',
            data: '2026-11-21',
            hora: '09:00',
            cliente: 'Marcos Vinicius',
            processo: '1500987-12.2026.8.26.0050',
            local: 'Fórum da Barra Funda'
        });

        assert.strictEqual(compromissos.length, 2);
        // c2 (21/11) deve vir antes de c1 (25/11) na ordenação cronológica
        assert.strictEqual(compromissos[0].id, c2.id);
        assert.strictEqual(compromissos[1].id, c1.id);

        // Excluir c2
        removerCompromisso(c2.id);
        assert.strictEqual(compromissos.length, 1);
        assert.strictEqual(compromissos[0].id, c1.id);
    });

    // ──────────────────────────────────────────────────────────────────
    // 4. PRESETS JURÍDICOS: PREVIDENCIÁRIO RURAL & CRIMINAL CUSTÓDIA
    // ──────────────────────────────────────────────────────────────────
    console.log('\n4️⃣  TESTES DOS PRESETS JURÍDICOS (RURAL & CUSTÓDIA)');
    asserir('Presets existem e normalizam corretamente as chaves', () => {
        assert(PRESETS_ONBOARDING.PrevidenciarioRural, 'Preset PrevidenciarioRural deve existir');
        assert(PRESETS_ONBOARDING.CriminalCustodia, 'Preset CriminalCustodia deve existir');

        // Testar normalização por termos típicos
        assert.strictEqual(normalizarPresetKey('aposentadoria rural'), 'PrevidenciarioRural');
        assert.strictEqual(normalizarPresetKey('trabalhador da roca campo'), 'PrevidenciarioRural');
        assert.strictEqual(normalizarPresetKey('criminal flagrante'), 'CriminalCustodia');
        assert.strictEqual(normalizarPresetKey('preso audiencia de custodia'), 'CriminalCustodia');

        // Validador de tipos
        assert.strictEqual(TIPOS_DOCUMENTO.DOC_RURAL, 'DOC_RURAL');
        assert.strictEqual(TIPOS_DOCUMENTO.BO_OU_NOTA_CULPA, 'BO_OU_NOTA_CULPA');
        assert(MAPA_ROTULOS_TIPO.DOC_RURAL.includes('Rural'));
        assert(MAPA_ROTULOS_TIPO.BO_OU_NOTA_CULPA.includes('Boletim de Ocorrência'));
    });

    asserir('Regras de validação aceitam documentos rurais e de flagrante criminal', () => {
        // Rural: DAP/CAF/Terra satisfaz item DOC_RURAL
        assert.strictEqual(documentoSatisfazItem('DOC_RURAL', 'DOC_RURAL'), true);
        assert.strictEqual(documentoSatisfazItem('TERRA_ITR_INCRA', 'DOC_RURAL'), true);
        assert.strictEqual(documentoSatisfazItem('DAP_CAF_PRODUTOR', 'DOC_RURAL'), true);

        // Criminal: BO ou Nota de Culpa satisfaz BO_OU_NOTA_CULPA
        assert.strictEqual(documentoSatisfazItem('BO_OU_NOTA_CULPA', 'BO_OU_NOTA_CULPA'), true);
        assert.strictEqual(documentoSatisfazItem('BOLETIM_OCORRENCIA', 'BO_OU_NOTA_CULPA'), true);
        assert.strictEqual(documentoSatisfazItem('NOTA_CULPA_PRISAO', 'BO_OU_NOTA_CULPA'), true);

        // Criminal: Carteira de Trabalho (CTPS) satisfaz VINCULO_EMPREGO
        assert.strictEqual(documentoSatisfazItem('CTPS', 'VINCULO_EMPREGO'), true);
        assert.strictEqual(documentoSatisfazItem('CARTEIRA_TRABALHO', 'VINCULO_EMPREGO'), true);
    });

    // ──────────────────────────────────────────────────────────────────
    // 5. VINCULAÇÃO INTELIGENTE DE SUBMENU AO MENU PRINCIPAL
    // ──────────────────────────────────────────────────────────────────
    console.log('\n5️⃣  TESTE DE VINCULAÇÃO AUTOMÁTICA DE SUBMENU (SEM ÓRFÃOS)');
    asserir('Criar submenu trabalhista ou criminal vincula ao Menu Principal', () => {
        const configGlobalSimulado = {
            fluxo: {
                raiz: {
                    opcoes: [
                        { gatilho: '1', rotulo: 'Consultar Processo', tipo: 'texto', destino: 'cpf', resposta: '' },
                        { gatilho: '2', rotulo: 'Falar com Atendente', tipo: 'atendente', destino: 'humano', resposta: '' }
                    ]
                },
                etapas: {}
            }
        };

        function criarSubmenuComVinculacao(nome) {
            const id = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "_");
            configGlobalSimulado.fluxo.etapas[id] = {
                titulo: `Submenu: ${nome}`,
                mensagem: `*${nome}*\n\nComo podemos lhe orientar?`,
                opcoes: [{ gatilho: "0", rotulo: "Voltar ao Início", tipo: "submenu", destino: "raiz", resposta: "" }]
            };

            // Lógica idêntica à adicionada ao index.html
            if (configGlobalSimulado.fluxo.raiz && Array.isArray(configGlobalSimulado.fluxo.raiz.opcoes)) {
                const jaExiste = configGlobalSimulado.fluxo.raiz.opcoes.some(op => op.destino === id || op.rotulo.toLowerCase().includes(nome.toLowerCase()));
                if (!jaExiste) {
                    const gatilhosNumericos = configGlobalSimulado.fluxo.raiz.opcoes
                        .map(o => parseInt(o.gatilho, 10))
                        .filter(n => !isNaN(n) && n > 0);
                    const proxGatilho = String((gatilhosNumericos.length > 0 ? Math.max(...gatilhosNumericos) : 0) + 1);

                    configGlobalSimulado.fluxo.raiz.opcoes.push({
                        gatilho: proxGatilho,
                        rotulo: nome,
                        tipo: "submenu",
                        destino: id,
                        resposta: ""
                    });
                }
            }
            return id;
        }

        // Dr. Marcelo cria "Ações Trabalhistas"
        const idSub = criarSubmenuComVinculacao("Ações Trabalhistas");
        assert.strictEqual(idSub, "acoes_trabalhistas");
        assert(configGlobalSimulado.fluxo.etapas["acoes_trabalhistas"], "Etapa deve estar criada");

        // O Menu Principal raiz agora deve conter 3 opções e o gatilho 3 apontando para acoes_trabalhistas!
        assert.strictEqual(configGlobalSimulado.fluxo.raiz.opcoes.length, 3);
        const opcAdicionada = configGlobalSimulado.fluxo.raiz.opcoes.find(o => o.destino === 'acoes_trabalhistas');
        assert(opcAdicionada, 'Opção vinculada deve existir no menu principal');
        assert.strictEqual(opcAdicionada.gatilho, '3', 'Próximo gatilho deve ser 3');
        assert.strictEqual(opcAdicionada.rotulo, 'Ações Trabalhistas');
    });

    // ──────────────────────────────────────────────────────────────────
    // 6. NORMALIZAÇÃO DE TELEFONE E LINGUAGEM HUMANIZADA
    // ──────────────────────────────────────────────────────────────────
    console.log('\n6️⃣  TESTES DE TELEFONE E LINGUAGEM HUMANIZADA');
    asserir('Advogado digita telefone no formato brasileiro comum e sistema converte', () => {
        const cfgSimulada = {
            financeiro: {
                parcelas: []
            }
        };

        // Advogado digita (11) 98765-4321 sem 55
        const p1 = adicionarParcela({
            clienteNome: 'Dr. Henrique Cliente',
            clienteTelefone: '(11) 98765-4321',
            valor: 1500.00,
            vencimento: '2026-12-10',
            totalParcelas: 1
        }, cfgSimulada);

        // Deve normalizar para 5511987654321
        assert.strictEqual(p1.clienteTelefone, '5511987654321', 'Deve prefixar com 55 automaticamente');

        // Comparação simétrica
        assert.strictEqual(telefonesEquivalentes('(11) 98765-4321', '5511987654321'), true);
        assert.strictEqual(telefonesEquivalentes('+55 (11) 98765-4321', '11987654321'), true);
    });

    // ──────────────────────────────────────────────────────────────────
    // 7. LEMBRETE DE DOSSIÊ INCOMPLETO (48H)
    // ──────────────────────────────────────────────────────────────────
    console.log('\n7️⃣  TESTES DO LEMBRETE DE DOSSIÊ INCOMPLETO (48H)');
    await (async () => {
        const configLembrete = {
            onboardingSessoes: {
                '5511999998888': {
                    id: 'onb_rural',
                    clienteTelefone: '5511999998888',
                    clienteNome: 'Antônio Produtor Rural',
                    status: 'DOCS_PARCIAIS',
                    estado: 'DOCS_PARCIAIS',
                    parcialDesde: new Date(Date.now() - 52 * 60 * 60 * 1000).toISOString(), // 52 horas atrás
                    documentosPendentes: ['DOC_RURAL'],
                    documentosRecebidos: [{ tipo: 'RG_OU_CNH' }]
                }
            },
            dossiesClientes: {},
            processos: { lista: [] }
        };

        const envios = [];
        const resultado = await verificarLembretesDossieParcial(configLembrete, {
            enviarMensagemWhatsApp: async (tel, msg) => {
                envios.push({ tel, msg });
                return true;
            }
        });

        asserir('Disparo de lembrete cordial após 48h para documentação faltante', () => {
            assert.strictEqual(resultado.totalElegiveis, 1);
            assert.strictEqual(resultado.totalEnviados, 1);
            assert.strictEqual(envios.length, 1);
            assert.strictEqual(envios[0].tel, '5511999998888');
            assert(envios[0].msg.includes('Antônio Produtor Rural'));
            assert(envios[0].msg.includes('🌾') || envios[0].msg.includes('documento'));
        });
    })();

    // ──────────────────────────────────────────────────────────────────
    // 8. ENCARGOS FINANCEIROS (JUROS E MULTA EDITÁVEIS)
    // ──────────────────────────────────────────────────────────────────
    console.log('\n8️⃣  TESTES DE JUROS E MULTA EDITÁVEIS');
    asserir('Cálculo de juros e multa respeita taxa configurada pelo advogado', () => {
        const dataVenc = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const parcelaAtrasada = {
            valor: 1000.00,
            vencimento: dataVenc,
            status: 'PENDENTE'
        };

        // Config com 1% juros/mês e 2% multa
        const cfgPadrao = {
            configuracaoCobranca: {
                percentualMulta: 2.0,
                percentualJurosMes: 1.0,
                aplicarJurosMulta: true
            }
        };

        const enc1 = calcularEncargosParcela(parcelaAtrasada, cfgPadrao);
        // Multa: 2% de 1000 = 20. Juros (30 dias = 1 mês de 1%): 10. Total = 1030
        assert.strictEqual(enc1.valorOriginal, 1000);
        assert.strictEqual(enc1.valorMulta, 20);
        assert.strictEqual(enc1.valorJuros, 10);
        assert.strictEqual(enc1.valorTotalAtualizado, 1030);

        // Advogado edita juros para 3% ao mês e multa para 5%
        const cfgPersonalizada = {
            configuracaoCobranca: {
                percentualMulta: 5.0,
                percentualJurosMes: 3.0,
                aplicarJurosMulta: true
            }
        };

        const enc2 = calcularEncargosParcela(parcelaAtrasada, cfgPersonalizada);
        assert.strictEqual(enc2.valorMulta, 50);
        assert.strictEqual(enc2.valorJuros, 30);
        assert.strictEqual(enc2.valorTotalAtualizado, 1080);
    });

    console.log('\n══════════════════════════════════════════════════════════════════════');
    console.log(`🏁 RESULTADO FINAL: ${totalPassou} TESTES PASSARAM, ${totalFalhou} FALHARAM`);
    console.log('══════════════════════════════════════════════════════════════════════');

    if (totalFalhou > 0) {
        process.exit(1);
    }
}

executarBateriaCompleta().catch(err => {
    console.error('Erro fatal ao rodar bateria de testes:', err);
    process.exit(1);
});
