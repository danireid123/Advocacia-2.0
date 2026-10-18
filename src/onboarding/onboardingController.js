/**
 * =========================================================================
 * ADVOCACIA STUDIO PRO v2.0 - CONTROLADOR DE ONBOARDING FORENSE & DOSSIÊ
 * =========================================================================
 * Gerencia a máquina de estados de coleta de documentos no WhatsApp
 * (DOCS_SOLICITADOS -> DOCS_PARCIAIS -> CONSOLIDADO), presets por área
 * jurídica, auditoria multimodal, consolidação do Dossiê do Cliente e
 * abertura automática de Caso Pré-Processual.
 */

const { auditarDocumentoMultimodal } = require('../documentos/validadorDocumentos');
const { salvarDocumentoCliente } = require('../documentos/armazenamentoDocs');
const { gerarQualificacaoCPC } = require('./formatadorCPC');

const PRESETS_ONBOARDING = {
    Trabalhista: {
        id: 'Trabalhista',
        rotulo: '⚖️ Direito Trabalhista',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA', 'CTPS', 'TERMO_RESCISAO'],
        descricoes: [
            'RG ou CNH (frente e verso nítidos)',
            'Comprovante de Residência atualizado (com CEP)',
            'Carteira de Trabalho (CTPS física ou PDF Digital)',
            'Termo de Rescisão (TRCT) ou últimos 3 Holerites'
        ]
    },
    Previdenciario: {
        id: 'Previdenciario',
        rotulo: '🏛️ Direito Previdenciário (INSS)',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA', 'LAUDO_MEDICO', 'CNIS'],
        descricoes: [
            'RG ou CNH (frente e verso nítidos)',
            'Comprovante de Residência atualizado',
            'Laudos, Exames e Receitas Médicas recentes',
            'Extrato Previdenciário (CNIS do Meu INSS)'
        ]
    },
    Civel: {
        id: 'Civel',
        rotulo: '📋 Direito Cível / Consumidor',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA', 'CONTRATO_COMPROVANTE'],
        descricoes: [
            'RG ou CNH (frente e verso nítidos)',
            'Comprovante de Residência atualizado',
            'Contrato, Nota Fiscal ou Comprovante do Negócio / Dano'
        ]
    },
    Familia: {
        id: 'Familia',
        rotulo: '👨‍👩‍👧 Direito de Família & Sucessões',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA', 'CERTIDAO'],
        descricoes: [
            'RG ou CNH (frente e verso nítidos)',
            'Comprovante de Residência atualizado',
            'Certidão de Casamento ou Nascimento dos envolvidos'
        ]
    },
    Geral: {
        id: 'Geral',
        rotulo: '📁 Kit Geral de Qualificação Civil',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA'],
        descricoes: [
            'RG ou CNH (frente e verso nítidos)',
            'Comprovante de Residência recente com CEP'
        ]
    }
};

function normalizarPresetKey(presetTipo) {
    const p = String(presetTipo || 'Geral')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    if (p.includes('trab')) return 'Trabalhista';
    if (p.includes('prev') || p.includes('inss')) return 'Previdenciario';
    if (p.includes('civ') || p.includes('consum')) return 'Civel';
    if (p.includes('fam') || p.includes('divor')) return 'Familia';
    return 'Geral';
}

function garantirEstruturaOnboarding(config) {
    if (!config || typeof config !== 'object') return;
    if (!config.onboardingSessoes || typeof config.onboardingSessoes !== 'object') {
        config.onboardingSessoes = {};
    }
    if (!config.dossiesClientes || typeof config.dossiesClientes !== 'object') {
        config.dossiesClientes = {};
    }
    if (!config.processos || typeof config.processos !== 'object') {
        config.processos = { mensagens: {}, lista: [] };
    }
    if (!Array.isArray(config.processos.lista)) {
        config.processos.lista = [];
    }
}

function documentoSatisfazItem(tipoDetectado, itemPendente) {
    const t = String(tipoDetectado || '').toUpperCase();
    const p = String(itemPendente || '').toUpperCase();
    if (!t || !p) return false;
    if (t === p) return true;
    if (p === 'RG_OU_CNH' && (t.includes('RG') || t.includes('CNH'))) return true;
    if (p.includes('COMPROVANTE') && t.includes('COMPROVANTE')) return true;
    if (p.includes('CTPS') && (t.includes('CTPS') || t.includes('CARTEIRA'))) return true;
    if (p.includes('CERTIDAO') && t.includes('CERTIDAO')) return true;
    if (p.includes('CONTRATO') && (t.includes('CONTRATO') || t.includes('COMPROVANTE'))) return true;
    return false;
}

