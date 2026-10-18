const { app, BrowserWindow, ipcMain, nativeImage, dialog, Notification, Menu } = require('electron');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');

process.on('uncaughtException', (err) => {
    console.error('[Proteção Anti-Crash] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[Proteção Anti-Crash] unhandledRejection:', reason);
});

// Carrega variáveis do arquivo .env se existir (Sem expor credenciais)
try {
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf-8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...vals] = trimmed.split('=');
                const val = vals.join('=').trim().replace(/^["']|["']$/g, '');
                if (key && !process.env[key.trim()]) {
                    process.env[key.trim()] = val;
                }
            }
        });
    }
} catch (e) {}

let mainWindow;
let client = null;
let configEmMemoria = null;
let contatosPausados = {};
let historicoConversas = {};
let dadosAudiosPorContato = {};
let estadosUsuarios = {};
let avisoForaHorarioRecente = {};
let mensagensJaProcessadas = new Set();
let momentoConexao = 0;
let iniciandoBot = false;
let reconectando = false;
let tentativasReconexao = 0;
let timerReconexao = null;
let instalandoUpdate = false;
let baixandoUpdate = false;
let caminhoInstaladorBaixado = null;
let statusAtualBot = 'initializing';
let subStatusDetalhado = 'Preparando ambiente seguro...';
let ultimoQrDataUrl = '';
let timerGravacaoDisco = null;
let timerHeartbeatShutdown = null;

const GITHUB_OWNER = 'danireid123';
const GITHUB_REPO = 'Advocacia-2.0';
const { criarConfigPadraoV2, migrarConfigV1ParaV2 } = require('./migracao');

const USER_DATA_DIR = app.getPath('userData');
const CONFIG_PATH = path.join(USER_DATA_DIR, 'config.json');
const CONFIG_BACKUP_PATH = path.join(USER_DATA_DIR, 'config.backup.json');
const IGNORED_CONTACTS_PATH = path.join(USER_DATA_DIR, 'ignored_contacts.json');
const AUTH_DIR = path.join(USER_DATA_DIR, 'wwebjs_auth_session_v2');

if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
}

/**
 * Escrita atômica: grava em arquivo temporário e renomeia. Se o app fechar no meio da
 * gravação, o arquivo original permanece íntegro (nunca fica um JSON pela metade).
 */
function escreverArquivoAtomico(destino, conteudo) {
    const tmp = `${destino}.${process.pid}.tmp`;
    try {
        fs.writeFileSync(tmp, conteudo, 'utf-8');
        fs.renameSync(tmp, destino);
    } catch (err) {
        try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch (e) {}
        throw err;
    }
}

/**
 * Todo ipcMain.handle passa por este wrapper: qualquer exceção vira
 * { success: false, error } e é logada, em vez de rejeitar a promise silenciosamente no renderer.
 */
const _ipcHandleOriginal = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (canal, listener) => _ipcHandleOriginal(canal, async (...args) => {
    try {
        return await listener(...args);
    } catch (err) {
        console.error(`[IPC:${canal}] erro:`, err);
        return { success: false, sucesso: false, error: err.message, erro: err.message };
    }
});

function carregarContatosIgnorados() {
    try {
        if (fs.existsSync(IGNORED_CONTACTS_PATH)) {
            const raw = fs.readFileSync(IGNORED_CONTACTS_PATH, 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {}
    try {
        if (configEmMemoria && Array.isArray(configEmMemoria.contatosIgnorados)) {
            return configEmMemoria.contatosIgnorados;
        }
        if (fs.existsSync(CONFIG_PATH)) {
            const rawCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            if (rawCfg && Array.isArray(rawCfg.contatosIgnorados)) {
                return rawCfg.contatosIgnorados;
            }
        }
    } catch (e) {}
    return [];
}

function salvarContatosIgnorados(lista) {
    try {
        const limpa = Array.isArray(lista) ? lista : [];
        escreverArquivoAtomico(IGNORED_CONTACTS_PATH, JSON.stringify(limpa, null, 2));
        const cfg = carregarConfig();
        cfg.contatosIgnorados = limpa;
        salvarConfigDisco(cfg, false);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-ignorados-sync', limpa);
        }
        return true;
    } catch (e) {
        return false;
    }
}

function isContactIgnored(fromNumber, ignoredList) {
    const cleanNumber = String(fromNumber || '').replace(/\D/g, '');
    if (!cleanNumber) return false;
    const list = Array.isArray(ignoredList) ? ignoredList : carregarContatosIgnorados();
    if (!Array.isArray(list) || list.length === 0) return false;
    return list
        .map(item => {
            const itemNum = typeof item === 'object' && item !== null ? (item.numero || item.telefone || '') : item;
            return String(itemNum || '').replace(/\D/g, '');
        })
        .filter(item => item.length >= 4) // ignora entradas vazias ou curtas
        .some(item => cleanNumber.includes(item));
}

function obterIconeNativo() {
    try {
        const pngPath = path.join(__dirname, 'icon.png');
        const icoPath = path.join(__dirname, 'icon.ico');
        const alvo = fs.existsSync(pngPath) ? pngPath : (fs.existsSync(icoPath) ? icoPath : null);
        if (!alvo) return undefined;
        let img = nativeImage.createFromPath(alvo);
        if (!img.isEmpty()) {
            return img.resize({ width: 256, height: 256, quality: 'best' });
        }
        return alvo;
    } catch (e) {
        return undefined;
    }
}

function configurarAutoStartWindows(ativar) {
    try {
        if (process.platform === 'win32' && app.isPackaged) {
            app.setLoginItemSettings({
                openAtLogin: Boolean(ativar),
                path: process.execPath
            });
        }
    } catch (e) {}
}

function obterCaminhoNavegador() {
    const progFiles = process.env['PROGRAMFILES'] || 'C:\\Program Files';
    const progFilesX86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';

    const caminhosWindows = [
        path.join(progFiles, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(progFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(localAppData, 'Google\\Chrome\\Application\\chrome.exe'),
        path.join(progFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(progFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
        path.join(localAppData, 'Microsoft\\Edge\\Application\\msedge.exe')
    ];
    for (const caminho of caminhosWindows) {
        if (caminho && fs.existsSync(caminho)) return caminho;
    }
    return undefined;
}

function limparLocksTravados() {
    try {
        const pastaSessao = path.join(AUTH_DIR, 'session-adv_studio_client');
        const possiveisLocks = [
            path.join(pastaSessao, 'SingletonLock'),
            path.join(pastaSessao, 'lockfile'),
            path.join(pastaSessao, 'Default', 'SingletonLock'),
            path.join(pastaSessao, 'Default', 'lockfile')
        ];
        for (const arq of possiveisLocks) {
            if (fs.existsSync(arq)) {
                try { fs.unlinkSync(arq); } catch (e) {}
            }
        }
    } catch (e) {}
}

function criarConfigPadrao() {
    return criarConfigPadraoV2();
}

function migrarTemplatesAntigosProcessos(cfg) {
    return migrarConfigV1ParaV2(cfg);
}

function carregarConfig(forcarDisco = false) {
    if (configEmMemoria && !forcarDisco) return configEmMemoria;
    try {
        const contatosIgnoradosExternos = carregarContatosIgnorados();
        if (!fs.existsSync(CONFIG_PATH)) {
            if (fs.existsSync(CONFIG_BACKUP_PATH)) {
                const recuperado = JSON.parse(fs.readFileSync(CONFIG_BACKUP_PATH, 'utf-8'));
                configEmMemoria = migrarConfigV1ParaV2(recuperado, contatosIgnoradosExternos);
                salvarConfigDisco(configEmMemoria, true);
                return configEmMemoria;
            }
            const padrao = criarConfigPadraoV2();
            escreverArquivoAtomico(CONFIG_PATH, JSON.stringify(padrao, null, 2));
            configEmMemoria = padrao;
            return configEmMemoria;
        }
        const lido = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
        configEmMemoria = migrarConfigV1ParaV2(lido, contatosIgnoradosExternos);
        if (configEmMemoria.pausadosPersistidos) {
            contatosPausados = { ...configEmMemoria.pausadosPersistidos, ...contatosPausados };
        }
        return configEmMemoria;
    } catch (e) {
        try {
            if (fs.existsSync(CONFIG_BACKUP_PATH)) {
                configEmMemoria = migrarConfigV1ParaV2(JSON.parse(fs.readFileSync(CONFIG_BACKUP_PATH, 'utf-8')), carregarContatosIgnorados());
                return configEmMemoria;
            }
        } catch (err2) {}
        // Ambos corrompidos: preserva o arquivo ruim para recuperação manual em vez de sobrescrevê-lo
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                fs.copyFileSync(CONFIG_PATH, CONFIG_PATH.replace(/\.json$/, '.corrompido.' + Date.now() + '.json'));
            }
        } catch (err3) {}
        configEmMemoria = criarConfigPadraoV2();
        return configEmMemoria;
    }
}

function salvarConfigDisco(cfg, imediato = false) {
    configEmMemoria = cfg;
    configEmMemoria.pausadosPersistidos = contatosPausados;
    const gravar = () => {
        try {
            const payload = JSON.stringify(configEmMemoria, null, 2);
            escreverArquivoAtomico(CONFIG_PATH, payload);
            escreverArquivoAtomico(CONFIG_BACKUP_PATH, payload);
        } catch (e) {
            console.error('[Config] Falha ao gravar config.json:', e.message);
        }
    };
    if (imediato) {
        gravar();
        return;
    }
    clearTimeout(timerGravacaoDisco);
    timerGravacaoDisco = setTimeout(gravar, 350);
}

function apenasNumeros(str) {
    return String(str || '').replace(/\D/g, '');
}

function formatarTelefoneBrasil(num) {
    const limpo = apenasNumeros(num);
    if (!limpo) return 'Contato';
    if (limpo.length === 13 && limpo.startsWith('55')) {
        return `+55 (${limpo.substring(2, 4)}) ${limpo.substring(4, 9)}-${limpo.substring(9)}`;
    }
    if (limpo.length === 12 && limpo.startsWith('55')) {
        return `+55 (${limpo.substring(2, 4)}) ${limpo.substring(4, 8)}-${limpo.substring(8)}`;
    }
    if (limpo.length === 11) {
        return `(${limpo.substring(0, 2)}) ${limpo.substring(2, 7)}-${limpo.substring(7)}`;
    }
    if (limpo.length === 10) {
        return `(${limpo.substring(0, 2)}) ${limpo.substring(2, 6)}-${limpo.substring(6)}`;
    }
    if (limpo.length > 13) {
        return `ID #${limpo.slice(-6)}`;
    }
    return `+${limpo}`;
}

async function resolverIdentidadeCompleta(msg, config) {
    const chatId = msg.from || '';
    const parteId = chatId.split('@')[0];
    let numeroReal = apenasNumeros(parteId);

    let nomeAgenda = '';
    let nomePush = (msg._data && (msg._data.notifyName || msg._data.pushname)) || '';

    try {
        const contato = await msg.getContact();
        if (contato) {
            if (contato.number) {
                numeroReal = apenasNumeros(contato.number);
            }
            if (contato.name) {
                nomeAgenda = String(contato.name).trim();
            }
            if (!nomePush && contato.pushname) {
                nomePush = String(contato.pushname).trim();
            }
        }
    } catch (e) {}

    if (!config.mapaNomes) config.mapaNomes = {};
    if (!config.mapaTelefones) config.mapaTelefones = {};

    const chaveUnica = numeroReal || parteId;
    const nomeEscolhido = nomeAgenda || nomePush || config.mapaNomes[chaveUnica] || '';

    if (nomeEscolhido) {
        config.mapaNomes[chaveUnica] = nomeEscolhido;
        config.mapaNomes[chatId] = nomeEscolhido;
    }
    if (numeroReal) {
        config.mapaTelefones[chaveUnica] = formatarTelefoneBrasil(numeroReal);
        config.mapaTelefones[chatId] = formatarTelefoneBrasil(numeroReal);
    }

    const telFormatado = formatarTelefoneBrasil(numeroReal || parteId);
    const exibicaoPrincipal = nomeEscolhido
        ? `${nomeEscolhido} (${telFormatado})`
        : telFormatado;

    return {
        idChat: chatId,
        chaveCliente: chaveUnica,
        nomeCliente: nomeEscolhido,
        temContatoSalvo: Boolean(nomeAgenda),
        telefoneFormatado: telFormatado,
        exibicao: exibicaoPrincipal
    };
}

function extrairGatilhoLimpo(texto) {
    const t = String(texto || '').trim().toLowerCase();
    const matchNumero = t.match(/^(\d+)\s*[\.\-\)]?$/);
    if (matchNumero) return matchNumero[1];
    return t;
}

function emitirPausados() {
    const cfg = carregarConfig();
    salvarConfigDisco(cfg, false);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot-pausados', contatosPausados);
    }
}

function dispararNotificacaoTransbordo(dados) {
    try {
        const { contatoNome, telefone, motivo } = dados || {};
        
        // 1. Emite evento para o renderer para tocar o áudio executivo e atualizar UI
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-transbordo-humano', {
                contatoNome: contatoNome || 'Cliente',
                telefone: telefone || '',
                motivo: motivo || 'Opção "Falar com Advogado"',
                timestamp: Date.now()
            });
        }

        // 2. Dispara Notificação Nativa do Windows via Electron Notification
        if (Notification && Notification.isSupported && Notification.isSupported()) {
            const notif = new Notification({
                title: '⚠️ Atendimento Humano Solicitado',
                body: `${contatoNome || 'Cliente'} (${telefone || 'WhatsApp'}) solicitou falar com o advogado.\nMotivo: ${motivo || 'Opção "Falar com Advogado"'}`,
                urgency: 'critical',
                silent: true
            });
            notif.on('click', () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.show();
                    mainWindow.focus();
                }
            });
            notif.show();
        }
    } catch (e) {
        console.warn('Erro ao disparar alerta de transbordo:', e);
    }
}

