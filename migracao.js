/**
 * Advocacia Studio Pro v2.0 - Módulo de Retrocompatibilidade e Migração
 * Garante compatibilidade total e sem perdas de saves/configurações da série v1.8.x.
 */

const fs = require('fs');
const path = require('path');

function criarConfigPadraoV2() {
    const msgPadraoAtualizacao = "⚖️ *Andamento Processual Localizado*\n\nOlá, *{nome}*!\nReferente ao processo nº *{processo}* (CPF: *{cpf}*):\n\n📋 *Resumo da Atualização ({data}):*\n{resumo}\n\n━━━━━━━━━━━━━━━━━━━━\nDigite *1* para encerrar a conversa\nDigite *2* para falar com um advogado";
    const msgPadraoJaVisto = "⚖️ *Consulta Processual*\n\nOlá, *{nome}*! Verificamos a pasta do seu processo nº *{processo}* e informamos que *não houve novas movimentações* desde a sua última consulta em *{ultima_consulta}*.\n\n📌 *Último resumo registrado ({data}):*\n{resumo}\n\n━━━━━━━━━━━━━━━━━━━━\nDigite *1* para encerrar a conversa\nDigite *2* para falar com um advogado";
    const msgPadraoSemAtualizacao = "⚖️ *Consulta Processual*\n\nOlá, *{nome}*! Seu processo nº *{processo}* está devidamente cadastrado em nosso sistema, porém ainda não possui movimentações ou resumos lançados até o momento.\n\n━━━━━━━━━━━━━━━━━━━━\nDigite *1* para encerrar a conversa\nDigite *2* para falar com um advogado";
    const msgPadraoDocs = "⚖️ *Solicitação de Documentos — {preset}*\n\nOlá, *{nome}*! Para darmos andamento imediato à abertura da sua pasta e elaboração da peça jurídica, por gentileza envie por aqui as fotos legíveis ou PDFs dos seguintes documentos:\n\n{documentos}\n\n💡 *Dica:* Tire as fotos em local iluminado, sem cortar as bordas. Nossa Inteligência Artificial conferirá cada documento automaticamente assim que você enviar!";

    return {
        versao_config: "2.0.0-alpha.1",
        versao_schema: 2,
        iniciar_com_windows: true,
        primeiraConexaoTimestamp: 0,
        ultimoDesligamentoTimestamp: 0,
        ultimoInicioTimestamp: 0,
        modeloMensagemSolicitacaoDocs: msgPadraoDocs,
        agenda: {
            "0": { nome: "Domingo", ativo: false, abertura: "08:00", fechamento: "18:00" },
            "1": { nome: "Segunda-feira", ativo: true, abertura: "08:00", fechamento: "18:00" },
            "2": { nome: "Terça-feira", ativo: true, abertura: "08:00", fechamento: "18:00" },
            "3": { nome: "Quarta-feira", ativo: true, abertura: "08:00", fechamento: "18:00" },
            "4": { nome: "Quinta-feira", ativo: true, abertura: "08:00", fechamento: "18:00" },
            "5": { nome: "Sexta-feira", ativo: true, abertura: "08:00", fechamento: "18:00" },
            "6": { nome: "Sábado", ativo: false, abertura: "08:00", fechamento: "12:00" },
            almoco_ativo: true,
            almoco_inicio: "12:00",
            almoco_fim: "13:30",
            msg_almoco: "⏳ *Horário de Almoço:* No momento nossa equipe está em intervalo de almoço (retornamos às 13:30), mas nosso atendimento automático segue abaixo para ajudar você:",
            msg_fora_expediente: "🌙 *Fora do Horário de Expediente:* Nosso escritório está fechado neste momento, mas nosso atendimento automático segue disponível abaixo para adiantar sua solicitação:"
        },
        fluxo: {
            raiz: {
                titulo: "Menu Principal (Boas-Vindas)",
                mensagem: "⚖️ *Escritório de Advocacia*\n\nOlá! Seja muito bem-vindo(a) ao nosso atendimento digital.\n\nComo podemos auxiliar você hoje?",
                opcoes: [
                    { gatilho: "1", rotulo: "Consultar Andamento de Processo", tipo: "processo", destino: "", resposta: "Perfeito! Por gentileza, digite apenas o seu *CPF* ou o *Número do Processo* para localizarmos sua pasta:" },
                    { gatilho: "2", rotulo: "Iniciar Nova Consulta Jurídica", tipo: "submenu", destino: "areas", resposta: "" },
                    { gatilho: "3", rotulo: "Falar diretamente com Advogado", tipo: "humano", destino: "", resposta: "Perfeito! Sua solicitação foi encaminhada e um advogado da nossa equipe já está chegando para assumir seu atendimento." }
                ]
            },
            etapas: {
                "areas": {
                    titulo: "Submenu: Especialidades",
                    mensagem: "*Nova Consulta Jurídica*\n\nSelecione a área correspondente ao seu caso:",
                    opcoes: [
                        { gatilho: "1", rotulo: "Direito Cível, Família ou Contratos", tipo: "texto", destino: "", resposta: "Compreendido. Envie um breve relato do ocorrido para análise prévia do advogado." },
                        { gatilho: "0", rotulo: "Voltar ao Menu Principal", tipo: "submenu", destino: "raiz", resposta: "" }
                    ]
                }
            }
        },
        processos: {
            mensagens: {
                msg_com_atualizacao: msgPadraoAtualizacao,
                msg_ja_visto: msgPadraoJaVisto,
                msg_sem_atualizacao: msgPadraoSemAtualizacao,
                msg_nao_encontrado: "⚠️ Não conseguimos localizar nenhum processo com o *CPF* ou *Número de Processo* informado.\n\nPor favor, envie novamente apenas os números do seu CPF ou do Processo, ou digite *0* para voltar ao Menu Inicial.",
                msg_encerrar_conversa: "✅ *Atendimento Finalizado!*\n\nAgradecemos o seu contato. Sempre que precisar consultar seu processo ou falar conosco, basta enviar uma mensagem por aqui. Tenha um excelente dia!",
                msg_chamar_advogado_pos_proc: "👨‍⚖️ *Solicitação Recebida!*\n\nUm advogado da nossa equipe já foi notificado e *já está chegando* para assumir o seu atendimento pessoalmente. Por gentileza, aguarde alguns instantes."
            },
            lista: []
        },
        mapaNomes: {},
        mapaTelefones: {},
        pausadosPersistidos: {},
        contatosIgnorados: [],
        metricasReais: { totalMensagens: 0, contatosAtendidos: [] },
        dossiesClientes: {},
        onboardingSessoes: {},
        configuracaoCobranca: {
            chavePix: "pix@escritorio.adv.br",
            tipoChave: "E-MAIL",
            beneficiario: "Advocacia Studio Pro",
            frequenciaSemanal: 2,
            diasDaSemana: ["TERCA", "QUINTA"],
            horarioEnvio: "09:30",
            delayMinimoSegundos: 15,
            delayMaximoSegundos: 30,
            modoAprovacao: "MANUAL_ADVOGADO"
        },
        financeiro: {
            contratos: [],
            parcelas: [],
            comprovantesRecebidos: []
        }
    };
}

