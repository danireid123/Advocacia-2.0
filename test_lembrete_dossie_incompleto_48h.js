const assert = require('assert');
const {
    verificarLembretesDossieParcial,
    iniciarSessaoOnboarding,
    processarMidiaOnboarding,
    consolidarDossie
} = require('./src/onboarding/onboardingController');

async function executarTestesLembrete48h() {
    console.log('🧪 Iniciando Bateria de Testes: Lembrete Automático de Dossiê Parcial (48h)...\n');

    // 1. Cenário: Dossiê parcial com menos de 48 horas (não deve enviar)
    {
        const config = {
            onboardingSessoes: {
                '5511999990001': {
                    id: 'onb_1',
                    clienteTelefone: '5511999990001',
                    clienteNome: 'Maria Silva',
                    status: 'DOCS_PARCIAIS',
                    estado: 'DOCS_PARCIAIS',
                    parcialDesde: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h atrás
                    documentosPendentes: ['COMPROVANTE_RESIDENCIA'],
                    documentosRecebidos: [{ tipo: 'RG_OU_CNH' }]
                }
            },
            dossiesClientes: {},
            processos: { lista: [] }
        };

        const mensagensEnviadas = [];
        const rel = await verificarLembretesDossieParcial(config, {
            enviarMensagemWhatsApp: async (tel, msg) => {
                mensagensEnviadas.push({ tel, msg });
                return true;
            }
        });

        assert.strictEqual(rel.totalVerificados, 1, 'Deve verificar 1 sessão parcial');
        assert.strictEqual(rel.totalElegiveis, 0, 'Não deve ser elegível pois só passaram 24h (< 48h)');
        assert.strictEqual(rel.totalEnviados, 0, 'Nenhuma mensagem deve ser enviada');
        assert.strictEqual(mensagensEnviadas.length, 0, 'Array de envios deve estar vazio');
        console.log('  ✅ [PASSOU] 1. Dossiê com 24h (< 48h) não dispara lembrete prematuro');
    }

    // 2. Cenário: Dossiê parcial com mais de 48 horas (DEVE enviar lembrete acolhedor)
    {
        const config = {
            onboardingSessoes: {
                '5511999990002': {
                    id: 'onb_2',
                    clienteTelefone: '5511999990002',
                    clienteNome: 'João Souza',
                    status: 'DOCS_PARCIAIS',
                    estado: 'DOCS_PARCIAIS',
                    parcialDesde: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(), // 50h atrás
                    documentosPendentes: ['LAUDO_MEDICO', 'CNIS'],
                    documentosRecebidos: [{ tipo: 'RG_OU_CNH' }]
                }
            },
            dossiesClientes: {
                '5511999990002': {
                    id: 'dossie_2',
                    clienteTelefone: '5511999990002',
                    clienteNome: 'João Souza',
                    status: 'DOCS_PARCIAIS',
                    documentosPendentes: ['LAUDO_MEDICO', 'CNIS'],
                    documentos: [{ tipo: 'RG_OU_CNH' }]
                }
            },
            processos: {
                lista: [
                    {
                        id: 'proc_2',
                        telefoneCliente: '5511999990002',
                        tipo: 'Pré-Processual',
                        fase: 'Documentação Parcial',
                        linhaDoTempo: []
                    }
                ]
            }
        };

        const mensagensEnviadas = [];
        const rel = await verificarLembretesDossieParcial(config, {
            enviarMensagemWhatsApp: async (tel, msg) => {
                mensagensEnviadas.push({ tel, msg });
                return true;
            }
        });

        assert.strictEqual(rel.totalVerificados, 1, 'Deve verificar 1 sessão parcial');
        assert.strictEqual(rel.totalElegiveis, 1, 'Deve ser elegível após 50h (> 48h)');
        assert.strictEqual(rel.totalEnviados, 1, 'Deve registrar 1 envio');
        assert.strictEqual(mensagensEnviadas.length, 1, 'Deve disparar 1 mensagem WhatsApp');
        assert.strictEqual(mensagensEnviadas[0].tel, '5511999990002', 'Telefone deve coincidir');

        const msgTexto = mensagensEnviadas[0].msg;
        assert.ok(msgTexto.includes('João Souza'), 'Mensagem deve conter o nome do cliente');
        assert.ok(msgTexto.includes('Laudo medico, Cnis') || msgTexto.includes('LAUDO_MEDICO') || msgTexto.toLowerCase().includes('laudo'), 'Deve citar os documentos pendentes');
        assert.ok(!msgTexto.includes('{nome}'), 'Template deve ter interpolado {nome}');
        assert.ok(!msgTexto.includes('{documentos_pendentes}'), 'Template deve ter interpolado {documentos_pendentes}');

        const sessao = config.onboardingSessoes['5511999990002'];
        assert.ok(sessao.ultimoLembreteParcialEm, 'Deve registrar data do último lembrete');
        assert.strictEqual(sessao.lembretesParciaisEnviados, 1, 'Contador de lembretes deve ser 1');
        assert.ok(Array.isArray(sessao.historicoLembretes) && sessao.historicoLembretes.length === 1, 'Deve arquivar no histórico');

        const proc = config.processos.lista[0];
        assert.strictEqual(proc.linhaDoTempo.length, 1, 'Linha do tempo pré-processual deve registrar o lembrete');
        assert.ok(proc.linhaDoTempo[0].evento.includes('Lembrete automático de 48h'), 'Evento deve descrever o lembrete de 48h');

        console.log('  ✅ [PASSOU] 2. Dossiê com 50h (> 48h) envia lembrete amigável e atualiza linha do tempo');
    }

    // 3. Cenário: Não reenvia se já foi enviado nas últimas 48h (Anti-Spam)
    {
        const config = {
            onboardingSessoes: {
                '5511999990003': {
                    id: 'onb_3',
                    clienteTelefone: '5511999990003',
                    clienteNome: 'Carlos Eduardo',
                    status: 'DOCS_PARCIAIS',
                    parcialDesde: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(), // 96h atrás
                    ultimoLembreteParcialEm: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(), // Enviado 10h atrás
                    lembretesParciaisEnviados: 1,
                    documentosPendentes: ['CTPS']
                }
            },
            dossiesClientes: {},
            processos: { lista: [] }
        };

        const mensagensEnviadas = [];
        const rel = await verificarLembretesDossieParcial(config, {
            enviarMensagemWhatsApp: async (tel, msg) => {
                mensagensEnviadas.push({ tel, msg });
                return true;
            }
        });

        assert.strictEqual(rel.totalEnviados, 0, 'Não deve reenviar se o último lembrete foi há menos de 48h');
        assert.strictEqual(mensagensEnviadas.length, 0, 'Nenhum envio WhatsApp duplicado');
        console.log('  ✅ [PASSOU] 3. Blindagem anti-spam impede reenvio se lembrete foi enviado há menos de 48h');
    }

    // 4. Cenário: Contato na lista de contatos ignorados (não deve incomodar o cliente)
    {
        const config = {
            contatosIgnorados: ['5511999990004'],
            onboardingSessoes: {
                '5511999990004': {
                    id: 'onb_4',
                    clienteTelefone: '5511999990004',
                    clienteNome: 'Dr. Contato VIP',
                    status: 'DOCS_PARCIAIS',
                    parcialDesde: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 72h atrás
                    documentosPendentes: ['PROCURACAO']
                }
            },
            dossiesClientes: {},
            processos: { lista: [] }
        };

        const mensagensEnviadas = [];
        const rel = await verificarLembretesDossieParcial(config, {
            enviarMensagemWhatsApp: async (tel, msg) => {
                mensagensEnviadas.push({ tel, msg });
                return true;
            },
            isContactIgnored: (tel, cfg) => (cfg.contatosIgnorados || []).includes(tel)
        });

        assert.strictEqual(rel.totalEnviados, 0, 'Contatos ignorados não devem receber lembrete automático');
        assert.strictEqual(mensagensEnviadas.length, 0, 'Mensagem bloqueada antes do envio');
        console.log('  ✅ [PASSOU] 4. Contatos ignorados são blindados contra lembretes automáticos');
    }

    // 5. Cenário: Dossiê já CONSOLIDADO (documentação completa)
    {
        const config = {
            onboardingSessoes: {
                '5511999990005': {
                    id: 'onb_5',
                    clienteTelefone: '5511999990005',
                    clienteNome: 'Ana Paula',
                    status: 'CONSOLIDADO',
                    documentosPendentes: []
                }
            },
            dossiesClientes: {},
            processos: { lista: [] }
        };

        const mensagensEnviadas = [];
        const rel = await verificarLembretesDossieParcial(config, {
            enviarMensagemWhatsApp: async (tel, msg) => {
                mensagensEnviadas.push({ tel, msg });
                return true;
            }
        });

        assert.strictEqual(rel.totalVerificados, 0, 'Dossiê consolidado não é considerado parcial');
        assert.strictEqual(rel.totalEnviados, 0, 'Nenhum envio para dossiê já concluído');
        console.log('  ✅ [PASSOU] 5. Dossiês consolidados (completos) são ignorados');
    }

    // 6. Cenário: Disparo forçado (manual pelo botão do advogado na interface)
    {
        const config = {
            onboardingSessoes: {
                '5511999990006': {
                    id: 'onb_6',
                    clienteTelefone: '5511999990006',
                    clienteNome: 'Roberto Nunes',
                    status: 'DOCS_PARCIAIS',
                    parcialDesde: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // Apenas 5h atrás
                    documentosPendentes: ['COMPROVANTE_RENDA']
                }
            },
            dossiesClientes: {},
            processos: { lista: [] }
        };

        const mensagensEnviadas = [];
        const rel = await verificarLembretesDossieParcial(config, {
            forcarDisparo: true, // Disparo manual imediato
            enviarMensagemWhatsApp: async (tel, msg) => {
                mensagensEnviadas.push({ tel, msg });
                return true;
            }
        });

        assert.strictEqual(rel.totalEnviados, 1, 'Disparo forçado envia mesmo antes das 48h');
        assert.strictEqual(mensagensEnviadas.length, 1, '1 mensagem enviada sob demanda');
        assert.ok(mensagensEnviadas[0].msg.includes('Roberto Nunes'), 'Nome do cliente correto');
        console.log('  ✅ [PASSOU] 6. Disparo manual forçado pela interface funciona com sucesso');
    }

    console.log('\n=============================================================');
    console.log('📊 RESULTADO: 6/6 CENÁRIOS DE LEMBRETE DE 48H APROVADOS!');
    console.log('=============================================================\n');
}

executarTestesLembrete48h().catch(err => {
    console.error('❌ Falha nos testes de Lembrete 48h:', err);
    process.exit(1);
});
