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
    PrevidenciarioRural: {
        id: 'PrevidenciarioRural',
        rotulo: '🌾 Aposentadoria Rural / Segurado Especial',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA', 'DOC_RURAL', 'AUTODECLARACAO_RURAL'],
        descricoes: [
            'RG ou CNH (frente e verso nítidos)',
            'Comprovante de Residência rural / domicílio',
            'Documentos da Terra (DAP/CAF, Bloco de Produtor, ITR ou INCRA)',
            'Autodeclaração Rural assinada ou Certidão de Casamento/Nascimento'
        ]
    },
    CriminalCustodia: {
        id: 'CriminalCustodia',
        rotulo: '🚨 Criminal — Flagrante & Custódia',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA', 'BO_OU_NOTA_CULPA', 'VINCULO_EMPREGO'],
        descricoes: [
            'RG ou CNH do preso/investigado (foto legível)',
            'Comprovante de Residência fixa recente',
            'Boletim de Ocorrência (B.O.) ou Nota de Culpa / Auto de Prisão',
            'Carteira de Trabalho (CTPS) ou Declaração de Emprego (comprovar vínculo)'
        ]
    },
    Civel: {
        id: 'Civel',
        rotulo: '📋 Direito Cível & Consumidor',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA', 'PROVA_CONTRATO_OU_DANO', 'PROTOCOLO_OU_BO'],
        descricoes: [
            'RG ou CNH (frente e verso nítidos)',
            'Comprovante de Residência atualizado',
            'Contrato, Fatura ou Prints da negociação / dano sofrido',
            'Protocolo de atendimento, reclamação no PROCON ou B.O.'
        ]
    },
    Familia: {
        id: 'Familia',
        rotulo: '👨‍👩‍👧 Direito de Família & Sucessões',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA', 'CERTIDAO_CIVIL', 'COMPROVANTE_RENDA'],
        descricoes: [
            'RG ou CNH (frente e verso nítidos)',
            'Comprovante de Residência atualizado',
            'Certidão de Casamento ou Nascimento dos filhos/envolvidos',
            'Comprovante de Renda ou Gastos (holerite, extrato ou IR)'
        ]
    },
    Imobiliario: {
        id: 'Imobiliario',
        rotulo: '🏠 Direito Imobiliário & Usucapião',
        documentos: ['RG_OU_CNH', 'COMPROVANTE_RESIDENCIA', 'MATRICULA_IMOVEL', 'COMPROVANTE_POSSE_OU_CONTRATO'],
        descricoes: [
            'RG ou CNH (frente e verso nítidos)',
            'Comprovante de Residência atualizado',
            'Matrícula atualizada do imóvel ou carnê do IPTU',
            'Contrato de compra e venda / locação ou comprovantes de posse'
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

    if (p.includes('rur') || p.includes('roca') || p.includes('campo')) return 'PrevidenciarioRural';
    if (p.includes('crim') || p.includes('flagr') || p.includes('preso') || p.includes('custod')) return 'CriminalCustodia';
    if (p.includes('trab')) return 'Trabalhista';
    if (p.includes('prev') || p.includes('inss')) return 'Previdenciario';
    if (p.includes('imob') || p.includes('usucap') || p.includes('imovel') || p.includes('matricula') || p.includes('locac')) return 'Imobiliario';
    if (p.includes('civ') || p.includes('consum')) return 'Civel';
    if (p.includes('fam') || p.includes('divor') || p.includes('sucess') || p.includes('invent') || p.includes('heranc')) return 'Familia';
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
    if (p === 'RG_OU_CNH' && (t.includes('RG') || t.includes('CNH') || t.includes('IDENTIDADE'))) return true;
    if (p === 'COMPROVANTE_RESIDENCIA') {
        return t === 'COMPROVANTE_RESIDENCIA' || t.includes('RESIDENCIA') || t.includes('ENDERECO') || t.includes('LUZ') || t.includes('AGUA') || t.includes('ENEL') || t.includes('SABESP');
    }
    if (p === 'CERTIDAO_CIVIL' && (t.includes('CERTIDAO') || t.includes('CASAMENTO') || t.includes('NASCIMENTO') || t.includes('OBITO'))) return true;
    if (p === 'COMPROVANTE_RENDA' && (t.includes('RENDA') || t.includes('HOLERITE') || t.includes('EXTRATO') || t.includes('IR') || t.includes('IMPOSTO') || t.includes('PAGAMENTO') || t.includes('CONTRACHEQUE') || t.includes('SALARIO'))) return true;
    if (p === 'PROVA_CONTRATO_OU_DANO' && (t.includes('CONTRATO') || t.includes('DANO') || t.includes('NOTA') || t.includes('FATURA') || t.includes('PRINT') || t.includes('RECIBO') || t.includes('COMPROVANTE'))) return true;
    if (p === 'PROTOCOLO_OU_BO' && (t.includes('PROTOCOLO') || t.includes('BO') || t.includes('BOLETIM') || t.includes('PROCON') || t.includes('SAC') || t.includes('RECLAMACAO') || t.includes('OCORRENCIA'))) return true;
    if (p === 'MATRICULA_IMOVEL' && (t.includes('MATRICULA') || t.includes('IMOVEL') || t.includes('IPTU') || t.includes('ESCRITURA') || t.includes('REGISTRO') || t.includes('CERTIDAO'))) return true;
    if (p === 'COMPROVANTE_POSSE_OU_CONTRATO' && (t.includes('POSSE') || t.includes('CONTRATO') || t.includes('LOCACAO') || t.includes('RECIBO') || t.includes('ENERGIA') || t.includes('AGUA') || t.includes('COMPROVANTE'))) return true;
    if (p.includes('COMPROVANTE') && t.includes('COMPROVANTE')) return true;
    if (p.includes('CTPS') && (t.includes('CTPS') || t.includes('CARTEIRA'))) return true;
    if (p.includes('CERTIDAO') && t.includes('CERTIDAO')) return true;
    if (p.includes('CONTRATO') && (t.includes('CONTRATO') || t.includes('COMPROVANTE'))) return true;
    if (p.includes('LAUDO') && (t.includes('LAUDO') || t.includes('MEDICO') || t.includes('EXAME'))) return true;
    if (p.includes('CNIS') && (t.includes('CNIS') || t.includes('INSS') || t.includes('EXTRATO'))) return true;
    if (p.includes('RURAL') || p.includes('DOC_RURAL')) {
        if (t.includes('RURAL') || t.includes('TERRA') || t.includes('ITR') || t.includes('INCRA') || t.includes('DAP') || t.includes('CAF') || t.includes('PRODUTOR')) return true;
    }
    if (p.includes('BO_OU_NOTA_CULPA') || p.includes('CULPA') || p.includes('FLAGR')) {
        if (t.includes('BO') || t.includes('BOLETIM') || t.includes('OCORRENCIA') || t.includes('CULPA') || t.includes('FLAGR') || t.includes('PRISAO')) return true;
    }
    if (p.includes('VINCULO_EMPREGO') && (t.includes('CTPS') || t.includes('CARTEIRA') || t.includes('EMPREGO') || t.includes('VINCULO') || t.includes('HOLERITE'))) return true;
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
    const nomeLimpo = String(clienteNome || '').trim() || 'Cliente';

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
        .replace(/\{nome\}/gi, () => nomeLimpo)
        .replace(/\{preset\}/gi, () => (preset.rotulo || keyPreset))
        .replace(/\{documentos\}/gi, () => listaTexto);

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

    // Salva documento validado fisicamente com extensão real e sem duplicar timestamps
    const ext = String(mimetype || '').includes('pdf') ? 'pdf' : (String(mimetype || '').includes('png') ? 'png' : 'jpg');
    const nomeArquivo = `${laudo.tipoDocumento || 'DOC'}.${ext}`;
    const arquivoSalvo = salvarDocumentoCliente(chaveTel, nomeArquivo, buffer, laudo);

    const docRegistrado = {
        id: arquivoSalvo.idDocumento,
        tipo: laudo.tipoDocumento || 'DOCUMENTO',
        tipoRotulo: laudo.tipoRotulo || laudo.tipoDocumento || 'Documento Validado',
        nomeArquivo: arquivoSalvo.nomeArquivoSalvo || nomeArquivo,
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

    // Mescla acumulativa de qualificação civil preservando valores anteriores se o novo for vazio
    const extraidos = laudo.dadosExtraidos || {};
    const qualAtual = sessao.qualificacaoAcumulada || {};
    const endAtual = qualAtual.endereco || {};
    const endNovo = extraidos.endereco || {};

    sessao.qualificacaoAcumulada = {
        ...qualAtual,
        nomeCompleto: (extraidos.nomeCompleto && extraidos.nomeCompleto.trim()) || qualAtual.nomeCompleto || sessao.clienteNome || '',
        cpf: (extraidos.cpf && extraidos.cpf.trim()) || qualAtual.cpf || '',
        rg: (extraidos.rg && extraidos.rg.trim()) || qualAtual.rg || '',
        rgOrgaoEmissor: (extraidos.rgOrgaoEmissor && extraidos.rgOrgaoEmissor.trim()) || qualAtual.rgOrgaoEmissor || '',
        filiacaoMae: (extraidos.filiacaoMae && extraidos.filiacaoMae.trim()) || qualAtual.filiacaoMae || '',
        filiacaoPai: (extraidos.filiacaoPai && extraidos.filiacaoPai.trim()) || qualAtual.filiacaoPai || '',
        dataNascimento: (extraidos.dataNascimento && extraidos.dataNascimento.trim()) || qualAtual.dataNascimento || '',
        endereco: {
            logradouro: (endNovo.logradouro && endNovo.logradouro.trim()) || endAtual.logradouro || '',
            numero: (endNovo.numero && endNovo.numero.trim()) || endAtual.numero || '',
            complemento: (endNovo.complemento && endNovo.complemento.trim()) || endAtual.complemento || '',
            bairro: (endNovo.bairro && endNovo.bairro.trim()) || endAtual.bairro || '',
            cidade: (endNovo.cidade && endNovo.cidade.trim()) || endAtual.cidade || '',
            uf: (endNovo.uf && endNovo.uf.trim()) || endAtual.uf || '',
            cep: (endNovo.cep && endNovo.cep.trim()) || endAtual.cep || ''
        }
    };

    // Baixa inteligente "2 em 1":
    // 1. RG_FRENTE, RG_VERSO, RG_COMPLETO ou CNH quita RG, CNH, RG_OU_CNH e variações.
    // 2. Se o RG ou CNH tiver CPF válido extraído pela IA, quita também o CPF da lista sem exigir foto separada!
    // 3. Comprovante de Residência quita COMPROVANTE_RESIDENCIA e ENDERECO.
    const tipo = String(laudo.tipoDocumento || '').toUpperCase();
    const ehIdentidade = ['RG_FRENTE', 'RG_VERSO', 'RG_COMPLETO', 'CNH'].includes(tipo) || tipo.includes('RG') || tipo.includes('CNH');
    const cpfLimpo = String(extraidos.cpf || qualAtual.cpf || '').replace(/\D/g, '');
    const temCpfValido = cpfLimpo.length === 11;
    const ehResidencia = tipo.includes('RESIDENCIA') || tipo.includes('ENDERECO');

    let removeuAoMenosUm = false;
    sessao.documentosPendentes = (sessao.documentosPendentes || []).filter(item => {
        const itemUp = String(item || '').toUpperCase();
        if (ehIdentidade && (itemUp === 'RG' || itemUp === 'CNH' || itemUp === 'RG_OU_CNH' || itemUp === 'RG_FRENTE' || itemUp === 'RG_VERSO')) {
            removeuAoMenosUm = true;
            return false;
        }
        if (ehIdentidade && temCpfValido && itemUp === 'CPF') {
            removeuAoMenosUm = true;
            return false;
        }
        if (ehResidencia && (itemUp.includes('RESIDENCIA') || itemUp.includes('ENDERECO'))) {
            removeuAoMenosUm = true;
            return false;
        }
        if (documentoSatisfazItem(laudo.tipoDocumento, item)) {
            removeuAoMenosUm = true;
            return false;
        }
        return true;
    });

    if (!removeuAoMenosUm && sessao.documentosPendentes.length > 0) {
        // Se o documento é OUTRO ou não reconhecido, NÃO faz shift cego!
        // Apenas dá baixa se for expressamente identificado como compatível
        if (laudo.tipoDocumento && laudo.tipoDocumento !== 'OUTRO') {
            sessao.documentosPendentes.shift();
            removeuAoMenosUm = true;
        }
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
        if (!sessao.parcialDesde) {
            sessao.parcialDesde = new Date().toISOString();
        }
        sessao.ultimoDocRecebidoEm = new Date().toISOString();
        dossieConsolidado = consolidarDossie(chaveTel, config);
        const pendentesAmigaveis = sessao.documentosPendentes.map(item => {
            const rotulos = {
                'RG_OU_CNH': 'RG ou CNH',
                'COMPROVANTE_RESIDENCIA': 'Comprovante de Residência',
                'CTPS': 'Carteira de Trabalho',
                'TERMO_RESCISAO': 'Termo de Rescisão / Holerites',
                'LAUDO_MEDICO': 'Laudos / Exames Médicos',
                'CNIS': 'Extrato CNIS (Meu INSS)',
                'CERTIDAO': 'Certidão de Nascimento/Casamento',
                'COMPROVANTE_RENDA': 'Comprovante de Renda',
                'CONTRATO_COMPROVANTE': 'Contrato ou Comprovante'
            };
            return rotulos[item] || item.replace(/_/g, ' ');
        }).join(', ');
        msgFeedback = `${laudo.mensagemFeedbackWhatsApp}\n\n📋 *Ainda faltam (${sessao.documentosPendentes.length}):* ${pendentesAmigaveis}.`;
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

    const isParcial = Array.isArray(sessao.documentosPendentes) && sessao.documentosPendentes.length > 0;
    const statusDossie = isParcial ? 'DOCS_PARCIAIS' : 'CONSOLIDADO';
    const totalDocsEsperados = docsSessao.length + (Array.isArray(sessao.documentosPendentes) ? sessao.documentosPendentes.length : 0);

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
        status: statusDossie,
        documentosPendentes: sessao.documentosPendentes || [],
        civil: civilAcumulado,
        qualificacao: civilAcumulado,
        qualificacaoCPC: textoQualificacaoCPC,
        documentos: todosDocumentos,
        atualizadoEm: new Date().toISOString(),
        criadoEm: existente.criadoEm || new Date().toISOString()
    };

    config.dossiesClientes[chaveTel] = dossie;
    if (config.onboardingSessoes[chaveTel]) {
        config.onboardingSessoes[chaveTel].status = statusDossie;
        config.onboardingSessoes[chaveTel].estado = statusDossie;
    }

    // Cria ou atualiza Caso Pré-Processual em config.processos.lista
    const cpfFinal = civilAcumulado.cpf || '';
    const jaExistePreProc = config.processos.lista.find(p =>
        (p.telefoneCliente && p.telefoneCliente === chaveTel && p.tipo === 'Pré-Processual') ||
        (cpfFinal && p.cpf === cpfFinal && p.tipo === 'Pré-Processual')
    );

    const provasNomes = todosDocumentos.map(d => d.tipoRotulo || d.tipo || d.arquivo || 'Documento Auditado');
    const agoraFormatado = new Date().toLocaleString('pt-BR');

    const fasePreProc = isParcial
        ? `Documentação Parcial (${docsSessao.length}/${totalDocsEsperados || (docsSessao.length + 1)} recebidos)`
        : 'Pré-Processual (Dossiê Consolidado)';
    const tagPreProc = isParcial
        ? `Documentação Parcial (${docsSessao.length}/${totalDocsEsperados || (docsSessao.length + 1)})`
        : 'Dossiê Consolidado';
    const resumoPreProc = isParcial
        ? `Dossiê em andamento (${docsSessao.length}/${totalDocsEsperados || (docsSessao.length + 1)} recebidos). Faltam: ${(sessao.documentosPendentes || []).join(', ')}.`
        : `Dossiê documental consolidado com ${todosDocumentos.length} documento(s) auditado(s) via IA. Qualificação civil pronta para elaboração da Petição Inicial.`;

    if (!jaExistePreProc) {
        const novoPreProc = {
            id: `preproc_${Date.now()}`,
            numero: `PRE-PROC-${new Date().getFullYear()}-${String(config.processos.lista.length + 1).padStart(3, '0')}`,
            numeroProcesso: `PRE-PROC-${new Date().getFullYear()}-${String(config.processos.lista.length + 1).padStart(3, '0')}`,
            nome: nomeFinal,
            cpf: cpfFinal,
            telefoneCliente: chaveTel,
            tipo: 'Pré-Processual',
            fase: fasePreProc,
            tag: tagPreProc,
            area: dossie.area,
            temAtualizacao: true,
            dataAtualizacaoTexto: agoraFormatado,
            resumo: resumoPreProc,
            linhaDoTempo: [
                { data: agoraFormatado, evento: isParcial ? `Recepção parcial de documentos (${docsSessao.length}/${totalDocsEsperados || (docsSessao.length + 1)} entregues). Faltam: ${(sessao.documentosPendentes || []).join(', ')}.` : `Solicitação e conferência multimodal de documentos (${dossie.area}) concluída.` },
                { data: agoraFormatado, evento: `Qualificação civil Art. 319 CPC atualizada para ${nomeFinal}.` }
            ],
            provasAnexadas: provasNomes
        };
        config.processos.lista.unshift(novoPreProc);
    } else {
        jaExistePreProc.nome = nomeFinal;
        jaExistePreProc.cpf = cpfFinal || jaExistePreProc.cpf;
        jaExistePreProc.fase = fasePreProc;
        jaExistePreProc.tag = tagPreProc;
        jaExistePreProc.resumo = resumoPreProc;
        jaExistePreProc.provasAnexadas = provasNomes;
        jaExistePreProc.dataAtualizacaoTexto = agoraFormatado;
        if (!Array.isArray(jaExistePreProc.linhaDoTempo)) jaExistePreProc.linhaDoTempo = [];
        jaExistePreProc.linhaDoTempo.push({
            data: agoraFormatado,
            evento: `Documento recebido: ${provasNomes[provasNomes.length - 1] || 'Novo Anexo'}. ${isParcial ? `Faltam: ${(sessao.documentosPendentes || []).join(', ')}` : 'Documentação completa.'}`
        });
    }

    return dossie;
}

function obterDossies(config = {}) {
    garantirEstruturaOnboarding(config);
    const mapa = { ...(config.dossiesClientes || {}) };
    const sessoes = config.onboardingSessoes || {};
    for (const [tel, sess] of Object.entries(sessoes)) {
        if (!sess || typeof sess !== 'object') continue;
        if (!mapa[tel] && (Array.isArray(sess.documentosRecebidos) && sess.documentosRecebidos.length > 0)) {
            mapa[tel] = {
                id: tel,
                clienteTelefone: tel,
                telefone: tel,
                clienteNome: sess.clienteNome || 'Cliente (Envio Parcial)',
                nome: sess.clienteNome || 'Cliente (Envio Parcial)',
                area: sess.preset || 'Geral',
                status: sess.estado || sess.status || 'DOCS_PARCIAIS',
                civil: sess.qualificacaoAcumulada || {},
                qualificacao: sess.qualificacaoAcumulada || {},
                documentos: sess.documentosRecebidos,
                atualizadoEm: sess.atualizadoEm || new Date().toISOString()
            };
        }
    }
    return mapa;
}

/**
 * Varre as sessões de onboarding e dossiês que se encontram em DOCS_PARCIAIS
 * e dispara automaticamente um lembrete amigável caso tenham transcorrido 48h
 * desde o último envio parcial sem que os documentos pendentes tenham sido completados.
 * 
 * @param {Object} config - Configuração geral do sistema
 * @param {Object} options - Opções de execução e injeção de dependências
 * @returns {Promise<Object>} Relatório de lembretes verificados e disparados
 */
async function verificarLembretesDossieParcial(config = {}, options = {}) {
    garantirEstruturaOnboarding(config);
    const agora = options.dataReferencia ? new Date(options.dataReferencia) : new Date();
    const horasLimite = typeof options.horasLimite === 'number' ? options.horasLimite : 48;
    const forcarDisparo = Boolean(options.forcarDisparo);
    const enviarMsgFn = typeof options.enviarMensagemWhatsApp === 'function' ? options.enviarMensagemWhatsApp : null;
    const isIgnoredFn = typeof options.isContactIgnored === 'function' ? options.isContactIgnored : null;

    const relatorio = {
        totalVerificados: 0,
        totalElegiveis: 0,
        totalEnviados: 0,
        detalhes: []
    };

    const sessoes = config.onboardingSessoes || {};
    const dossies = config.dossiesClientes || {};

    // Mapeia todos os telefones únicos que possuem sessão ou dossiê
    const chavesUnicas = new Set([...Object.keys(sessoes), ...Object.keys(dossies)]);

    for (const tel of chavesUnicas) {
        const sessao = sessoes[tel] || {};
        const dossie = dossies[tel] || {};

        const statusSessao = sessao.status || sessao.estado || '';
        const statusDossie = dossie.status || '';

        // Só atua se estiver explicitamente em DOCS_PARCIAIS
        if (statusSessao !== 'DOCS_PARCIAIS' && statusDossie !== 'DOCS_PARCIAIS') {
            continue;
        }

        relatorio.totalVerificados++;

        // Obtém pendências
        const pendentes = Array.isArray(sessao.documentosPendentes) && sessao.documentosPendentes.length > 0
            ? sessao.documentosPendentes
            : (Array.isArray(dossie.documentosPendentes) && dossie.documentosPendentes.length > 0
                ? dossie.documentosPendentes
                : []);

        if (pendentes.length === 0) {
            continue;
        }

        // Checa se o contato está na lista de contatos ignorados / VIP silencioso
        if (isIgnoredFn && isIgnoredFn(tel, config)) {
            continue;
        }

        // Determina a data base de referência para contagem de horas
        const dataBaseStr = sessao.parcialDesde || sessao.ultimoDocRecebidoEm || sessao.atualizadoEm || dossie.atualizadoEm || sessao.iniciadoEm;
        const dataBase = dataBaseStr ? new Date(dataBaseStr) : agora;
        const diffHoras = (agora.getTime() - dataBase.getTime()) / (1000 * 60 * 60);

        // Verifica se completou 48 horas (ou se o disparo foi forçado)
        if (diffHoras < horasLimite && !forcarDisparo) {
            continue;
        }

        // Evita reenvio excessivo: se já enviou lembrete nas últimas 48h, respeita o intervalo
        if (sessao.ultimoLembreteParcialEm && !forcarDisparo) {
            const horasDesdeUltimoLembrete = (agora.getTime() - new Date(sessao.ultimoLembreteParcialEm).getTime()) / (1000 * 60 * 60);
            if (horasDesdeUltimoLembrete < horasLimite) {
                continue;
            }
        }

        relatorio.totalElegiveis++;

        // Formatação amigável dos nomes dos documentos faltantes
        const pendentesFormatados = pendentes.map(p => {
            const rotulo = p.replace(/_/g, ' ').toLowerCase();
            return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
        }).join(', ');

        const nomeCliente = sessao.clienteNome || dossie.clienteNome || dossie.nome || 'Cliente';
        const docsRecebidosQtd = Array.isArray(sessao.documentosRecebidos) ? sessao.documentosRecebidos.length : (Array.isArray(dossie.documentos) ? dossie.documentos.length : 0);

        // Template de mensagem amigável e acolhedor (anti-robô)
        const templateBase = (config && typeof config.modeloMensagemLembreteDossieParcial === 'string' && config.modeloMensagemLembreteDossieParcial.trim())
            ? config.modeloMensagemLembreteDossieParcial
            : (
                `⚖️ *Lembrete de Documentação — Advocacia Pro*\n\n` +
                `Olá, *{nome}*! Tudo bem? Esperamos que esteja tendo uma excelente semana! 😊\n\n` +
                `Passando para te avisar que já registramos com sucesso parte dos seus documentos para a abertura do seu caso.\n\n` +
                `📋 *Para darmos entrada no processo, ainda precisamos apenas de:*\n` +
                `👉 *{documentos_pendentes}*\n\n` +
                `Assim que você puder, envie por aqui mesmo uma foto nítida ou arquivo em PDF. Nossa equipe jurídica está pronta para avançar com o seu pedido!\n\n` +
                `Qualquer dúvida, estamos à disposição. ⚖️`
            );

        const mensagemFinal = templateBase
            .replace(/\{nome\}/gi, () => nomeCliente)
            .replace(/\{documentos_pendentes\}/gi, () => pendentesFormatados)
            .replace(/\{total_pendentes\}/gi, () => String(pendentes.length))
            .replace(/\{total_recebidos\}/gi, () => String(docsRecebidosQtd));

        let enviado = false;
        if (enviarMsgFn) {
            try {
                const resEnvio = await enviarMsgFn(tel, mensagemFinal);
                enviado = (resEnvio !== false);
            } catch (errEnvio) {
                console.error(`[Lembrete Dossiê Parcial] Erro ao enviar mensagem para ${tel}:`, errEnvio.message);
                enviado = false;
            }
        } else {
            // Em testes unitários ou sem client conectado direto
            enviado = true;
        }

        if (enviado) {
            const agoraISO = agora.toISOString();
            const agoraFormatado = agora.toLocaleString('pt-BR');

            // Atualiza sessão
            sessao.ultimoLembreteParcialEm = agoraISO;
            sessao.lembretesParciaisEnviados = (sessao.lembretesParciaisEnviados || 0) + 1;
            sessao.atualizadoEm = agoraISO;
            if (!Array.isArray(sessao.historicoLembretes)) sessao.historicoLembretes = [];
            sessao.historicoLembretes.push({
                data: agoraISO,
                dataTexto: agoraFormatado,
                documentosPendentes: [...pendentes],
                mensagem: mensagemFinal
            });

            // Atualiza dossiê
            if (dossie && typeof dossie === 'object') {
                dossie.ultimoLembreteParcialEm = agoraISO;
                dossie.lembretesParciaisEnviados = sessao.lembretesParciaisEnviados;
                dossie.atualizadoEm = agoraISO;
            }

            // Atualiza linha do tempo pré-processual
            if (config.processos && Array.isArray(config.processos.lista)) {
                const proc = config.processos.lista.find(p =>
                    (p.telefoneCliente && p.telefoneCliente === tel) ||
                    (dossie.cpf && p.cpf && p.cpf === dossie.cpf)
                );
                if (proc) {
                    if (!Array.isArray(proc.linhaDoTempo)) proc.linhaDoTempo = [];
                    proc.linhaDoTempo.push({
                        data: agoraFormatado,
                        evento: `⏰ Lembrete automático de 48h enviado ao cliente solicitando: ${pendentesFormatados}.`
                    });
                    proc.dataAtualizacaoTexto = agoraFormatado;
                    proc.temAtualizacao = true;
                }
            }

            relatorio.totalEnviados++;
            relatorio.detalhes.push({
                telefone: tel,
                nome: nomeCliente,
                documentosPendentes: pendentes,
                horasDecorridas: Math.round(diffHoras),
                mensagem: mensagemFinal
            });
        }
    }

    return relatorio;
}

module.exports = {
    PRESETS_ONBOARDING,
    normalizarPresetKey,
    documentoSatisfazItem,
    iniciarSessaoOnboarding,
    obterSessaoAtiva,
    processarMidiaOnboarding,
    consolidarDossie,
    obterDossies,
    verificarLembretesDossieParcial,
    garantirEstruturaOnboarding
};