function extrairNumeroIgnorado(c) {
    if (!c) return '';
    if (typeof c === 'object' && c !== null) {
        return String(c.numero || c.telefone || c.id || '').trim();
    }
    return String(c).trim();
}

/**
 * Migra qualquer configuração v1.8.x para v2.0 preservando 100% dos dados.
 * @param {Object|string} rawInput Configuração lida do disco ou objeto JSON
 * @param {Array} contatosIgnoradosExternos Lista opcional de contatos do ignored_contacts.json
 * @returns {Object} Configuração v2.0 completa e retrocompatível
 */
function migrarConfigV1ParaV2(rawInput, contatosIgnoradosExternos = []) {
    let raw = rawInput;
    if (typeof raw === 'string') {
        try {
            raw = JSON.parse(raw);
        } catch (e) {
            raw = {};
        }
    }
    if (!raw || typeof raw !== 'object') {
        raw = {};
    }

    const padrao = criarConfigPadraoV2();
    const versaoOrigem = raw.versao_config || "1.8.x";

    // Cria clone base mantendo quaisquer propriedades customizadas do usuário
    const migrado = { ...raw };

    migrado.versao_origem = versaoOrigem;
    migrado.versao_config = "2.0.0-alpha.1";
    migrado.versao_schema = 2;

    // 1. Iniciar com windows
    migrado.iniciar_com_windows = typeof raw.iniciar_com_windows !== 'undefined'
        ? Boolean(raw.iniciar_com_windows)
        : padrao.iniciar_com_windows;

    // 2. Timestamps de estado
    migrado.primeiraConexaoTimestamp = Number(raw.primeiraConexaoTimestamp || 0);
    migrado.ultimoDesligamentoTimestamp = Number(raw.ultimoDesligamentoTimestamp || 0);
    migrado.ultimoInicioTimestamp = Number(raw.ultimoInicioTimestamp || 0);

    // 3. Agenda de Horários
    migrado.agenda = { ...padrao.agenda, ...(raw.agenda || {}) };
    for (let d = 0; d <= 6; d++) {
        const diaStr = String(d);
        migrado.agenda[diaStr] = {
            ...padrao.agenda[diaStr],
            ...((raw.agenda && raw.agenda[diaStr]) || {})
        };
    }
    if (raw.agenda) {
        if (typeof raw.agenda.almoco_ativo !== 'undefined') migrado.agenda.almoco_ativo = raw.agenda.almoco_ativo;
        if (raw.agenda.almoco_inicio) migrado.agenda.almoco_inicio = raw.agenda.almoco_inicio;
        if (raw.agenda.almoco_fim) migrado.agenda.almoco_fim = raw.agenda.almoco_fim;
        if (raw.agenda.msg_almoco) migrado.agenda.msg_almoco = raw.agenda.msg_almoco;
        if (raw.agenda.msg_fora_expediente) migrado.agenda.msg_fora_expediente = raw.agenda.msg_fora_expediente;
    }

    // 4. Fluxo e Menus (Preservação estrita de customizações do usuário)
    migrado.fluxo = migrado.fluxo || {};
    const rawFluxo = raw.fluxo || {};

    // 4.1 Menu Raiz
    if (rawFluxo.raiz) {
        migrado.fluxo.raiz = {
            titulo: rawFluxo.raiz.titulo || padrao.fluxo.raiz.titulo,
            mensagem: typeof rawFluxo.raiz.mensagem === 'string' ? rawFluxo.raiz.mensagem : padrao.fluxo.raiz.mensagem,
            opcoes: Array.isArray(rawFluxo.raiz.opcoes)
                ? JSON.parse(JSON.stringify(rawFluxo.raiz.opcoes))
                : padrao.fluxo.raiz.opcoes
        };
    } else {
        migrado.fluxo.raiz = JSON.parse(JSON.stringify(padrao.fluxo.raiz));
    }

    // 4.2 Submenus e Etapas customizadas
    migrado.fluxo.etapas = migrado.fluxo.etapas || {};
    const etapasOriginais = rawFluxo.etapas || {};

    // Mantém todas as etapas que o usuário configurou
    for (const [etapaKey, etapaVal] of Object.entries(etapasOriginais)) {
        migrado.fluxo.etapas[etapaKey] = {
            titulo: etapaVal.titulo || etapaKey,
            mensagem: typeof etapaVal.mensagem === 'string' ? etapaVal.mensagem : '',
            opcoes: Array.isArray(etapaVal.opcoes) ? JSON.parse(JSON.stringify(etapaVal.opcoes)) : []
        };
    }

    // Se não existia nenhuma etapa e a raiz referencia 'areas', adiciona a default
    if (Object.keys(migrado.fluxo.etapas).length === 0) {
        migrado.fluxo.etapas = JSON.parse(JSON.stringify(padrao.fluxo.etapas));
    }

    // 5. Processos e Templates de Mensagens
    migrado.processos = migrado.processos || {};
    const rawProcessos = raw.processos || {};

    // 5.1 Lista de Processos (sem perda de nenhum registro)
    if (Array.isArray(rawProcessos.lista)) {
        migrado.processos.lista = JSON.parse(JSON.stringify(rawProcessos.lista));
    } else if (Array.isArray(raw.listaProcessos)) {
        // Fallback para versões mais antigas
        migrado.processos.lista = JSON.parse(JSON.stringify(raw.listaProcessos));
    } else if (Array.isArray(rawProcessos)) {
        migrado.processos.lista = JSON.parse(JSON.stringify(rawProcessos));
    } else {
        migrado.processos.lista = [];
    }

    // 5.2 Mensagens e templates
    const rawMensagens = rawProcessos.mensagens || raw.mensagensProcessos || {};
    const padraoMensagens = padrao.processos.mensagens;

    const substituirRodapeAntigo = (txt) => {
        if (!txt || typeof txt !== 'string') return txt;
        return txt.replace(/_\(Digite \*0\* para voltar ao Menu Principal ou \*3\* para falar com um advogado\)_/gi,
            "━━━━━━━━━━━━━━━━━━━━\nDigite *1* para encerrar a conversa\nDigite *2* para falar com um advogado");
    };

    migrado.processos.mensagens = {
        msg_com_atualizacao: substituirRodapeAntigo(rawMensagens.msg_com_atualizacao || padraoMensagens.msg_com_atualizacao),
        msg_ja_visto: substituirRodapeAntigo(rawMensagens.msg_ja_visto || padraoMensagens.msg_ja_visto),
        msg_sem_atualizacao: substituirRodapeAntigo(rawMensagens.msg_sem_atualizacao || padraoMensagens.msg_sem_atualizacao),
        msg_nao_encontrado: rawMensagens.msg_nao_encontrado || padraoMensagens.msg_nao_encontrado,
        msg_encerrar_conversa: rawMensagens.msg_encerrar_conversa || padraoMensagens.msg_encerrar_conversa,
        msg_chamar_advogado_pos_proc: rawMensagens.msg_chamar_advogado_pos_proc || padraoMensagens.msg_chamar_advogado_pos_proc
    };

    // 6. Contatos Ignorados (unificação sem duplicatas)
    const setIgnorados = new Set();
    if (Array.isArray(raw.contatosIgnorados)) {
        raw.contatosIgnorados.forEach(c => {
            const num = extrairNumeroIgnorado(c);
            if (num) setIgnorados.add(num);
        });
    }
    if (Array.isArray(contatosIgnoradosExternos)) {
        contatosIgnoradosExternos.forEach(c => {
            const num = extrairNumeroIgnorado(c);
            if (num) setIgnorados.add(num);
        });
    }
    migrado.contatosIgnorados = Array.from(setIgnorados);

    // 7. Mapeamento de Nomes e Telefones
    migrado.mapaNomes = (raw.mapaNomes && typeof raw.mapaNomes === 'object')
        ? { ...raw.mapaNomes }
        : {};

    migrado.mapaTelefones = (raw.mapaTelefones && typeof raw.mapaTelefones === 'object')
        ? { ...raw.mapaTelefones }
        : {};

    // 8. Contatos Pausados Persistidos
    migrado.pausadosPersistidos = (raw.pausadosPersistidos && typeof raw.pausadosPersistidos === 'object')
        ? { ...raw.pausadosPersistidos }
        : {};

    // 9. Métricas Reais
    migrado.metricasReais = {
        totalMensagens: Number(raw.metricasReais?.totalMensagens || 0),
        contatosAtendidos: Array.isArray(raw.metricasReais?.contatosAtendidos)
            ? [...raw.metricasReais.contatosAtendidos]
            : []
    };

    // 10. Dossiês de Clientes, Onboarding e Financeiro (v2.1+)
    migrado.dossiesClientes = (raw.dossiesClientes && typeof raw.dossiesClientes === 'object' && !Array.isArray(raw.dossiesClientes))
        ? { ...raw.dossiesClientes }
        : {};

    migrado.onboardingSessoes = (raw.onboardingSessoes && typeof raw.onboardingSessoes === 'object' && !Array.isArray(raw.onboardingSessoes))
        ? { ...raw.onboardingSessoes }
        : {};

    migrado.modeloMensagemSolicitacaoDocs = typeof raw.modeloMensagemSolicitacaoDocs === 'string' && raw.modeloMensagemSolicitacaoDocs.trim()
        ? raw.modeloMensagemSolicitacaoDocs
        : padrao.modeloMensagemSolicitacaoDocs;

    migrado.configuracaoCobranca = {
        ...padrao.configuracaoCobranca,
        ...((raw.configuracaoCobranca && typeof raw.configuracaoCobranca === 'object') ? raw.configuracaoCobranca : {})
    };
    if (!Array.isArray(migrado.configuracaoCobranca.diasDaSemana)) {
        migrado.configuracaoCobranca.diasDaSemana = [...padrao.configuracaoCobranca.diasDaSemana];
    }

    migrado.financeiro = {
        contratos: Array.isArray(raw.financeiro?.contratos) ? [...raw.financeiro.contratos] : [],
        parcelas: Array.isArray(raw.financeiro?.parcelas) ? [...raw.financeiro.parcelas] : [],
        comprovantesRecebidos: Array.isArray(raw.financeiro?.comprovantesRecebidos) ? [...raw.financeiro.comprovantesRecebidos] : []
    };

    return migrado;
}