function atualizarStatusUI(novoStatus, detalheSubStatus = null) {
    statusAtualBot = novoStatus;
    if (detalheSubStatus) subStatusDetalhado = detalheSubStatus;
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot-status', novoStatus);
        mainWindow.webContents.send('bot-substatus', {
            status: novoStatus,
            detalhe: subStatusDetalhado,
            tentativa: tentativasReconexao
        });
    }
}

function converterHoraParaMinutos(horaStr) {
    const partes = String(horaStr || '00:00').split(':');
    return (parseInt(partes[0], 10) || 0) * 60 + (parseInt(partes[1], 10) || 0);
}

function obterPrefixoHorario(config, remetenteChave) {
    try {
        const agenda = config.agenda;
        if (!agenda) return '';

        const ultimoAviso = avisoForaHorarioRecente[remetenteChave] || 0;
        if (Date.now() - ultimoAviso < 30 * 60 * 1000) return '';

        const agora = new Date();
        const diaSemana = String(agora.getDay());
        const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

        const registrarAviso = () => {
            avisoForaHorarioRecente[remetenteChave] = Date.now();
            if (Object.keys(avisoForaHorarioRecente).length > 500) {
                const limite = Date.now() - 60 * 60 * 1000;
                for (const k in avisoForaHorarioRecente) {
                    if (avisoForaHorarioRecente[k] < limite) delete avisoForaHorarioRecente[k];
                }
            }
        };

        const confDia = agenda[diaSemana];
        if (!confDia || !confDia.ativo) {
            registrarAviso();
            return (agenda.msg_fora_expediente || '').trim() + '\n\n';
        }

        const minAbertura = converterHoraParaMinutos(confDia.abertura || '08:00');
        const minFechamento = converterHoraParaMinutos(confDia.fechamento || '18:00');

        if (minutosAgora < minAbertura || minutosAgora >= minFechamento) {
            registrarAviso();
            return (agenda.msg_fora_expediente || '').trim() + '\n\n';
        }

        if (agenda.almoco_ativo) {
            const minAlmocoIni = converterHoraParaMinutos(agenda.almoco_inicio || '12:00');
            const minAlmocoFim = converterHoraParaMinutos(agenda.almoco_fim || '13:30');
            if (minutosAgora >= minAlmocoIni && minutosAgora < minAlmocoFim) {
                registrarAviso();
                return (agenda.msg_almoco || '').trim() + '\n\n';
            }
        }
    } catch (e) {}
    return '';
}

async function enviarMensagemSegura(msgObj, chatId, texto) {
    if (!client || !texto) return;
    try {
        await client.sendMessage(chatId, texto, { sendSeen: false });
    } catch (err1) {
        try {
            if (msgObj && typeof msgObj.reply === 'function') {
                await msgObj.reply(texto, chatId, { sendSeen: false });
            }
        } catch (err2) {}
    }
}

function montarTextoEtapa(etapa) {
    let txt = (etapa.mensagem || '') + "\n\n";
    (etapa.opcoes || []).forEach(op => {
        txt += `*${op.gatilho}* - ${op.rotulo}\n`;
    });
    return txt.trim();
}

function buscarProcessoPorNumero(config, digitosBusca) {
    if (!config.processos) return null;
    const lista = Array.isArray(config.processos) ? config.processos : (Array.isArray(config.processos.lista) ? config.processos.lista : []);
    if (!lista || lista.length === 0) return null;
    if (!digitosBusca || digitosBusca.length < 5) return null;

    return lista.find(p => {
        const cpfLimpo = apenasNumeros(p.cpf);
        const numLimpo = apenasNumeros(p.numero || p.numeroProcesso || p.processo || '');
        return (cpfLimpo && cpfLimpo === digitosBusca) ||
               (numLimpo && numLimpo === digitosBusca) ||
               (cpfLimpo && cpfLimpo.length >= 5 && (digitosBusca.includes(cpfLimpo) || cpfLimpo.includes(digitosBusca))) ||
               (numLimpo && numLimpo.length >= 5 && (digitosBusca.includes(numLimpo) || numLimpo.includes(digitosBusca)));
    });
}

async function formatarMensagemProcesso(config, proc, remetenteChave) {
    const tpls = (config.processos && config.processos.mensagens) || criarConfigPadrao().processos.mensagens;
    const textoBrutoResumo = (proc.resumo && proc.resumo.trim())
        ? proc.resumo.trim()
        : ((proc.resumoGlobalProcesso && proc.resumoGlobalProcesso.trim()) || '');
    const temResumo = Boolean(proc.temAtualizacao !== false && textoBrutoResumo);

    if (!proc.consultasPorContato) proc.consultasPorContato = {};
    const ultimaConsulta = proc.consultasPorContato[remetenteChave];
    const agoraTexto = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    let modelo = tpls.msg_sem_atualizacao;
    if (temResumo) {
        if (ultimaConsulta && !proc._resetarVistos) {
            modelo = tpls.msg_ja_visto;
        } else {
            modelo = tpls.msg_com_atualizacao;
        }
    }

    proc.consultasPorContato[remetenteChave] = agoraTexto;
    proc._resetarVistos = false;
    salvarConfigDisco(config, true);

    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bot-processos-sync', config);
    }

    // Se houver resumo, tenta traduzir com Gemini Flash (com fallback imediato para o texto original)
    let resumoParaExibir = textoBrutoResumo || 'Sem detalhes adicionais.';
    if (temResumo) {
        try {
            resumoParaExibir = await traduzirAndamentoParaCliente(proc, textoBrutoResumo, config);
        } catch (e) {
            resumoParaExibir = textoBrutoResumo;
        }
    }

    const numeroExibicao = proc.numero || proc.numeroProcesso || proc.numeroProcessoFormatado || proc.processo || '-';
    const dataExibicao = proc.dataAtualizacaoTexto || proc.data || agoraTexto;

    return String(modelo || '')
        .replace(/\{nome\}/g, proc.nome || 'Cliente')
        .replace(/\{cpf\}/g, proc.cpf || '-')
        .replace(/\{processo\}/g, numeroExibicao)
        .replace(/\{resumo\}/g, resumoParaExibir)
        .replace(/\{data\}/g, dataExibicao)
        .replace(/\{ultima_consulta\}/g, ultimaConsulta || agoraTexto);
}

const FRASES_TRANSBORDO_DIRETO = [
    "falar com advogado", "falar com o advogado", "chamar advogado",
    "quero falar com advogado", "atendente", "falar com humano",
    "atendimento humano", "advogado", "suporte humano", "falar diretamente com advogado"
];