/**
 * Inicia uma sessão de coleta de documentos para o cliente no WhatsApp.
 */
function iniciarSessaoOnboarding(clienteTelefone, clienteNome, presetTipo = 'Geral', config = {}, opcoes = {}) {
    garantirEstruturaOnboarding(config);
    const chaveTel = String(clienteTelefone || '').trim();
    const keyPreset = normalizarPresetKey(presetTipo);
    const preset = PRESETS_ONBOARDING[keyPreset] || PRESETS_ONBOARDING.Geral;
    const nomeLimpo = String(clienteNome || 'Cliente').trim();

    let mensagemCustomizada = '';
    let itensPersonalizados = null;
    if (typeof opcoes === 'string') {
        mensagemCustomizada = opcoes;
    } else if (Array.isArray(opcoes)) {
        itensPersonalizados = opcoes;
    } else if (opcoes && typeof opcoes === 'object') {
        mensagemCustomizada = opcoes.mensagemPersonalizada || opcoes.mensagem || '';
        itensPersonalizados = opcoes.itensPersonalizados || null;
    }

    const descricoes = (itensPersonalizados && itensPersonalizados.length > 0)
        ? itensPersonalizados
        : preset.descricoes;
    const listaTexto = descricoes.map((d, idx) => `${idx + 1}. 📄 *${d}*`).join('\n');

    const templatePadrao = (config && typeof config.modeloMensagemSolicitacaoDocs === 'string' && config.modeloMensagemSolicitacaoDocs.trim())
        ? config.modeloMensagemSolicitacaoDocs
        : (
            `⚖️ *Solicitação de Documentos — {preset}*\n\n` +
            `Olá, *{nome}*! Para darmos andamento imediato à abertura da sua pasta e elaboração da peça jurídica, por gentileza envie por aqui as fotos legíveis ou PDFs dos seguintes documentos:\n\n` +
            `{documentos}\n\n` +
            `💡 *Dica:* Tire as fotos em local iluminado, sem cortar as bordas. Nossa Inteligência Artificial conferirá cada documento automaticamente assim que você enviar!`
        );

    const baseTexto = (mensagemCustomizada && mensagemCustomizada.trim())
        ? mensagemCustomizada
        : templatePadrao;

    const mensagemSolicitacaoWhatsApp = baseTexto
        .replace(/\{nome\}/gi, nomeLimpo)
        .replace(/\{preset\}/gi, preset.rotulo || keyPreset)
        .replace(/\{documentos\}/gi, listaTexto);

    const sessao = {
        id: `onb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clienteTelefone: chaveTel,
        clienteNome: nomeLimpo,
        preset: keyPreset,
        presetRotulo: preset.rotulo,
        status: 'DOCS_SOLICITADOS',
        estado: 'DOCS_SOLICITADOS',
        documentosSolicitados: [...preset.documentos],
        documentosPendentes: [...preset.documentos],
        itensSolicitados: [...preset.documentos],
        itensPendentes: [...preset.documentos],
        documentosRecebidos: [],
        qualificacaoAcumulada: {
            nomeCompleto: nomeLimpo
        },
        mensagemDisparo: mensagemSolicitacaoWhatsApp,
        mensagemSolicitacaoWhatsApp: mensagemSolicitacaoWhatsApp,
        iniciadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };

    config.onboardingSessoes[chaveTel] = sessao;
    const digitos = chaveTel.replace(/\D/g, '');
    if (digitos && digitos !== chaveTel) {
        config.onboardingSessoes[digitos] = sessao;
    }
    return sessao;
}

function obterSessaoAtiva(clienteTelefone, config = {}) {
    garantirEstruturaOnboarding(config);
    if (!config || !config.onboardingSessoes) return null;
    const raw = String(clienteTelefone || '').trim();
    const digitos = raw.replace(/\D/g, '');

    if (config.onboardingSessoes[raw] && config.onboardingSessoes[raw].status !== 'CONSOLIDADO') {
        return config.onboardingSessoes[raw];
    }
    if (digitos && config.onboardingSessoes[digitos] && config.onboardingSessoes[digitos].status !== 'CONSOLIDADO') {
        return config.onboardingSessoes[digitos];
    }
    for (const [k, sessao] of Object.entries(config.onboardingSessoes)) {
        if (!sessao || sessao.status === 'CONSOLIDADO') continue;
        const kDig = k.replace(/\D/g, '');
        if (digitos && kDig && (kDig === digitos || kDig.endsWith(digitos) || digitos.endsWith(kDig))) {
            return sessao;
        }
    }
    return null;
}

/**
 * Processa uma imagem ou PDF enviado pelo cliente durante o onboarding.
 * Suporta tanto chamada posicional quanto chamada com objeto de payload.
 */
async function processarMidiaOnboarding(clienteTelefoneOuPayload, bufferArg, mimetypeArg, apiKeyArg, configArg = {}) {
    let clienteTelefone, buffer, mimetype, apiKey, config;
    let clienteNome = 'Cliente';

    if (typeof clienteTelefoneOuPayload === 'object' && !Buffer.isBuffer(clienteTelefoneOuPayload)) {
        config = bufferArg || configArg || {};
        clienteTelefone = clienteTelefoneOuPayload.clienteTelefone || clienteTelefoneOuPayload.telefone || '';
        clienteNome = clienteTelefoneOuPayload.clienteNome || clienteTelefoneOuPayload.nome || 'Cliente';
        buffer = clienteTelefoneOuPayload.buffer;
        mimetype = clienteTelefoneOuPayload.mimetype || clienteTelefoneOuPayload.mimeType || 'image/jpeg';
        apiKey = clienteTelefoneOuPayload.apiKey;
    } else {
        clienteTelefone = clienteTelefoneOuPayload;
        buffer = bufferArg;
        mimetype = mimetypeArg;
        apiKey = apiKeyArg;
        config = configArg || {};
    }

    garantirEstruturaOnboarding(config);
    const chaveTel = String(clienteTelefone || '').trim();
    let sessao = obterSessaoAtiva(chaveTel, config);

    if (!sessao) {
        sessao = iniciarSessaoOnboarding(chaveTel, clienteNome, 'Geral', config);
    }

    const itensEsperados = sessao.documentosPendentes || sessao.itensPendentes || ['RG_OU_CNH'];
    const laudo = await auditarDocumentoMultimodal(buffer, mimetype, apiKey, itensEsperados);

    if (!laudo.legivel) {
        sessao.atualizadoEm = new Date().toISOString();
        return {
            sucesso: false,
            legivel: false,
            statusSessao: sessao.status,
            laudo,
            sessao,
            mensagemFeedbackWhatsApp: laudo.mensagemFeedbackWhatsApp
        };
    }

    // Salva documento validado fisicamente
    const ext = String(mimetype || '').includes('pdf') ? 'pdf' : 'jpg';
    const nomeArquivo = `${laudo.tipoDocumento || 'DOC'}_${Date.now()}.${ext}`;
    const arquivoSalvo = salvarDocumentoCliente(chaveTel, nomeArquivo, buffer, laudo);

    const docRegistrado = {
        id: arquivoSalvo.idDocumento,
        tipo: laudo.tipoDocumento || 'DOCUMENTO',
        tipoRotulo: laudo.tipoRotulo || laudo.tipoDocumento || 'Documento Validado',
        nomeArquivo: nomeArquivo,
        caminhoRelativo: arquivoSalvo.caminhoRelativo,
        caminhoAbsoluto: arquivoSalvo.caminhoAbsoluto,
        mimetype: mimetype || 'image/jpeg',
        tamanhoBytes: arquivoSalvo.tamanhoBytes,
        validado: true,
        legivel: true,
        confiancaScore: laudo.confiancaScore,
        defeitos: laudo.defeitos || [],
        dados: laudo.dadosExtraidos || {},
        dataEnvio: new Date().toISOString()
    };

    if (!Array.isArray(sessao.documentosRecebidos)) sessao.documentosRecebidos = [];
    sessao.documentosRecebidos.push(docRegistrado);

    // Mescla dados cadastrais extraídos
    const extraidos = laudo.dadosExtraidos || {};
    sessao.qualificacaoAcumulada = {
        ...sessao.qualificacaoAcumulada,
        ...(extraidos.nomeCompleto ? { nomeCompleto: extraidos.nomeCompleto } : {}),
        ...(extraidos.cpf ? { cpf: extraidos.cpf } : {}),
        ...(extraidos.rg ? { rg: extraidos.rg } : {}),
        ...(extraidos.rgOrgaoEmissor ? { rgOrgaoEmissor: extraidos.rgOrgaoEmissor } : {}),
        ...(extraidos.filiacaoMae ? { filiacaoMae: extraidos.filiacaoMae } : {}),
        ...(extraidos.filiacaoPai ? { filiacaoPai: extraidos.filiacaoPai } : {}),
        ...(extraidos.dataNascimento ? { dataNascimento: extraidos.dataNascimento } : {}),
        ...(extraidos.endereco && Object.keys(extraidos.endereco).length > 0 ? { endereco: { ...(sessao.qualificacaoAcumulada?.endereco || {}), ...extraidos.endereco } } : {})
    };

    // Atualiza lista de pendentes
    let removeu = false;
    sessao.documentosPendentes = (sessao.documentosPendentes || []).filter(item => {
        if (!removeu && documentoSatisfazItem(laudo.tipoDocumento, item)) {
            removeu = true;
            return false;
        }
        return true;
    });
    if (!removeu && sessao.documentosPendentes.length > 0) {
        sessao.documentosPendentes.shift();
    }
    sessao.itensPendentes = [...sessao.documentosPendentes];
    sessao.atualizadoEm = new Date().toISOString();

    let dossieConsolidado = null;
    let msgFeedback = laudo.mensagemFeedbackWhatsApp;

    if (sessao.documentosPendentes.length === 0) {
        sessao.status = 'CONSOLIDADO';
        sessao.estado = 'CONSOLIDADO';
        dossieConsolidado = consolidarDossie(chaveTel, config);
        msgFeedback = `${laudo.mensagemFeedbackWhatsApp}\n\n🎉 *Documentação Completa!* Todos os documentos solicitados foram validados e sua pasta já foi encaminhada ao advogado responsável.`;
    } else {
        sessao.status = 'DOCS_PARCIAIS';
        sessao.estado = 'DOCS_PARCIAIS';
        msgFeedback = `${laudo.mensagemFeedbackWhatsApp}\n\n📋 *Ainda faltam (${sessao.documentosPendentes.length}):* ${sessao.documentosPendentes.join(', ')}.`;
    }

    return {
        sucesso: true,
        legivel: true,
        statusSessao: sessao.status,
        laudo,
        documentoSalvo: docRegistrado,
        sessao,
        dossieConsolidado,
        mensagemFeedbackWhatsApp: msgFeedback
    };
}

/**
 * Consolida os dados e documentos da sessão no Dossiê permanente do cliente
 * e cria automaticamente o registro Pré-Processual na aba de Processos.
 */
function consolidarDossie(clienteTelefone, config = {}) {
    garantirEstruturaOnboarding(config);
    const chaveTel = String(clienteTelefone || '').trim();
    const sessao = config.onboardingSessoes[chaveTel] || {};
    const existente = config.dossiesClientes[chaveTel] || {};

    const docsSessao = Array.isArray(sessao.documentosRecebidos) ? sessao.documentosRecebidos : [];
    let civilAcumulado = {
        ...(existente.civil || existente.qualificacao || {}),
        ...(sessao.qualificacaoAcumulada || {})
    };

    docsSessao.forEach(doc => {
        const d = doc.dados || doc.metadadosExtraidos || {};
        if (d.nomeCompleto) civilAcumulado.nomeCompleto = d.nomeCompleto;
        if (d.cpf) civilAcumulado.cpf = d.cpf;
        if (d.rg) civilAcumulado.rg = d.rg;
        if (d.rgOrgaoEmissor) civilAcumulado.rgOrgaoEmissor = d.rgOrgaoEmissor;
        if (d.filiacaoMae) civilAcumulado.filiacaoMae = d.filiacaoMae;
        if (d.filiacaoPai) civilAcumulado.filiacaoPai = d.filiacaoPai;
        if (d.dataNascimento) civilAcumulado.dataNascimento = d.dataNascimento;
        if (d.endereco) civilAcumulado.endereco = { ...(civilAcumulado.endereco || {}), ...d.endereco };
    });

    const nomeFinal = civilAcumulado.nomeCompleto || sessao.clienteNome || existente.clienteNome || 'Cliente';
    civilAcumulado.nomeCompleto = nomeFinal;

    const textoQualificacaoCPC = gerarQualificacaoCPC(civilAcumulado);
    const todosDocumentos = [
        ...(Array.isArray(existente.documentos) ? existente.documentos : []),
        ...docsSessao
    ];

    const dossie = {
        id: existente.id || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        clienteTelefone: chaveTel,
        telefone: chaveTel,
        clienteNome: nomeFinal,
        nome: nomeFinal,
        cpf: civilAcumulado.cpf || '',
        rg: civilAcumulado.rg || '',
        rgOrgaoEmissor: civilAcumulado.rgOrgaoEmissor || 'SSP',
        area: sessao.preset || existente.area || 'Geral',
        status: 'CONSOLIDADO',
        civil: civilAcumulado,
        qualificacao: civilAcumulado,
        qualificacaoCPC: textoQualificacaoCPC,
        documentos: todosDocumentos,
        atualizadoEm: new Date().toISOString(),
        criadoEm: existente.criadoEm || new Date().toISOString()
    };

    config.dossiesClientes[chaveTel] = dossie;
    if (config.onboardingSessoes[chaveTel]) {
        config.onboardingSessoes[chaveTel].status = 'CONSOLIDADO';
        config.onboardingSessoes[chaveTel].estado = 'CONSOLIDADO';
    }

    // Cria ou atualiza Caso Pré-Processual em config.processos.lista
    const cpfFinal = civilAcumulado.cpf || '';
    const jaExistePreProc = config.processos.lista.find(p =>
        (p.telefoneCliente && p.telefoneCliente === chaveTel && p.tipo === 'Pré-Processual') ||
        (cpfFinal && p.cpf === cpfFinal && p.tipo === 'Pré-Processual')
    );

    const provasNomes = todosDocumentos.map(d => d.tipoRotulo || d.tipo || d.arquivo || 'Documento Auditado');
    const agoraFormatado = new Date().toLocaleString('pt-BR');

    if (!jaExistePreProc) {
        const novoPreProc = {
            id: `preproc_${Date.now()}`,
            numero: `PRE-PROC-${new Date().getFullYear()}-${String(config.processos.lista.length + 1).padStart(3, '0')}`,
            numeroProcesso: `PRE-PROC-${new Date().getFullYear()}-${String(config.processos.lista.length + 1).padStart(3, '0')}`,
            nome: nomeFinal,
            cpf: cpfFinal,
            telefoneCliente: chaveTel,
            tipo: 'Pré-Processual',
            fase: 'Pré-Processual (Dossiê Consolidado)',
            area: dossie.area,
            temAtualizacao: true,
            dataAtualizacaoTexto: agoraFormatado,
            resumo: `Dossiê documental consolidado com ${todosDocumentos.length} documento(s) auditado(s) via IA. Qualificação civil pronta para elaboração da Petição Inicial.`,
            linhaDoTempo: [
                { data: agoraFormatado, evento: `Solicitação e conferência multimodal de documentos (${dossie.area}) concluída.` },
                { data: agoraFormatado, evento: `Qualificação civil Art. 319 CPC gerada automaticamente para ${nomeFinal}.` }
            ],
            provasAnexadas: provasNomes
        };
        config.processos.lista.unshift(novoPreProc);
    } else {
        jaExistePreProc.nome = nomeFinal;
        jaExistePreProc.cpf = cpfFinal || jaExistePreProc.cpf;
        jaExistePreProc.provasAnexadas = provasNomes;
        jaExistePreProc.dataAtualizacaoTexto = agoraFormatado;
    }

    return dossie;
}

function obterDossies(config = {}) {
    garantirEstruturaOnboarding(config);
    return config.dossiesClientes;
}

module.exports = {
    PRESETS_ONBOARDING,
    iniciarSessaoOnboarding,
    obterSessaoAtiva,
    processarMidiaOnboarding,
    consolidarDossie,
    obterDossies,
    garantirEstruturaOnboarding
};