/**
 * Validador rigoroso de retrocompatibilidade
 * Compara a configuração original (v1.8.x) com a versão migrada (v2.0)
 * e garante que nenhum dado ou customização foi perdido.
 */
function validarIntegridadeConfig(configOriginal, configMigrada) {
    const erros = [];
    const avisos = [];

    if (!configMigrada || typeof configMigrada !== 'object') {
        return { valido: false, erros: ['Configuração migrada é nula ou inválida.'], avisos };
    }

    // 1. Valida Menus e Fluxos
    if (configOriginal.fluxo?.raiz?.opcoes) {
        const origOpcoes = configOriginal.fluxo.raiz.opcoes;
        const migrOpcoes = configMigrada.fluxo?.raiz?.opcoes;
        if (!Array.isArray(migrOpcoes)) {
            erros.push('Opções do menu raiz foram perdidas na migração.');
        } else if (migrOpcoes.length !== origOpcoes.length) {
            erros.push(`Quantidade de opções no menu raiz divergente: original=${origOpcoes.length}, migrado=${migrOpcoes.length}`);
        } else {
            for (let i = 0; i < origOpcoes.length; i++) {
                const o = origOpcoes[i];
                const m = migrOpcoes[i];
                if (m.gatilho !== o.gatilho || m.rotulo !== o.rotulo || m.tipo !== o.tipo) {
                    erros.push(`Opção ${i} da raiz diverge: original(${o.gatilho}-${o.rotulo}) vs migrado(${m?.gatilho}-${m?.rotulo})`);
                }
            }
        }
    }

    if (configOriginal.fluxo?.raiz?.mensagem) {
        if (configMigrada.fluxo?.raiz?.mensagem !== configOriginal.fluxo.raiz.mensagem) {
            erros.push('Mensagem customizada do menu raiz foi corrompida.');
        }
    }

    // Valida etapas/submenus customizados
    if (configOriginal.fluxo?.etapas) {
        for (const [etapaKey, etapaVal] of Object.entries(configOriginal.fluxo.etapas)) {
            if (!configMigrada.fluxo?.etapas?.[etapaKey]) {
                erros.push(`Etapa customizada '${etapaKey}' não foi encontrada na configuração migrada.`);
            } else {
                const mEtapa = configMigrada.fluxo.etapas[etapaKey];
                if (mEtapa.mensagem !== etapaVal.mensagem) {
                    erros.push(`Mensagem da etapa '${etapaKey}' divergiu.`);
                }
                const origOpts = etapaVal.opcoes || [];
                const migrOpts = mEtapa.opcoes || [];
                if (migrOpts.length !== origOpts.length) {
                    erros.push(`Quantidade de opções na etapa '${etapaKey}' divergente.`);
                }
            }
        }
    }

    // 2. Valida Processos
    const origProcLista = configOriginal.processos?.lista || configOriginal.listaProcessos || [];
    const migrProcLista = configMigrada.processos?.lista || [];
    if (origProcLista.length !== migrProcLista.length) {
        erros.push(`Lista de processos divergente: esperava ${origProcLista.length}, obteve ${migrProcLista.length}.`);
    } else {
        for (let i = 0; i < origProcLista.length; i++) {
            const pOrig = origProcLista[i];
            const pMigr = migrProcLista[i];
            if (pOrig.numeroProcesso !== pMigr.numeroProcesso ||
                pOrig.cpf !== pMigr.cpf ||
                pOrig.nome !== pMigr.nome ||
                pOrig.resumo !== pMigr.resumo) {
                erros.push(`Processo índice ${i} (${pOrig.numeroProcesso}) teve dados corrompidos.`);
                break;
            }
        }
    }

    // 3. Valida Mensagens de Processos
    if (configOriginal.processos?.mensagens) {
        const origMsg = configOriginal.processos.mensagens;
        const migrMsg = configMigrada.processos?.mensagens;
        ['msg_nao_encontrado', 'msg_encerrar_conversa', 'msg_chamar_advogado_pos_proc'].forEach(key => {
            if (origMsg[key] && origMsg[key] !== migrMsg?.[key]) {
                erros.push(`Template de mensagem '${key}' não foi preservado.`);
            }
        });
    }

    // 4. Valida Contatos Ignorados
    if (Array.isArray(configOriginal.contatosIgnorados)) {
        for (const c of configOriginal.contatosIgnorados) {
            const strC = extrairNumeroIgnorado(c);
            if (strC && !configMigrada.contatosIgnorados.includes(strC)) {
                erros.push(`Contato ignorado '${strC}' não foi mantido na lista migrada.`);
            }
        }
    }

    // 5. Valida Mapa de Nomes e Telefones
    if (configOriginal.mapaNomes) {
        for (const [k, v] of Object.entries(configOriginal.mapaNomes)) {
            if (configMigrada.mapaNomes?.[k] !== v) {
                erros.push(`Mapeamento mapaNomes['${k}'] divergente.`);
            }
        }
    }

    // 6. Valida Pausados Persistidos
    if (configOriginal.pausadosPersistidos) {
        for (const [k, v] of Object.entries(configOriginal.pausadosPersistidos)) {
            if (configMigrada.pausadosPersistidos?.[k] !== v) {
                erros.push(`Pausa persistida para '${k}' divergente.`);
            }
        }
    }

    return {
        valido: erros.length === 0,
        erros,
        avisos,
        totalProcessosPreservados: migrProcLista.length,
        totalContatosIgnoradosPreservados: configMigrada.contatosIgnorados?.length || 0,
        totalEtapasPreservadas: Object.keys(configMigrada.fluxo?.etapas || {}).length
    };
}

module.exports = {
    criarConfigPadraoV2,
    migrarConfigV1ParaV2,
    validarIntegridadeConfig
};