async function processarMensagemEntrada(msg) {
    try {
        if (!msg || msg.fromMe || msg.isStatus || msg.broadcast) return false;
        if (!msg.from || msg.from.includes('@g.us') || msg.from.includes('@newsletter') || msg.from.includes('@broadcast')) return false;

        // Interceptador de Contatos Ignorados (Descarte imediato antes de qualquer resposta)
        const senderId = msg.from || '';
        if (isContactIgnored(senderId) || (msg.author && isContactIgnored(msg.author))) {
            return false;
        }

        const msgId = (msg.id && (msg.id._serialized || msg.id.id)) ? (msg.id._serialized || msg.id.id) : `${msg.from}_${msg.timestamp}_${msg.body}`;
        if (mensagensJaProcessadas.has(msgId)) return false;

        const ehAudio = Boolean(msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio'));
        let textoOriginal = String(msg.body || '').trim();
        if (!textoOriginal && !ehAudio) return false;
        if (ehAudio && !textoOriginal) {
            textoOriginal = '[Mensagem de Voz enviada pelo cliente]';
        }

        mensagensJaProcessadas.add(msgId);
        if (mensagensJaProcessadas.size > 2000) {
            const primeiroItem = mensagensJaProcessadas.values().next().value;
            mensagensJaProcessadas.delete(primeiroItem);
        }

        const config = carregarConfig();
        const identidade = await resolverIdentidadeCompleta(msg, config);
        const remetenteChave = identidade.chaveCliente;

        // Se for áudio do WhatsApp, faz download e processa via Gemini Multimodal
        if (ehAudio && typeof msg.downloadMedia === 'function') {
            try {
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    const audioBase64 = media.data;
                    const mimeType = media.mimetype || 'audio/ogg';
                    const { processarAudioECopilot } = require('./src/ia/tradutorJuridico');
                    const resAudio = await processarAudioECopilot(audioBase64, mimeType, {
                        nome: identidade.nomeCliente || identidade.exibicao || '',
                        telefone: identidade.telefoneFormatado || remetenteChave
                    });

                    dadosAudiosPorContato[remetenteChave] = {
                        audioBase64: `data:${mimeType};base64,${audioBase64}`,
                        mimeType,
                        transcricao: resAudio.transcricao,
                        resumo: resAudio.resumo,
                        sugestoesResposta: resAudio.sugestoesResposta
                    };

                    textoOriginal = `[Mensagem de Voz]: "${resAudio.transcricao || 'Áudio recebido'}"`;
                }
            } catch (errAudio) {
                console.error('Erro ao baixar/processar áudio no WhatsApp:', errAudio);
            }
        }

        // Verificação redundante com número real limpo da identidade
        if (isContactIgnored(remetenteChave) || isContactIgnored(identidade.telefoneFormatado)) {
            return false;
        }

        const gatilhoDigitado = extrairGatilhoLimpo(textoOriginal);

        const registroPausa = contatosPausados[remetenteChave] || contatosPausados[msg.from];
        const tsPausa = typeof registroPausa === 'object' ? registroPausa.timestamp : registroPausa;
        if (tsPausa && (Date.now() - tsPausa < 24 * 60 * 60 * 1000)) {
            // Contato já em pausa: silencia robô, mas anexa mensagem/áudio e atualiza Fila de Espera
            const horaMsg = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const novaMsg = {
                de: 'cliente',
                texto: textoOriginal,
                hora: horaMsg
            };

            if (!historicoConversas[remetenteChave]) historicoConversas[remetenteChave] = [];
            historicoConversas[remetenteChave].push(novaMsg);

            const itemPausado = contatosPausados[remetenteChave] || contatosPausados[msg.from];
            if (itemPausado && typeof itemPausado === 'object') {
                if (!Array.isArray(itemPausado.mensagens)) itemPausado.mensagens = [];
                itemPausado.mensagens.push(novaMsg);
                if (dadosAudiosPorContato[remetenteChave]) {
                    itemPausado.audioBase64 = dadosAudiosPorContato[remetenteChave].audioBase64;
                    itemPausado.transcricao = dadosAudiosPorContato[remetenteChave].transcricao;
                    itemPausado.resumo = dadosAudiosPorContato[remetenteChave].resumo;
                    itemPausado.sugestoesResposta = dadosAudiosPorContato[remetenteChave].sugestoesResposta;
                }
                emitirPausados();
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', {
                    numero: identidade.telefoneFormatado,
                    nome: identidade.nomeCliente || '',
                    exibicao: identidade.exibicao,
                    msg: `[Fila Humana] ${textoOriginal}`,
                    hora: horaMsg
                });
            }

            return false;
        }

        if (!config.metricasReais) config.metricasReais = { totalMensagens: 0, contatosAtendidos: [] };
        config.metricasReais.totalMensagens += 1;
        if (!config.metricasReais.contatosAtendidos.includes(remetenteChave)) {
            config.metricasReais.contatosAtendidos.push(remetenteChave);
        }
        salvarConfigDisco(config, false);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-log', {
                numero: identidade.telefoneFormatado,
                nome: identidade.nomeCliente || '',
                exibicao: identidade.exibicao,
                msg: textoOriginal,
                hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                metricasReais: {
                    totalMensagens: config.metricasReais.totalMensagens,
                    totalContatos: config.metricasReais.contatosAtendidos.length
                }
            });
        }

        if (!historicoConversas[remetenteChave]) historicoConversas[remetenteChave] = [];
        historicoConversas[remetenteChave].push({
            de: 'cliente',
            texto: textoOriginal,
            hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        const prefixoHorario = obterPrefixoHorario(config, remetenteChave);
        const responderCliente = async (txt) => {
            await enviarMensagemSegura(msg, msg.from, prefixoHorario + txt);
        };

        const colocarNaFilaHumana = async (mensagemConfirmacao, motivo = 'Opção "Falar com Advogado"', opcoesExtras = {}) => {
            const audioSalvo = dadosAudiosPorContato[remetenteChave] || {};
            const acoesItem = opcoesExtras.acoes || null;
            contatosPausados[remetenteChave] = {
                timestamp: Date.now(),
                nome: identidade.nomeCliente || '',
                telefone: identidade.telefoneFormatado,
                exibicao: identidade.exibicao,
                motivo: motivo,
                idChat: msg.from,
                origem: 'WHATSAPP',
                mensagens: (historicoConversas[remetenteChave] || []).slice(-10),
                audioBase64: audioSalvo.audioBase64 || null,
                transcricao: audioSalvo.transcricao || null,
                resumo: audioSalvo.resumo || null,
                sugestoesResposta: audioSalvo.sugestoesResposta || null,
                acoes: acoesItem,
                aguardandoAudioRelato: Boolean(acoesItem && acoesItem.aguardarAudioRelato)
            };
            delete estadosUsuarios[remetenteChave];
            salvarConfigDisco(config, true);
            emitirPausados();
            if (opcoesExtras.alertar !== false) {
                dispararNotificacaoTransbordo({
                    contatoNome: identidade.nomeCliente || identidade.exibicao || '',
                    telefone: identidade.telefoneFormatado || msg.from,
                    motivo: motivo
                });
            }
            await responderCliente(mensagemConfirmacao);
        };

        const estadoAtual = estadosUsuarios[remetenteChave] || 'raiz';
        const tplsProc = (config.processos && config.processos.mensagens) || criarConfigPadrao().processos.mensagens;

        if (estadoAtual === 'pos_consulta_processo') {
            if (gatilhoDigitado === '1') {
                delete estadosUsuarios[remetenteChave];
                await responderCliente(tplsProc.msg_encerrar_conversa || "✅ Atendimento finalizado! Agradecemos o seu contato.");
                return true;
            }
            if (gatilhoDigitado === '2') {
                await colocarNaFilaHumana(tplsProc.msg_chamar_advogado_pos_proc || "👨‍⚖️ Perfeito! Um advogado da nossa equipe já foi acionado e já está chegando para atender você.");
                return true;
            }
        }

        // Reconhecimento direto de pedido de transbordo humano ("falar com advogado", etc.)
        if (FRASES_TRANSBORDO_DIRETO.some(f => gatilhoDigitado === f || gatilhoDigitado.includes(f))) {
            const opHumano = (config.fluxo && config.fluxo.raiz && Array.isArray(config.fluxo.raiz.opcoes))
                ? config.fluxo.raiz.opcoes.find(o => o.tipo === 'humano')
                : null;
            const msgConfirmacao = (opHumano && opHumano.resposta)
                || tplsProc.msg_chamar_advogado_pos_proc
                || "👨‍⚖️ Perfeito! Sua solicitação foi encaminhada e um advogado da nossa equipe já está chegando para assumir seu atendimento.";
            await colocarNaFilaHumana(msgConfirmacao, 'Solicitação de atendimento humano');
            return true;
        }

        const saudacoes = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "menu", "inicio", "início", "ajuda"];
        if (gatilhoDigitado === "0" || saudacoes.some(s => gatilhoDigitado === s || gatilhoDigitado.startsWith(s + " "))) {
            estadosUsuarios[remetenteChave] = 'raiz';
            await responderCliente(montarTextoEtapa(config.fluxo.raiz));
            return true;
        }

        if (estadoAtual === 'aguardando_processo') {
            const digitos = apenasNumeros(textoOriginal);
            const procAchado = buscarProcessoPorNumero(config, digitos);
            if (procAchado) {
                if (procAchado.nome && !config.mapaNomes[remetenteChave]) {
                    config.mapaNomes[remetenteChave] = procAchado.nome;
                }
                estadosUsuarios[remetenteChave] = 'pos_consulta_processo';
                const textoProc = await formatarMensagemProcesso(config, procAchado, remetenteChave);
                await responderCliente(textoProc);
                return true;
            } else {
                const msgNaoEncontrado = tplsProc.msg_nao_encontrado || criarConfigPadrao().processos.mensagens.msg_nao_encontrado;
                await responderCliente(msgNaoEncontrado);
                return true;
            }
        }

        const etapaAtual = (estadoAtual === 'raiz' || estadoAtual === 'pos_consulta_processo')
            ? config.fluxo.raiz
            : (config.fluxo.etapas[estadoAtual] || config.fluxo.raiz);

        const opcaoEscolhida = (etapaAtual.opcoes || []).find(op => {
            const g = String(op.gatilho || '').trim().toLowerCase();
            const r = String(op.rotulo || '').trim().toLowerCase();
            return g === gatilhoDigitado || (r && r === gatilhoDigitado);
        });

        if (opcaoEscolhida) {
            const acoes = opcaoEscolhida.acoes || {};
            const deveEncaminharFila = opcaoEscolhida.tipo === 'humano' || Boolean(acoes.encaminharFilaHumana) || Boolean(acoes.pausarRobo);

            // Se a opção possui ações ativas (encaminharFilaHumana, humano ou pausarRobo), a ação PREVALECE!
            if (deveEncaminharFila) {
                const motivoFila = acoes.motivoFila || opcaoEscolhida.rotulo || 'Novo Atendimento';
                const msgConfirmacao = opcaoEscolhida.resposta || "Perfeito! Sua solicitação foi registrada e nossa equipe jurídica já foi notificada para lhe atender.";
                const alertar = acoes.dispararAlertaSonoro !== false;
                await colocarNaFilaHumana(msgConfirmacao, motivoFila, { acoes, alertar });
                return true;
            }

            if (opcaoEscolhida.tipo === 'submenu') {
                const dest = opcaoEscolhida.destino || 'raiz';
                estadosUsuarios[remetenteChave] = dest;
                const proxEtapa = dest === 'raiz' ? config.fluxo.raiz : config.fluxo.etapas[dest];
                await responderCliente(montarTextoEtapa(proxEtapa || config.fluxo.raiz));
                return true;
            }
            if (opcaoEscolhida.tipo === 'processo') {
                estadosUsuarios[remetenteChave] = 'aguardando_processo';
                await responderCliente(opcaoEscolhida.resposta || "Por favor, digite apenas o seu *CPF* ou o *Número do Processo*:");
                return true;
            }
            if (opcaoEscolhida.resposta) {
                await responderCliente(opcaoEscolhida.resposta);
                return true;
            }
        }

        const digitosDiretos = apenasNumeros(textoOriginal);
        if (digitosDiretos.length >= 9) {
            const procDireto = buscarProcessoPorNumero(config, digitosDiretos);
            if (procDireto) {
                if (procDireto.nome && !config.mapaNomes[remetenteChave]) {
                    config.mapaNomes[remetenteChave] = procDireto.nome;
                }
                estadosUsuarios[remetenteChave] = 'pos_consulta_processo';
                const textoProc = await formatarMensagemProcesso(config, procDireto, remetenteChave);
                await responderCliente(textoProc);
                return true;
            }
        }

        estadosUsuarios[remetenteChave] = 'raiz';
        await responderCliente(montarTextoEtapa(config.fluxo.raiz));
        return true;
    } catch (e) {
        return false;
    }
}

function compararVersoes(vNova, vAtual) {
    const limpar = (v) => String(v || '').replace(/^v/i, '').trim().split('.').map(n => parseInt(n, 10) || 0);
    const p1 = limpar(vNova);
    const p2 = limpar(vAtual);
    for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
        const n1 = p1[i] || 0;
        const n2 = p2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
}

function requisitarJsonGitHub(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Advocacia-Studio-Pro-Updater', 'Accept': 'application/vnd.github.v3+json' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return requisitarJsonGitHub(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`Status HTTP ${res.statusCode}`));
            let raw = '';
            res.on('data', chunk => raw += chunk);
            res.on('end', () => { try { resolve(JSON.parse(raw)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

function baixarArquivoComProgresso(url, destinoPath, onProgress) {
    return new Promise((resolve, reject) => {
        const fazerDownload = (linkAtual) => {
            https.get(linkAtual, { headers: { 'User-Agent': 'Advocacia-Studio-Pro-Updater' } }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return fazerDownload(res.headers.location);
                }
                if (res.statusCode !== 200) return reject(new Error(`Falha no download: HTTP ${res.statusCode}`));

                const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
                let baixadosBytes = 0;
                let ultimoPct = -1;
                const fileStream = fs.createWriteStream(destinoPath);

                res.on('data', (chunk) => {
                    baixadosBytes += chunk.length;
                    if (totalBytes > 0) {
                        const pct = Math.min(99, Math.round((baixadosBytes / totalBytes) * 100));
                        if (pct !== ultimoPct) { ultimoPct = pct; onProgress(pct); }
                    }
                });

                res.pipe(fileStream);
                fileStream.on('finish', () => fileStream.close(() => resolve(destinoPath)));
                fileStream.on('error', (err) => { try { fs.unlinkSync(destinoPath); } catch (e) {} reject(err); });
            }).on('error', reject);
        };
        fazerDownload(url);
    });
}

async function verificarEBaixarAtualizacaoGitHub() {
    if (baixandoUpdate || instalandoUpdate || caminhoInstaladorBaixado) return { disponivel: false };
    try {
        const versaoAtual = app.getVersion();
        const release = await requisitarJsonGitHub(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`);
        if (!release || !release.tag_name) return { disponivel: false };

        const versaoRemota = String(release.tag_name).replace(/^v/i, '').trim();
        if (compararVersoes(versaoRemota, versaoAtual) <= 0) return { disponivel: false };

        const assetExe = (release.assets || []).find(a => a.name && a.name.toLowerCase().endsWith('.exe') && !a.name.toLowerCase().includes('blockmap'));
        if (!assetExe || !assetExe.browser_download_url) return { disponivel: false };

        baixandoUpdate = true;
        const destinoExe = path.join(app.getPath('temp'), `AdvocaciaStudioPro-Update-${versaoRemota}.exe`);
        if (fs.existsSync(destinoExe)) try { fs.unlinkSync(destinoExe); } catch (e) {}

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-update-status', { status: 'downloading', versao: versaoRemota, nomeRelease: release.name || `v${versaoRemota}`, progresso: 1 });
        }

        await baixarArquivoComProgresso(assetExe.browser_download_url, destinoExe, (pct) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-update-status', { status: 'downloading', versao: versaoRemota, nomeRelease: release.name || `v${versaoRemota}`, progresso: pct });
            }
        });

        caminhoInstaladorBaixado = destinoExe;
        baixandoUpdate = false;

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-update-status', { status: 'ready', versao: versaoRemota, nomeRelease: release.name || `v${versaoRemota}`, progresso: 100 });
        }
        return { disponivel: true, versao: versaoRemota };
    } catch (err) {
        baixandoUpdate = false;
        return { disponivel: false };
    }
}

function configurarAutoUpdater() {
    setTimeout(() => { verificarEBaixarAtualizacaoGitHub(); }, 4000);
    setInterval(() => { verificarEBaixarAtualizacaoGitHub(); }, 15 * 60 * 1000);
}

async function executarInstalacaoSilenciosaUpdate() {
    if (instalandoUpdate || !caminhoInstaladorBaixado || !fs.existsSync(caminhoInstaladorBaixado)) return false;

    try {
        const stat = fs.statSync(caminhoInstaladorBaixado);
        if (stat.size < 20 * 1024 * 1024) {
            console.error('[Update] Arquivo baixado muito pequeno/corrompido:', stat.size);
            caminhoInstaladorBaixado = '';
            return false;
        }
    } catch (e) {
        return false;
    }

    instalandoUpdate = true;

    try {
        const cfg = carregarConfig();
        cfg.ultimoDesligamentoTimestamp = Math.floor(Date.now() / 1000);
        salvarConfigDisco(cfg, true);
    } catch (e) {}

    try {
        if (client) { await client.destroy(); client = null; }
        limparLocksTravados();
    } catch (e) {}

    setTimeout(() => {
        try {
            const batPath = path.join(app.getPath('temp'), 'aplicar_update.bat');
            const conteudoBat = [
                '@echo off',
                'timeout /t 1 /nobreak > NUL',
                'taskkill /F /IM "Advocacia Studio Pro.exe" > NUL 2>&1',
                'taskkill /F /IM "chrome.exe" > NUL 2>&1',
                `start /wait "" "${caminhoInstaladorBaixado}" /S`,
                'if errorlevel 1 (',
                `    start /wait "" "${caminhoInstaladorBaixado}"`,
                ')',
                `start "" "${process.execPath}"`,
                `del "${batPath}"`
            ].join('\r\n');

            fs.writeFileSync(batPath, conteudoBat, 'utf-8');
            const child = spawn('cmd.exe', ['/c', batPath], { detached: true, stdio: 'ignore', windowsHide: true });
            child.unref();
        } catch (e) {}
        app.quit();
    }, 200);
    return true;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1100,
        minHeight: 720,
        title: 'Advocacia Studio Pro v2.0 (Executive Suite)',
        icon: obterIconeNativo(),
        backgroundColor: '#0b0f17',
        show: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            backgroundThrottling: false
        },
        autoHideMenuBar: true
    });

    mainWindow.loadFile('index.html');

    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('[MainWindow] Falha ao carregar index.html:', errorCode, errorDescription);
    });

    // Menu de contexto nativo com Desfazer, Recortar, Copiar, Colar para campos de texto
    mainWindow.webContents.on('context-menu', (event, params) => {
        const { editFlags, isEditable, selectionText } = params;
        if (isEditable) {
            const menu = Menu.buildFromTemplate([
                { role: 'undo', label: 'Desfazer' },
                { role: 'redo', label: 'Refazer' },
                { type: 'separator' },
                { role: 'cut', label: 'Recortar', enabled: editFlags.canCut },
                { role: 'copy', label: 'Copiar', enabled: editFlags.canCopy },
                { role: 'paste', label: 'Colar', enabled: editFlags.canPaste },
                { type: 'separator' },
                { role: 'selectAll', label: 'Selecionar Tudo' }
            ]);
            menu.popup(mainWindow);
        } else if (selectionText && selectionText.trim().length > 0) {
            const menu = Menu.buildFromTemplate([
                { role: 'copy', label: 'Copiar' },
                { role: 'selectAll', label: 'Selecionar Tudo' }
            ]);
            menu.popup(mainWindow);
        }
    });
}

// Otimização para PC fraco: limpeza periódica de referências em memória (< 300MB)
setInterval(() => {
    try {
        if (global.gc) global.gc();
        if (mensagensJaProcessadas && mensagensJaProcessadas.size > 800) {
            const arr = Array.from(mensagensJaProcessadas).slice(0, 400);
            for (const item of arr) mensagensJaProcessadas.delete(item);
        }
    } catch (e) {}
}, 5 * 60 * 1000);

app.whenReady().then(() => {
    const cfg = carregarConfig(true);
    cfg.ultimoInicioTimestamp = Math.floor(Date.now() / 1000);
    salvarConfigDisco(cfg, true);

    configurarAutoStartWindows(cfg.iniciar_com_windows !== false);
    createWindow();

    // Inicia o motor WhatsApp e o AutoUpdater em background sem bloquear a abertura da janela
    setTimeout(() => {
        iniciarWhatsApp();
        configurarAutoUpdater();
    }, 1000);

    timerHeartbeatShutdown = setInterval(() => {
        try {
            const c = carregarConfig();
            c.ultimoDesligamentoTimestamp = Math.floor(Date.now() / 1000);
            salvarConfigDisco(c, false);
        } catch (e) {}
    }, 30000);
});

app.on('before-quit', async () => {
    clearInterval(timerHeartbeatShutdown);
    try {
        const cfg = carregarConfig();
        cfg.ultimoDesligamentoTimestamp = Math.floor(Date.now() / 1000);
        salvarConfigDisco(cfg, true);
    } catch (e) {}
    if (client) {
        try { await client.destroy(); } catch (e) {}
    }
});

function agendarReconexaoBackoff() {
    if (reconectando || instalandoUpdate) return;
    reconectando = true;
    clearTimeout(timerReconexao);

    const delays = [5000, 15000, 30000, 60000];
    const delayAtual = delays[Math.min(tentativasReconexao, delays.length - 1)];
    tentativasReconexao++;

    const segs = Math.round(delayAtual / 1000);
    atualizarStatusUI('disconnected', `Oscilação detectada. Reconectando em ${segs}s (Tentativa #${tentativasReconexao})...`);

    timerReconexao = setTimeout(() => {
        reconectando = false;
        iniciarWhatsApp(true);
    }, delayAtual);
}

async function iniciarWhatsApp(forcarReinicio = false) {
    if (iniciandoBot && !forcarReinicio) return;
    iniciandoBot = true;
    clearTimeout(timerReconexao);

    atualizarStatusUI('initializing', 'Iniciando motor Chromium em segundo plano...');

    if (client) {
        try { await client.destroy(); } catch (e) {}
        client = null;
    }
    limparLocksTravados();

    const puppeteerConfig = {
        headless: true,
        takeoverOnConflict: true,
        takeoverTimeoutMs: 0,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
            '--disable-extensions',
            '--mute-audio',
            '--no-default-browser-check',
            '--disable-sync',
            '--disable-translate',
            '--disable-default-apps',
            '--blink-settings=imagesEnabled=false',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
        ]
    };

    const browserPath = obterCaminhoNavegador();
    if (browserPath) {
        puppeteerConfig.executablePath = browserPath;
    }

    atualizarStatusUI('initializing', 'Carregando sessão local criptografada...');

    client = new Client({
        authStrategy: new LocalAuth({
            clientId: "adv_studio_client",
            dataPath: AUTH_DIR
        }),
        webVersionCache: {
            type: 'none'
        },
        puppeteer: puppeteerConfig
    });

    let watchdog99Timer = null;
    let readyJaDisparado = false;

    client.on('loading_screen', (percent, message) => {
        const pct = percent || 0;
        atualizarStatusUI('authenticated', `Carregando conversas (${pct}%): ${message || 'Sincronizando WhatsApp...'}`);

        // WATCHDOG ATIVO ANTI-TRAVAMENTO 99%:
        // Se passar de 90%, inicia monitoramento do DOM do WhatsApp.
        // Assim que o container de chats estiver pronto, força a transição segura para READY!
        if (pct >= 90) {
            clearTimeout(watchdog99Timer);
            watchdog99Timer = setTimeout(async () => {
                if (!readyJaDisparado && statusAtualBot !== 'ready' && client && client.pupPage) {
                    try {
                        const prontoNoDOM = await client.pupPage.evaluate(() => {
                            try {
                                const chatList = document.querySelector('#pane-side') || 
                                                 document.querySelector('[data-testid="chat-list"]') ||
                                                 document.querySelector('div[aria-label="Lista de conversas"]') ||
                                                 document.querySelector('div[aria-label="Chat list"]');
                                if (chatList) {
                                    if (typeof window.onAppStateHasSyncedEvent === 'function') {
                                        window.onAppStateHasSyncedEvent();
                                    }
                                    return true;
                                }
                            } catch (_) {}
                            return false;
                        });

                        if (prontoNoDOM) {
                            atualizarStatusUI('ready', 'Conectado e Operante ( Monitoramento em Tempo Real )');
                            if (!readyJaDisparado) {
                                readyJaDisparado = true;
                                iniciandoBot = false;
                                reconectando = false;
                                tentativasReconexao = 0;
                                ultimoQrDataUrl = '';
                                momentoConexao = Math.floor(Date.now() / 1000);
                                try {
                                    client.emit('ready');
                                } catch (_) {}
                            }
                        }
                    } catch (_) {}
                }
            }, 3000);
        }
    });

    client.on('qr', async (qr) => {
        iniciandoBot = false;
        tentativasReconexao = 0;
        clearTimeout(watchdog99Timer);
        try {
            ultimoQrDataUrl = await qrcode.toDataURL(qr);
            atualizarStatusUI('waiting_qr', 'QR Code gerado! Aguardando leitura pelo celular...');
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-qr', ultimoQrDataUrl);
            }
        } catch (e) {}
    });

    client.on('authenticated', () => {
        ultimoQrDataUrl = '';
        tentativasReconexao = 0;
        atualizarStatusUI('authenticated', 'Autenticado! Preparando listas de mensagens...');
    });

    client.on('auth_failure', () => {
        iniciandoBot = false;
        clearTimeout(watchdog99Timer);
        atualizarStatusUI('disconnected', 'Falha de autenticação. Reiniciando sessão...');
        agendarReconexaoBackoff();
    });

    client.on('ready', () => {
        clearTimeout(watchdog99Timer);
        if (readyJaDisparado) return;
        readyJaDisparado = true;
        iniciandoBot = false;
        reconectando = false;
        tentativasReconexao = 0;
        ultimoQrDataUrl = '';
        momentoConexao = Math.floor(Date.now() / 1000);

        const cfg = carregarConfig();
        if (!cfg.primeiraConexaoTimestamp || cfg.primeiraConexaoTimestamp === 0) {
            cfg.primeiraConexaoTimestamp = momentoConexao;
            salvarConfigDisco(cfg, true);
        }

        atualizarStatusUI('ready', 'Conectado e Operante ( Monitoramento em Tempo Real )');
    });

    client.on('disconnected', () => {
        iniciandoBot = false;
        readyJaDisparado = false;
        ultimoQrDataUrl = '';
        agendarReconexaoBackoff();
    });

    client.on('message', async (msg) => {
        await processarMensagemEntrada(msg);
    });

    try {
        await client.initialize();
    } catch (e) {
        iniciandoBot = false;
        agendarReconexaoBackoff();
    }
}

ipcMain.handle('obter-config', () => carregarConfig());
ipcMain.handle('obter-versao-app', () => `v2.0 (Executive Suite)`);
ipcMain.handle('obter-estado-conexao', () => ({ status: statusAtualBot, qr: ultimoQrDataUrl, subStatus: subStatusDetalhado, tentativa: tentativasReconexao }));
ipcMain.handle('salvar-config', (e, nc) => {
    // Campos de runtime pertencem ao processo principal: o renderer guarda cópias parciais
    // (ex.: contatosAtendidos vira array vazio) que corromperiam as métricas ao autosalvar.
    const atualEmMemoria = carregarConfig();
    ['metricasReais', 'mapaNomes', 'mapaTelefones'].forEach(k => {
        if (atualEmMemoria && atualEmMemoria[k] !== undefined) nc[k] = atualEmMemoria[k];
    });
    salvarConfigDisco(nc, true);
    if (typeof nc.iniciar_com_windows !== 'undefined') {
        configurarAutoStartWindows(nc.iniciar_com_windows);
    }
    return true;
});
ipcMain.handle('obter-status-autostart', () => {
    const cfg = carregarConfig();
    return Boolean(cfg.iniciar_com_windows !== false);
});
ipcMain.handle('definir-autostart', (e, ativo) => {
    const cfg = carregarConfig();
    cfg.iniciar_com_windows = Boolean(ativo);
    salvarConfigDisco(cfg, true);
    configurarAutoStartWindows(ativo);
    return true;
});
ipcMain.handle('reiniciar-bot', () => { tentativasReconexao = 0; iniciarWhatsApp(true); return true; });
ipcMain.handle('verificar-atualizacao-manual', async () => await verificarEBaixarAtualizacaoGitHub());
ipcMain.handle('instalar-atualizacao-agora', async () => await executarInstalacaoSilenciosaUpdate());
ipcMain.handle('obter-pausados', () => contatosPausados);
ipcMain.handle('remover-pausa', (e, num) => {
    delete contatosPausados[num];
    if (configEmMemoria) salvarConfigDisco(configEmMemoria, true);
    emitirPausados();
    return contatosPausados;
});
ipcMain.handle('obter-ignorados', () => carregarContatosIgnorados());
ipcMain.handle('adicionar-ignorado', (e, item) => {
    const lista = carregarContatosIgnorados();
    const numeroLimpo = apenasNumeros(typeof item === 'object' && item !== null ? item.numero : item);
    if (!numeroLimpo) return lista;
    const jaExiste = lista.some(x => apenasNumeros(typeof x === 'object' && x !== null ? x.numero : x) === numeroLimpo);
    if (!jaExiste) {
        const novoItem = {
            id: 'ign_' + Date.now(),
            numero: numeroLimpo,
            telefoneFormatado: formatarTelefoneBrasil(numeroLimpo),
            nome: (typeof item === 'object' && item !== null && item.nome) ? String(item.nome).trim() : '',
            adicionadoEm: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        };
        lista.push(novoItem);
        salvarContatosIgnorados(lista);
    }
    return lista;
});
ipcMain.handle('remover-ignorado', (e, identificador) => {
    let lista = carregarContatosIgnorados();
    const limpo = apenasNumeros(identificador);
    lista = lista.filter(x => {
        if (typeof x === 'object' && x !== null) {
            if (x.id && x.id === identificador) return false;
            if (apenasNumeros(x.numero) === limpo) return false;
            return true;
        }
        return apenasNumeros(x) !== limpo;
    });
    salvarContatosIgnorados(lista);
    return lista;
});

// ==========================================
// MÓDULOS v2.0: INGESTÃO MULTIFORMATO & TRANSBORDO & IA
// ==========================================
const { processarArquivoIngestao, processarMultiplosArquivos, mesclarComConfigAtual, processosEquivalentes, extrairTextoDocumento } = require('./src/ingestao/motorIngestao');
const { traduzirAndamentoParaCliente, traduzirAndamentoJuridico, catalogarPecaProcessual } = require('./src/ia/tradutorJuridico');
const os = require('os');

// Ingestão de arquivo único (Legado / Fallback)
ipcMain.handle('ingestao-processar-arquivo', async (event, { caminhoArquivo, nomeArquivo, bufferBase64 }) => {
    try {
        let fonte = caminhoArquivo;
        if (bufferBase64) {
            fonte = Buffer.from(bufferBase64, 'base64');
        }
        const resultado = await processarArquivoIngestao(fonte, nomeArquivo || path.basename(caminhoArquivo || ''));
        const cfgAtual = carregarConfig();
        const existentes = Array.isArray(cfgAtual.processos) ? cfgAtual.processos : ((cfgAtual.processos && cfgAtual.processos.lista) || []);
        (resultado.processos || []).forEach(n => { n.situacao = existentes.some(p => processosEquivalentes(n, p)) ? 'ATUALIZACAO' : 'NOVO'; });
        return resultado;
    } catch (err) {
        return { success: false, error: err.message, processos: [], total: 0 };
    }
});

// Processamento unificado de lista de caminhos
ipcMain.handle('ingestao-processar-caminhos', async (event, filePaths) => {
    try {
        if (!Array.isArray(filePaths) || filePaths.length === 0) {
            return { success: false, error: 'Nenhum caminho de arquivo válido recebido.' };
        }
        const configAtual = carregarConfig();
        const resultado = await processarMultiplosArquivos(filePaths, configAtual);
        return { success: true, ...resultado };
    } catch (err) {
        console.error('Erro na ingestao-processar-caminhos:', err);
        return { success: false, error: err.message };
    }
});

// Processamento via buffer temporário (Fallback para Drag-and-Drop sem path no SO)
ipcMain.handle('ingestao-processar-buffer', async (event, listaArquivosBuffer) => {
    const caminhosTemp = [];
    try {
        if (!Array.isArray(listaArquivosBuffer) || listaArquivosBuffer.length === 0) {
            return { success: false, error: 'Nenhum buffer recebido.' };
        }
        for (const item of listaArquivosBuffer) {
            const tempPath = path.join(os.tmpdir(), `adv_import_${Date.now()}_${item.nome || 'documento.xlsx'}`);
            const buf = Buffer.isBuffer(item.buffer) ? item.buffer : Buffer.from(item.buffer);
            fs.writeFileSync(tempPath, buf);
            caminhosTemp.push(tempPath);
        }
        const configAtual = carregarConfig();
        const resultado = await processarMultiplosArquivos(caminhosTemp, configAtual);
        return { success: true, ...resultado };
    } catch (err) {
        console.error('Erro na ingestao-processar-buffer:', err);
        return { success: false, error: err.message };
    } finally {
        caminhosTemp.forEach(p => {
            try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (e) {}
        });
    }
});

// Gravação confirmada preservando 100% de menus, templates e regras
ipcMain.handle('ingestao-salvar-processos', async (event, processosParaSalvar) => {
    try {
        const configAtual = carregarConfig();
        const { configAtualizado, adicionados, atualizados, totalProcessosNaBase } = mesclarComConfigAtual(processosParaSalvar, configAtual);
        salvarConfigDisco(configAtualizado, true);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-processos-sync', configAtualizado);
        }
        return { success: true, adicionados, atualizados, totalProcessosNaBase, config: configAtualizado };
    } catch (err) {
        console.error('Erro em ingestao-salvar-processos:', err);
        return { success: false, error: err.message };
    }
});

ipcMain.handle('notify-transbordo-humano', (event, { contatoNome, telefone, motivo }) => {
    try {
        dispararNotificacaoTransbordo({ contatoNome, telefone, motivo });
        return { success: true };
    } catch (e) {
        console.warn('Erro ao disparar notificação nativa:', e);
        return { success: false, error: e.message };
    }
});

ipcMain.handle('ingestao-selecionar-arquivos', async () => {
    try {
        if (!mainWindow) return { canceled: true, filePaths: [] };
        const result = await dialog.showOpenDialog(mainWindow, {
            title: 'Selecionar Planilhas ou Documentos de Processos',
            buttonLabel: 'Importar Arquivos',
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'Documentos e Planilhas Aceitos', extensions: ['xlsx', 'xls', 'csv', 'ods', 'pdf', 'docx', 'txt', 'log'] },
                { name: 'Planilhas (Excel / CSV)', extensions: ['xlsx', 'xls', 'csv', 'ods'] },
                { name: 'Documentos PDF (Tribunais)', extensions: ['pdf'] },
                { name: 'Documentos Word (.docx)', extensions: ['docx'] },
                { name: 'Textos / Extratos (.txt)', extensions: ['txt', 'log'] },
                { name: 'Todos os Arquivos', extensions: ['*'] }
            ]
        });
        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
            return { canceled: true, filePaths: [] };
        }
        const configAtual = carregarConfig();
        const analise = await processarMultiplosArquivos(result.filePaths, configAtual);
        return { canceled: false, filePaths: result.filePaths, ...analise };
    } catch (err) {
        return { canceled: true, error: err.message, filePaths: [] };
    }
});

// Download da Planilha Modelo (Cópia fiel do arquivo oficial com fallback gerado)
ipcMain.handle('ingestao-baixar-planilha-modelo', async () => {
    try {
        if (!mainWindow) return { success: false };
        const saveDialog = await dialog.showSaveDialog(mainWindow, {
            title: 'Salvar Planilha Modelo de Processos',
            defaultPath: 'Planilha_Modelo_Processos_Advocacia.xlsx',
            filters: [{ name: 'Planilha Excel (*.xlsx)', extensions: ['xlsx'] }]
        });
        if (saveDialog.canceled || !saveDialog.filePath) {
            return { success: false, canceled: true };
        }

        const modeloOrigem = path.join(__dirname, 'exemplos_importacao', '1_Planilha_Modelo_Oficial.xlsx');
        if (fs.existsSync(modeloOrigem)) {
            fs.copyFileSync(modeloOrigem, saveDialog.filePath);
        } else {
            const XLSX = require('xlsx');
            const wb = XLSX.utils.book_new();
            const dadosExemplo = [
                {
                    "NOME DO CLIENTE": "Maria Oliveira da Silva",
                    "CPF": "529.982.247-25",
                    "NUMERO DO PROCESSO": "0001234-56.2023.8.26.0100",
                    "DATA": new Date().toLocaleDateString('pt-BR'),
                    "RESUMO / ANDAMENTO": "Intimação expedida para réplica no prazo legal de 15 dias."
                },
                {
                    "NOME DO CLIENTE": "Carlos Eduardo Pereira",
                    "CPF": "111.444.777-35",
                    "NUMERO DO PROCESSO": "1005555-88.2024.8.26.0050",
                    "DATA": new Date().toLocaleDateString('pt-BR'),
                    "RESUMO / ANDAMENTO": "Sentença de procedência parcial publicada no Diário da Justiça."
                }
            ];
            const ws = XLSX.utils.json_to_sheet(dadosExemplo);
            XLSX.utils.book_append_sheet(wb, ws, "Processos e Clientes");
            XLSX.writeFile(wb, saveDialog.filePath);
        }
        return { success: true, filePath: saveDialog.filePath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// Teste de Conexão com Google Gemini API
ipcMain.handle('ia-testar-conexao', async (event, chaveManual) => {
    try {
        const config = carregarConfig();
        const resultado = await traduzirAndamentoJuridico(
            `Vistos. Especifiquem as partes as provas que pretendem produzir, justificando sua pertinência em 15 dias. [Teste #${Date.now()}]`,
            {
                apiKey: chaveManual,
                config,
                timeoutMs: 8000,
                desativarPersistencia: true
            }
        );
        if (resultado.fonte === 'ia') {
            return { success: true, mensagem: `Conectado com sucesso à IA Gemini (${resultado.modelo || 'gemini-flash'})!`, texto: resultado.texto, modelo: resultado.modelo };
        }
        return { success: false, mensagem: `Não foi possível conectar (${resultado.erro || 'verifique a chave ou o status da rede'}).` };
    } catch (err) {
        return { success: false, error: err.message, mensagem: err.message };
    }
});

// SIMULADOR DE CHAT CLIENTE (SANDBOX LOCAL — FUNCIONA 100% SEM WHATSAPP CONECTADO)
async function executarSimulacaoMensagem({ texto, telefone, nome } = {}) {
    try {
        const telLimpo = (telefone || '5511999998888').replace(/\D/g, '') || '5511999998888';
        const nomeCliente = (nome || 'Cliente Teste').trim();
        const chatId = `${telLimpo}@c.us`;

        let respostaSimulada = '';
        let acaoTransbordo = false;

        // Mock de mensagem com interface compatível com processarMensagemEntrada
        const mockMsg = {
            id: { id: `sim_${Date.now()}`, _serialized: `sim_${Date.now()}` },
            from: chatId,
            fromMe: false,
            isStatus: false,
            broadcast: false,
            body: String(texto || '').trim(),
            timestamp: Math.floor(Date.now() / 1000),
            _data: { notifyName: nomeCliente, pushname: nomeCliente },
            getContact: async () => ({
                number: telLimpo,
                name: nomeCliente,
                pushname: nomeCliente
            })
        };

        const config = carregarConfig();
        const identidade = await resolverIdentidadeCompleta(mockMsg, config);
        const remetenteChave = identidade.chaveCliente;
        const gatilhoDigitado = extrairGatilhoLimpo(mockMsg.body);

        // Espelha o fluxo real: contato pausado (aguardando advogado) não recebe resposta do robô
        const regPausaSim = contatosPausados[remetenteChave];
        const tsPausaSim = regPausaSim && (typeof regPausaSim === 'object' ? regPausaSim.timestamp : regPausaSim);
        if (tsPausaSim && (Date.now() - tsPausaSim < 24 * 60 * 60 * 1000)) {
            const horaAtual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const novaMsg = {
                de: 'cliente',
                texto: mockMsg.body,
                hora: horaAtual
            };

            if (!historicoConversas[remetenteChave]) historicoConversas[remetenteChave] = [];
            historicoConversas[remetenteChave].push(novaMsg);

            if (contatosPausados[remetenteChave] && typeof contatosPausados[remetenteChave] === 'object') {
                if (!Array.isArray(contatosPausados[remetenteChave].mensagens)) {
                    contatosPausados[remetenteChave].mensagens = [];
                }
                contatosPausados[remetenteChave].mensagens.push(novaMsg);
                if (dadosAudiosPorContato[remetenteChave]) {
                    contatosPausados[remetenteChave].audioBase64 = dadosAudiosPorContato[remetenteChave].audioBase64;
                    contatosPausados[remetenteChave].transcricao = dadosAudiosPorContato[remetenteChave].transcricao;
                    contatosPausados[remetenteChave].resumo = dadosAudiosPorContato[remetenteChave].resumo;
                    contatosPausados[remetenteChave].sugestoesResposta = dadosAudiosPorContato[remetenteChave].sugestoesResposta;
                }
                emitirPausados();
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', {
                    numero: identidade.telefoneFormatado,
                    nome: identidade.nomeCliente || '',
                    exibicao: identidade.exibicao,
                    msg: `[Fila Humana] ${mockMsg.body}`,
                    hora: horaAtual
                });
            }

            return { success: true, sucesso: true, resposta: '', pausado: true, transbordo: false };
        }

        // Métricas do topo + Histórico de Mensagens (mesmo caminho do WhatsApp real)
        if (!config.metricasReais) config.metricasReais = { totalMensagens: 0, contatosAtendidos: [] };
        if (!Array.isArray(config.metricasReais.contatosAtendidos)) config.metricasReais.contatosAtendidos = [];
        config.metricasReais.totalMensagens += 1;
        if (!config.metricasReais.contatosAtendidos.includes(remetenteChave)) {
            config.metricasReais.contatosAtendidos.push(remetenteChave);
        }
        salvarConfigDisco(config, false);
        const horaLog = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-log', {
                numero: identidade.telefoneFormatado,
                nome: identidade.nomeCliente || '',
                exibicao: identidade.exibicao,
                msg: mockMsg.body,
                hora: horaLog(),
                metricasReais: {
                    totalMensagens: config.metricasReais.totalMensagens,
                    totalContatos: config.metricasReais.contatosAtendidos.length
                }
            });
        }

        if (!historicoConversas[remetenteChave]) historicoConversas[remetenteChave] = [];
        historicoConversas[remetenteChave].push({
            de: 'cliente',
            texto: mockMsg.body,
            hora: horaLog()
        });

        const prefixoHorario = obterPrefixoHorario(config, remetenteChave);
        const responderCliente = async (txt) => {
            respostaSimulada = prefixoHorario + txt;
        };
        const finalizarSimulacao = () => {
            if (respostaSimulada && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', {
                    numero: identidade.telefoneFormatado,
                    nome: '🤖 Robô → ' + (identidade.nomeCliente || 'Cliente'),
                    exibicao: '🤖 Robô',
                    msg: respostaSimulada.replace(/\s+/g, ' ').slice(0, 180),
                    hora: horaLog()
                });
            }
            return {
                success: true,
                sucesso: true,
                resposta: respostaSimulada,
                transbordo: acaoTransbordo,
                pausado: Boolean(contatosPausados[remetenteChave]),
                itemPausado: contatosPausados[remetenteChave] || null
            };
        };

        const colocarNaFilaHumana = async (mensagemConfirmacao, motivo = 'Novo Atendimento', opcoesExtras = {}) => {
            acaoTransbordo = true;
            const audioSalvo = dadosAudiosPorContato[remetenteChave] || {};
            const acoesItem = opcoesExtras.acoes || null;
            const registroExistente = contatosPausados[remetenteChave];
            const msgsIniciais = (registroExistente && Array.isArray(registroExistente.mensagens))
                ? [...registroExistente.mensagens]
                : (historicoConversas[remetenteChave] || []).slice(-10);

            contatosPausados[remetenteChave] = {
                timestamp: Date.now(),
                nome: identidade.nomeCliente || '',
                telefone: identidade.telefoneFormatado,
                exibicao: identidade.exibicao,
                motivo: motivo,
                idChat: mockMsg.from,
                origem: 'SIMULADOR',
                mensagens: msgsIniciais,
                audioBase64: audioSalvo.audioBase64 || null,
                transcricao: audioSalvo.transcricao || null,
                resumo: audioSalvo.resumo || null,
                sugestoesResposta: audioSalvo.sugestoesResposta || null,
                acoes: acoesItem,
                aguardandoAudioRelato: Boolean(acoesItem && acoesItem.aguardarAudioRelato)
            };
            delete estadosUsuarios[remetenteChave];
            salvarConfigDisco(config, true);
            emitirPausados();
            if (opcoesExtras.alertar !== false) {
                dispararNotificacaoTransbordo({
                    contatoNome: identidade.nomeCliente || identidade.exibicao || '',
                    telefone: identidade.telefoneFormatado || mockMsg.from,
                    motivo: `[SIMULADOR] ${motivo}`
                });
            }
            await responderCliente(mensagemConfirmacao);
        };

        const estadoAtual = estadosUsuarios[remetenteChave] || 'raiz';
        const tplsProc = (config.processos && config.processos.mensagens) || criarConfigPadrao().processos.mensagens;

        // Frases universais de transbordo humano direto (ex.: botão "Chamar Advogado" ou digitação livre)
        if (FRASES_TRANSBORDO_DIRETO.some(f => gatilhoDigitado === f || gatilhoDigitado.includes(f))) {
            const opHumano = ((config.fluxo && config.fluxo.raiz && config.fluxo.raiz.opcoes) || []).find(op => op.tipo === 'humano');
            const msgTransbordo = (opHumano && opHumano.resposta) || tplsProc.msg_chamar_advogado_pos_proc || "👨‍⚖️ Perfeito! Um advogado da nossa equipe já foi acionado e já está chegando para atender você.";
            await colocarNaFilaHumana(msgTransbordo, 'Solicitação direta de atendimento humano');
            return finalizarSimulacao();
        }

        if (estadoAtual === 'pos_consulta_processo') {
            if (gatilhoDigitado === '1') {
                delete estadosUsuarios[remetenteChave];
                await responderCliente(tplsProc.msg_encerrar_conversa || "✅ Atendimento finalizado! Agradecemos o seu contato.");
                return finalizarSimulacao();
            }
            if (gatilhoDigitado === '2') {
                await colocarNaFilaHumana(tplsProc.msg_chamar_advogado_pos_proc || "👨‍⚖️ Perfeito! Um advogado da nossa equipe já foi acionado e já está chegando para atender você.");
                return finalizarSimulacao();
            }
        }

        const saudacoes = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "menu", "inicio", "início", "ajuda"];
        if (gatilhoDigitado === "0" || saudacoes.some(s => gatilhoDigitado === s || gatilhoDigitado.startsWith(s + " "))) {
            estadosUsuarios[remetenteChave] = 'raiz';
            await responderCliente(montarTextoEtapa(config.fluxo.raiz));
            return finalizarSimulacao();
        }

        // Helper que busca no banco ou retorna processo demonstrativo para o CPF de teste padrão do Simulador (123.456.789-00)
        const buscarProcessoSimulador = (digitos) => {
            let proc = buscarProcessoPorNumero(config, digitos);
            if (!proc && digitos === '12345678900') {
                const lista = Array.isArray(config.processos) ? config.processos : ((config.processos && config.processos.lista) || []);
                proc = lista[0] || {
                    id: 'proc_demo_simulador',
                    numero: '0004589-72.2025.8.26.0100',
                    numeroProcesso: '0004589-72.2025.8.26.0100',
                    cpf: '12345678900',
                    nome: nomeCliente || 'Cliente Demonstração',
                    resumo: 'Vistos. Julgo PROCEDENTE o pedido inicial para condenar a parte ré ao pagamento de R$ 18.500,00 a título de indenização, bem como determino a expedição imediata de alvará eletrônico após o trânsito em julgado.',
                    atualizadoEm: new Date().toLocaleDateString('pt-BR')
                };
            }
            return proc;
        };

        if (estadoAtual === 'aguardando_processo') {
            const digitos = apenasNumeros(mockMsg.body);
            const procAchado = buscarProcessoSimulador(digitos);
            if (procAchado) {
                if (procAchado.nome && !config.mapaNomes[remetenteChave]) {
                    config.mapaNomes[remetenteChave] = procAchado.nome;
                }
                estadosUsuarios[remetenteChave] = 'pos_consulta_processo';
                const textoProc = await formatarMensagemProcesso(config, procAchado, remetenteChave);
                await responderCliente(textoProc);
                return finalizarSimulacao();
            } else {
                const msgNaoEncontrado = tplsProc.msg_nao_encontrado || criarConfigPadrao().processos.mensagens.msg_nao_encontrado;
                await responderCliente(msgNaoEncontrado);
                return finalizarSimulacao();
            }
        }

        const etapaAtual = (estadoAtual === 'raiz' || estadoAtual === 'pos_consulta_processo')
            ? config.fluxo.raiz
            : (config.fluxo.etapas[estadoAtual] || config.fluxo.raiz);

        const opcaoEscolhida = (etapaAtual.opcoes || []).find(op => {
            const g = String(op.gatilho || '').trim().toLowerCase();
            const r = String(op.rotulo || '').trim().toLowerCase();
            return g === gatilhoDigitado || (r && r === gatilhoDigitado);
        });

        if (opcaoEscolhida) {
            const acoes = opcaoEscolhida.acoes || {};
            const deveEncaminharFila = opcaoEscolhida.tipo === 'humano' || Boolean(acoes.encaminharFilaHumana) || Boolean(acoes.pausarRobo);

            // Se a opção possui ações ativas (encaminharFilaHumana, humano ou pausarRobo), a ação PREVALECE!
            if (deveEncaminharFila) {
                const motivoFila = acoes.motivoFila || opcaoEscolhida.rotulo || 'Novo Atendimento';
                const msgConfirmacao = opcaoEscolhida.resposta || "Perfeito! Sua solicitação foi registrada e nossa equipe jurídica já foi notificada para lhe atender.";
                const alertar = acoes.dispararAlertaSonoro !== false;
                await colocarNaFilaHumana(msgConfirmacao, motivoFila, { acoes, alertar });
                return finalizarSimulacao();
            }

            if (opcaoEscolhida.tipo === 'submenu') {
                const dest = opcaoEscolhida.destino || 'raiz';
                estadosUsuarios[remetenteChave] = dest;
                const proxEtapa = dest === 'raiz' ? config.fluxo.raiz : config.fluxo.etapas[dest];
                await responderCliente(montarTextoEtapa(proxEtapa || config.fluxo.raiz));
                return finalizarSimulacao();
            }
            if (opcaoEscolhida.tipo === 'processo') {
                estadosUsuarios[remetenteChave] = 'aguardando_processo';
                await responderCliente(opcaoEscolhida.resposta || "Por favor, digite apenas o seu *CPF* ou o *Número do Processo*:");
                return finalizarSimulacao();
            }
            if (opcaoEscolhida.resposta) {
                await responderCliente(opcaoEscolhida.resposta);
                return finalizarSimulacao();
            }
        }

        const digitosDiretos = apenasNumeros(mockMsg.body);
        if (digitosDiretos.length >= 9) {
            const procDireto = buscarProcessoSimulador(digitosDiretos);
            if (procDireto) {
                if (procDireto.nome && !config.mapaNomes[remetenteChave]) {
                    config.mapaNomes[remetenteChave] = procDireto.nome;
                }
                estadosUsuarios[remetenteChave] = 'pos_consulta_processo';
                const textoProc = await formatarMensagemProcesso(config, procDireto, remetenteChave);
                await responderCliente(textoProc);
                return finalizarSimulacao();
            }
        }

        estadosUsuarios[remetenteChave] = 'raiz';
        await responderCliente(montarTextoEtapa(config.fluxo.raiz));
        return finalizarSimulacao();
    } catch (err) {
        console.error('Erro no simulador-enviar-mensagem:', err);
        return { success: false, sucesso: false, error: err.message, erro: err.message, resposta: 'Erro ao processar mensagem simulada.' };
    }
}

ipcMain.handle('simulador-enviar-mensagem', async (event, payload) => {
    return await executarSimulacaoMensagem(payload);
});

// RESETAR CONVERSA DO SIMULADOR / DESPAUSAR ROBÔ
async function resetarConversaSimulador(dados = {}) {
    const tel = String((dados && dados.telefone) || '').replace(/\D/g, '') || '5511999998888';
    let despausado = false;
    [tel, `${tel}@c.us`].forEach(k => {
        delete estadosUsuarios[k];
        delete historicoConversas[k];
        delete dadosAudiosPorContato[k];
        if (contatosPausados[k]) { delete contatosPausados[k]; despausado = true; }
    });
    // Libera o reenvio de andamentos para este contato (permite testar "novo andamento" de novo)
    const cfg = carregarConfig();
    const lista = Array.isArray(cfg.processos) ? cfg.processos : ((cfg.processos && cfg.processos.lista) || []);
    lista.forEach(p => { if (p.consultasPorContato) { delete p.consultasPorContato[tel]; p._resetarVistos = true; } });
    salvarConfigDisco(cfg, false);
    emitirPausados();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bot-processos-sync', cfg);
    return { success: true, despausado };
}

ipcMain.handle('simulador-resetar-conversa', async (event, dados) => {
    return await resetarConversaSimulador(dados);
});

// CADASTRO MANUAL DE PROCESSO (usa a MESMA regra de deduplicação da importação de planilhas)
ipcMain.handle('processo-salvar-manual', async (event, registro) => {
    if (!registro || typeof registro !== 'object') return { success: false, error: 'Registro inválido.' };
    const configAtual = carregarConfig();
    const { configAtualizado, adicionados, atualizados } = mesclarComConfigAtual([{
        ...registro,
        numeroProcesso: registro.numeroProcesso || registro.numero || '',
        origem: registro.origem || { tipo: 'MANUAL', arquivo: 'cadastro manual' }
    }], configAtual);
    const lista = Array.isArray(configAtualizado.processos) ? configAtualizado.processos : configAtualizado.processos.lista;
    const salvo = lista.find(p => processosEquivalentes(registro, p));
    salvarConfigDisco(configAtualizado, true);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bot-processos-sync', configAtualizado);
    return { success: true, adicionados, atualizados, id: salvo ? salvo.id : null, config: configAtualizado };
});

// ANEXAR PEÇAS PROCESSUAIS (PDF / DOCX / TXT) A UM PROCESSO ESPECÍFICO -> documentosCatalogados
async function anexarArquivosAoProcesso(processoId, caminhos) {
    const config = carregarConfig();
    const lista = Array.isArray(config.processos) ? config.processos : ((config.processos && config.processos.lista) || []);
    const proc = lista.find(p => p.id === processoId);
    if (!proc) return { success: false, error: 'Processo não encontrado.' };
    if (!Array.isArray(proc.documentosCatalogados)) proc.documentosCatalogados = [];
    if (!Array.isArray(proc.historicoAndamentos)) proc.historicoAndamentos = [];

    const LIMITE_BYTES = 25 * 1024 * 1024;
    const avisos = [];
    let anexados = 0;
    const digitosProc = String(proc.numero || proc.numeroProcesso || '').replace(/\D/g, '');

    for (const caminho of caminhos) {
        const nomeArquivo = path.basename(caminho);
        try {
            const stat = fs.statSync(caminho);
            if (stat.size > LIMITE_BYTES) { avisos.push(`${nomeArquivo}: arquivo maior que 25 MB, ignorado.`); continue; }
            const ext = await extrairTextoDocumento(caminho, nomeArquivo);
            if (!ext.success) { avisos.push(`${nomeArquivo}: ${ext.error}`); continue; }
            if (ext.alerta) avisos.push(`${nomeArquivo}: ${ext.alerta}`);

            const cat = ext.texto
                ? await catalogarPecaProcessual(ext.texto, { config, nomeArquivo })
                : { tipoPeca: 'DOCUMENTO_PROCESSUAL', assunto: 'Documento sem texto pesquisável', decisao: '-', proximoPasso: '-', resumoCliente: 'Documento anexado ao processo.', fonte: 'sem-texto', dadosExtraidos: {} };

            const cnjDoc = String((cat.dadosExtraidos && cat.dadosExtraidos.numeroProcesso) || '').replace(/\D/g, '');
            if (cnjDoc && digitosProc && cnjDoc !== digitosProc) {
                avisos.push(`${nomeArquivo}: o número do processo no documento (${cat.dadosExtraidos.numeroProcesso}) é diferente do processo selecionado.`);
            }

            const doc = {
                id: 'doc_' + Date.now() + '_' + anexados,
                nomeArquivo,
                tamanhoBytes: stat.size,
                tipoPeca: cat.tipoPeca,
                assunto: cat.assunto,
                decisao: cat.decisao,
                proximoPasso: cat.proximoPasso,
                resumoIA: cat.resumoCliente,
                resumoCliente: cat.resumoCliente,
                fonteResumo: cat.fonte || 'local',
                dadosExtraidos: cat.dadosExtraidos || {},
                anexadoEm: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
                timestamp: Date.now()
            };
            const idxMesmo = proc.documentosCatalogados.findIndex(d => d.nomeArquivo === nomeArquivo);
            if (idxMesmo !== -1) proc.documentosCatalogados[idxMesmo] = doc; else proc.documentosCatalogados.unshift(doc);

            proc.historicoAndamentos.unshift({
                data: doc.anexadoEm,
                tipo: 'PECA',
                textoBruto: `📎 Peça anexada: ${nomeArquivo} — ${cat.decisao}`,
                textoHumanizado: cat.resumoCliente,
                timestamp: doc.timestamp
            });
            anexados++;
        } catch (err) {
            avisos.push(`${nomeArquivo}: ${err.message}`);
        }
    }

    proc.updatedAt = Date.now();
    salvarConfigDisco(config, true);
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('bot-processos-sync', config);
    return { success: anexados > 0 || avisos.length === 0, anexados, avisos, documentos: proc.documentosCatalogados, config };
}

ipcMain.handle('processo-anexar-pecas', async (event, dados) => {
    const processoId = dados && dados.processoId;
    if (!processoId) return { success: false, error: 'Processo não informado.' };
    if (!mainWindow) return { success: false, error: 'Janela indisponível.' };
    const sel = await dialog.showOpenDialog(mainWindow, {
        title: 'Anexar peças ao processo',
        buttonLabel: 'Anexar',
        properties: ['openFile', 'multiSelections'],
        filters: [
            { name: 'Peças (PDF, Word, Texto)', extensions: ['pdf', 'docx', 'txt'] },
            { name: 'Todos os Arquivos', extensions: ['*'] }
        ]
    });
    if (sel.canceled || !sel.filePaths || sel.filePaths.length === 0) return { success: false, canceled: true };
    return await anexarArquivosAoProcesso(processoId, sel.filePaths);
});

// Mesma ação para arquivos já conhecidos (arrastar e soltar sobre o processo)
ipcMain.handle('processo-anexar-pecas-caminhos', async (event, dados) => {
    const { processoId, caminhos } = dados || {};
    if (!processoId || !Array.isArray(caminhos) || caminhos.length === 0) return { success: false, error: 'Dados inválidos.' };
    return await anexarArquivosAoProcesso(processoId, caminhos);
});

// HIGIENIZAÇÃO DE BASE LOCAL
ipcMain.handle('processos-higienizar-base', async () => {
    try {
        const { higienizarBaseProcessos } = require('./src/ingestao/higienizarBase');
        const configAtual = carregarConfig();
        const res = higienizarBaseProcessos(configAtual);
        salvarConfigDisco(res.configHigienizado, true);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-processos-sync', res.configHigienizado);
        }
        return { sucesso: true, ...res };
    } catch (err) {
        return { sucesso: false, erro: err.message };
    }
});

// CATALOGAR PEÇA PROCESSUAL COM IA
ipcMain.handle('ia-catalogar-peca', async (event, { texto, nomeArquivo }) => {
    try {
        const { catalogarPecaProcessual } = require('./src/ia/tradutorJuridico');
        const config = carregarConfig();
        const resultado = await catalogarPecaProcessual(texto, { config });
        return { sucesso: true, resultado };
    } catch (err) {
        return { sucesso: false, erro: err.message };
    }
});

// TRANSCRIÇÃO DE ÁUDIO E COPILOT ONE-CLICK
ipcMain.handle('processar-audio-copilot', async (event, dados = {}) => {
    try {
        const { processarAudioECopilot } = require('./src/ia/tradutorJuridico');
        const { audioBase64, mimeType, contexto } = dados;
        const config = carregarConfig ? carregarConfig() : {};
        const contextoFinal = {
            ...(contexto || {}),
            apiKey: (contexto && contexto.apiKey) || config.gemini_api_key || process.env.GEMINI_API_KEY
        };
        const resultado = await processarAudioECopilot(audioBase64, mimeType || 'audio/webm', contextoFinal);

        // Enriquecer e sincronizar com contato pausado
        const telLimpo = apenasNumeros((contexto && (contexto.telefone || contexto.numero || contexto.chave)) || '');
        if (telLimpo) {
            dadosAudiosPorContato[telLimpo] = {
                audioBase64,
                mimeType,
                transcricao: resultado.transcricao,
                resumo: resultado.resumo,
                sugestoesResposta: resultado.sugestoesResposta
            };
            if (contatosPausados[telLimpo]) {
                contatosPausados[telLimpo].audioBase64 = audioBase64;
                contatosPausados[telLimpo].transcricao = resultado.transcricao;
                contatosPausados[telLimpo].resumo = resultado.resumo;
                contatosPausados[telLimpo].sugestoesResposta = resultado.sugestoesResposta;
                if (!Array.isArray(contatosPausados[telLimpo].mensagens)) {
                    contatosPausados[telLimpo].mensagens = [];
                }
                contatosPausados[telLimpo].mensagens.push({
                    de: 'cliente',
                    texto: `🎙️ [Mensagem de Voz]: "${resultado.transcricao || 'Áudio enviado'}"`,
                    hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
                emitirPausados();
            }
        }

        return resultado;
    } catch (err) {
        return {
            sucesso: false,
            erro: err.message,
            transcricao: "[Não foi possível processar o áudio]",
            resumo: "• Erro interno ao despachar áudio.",
            sugestoesResposta: [
                "Olá! Recebi seu áudio e já estou verificando sua solicitação.",
                "Poderia nos resumir o seu pedido por texto enquanto abro sua ficha?",
                "Entendido. Em breve retornaremos com a orientação jurídica necessária."
            ]
        };
    }
});

// RESPONDER CLIENTE PAUSADO (FINALIZA ATENDIMENTO NA FILA)
ipcMain.handle('responder-cliente-pausado', async (event, { chave, textoResposta }) => {
    try {
        const numLimpo = apenasNumeros(chave);
        const item = contatosPausados[numLimpo] || contatosPausados[chave];
        if (item) {
            if (item.origem === 'WHATSAPP' && client && item.idChat) {
                try {
                    await client.sendMessage(item.idChat, `👨‍⚖️ *Mensagem do Advogado:*\n\n${textoResposta}`);
                } catch (e) {
                    console.error('Erro ao enviar mensagem pelo WhatsApp:', e);
                }
            } else if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('simulador-resposta-advogado', {
                    chave: numLimpo,
                    texto: textoResposta,
                    nomeAdvogado: 'Advogado Responsável'
                });
            }
            delete contatosPausados[numLimpo];
            delete contatosPausados[chave];
            emitirPausados();
            return { sucesso: true, despausado: true };
        }
        return { sucesso: false, erro: 'Contato não localizado na fila.' };
    } catch (err) {
        return { sucesso: false, erro: err.message };
    }
});

// MELHORAR MENSAGEM COM IA (TERMOS TÉCNICOS ACESSÍVEIS, EMOJIS E INTERAÇÕES)
ipcMain.handle('ia-melhorar-mensagem', async (event, dados = {}) => {
    try {
        const texto = typeof dados === 'string' ? dados : (dados && dados.texto ? dados.texto : '');
        const contexto = (dados && typeof dados === 'object' && dados.contexto) ? dados.contexto : (typeof dados === 'object' ? dados : {});
        const { melhorarMensagemComIA, melhorarMensagemLocalmente } = require('./src/ia/tradutorJuridico');
        const cfg = typeof carregarConfig === 'function' ? carregarConfig() : {};
        const chaveResolvida = (contexto && contexto.apiKey) || cfg.gemini_api_key || (cfg.ia && cfg.ia.gemini_api_key) || (cfg.processos && cfg.processos.gemini_api_key) || process.env.GEMINI_API_KEY || '';
        const contextoFinal = {
            config: cfg,
            apiKey: chaveResolvida,
            ...(contexto || {})
        };
        const resultado = await melhorarMensagemComIA(texto, contextoFinal);
        return {
            sucesso: true,
            texto: (resultado && resultado.texto) ? String(resultado.texto) : (typeof resultado === 'string' ? resultado : ''),
            fonte: (resultado && resultado.fonte) || 'ia',
            duracaoMs: (resultado && resultado.duracaoMs) || 0
        };
    } catch (err) {
        console.error('[IA] Falha ao melhorar mensagem no main process, aplicando fallback gracioso:', err.message);
        try {
            const { melhorarMensagemLocalmente } = require('./src/ia/tradutorJuridico');
            const textoLimpo = typeof dados === 'string' ? dados : (dados && dados.texto ? dados.texto : '');
            const fallback = melhorarMensagemLocalmente(textoLimpo);
            return { sucesso: true, texto: String(fallback), fonte: 'fallback', duracaoMs: 0 };
        } catch (e2) {
            return { sucesso: true, texto: typeof dados === 'string' ? dados : (dados?.texto || ''), fonte: 'original', duracaoMs: 0 };
        }
    }
});

module.exports = {
    traduzirAndamentoParaCliente,
    formatarMensagemProcesso,
    buscarProcessoPorNumero,
    processarMensagemEntrada,
    executarSimulacaoMensagem,
    resetarConversaSimulador
};
