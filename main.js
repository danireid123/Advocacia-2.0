const electronModulo = require('electron');
const { app, BrowserWindow, ipcMain, nativeImage, dialog, Notification, Menu, safeStorage } = electronModulo;
const path = require('path');
const crypto = require('crypto');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
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
let processosSelecionaveisPorContato = {};
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

function normalizarTelefoneSimetricoBR(num) {
    let d = String(num || '').replace(/\D/g, '');
    if (d.length >= 12 && d.startsWith('55')) d = d.slice(2);
    return d;
}

function isContactIgnored(fromNumber, ignoredList) {
    const cleanNumber = normalizarTelefoneSimetricoBR(fromNumber);
    if (!cleanNumber) return false;
    const list = Array.isArray(ignoredList) ? ignoredList : carregarContatosIgnorados();
    if (!Array.isArray(list) || list.length === 0) return false;
    return list
        .map(item => {
            const itemNum = typeof item === 'object' && item !== null ? (item.numero || item.telefone || '') : item;
            return normalizarTelefoneSimetricoBR(itemNum);
        })
        .filter(item => item.length >= 4) // ignora entradas vazias ou curtas
        .some(item => {
            if (cleanNumber === item) return true;
            if (cleanNumber.length >= 8 && item.length >= 8 && cleanNumber.slice(-8) === item.slice(-8)) {
                return cleanNumber.slice(0, 2) === item.slice(0, 2) || cleanNumber.length <= 9 || item.length <= 9;
            }
            return cleanNumber.includes(item) || item.includes(cleanNumber);
        });
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
        if (!fs.existsSync(AUTH_DIR)) return;
        const pastas = ['session-advocacia-desktop-session', 'session-adv_studio_client'];
        try {
            const entradas = fs.readdirSync(AUTH_DIR, { withFileTypes: true });
            for (const ent of entradas) {
                if (ent.isDirectory() && ent.name.startsWith('session-') && !pastas.includes(ent.name)) {
                    pastas.push(ent.name);
                }
            }
        } catch (_) {}

        for (const pasta of pastas) {
            const pastaSessao = path.join(AUTH_DIR, pasta);
            const possiveisLocks = [
                path.join(pastaSessao, 'SingletonLock'),
                path.join(pastaSessao, 'SingletonCookie'),
                path.join(pastaSessao, 'SingletonSocket'),
                path.join(pastaSessao, 'lockfile'),
                path.join(pastaSessao, 'Default', 'SingletonLock'),
                path.join(pastaSessao, 'Default', 'SingletonCookie'),
                path.join(pastaSessao, 'Default', 'SingletonSocket'),
                path.join(pastaSessao, 'Default', 'lockfile')
            ];
            for (const arq of possiveisLocks) {
                try {
                    if (fs.existsSync(arq)) {
                        fs.unlinkSync(arq);
                    }
                } catch (e) {}
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

const CHAVE_FALLBACK_NODE = crypto.scryptSync('advocacia-studio-pro-v2-safestorage-fallback', 'adv-salt-v2', 32);

function obterSafeStorageAtivo() {
    const storage = safeStorage || (electronModulo && electronModulo.safeStorage);
    if (storage && typeof storage.isEncryptionAvailable === 'function' && storage.isEncryptionAvailable()) {
        return storage;
    }
    return null;
}

function cifrarChaveApi(chavePlana) {
    if (!chavePlana || typeof chavePlana !== 'string') return '';
    const limpa = chavePlana.trim();
    if (!limpa) return '';
    try {
        const storage = obterSafeStorageAtivo();
        if (storage && typeof storage.encryptString === 'function') {
            const buf = storage.encryptString(limpa);
            return Buffer.isBuffer(buf) ? buf.toString('base64') : Buffer.from(String(buf)).toString('base64');
        }
    } catch (err) {
        console.warn('[SafeStorage] Aviso ao cifrar via Electron safeStorage, usando fallback AES:', err.message);
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', CHAVE_FALLBACK_NODE, iv);
    const enc = Buffer.concat([cipher.update(limpa, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([Buffer.from('ADV2AES:'), iv, tag, enc]).toString('base64');
}

function decifrarChaveApi(valorCifrado) {
    if (!valorCifrado || typeof valorCifrado !== 'string') return '';
    const limpo = valorCifrado.trim();
    if (!limpo) return '';
    try {
        const rawBuf = Buffer.from(limpo, 'base64');
        if (rawBuf.length > 36 && rawBuf.subarray(0, 8).toString('utf8') === 'ADV2AES:') {
            const iv = rawBuf.subarray(8, 20);
            const tag = rawBuf.subarray(20, 36);
            const enc = rawBuf.subarray(36);
            const decipher = crypto.createDecipheriv('aes-256-gcm', CHAVE_FALLBACK_NODE, iv);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
        }
        const storage = obterSafeStorageAtivo();
        if (storage && typeof storage.decryptString === 'function') {
            return storage.decryptString(rawBuf);
        }
    } catch (err) {
        console.warn('[SafeStorage] Falha ao decifrar chave API:', err.message);
    }
    return '';
}

function extrairChaveApiPlana(cfg) {
    if (!cfg || typeof cfg !== 'object') return '';
    const candidata = cfg.gemini_api_key
        || cfg.geminiApiKey
        || (cfg.ia && (cfg.ia.apiKey || cfg.ia.gemini_api_key || cfg.ia.chave))
        || (cfg.processos && cfg.processos.gemini_api_key)
        || '';
    return typeof candidata === 'string' ? candidata.trim() : '';
}

function removerCamposChavePlana(alvo) {
    if (!alvo || typeof alvo !== 'object') return;
    delete alvo.gemini_api_key;
    delete alvo.geminiApiKey;
    delete alvo.nova_gemini_api_key;
    delete alvo.remover_gemini_api_key;
    if (alvo.ia && typeof alvo.ia === 'object') {
        delete alvo.ia.apiKey;
        delete alvo.ia.gemini_api_key;
        delete alvo.ia.chave;
    }
    if (alvo.processos && typeof alvo.processos === 'object') {
        delete alvo.processos.gemini_api_key;
    }
}

function prepararConfigParaDisco(cfg) {
    if (!cfg || typeof cfg !== 'object') return {};
    const copiaDisco = JSON.parse(JSON.stringify(cfg));
    const chavePlana = extrairChaveApiPlana(cfg);

    if (chavePlana) {
        cfg.gemini_api_key = chavePlana;
        const cifrada = cifrarChaveApi(chavePlana);
        if (cifrada) {
            copiaDisco.gemini_api_key_cifrada = cifrada;
            cfg.gemini_api_key_cifrada = cifrada;
        }
    } else if (typeof cfg.gemini_api_key_cifrada === 'string' && cfg.gemini_api_key_cifrada.trim()) {
        copiaDisco.gemini_api_key_cifrada = cfg.gemini_api_key_cifrada.trim();
        const decifrada = decifrarChaveApi(copiaDisco.gemini_api_key_cifrada);
        if (decifrada) {
            cfg.gemini_api_key = decifrada;
        }
    } else {
        delete copiaDisco.gemini_api_key_cifrada;
    }

    removerCamposChavePlana(copiaDisco);

    delete cfg.geminiApiKey;
    delete cfg.nova_gemini_api_key;
    delete cfg.remover_gemini_api_key;
    if (cfg.ia && typeof cfg.ia === 'object') {
        delete cfg.ia.apiKey;
        delete cfg.ia.gemini_api_key;
        delete cfg.ia.chave;
    }
    if (cfg.processos && typeof cfg.processos === 'object') {
        delete cfg.processos.gemini_api_key;
    }

    return copiaDisco;
}

function hidratarChaveApiAoCarregar(lidoBruto, cfgMigrada) {
    if (!cfgMigrada || typeof cfgMigrada !== 'object') return { precisaMigrarDisco: false };
    const origem = (lidoBruto && typeof lidoBruto === 'object') ? lidoBruto : cfgMigrada;
    const chavePlanaNoDisco = extrairChaveApiPlana(origem) || extrairChaveApiPlana(cfgMigrada);
    const chaveCifradaNoDisco = (typeof origem.gemini_api_key_cifrada === 'string' && origem.gemini_api_key_cifrada.trim())
        ? origem.gemini_api_key_cifrada.trim()
        : ((typeof cfgMigrada.gemini_api_key_cifrada === 'string' && cfgMigrada.gemini_api_key_cifrada.trim()) ? cfgMigrada.gemini_api_key_cifrada.trim() : '');

    let chaveResolvida = '';
    if (chaveCifradaNoDisco) {
        chaveResolvida = decifrarChaveApi(chaveCifradaNoDisco);
    }
    if (!chaveResolvida && chavePlanaNoDisco) {
        chaveResolvida = chavePlanaNoDisco;
    }

    removerCamposChavePlana(cfgMigrada);

    if (chaveResolvida) {
        cfgMigrada.gemini_api_key = chaveResolvida;
        cfgMigrada.gemini_api_key_cifrada = chaveCifradaNoDisco || cifrarChaveApi(chaveResolvida);
    }

    const tinhaTextoPlanoNoArquivo = Boolean(
        lidoBruto && typeof lidoBruto === 'object' && (
            lidoBruto.gemini_api_key !== undefined ||
            lidoBruto.geminiApiKey !== undefined ||
            (lidoBruto.ia && (lidoBruto.ia.apiKey !== undefined || lidoBruto.ia.gemini_api_key !== undefined || lidoBruto.ia.chave !== undefined)) ||
            (lidoBruto.processos && lidoBruto.processos.gemini_api_key !== undefined)
        )
    );

    return {
        precisaMigrarDisco: tinhaTextoPlanoNoArquivo && Boolean(chaveResolvida)
    };
}

function carregarConfig(forcarDisco = false) {
    if (configEmMemoria && !forcarDisco) return configEmMemoria;
    try {
        const contatosIgnoradosExternos = carregarContatosIgnorados();
        if (!fs.existsSync(CONFIG_PATH)) {
            if (fs.existsSync(CONFIG_BACKUP_PATH)) {
                const recuperado = JSON.parse(fs.readFileSync(CONFIG_BACKUP_PATH, 'utf-8'));
                configEmMemoria = migrarConfigV1ParaV2(recuperado, contatosIgnoradosExternos);
                hidratarChaveApiAoCarregar(recuperado, configEmMemoria);
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
        const { precisaMigrarDisco } = hidratarChaveApiAoCarregar(lido, configEmMemoria);
        if (configEmMemoria.pausadosPersistidos) {
            contatosPausados = { ...configEmMemoria.pausadosPersistidos, ...contatosPausados };
        }
        if (precisaMigrarDisco) {
            salvarConfigDisco(configEmMemoria, true);
        }
        return configEmMemoria;
    } catch (e) {
        try {
            if (fs.existsSync(CONFIG_BACKUP_PATH)) {
                const recuperado = JSON.parse(fs.readFileSync(CONFIG_BACKUP_PATH, 'utf-8'));
                configEmMemoria = migrarConfigV1ParaV2(recuperado, carregarContatosIgnorados());
                const { precisaMigrarDisco } = hidratarChaveApiAoCarregar(recuperado, configEmMemoria);
                if (precisaMigrarDisco) {
                    salvarConfigDisco(configEmMemoria, true);
                }
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
    prepararConfigParaDisco(configEmMemoria);
    const gravar = () => {
        try {
            const copiaDisco = prepararConfigParaDisco(configEmMemoria);
            const payload = JSON.stringify(copiaDisco, null, 2);
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

function isMensagemCritica(texto, cfg = null) {
    if (!texto || typeof texto !== 'string') return false;
    const configAtiva = cfg || (typeof carregarConfig === 'function' ? carregarConfig() : null);
    try {
        const { isMensagemCritica: isCriticaShared } = require('./src/ia/tradutorJuridico');
        if (typeof isCriticaShared === 'function') {
            return isCriticaShared(texto, configAtiva);
        }
    } catch (_) {}
    const regexTermos = /\b(urgente|socorro|delegacia|flagrante|oficial\s+de\s+justi[cç]a|mandado|busca\s+e\s+apreens[aã]o|intima[cç][aã]o|liminar|\buti\b|audi[eê]ncia\s+hoje|bloquearam\s+minha\s+conta|sisbajud|bacenjud|plano\s+de\s+sa[uú]de\s+negou|\bpreso\b|despejo|vazamento\s+de\s+dados|incidente\s+de\s+seguran[cç]a|ransomware|ataque\s+hacker|anpd|conta\s+invadida|perfil\s+hackeado|medida\s+protetiva|aliena[cç][aã]o\s+parental)\b/i;
    return regexTermos.test(texto.toLowerCase());
}

function isForaDeExpediente(config) {
    try {
        const agenda = config && config.agenda;
        if (!agenda) return false;
        // Modo Plantão 24h Global (atende a criminalistas e plantões contínuos)
        if (agenda.plantao24hGlobal || agenda.plantao24h) return false;
        const agora = new Date();
        const diaSemana = String(agora.getDay());
        const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
        const confDia = agenda[diaSemana];
        if (!confDia || !confDia.ativo) return true;
        if (confDia.plantao24h) return false;

        const minAbertura = converterHoraParaMinutos(confDia.abertura || '08:00');
        const minFechamento = converterHoraParaMinutos(confDia.fechamento || '18:00');

        let dentroDoHorario = false;
        if (minAbertura <= minFechamento) {
            dentroDoHorario = (minutosAgora >= minAbertura && minutosAgora < minFechamento);
        } else {
            // Turno noturno / plantão criminal que atravessa a meia-noite (ex: 18:00 às 08:00)
            dentroDoHorario = (minutosAgora >= minAbertura || minutosAgora < minFechamento);
        }

        if (!dentroDoHorario) return true;

        if (agenda.almoco_ativo) {
            const minAlmocoIni = converterHoraParaMinutos(agenda.almoco_inicio || '12:00');
            const minAlmocoFim = converterHoraParaMinutos(agenda.almoco_fim || '13:30');
            if (minutosAgora >= minAlmocoIni && minutosAgora < minAlmocoFim) return true;
        }
        return false;
    } catch (_) {
        return false;
    }
}

function estaEmHorarioAlmoco(config) {
    try {
        const agenda = config && config.agenda;
        if (!agenda || !agenda.almoco_ativo) return false;
        // Modo Plantão 24h Global suprime pausa de almoço automática
        if (agenda.plantao24hGlobal || agenda.plantao24h) return false;
        const agora = new Date();
        const diaSemana = String(agora.getDay());
        const confDia = agenda[diaSemana];
        if (!confDia || !confDia.ativo) return false;
        const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
        const minAlmocoIni = converterHoraParaMinutos(agenda.almoco_inicio || '12:00');
        const minAlmocoFim = converterHoraParaMinutos(agenda.almoco_fim || '13:30');
        return (minutosAgora >= minAlmocoIni && minutosAgora < minAlmocoFim);
    } catch (_) {
        return false;
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

        if (confDia.plantao24h) {
            return '';
        }

        const minAbertura = converterHoraParaMinutos(confDia.abertura || '08:00');
        const minFechamento = converterHoraParaMinutos(confDia.fechamento || '18:00');

        let dentroDoHorario = false;
        if (minAbertura <= minFechamento) {
            dentroDoHorario = (minutosAgora >= minAbertura && minutosAgora < minFechamento);
        } else {
            dentroDoHorario = (minutosAgora >= minAbertura || minutosAgora < minFechamento);
        }

        if (!dentroDoHorario) {
            registrarAviso();
            return (agenda.msg_fora_expediente || '').trim() + '\n\n';
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

function montarTextoEtapa(etapa, config = null, identidade = null) {
    let txt = (etapa && etapa.mensagem ? etapa.mensagem : '') + "\n\n";
    (etapa && etapa.opcoes ? etapa.opcoes : []).forEach(op => {
        txt += `*${op.gatilho}* - ${op.rotulo}\n`;
    });
    const cfg = config || (typeof carregarConfig === 'function' ? carregarConfig() : null) || {};
    const escritorio = (cfg.nomeEscritorio || (cfg.configuracaoCobranca && cfg.configuracaoCobranca.beneficiario) || 'Nosso Escritório').trim();
    const nome = (identidade && (identidade.nomeCliente || identidade.nome)) ? String(identidade.nomeCliente || identidade.nome).trim() : 'Cliente';
    const cpf = (identidade && identidade.cpf) ? String(identidade.cpf).trim() : '';
    return txt
        .replace(/\{escritorio\}/gi, escritorio)
        .replace(/\{nome\}/gi, nome)
        .replace(/\{cpf\}/gi, cpf)
        .trim();
}

function buscarProcessoPorTelefoneCliente(config, tel) {
    if (!config || !tel) return null;
    const numLimpo = apenasNumeros(tel);
    if (!numLimpo || numLimpo.length < 8) return null;
    const ultimos8 = numLimpo.slice(-8);
    const lista = Array.isArray(config.processos) ? config.processos : ((config.processos && config.processos.lista) || []);
    const proc = lista.find(p => {
        const pTel = apenasNumeros(p.telefone || p.telefoneCliente || (p.dadosCadastrais && p.dadosCadastrais.telefone));
        return pTel && pTel.includes(ultimos8);
    });
    if (proc) return proc;
    if (config.dossiesClientes && typeof config.dossiesClientes === "object") {
        for (const [k, d] of Object.entries(config.dossiesClientes)) {
            const dTel = apenasNumeros(d.telefone || d.clienteTelefone || k);
            if (dTel && dTel.includes(ultimos8) && (d.processoVinculado || d.numeroProcesso)) {
                const procVinc = apenasNumeros(d.processoVinculado || d.numeroProcesso);
                const procNaLista = lista.find(p => {
                    const nLimpo = apenasNumeros(p.numero || p.numeroProcesso || p.processo || "");
                    return nLimpo && nLimpo.includes(procVinc);
                });
                if (procNaLista) return procNaLista;
            }
        }
    }
    return null;
}

function buscarProcessosPorNumero(config, digitosBusca) {
    if (!config || !config.processos) return [];
    const lista = Array.isArray(config.processos) ? config.processos : (Array.isArray(config.processos.lista) ? config.processos.lista : []);
    if (!lista || lista.length === 0) return [];
    if (!digitosBusca || digitosBusca.length < 5) return [];

    const encontrados = [];
    const idsVistos = new Set();
    const adicionarUnico = (p) => {
        if (!p) return;
        const chave = String(p.id || p.numero || p.numeroProcesso || Math.random());
        if (!idsVistos.has(chave)) {
            idsVistos.add(chave);
            encontrados.push(p);
        }
    };

    // 1. Busca direta na lista de processos por CPF/CNPJ, Número do Processo (CNJ) ou Telefone
    lista.forEach(p => {
        const cpfLimpo = apenasNumeros(p.cpf);
        const numLimpo = apenasNumeros(p.numero || p.numeroProcesso || p.processo || '');
        const telLimpo = apenasNumeros(p.telefone || p.telefoneCliente || (p.dadosCadastrais && p.dadosCadastrais.telefone));
        const bate = (cpfLimpo && (cpfLimpo === digitosBusca || cpfLimpo.includes(digitosBusca) || digitosBusca.includes(cpfLimpo))) ||
                     (numLimpo && (numLimpo === digitosBusca || numLimpo.includes(digitosBusca) || digitosBusca.includes(numLimpo))) ||
                     (telLimpo && (telLimpo === digitosBusca || telLimpo.includes(digitosBusca) || digitosBusca.includes(telLimpo)));
        if (bate) adicionarUnico(p);
    });

    // 2. Busca cruzada unificada com Dossiê de Clientes (config.dossiesClientes)
    if (config.dossiesClientes && typeof config.dossiesClientes === 'object') {
        for (const [chave, d] of Object.entries(config.dossiesClientes)) {
            if (!d || typeof d !== 'object') continue;
            const chaveLimpa = apenasNumeros(chave);
            const dCpf = apenasNumeros(d.cpf || (d.civil && d.civil.cpf));
            const dTel = apenasNumeros(d.telefone || d.clienteTelefone || (d.civil && d.civil.telefone));
            const dProc = apenasNumeros(d.processoVinculado || d.numeroProcesso || '');

            const matchDossie = (chaveLimpa && (chaveLimpa === digitosBusca || chaveLimpa.includes(digitosBusca))) ||
                                (dCpf && (dCpf === digitosBusca || dCpf.includes(digitosBusca))) ||
                                (dTel && (dTel === digitosBusca || dTel.includes(digitosBusca))) ||
                                (dProc && (dProc === digitosBusca || dProc.includes(digitosBusca)));

            if (matchDossie) {
                if (d.processoVinculado || d.numeroProcesso) {
                    const procVinculadoLimpo = apenasNumeros(d.processoVinculado || d.numeroProcesso);
                    lista.forEach(p => {
                        const nLimpo = apenasNumeros(p.numero || p.numeroProcesso || p.processo || '');
                        if (nLimpo && (nLimpo === procVinculadoLimpo || nLimpo.includes(procVinculadoLimpo))) {
                            adicionarUnico(p);
                        }
                    });
                }
                if (dCpf && dCpf.length >= 11) {
                    lista.forEach(p => {
                        if (apenasNumeros(p.cpf) === dCpf) adicionarUnico(p);
                    });
                }
            }
        }
    }

    return encontrados;
}

function buscarProcessoPorNumero(config, digitosBusca) {
    const lista = buscarProcessosPorNumero(config, digitosBusca);
    return lista.length > 0 ? lista[0] : null;
}

async function responderMultiplosProcessosOuUnico(config, procsAchados, remetenteChave, responderCliente) {
    if (!procsAchados || procsAchados.length === 0) return false;
    if (procsAchados.length === 1) {
        const proc = procsAchados[0];
        if (proc.nome && !config.mapaNomes[remetenteChave]) {
            config.mapaNomes[remetenteChave] = proc.nome;
        }
        estadosUsuarios[remetenteChave] = 'pos_consulta_processo';
        delete processosSelecionaveisPorContato[remetenteChave];
        const textoProc = await formatarMensagemProcesso(config, proc, remetenteChave);
        await responderCliente(textoProc);
        return true;
    }

    processosSelecionaveisPorContato[remetenteChave] = procsAchados;
    estadosUsuarios[remetenteChave] = 'selecionando_processo';
    const linhas = procsAchados.map((p, idx) => {
        const numP = p.numero || p.numeroProcesso || 'Pré-Processual';
        const extras = [p.area, p.fase].filter(Boolean).join(' • ');
        return `*${idx + 1}* - Processo \`${numP}\`${extras ? ` (${extras})` : ''}`;
    });
    const msgLista = `📂 Localizamos *${procsAchados.length} processos* vinculados a este documento:\n\n${linhas.join('\n')}\n\nPor favor, digite o *número da opção* (1 a ${procsAchados.length}) para ver o andamento completo ou *0* para voltar ao menu.`;
    await responderCliente(msgLista);
    return true;
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
    const nomeEscritorio = (config?.nomeEscritorio || config?.configuracaoCobranca?.beneficiario || '').trim() || 'Escritório de Advocacia';

    return String(modelo || '')
        .replace(/\{nome\}/g, proc.nome || 'Cliente')
        .replace(/\{cpf\}/g, proc.cpf || '-')
        .replace(/\{processo\}/g, numeroExibicao)
        .replace(/\{resumo\}/g, resumoParaExibir)
        .replace(/\{data\}/g, dataExibicao)
        .replace(/\{ultima_consulta\}/g, ultimaConsulta || agoraTexto)
        .replace(/\{escritorio\}/g, nomeEscritorio);
}

const FRASES_TRANSBORDO_DIRETO = [
    "falar com advogado", "falar com o advogado", "chamar advogado",
    "quero falar com advogado", "atendente", "falar com humano",
    "atendimento humano", "advogado", "suporte humano", "falar diretamente com advogado"
];

/**
 * Concatena cumulativamente múltiplos áudios e mensagens de um cliente pausado na fila.
 * Atualiza transcrições, histórico e aciona a IA para atualizar o Resumo Executivo,
 * as 3 Sugestões do Copilot, Classificação de Urgência e Cronologia dos Fatos.
 */
async function anexarMensagemOuAudioAoPausado(chave, { novaMsg = null, novoAudio = null, contexto = {} } = {}) {
    const item = contatosPausados[chave];
    if (!item || typeof item !== 'object') return null;

    if (!Array.isArray(item.mensagens)) item.mensagens = [];
    if (!Array.isArray(item.historicoMensagens)) item.historicoMensagens = [...item.mensagens];
    if (!Array.isArray(item.historicoAudios)) {
        item.historicoAudios = item.audioBase64 ? [{
            id: 'audio_1',
            audioBase64: item.audioBase64,
            mimeType: item.mimeType || 'audio/webm',
            transcricao: item.transcricao || '',
            hora: item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
        }] : [];
    }

    if (novaMsg) {
        const itemPausado = item;
        if (!itemPausado.mensagens.includes(novaMsg)) {
            itemPausado.mensagens.push(novaMsg);
        }
        if (!item.historicoMensagens.includes(novaMsg)) {
            item.historicoMensagens.push(novaMsg);
        }
    }

    if (novoAudio) {
        const audioId = 'audio_' + (item.historicoAudios.length + 1);
        item.historicoAudios.push({
            id: audioId,
            audioBase64: novoAudio.audioBase64,
            mimeType: novoAudio.mimeType || 'audio/webm',
            transcricao: novoAudio.transcricao || '',
            hora: novoAudio.hora || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        item.audioBase64 = novoAudio.audioBase64;
    }

    // Concatena todas as transcrições de áudios existentes sem sobrescrever
    if (item.historicoAudios.length > 0) {
        item.transcricao = item.historicoAudios.map((a, i) => `[Áudio ${i + 1}${a.hora ? ' (' + a.hora + ')' : ''}]: "${a.transcricao || ''}"`).join('\n\n');
    }

    // Concatena totalidade das mensagens e áudios para atualizar Resumo, Copilot, Urgência e Cronologia
    const linhasConsolidadas = [];
    for (const m of item.historicoMensagens) {
        linhasConsolidadas.push(`${m.de === 'cliente' ? 'Cliente' : 'Robô'}: ${m.texto}`);
    }
    for (let i = 0; i < item.historicoAudios.length; i++) {
        const a = item.historicoAudios[i];
        if (a.transcricao) {
            linhasConsolidadas.push(`[Áudio ${i + 1} transcrito]: ${a.transcricao}`);
        }
    }

    const textoConsolidado = linhasConsolidadas.join('\n');
    try {
        const { analisarUrgenciaECronologia } = require('./src/ia/tradutorJuridico');
        const cfg = typeof carregarConfig === 'function' ? carregarConfig() : {};
        const apiKey = (contexto && contexto.apiKey) || cfg.gemini_api_key || process.env.GEMINI_API_KEY;
        const analise = await analisarUrgenciaECronologia(textoConsolidado, {
            apiKey,
            nome: item.nome,
            telefone: item.telefone,
            motivo: item.motivo
        });

        if (analise) {
            if (analise.resumo) item.resumo = analise.resumo;
            if (Array.isArray(analise.sugestoesResposta)) item.sugestoesResposta = analise.sugestoesResposta;
            if (analise.nivelUrgencia) item.nivelUrgencia = analise.nivelUrgencia;
            if (analise.motivoUrgencia) item.motivoUrgencia = analise.motivoUrgencia;
            if (Array.isArray(analise.cronologiaFatos)) item.cronologiaFatos = analise.cronologiaFatos;
        }
    } catch (errAnalise) {
        console.error('Erro ao analisar urgência/cronologia consolidada:', errAnalise);
    }

    emitirPausados();
    return item;
}

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
        const ehMidiaVisual = Boolean(msg.hasMedia && !ehAudio);
        let textoOriginal = String(msg.body || '').trim();
        if (!textoOriginal && !ehAudio && !ehMidiaVisual) return false;
        if (ehAudio && !textoOriginal) {
            textoOriginal = '[Mensagem de Voz enviada pelo cliente]';
        } else if (ehMidiaVisual && !textoOriginal) {
            textoOriginal = '[Documento / Imagem enviada pelo cliente]';
        }

        mensagensJaProcessadas.add(msgId);
        if (mensagensJaProcessadas.size > 2000) {
            const primeiroItem = mensagensJaProcessadas.values().next().value;
            mensagensJaProcessadas.delete(primeiroItem);
        }

        const config = carregarConfig();
        const identidade = await resolverIdentidadeCompleta(msg, config);
        const remetenteChave = identidade.chaveCliente;

        // Bloqueia imediatamente contatos ignorados antes de baixar mídias/áudios ou acionar IA
        if (isContactIgnored(remetenteChave) || isContactIgnored(identidade.telefoneFormatado)) {
            return false;
        }

        // Se for documento/imagem (Onboarding Forense ou Comprovante PIX)
        if (ehMidiaVisual && typeof msg.downloadMedia === 'function') {
            try {
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    const bufferMidia = Buffer.from(media.data, 'base64');
                    const mimeType = media.mimetype || 'image/jpeg';
                    const apiKey = config.gemini_api_key || process.env.GEMINI_API_KEY || '';
                    const { obterSessaoAtiva, processarMidiaOnboarding } = require('./src/onboarding/onboardingController');
                    const { processarComprovanteRecebido } = require('./src/financeiro/gestaoFinanceira');

                    const sessaoOnboarding = obterSessaoAtiva(remetenteChave, config);
                    const corpoMin = String(msg.body || '').toLowerCase();
                    const palavrasCivil = ['rg', 'cnh', 'documento', 'residencia', 'filiacao', 'ctps', 'certidao', 'identidade', 'endereco'];
                    const contemCivil = palavrasCivil.some(pc => corpoMin.includes(pc));

                    if (sessaoOnboarding || contemCivil) {
                        const resOnb = await processarMidiaOnboarding({
                            clienteTelefone: remetenteChave,
                            clienteNome: identidade.nomeCliente || 'Cliente',
                            buffer: bufferMidia,
                            mimetype: mimeType,
                            apiKey
                        }, config);
                        salvarConfigDisco(config, true);
                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('bot-processos-sync', config);
                        }
                        if (resOnb && resOnb.mensagemFeedbackWhatsApp && client) {
                            await client.sendMessage(msg.from, resOnb.mensagemFeedbackWhatsApp);
                        }
                        if (resOnb && resOnb.dossieConsolidado) {
                            dispararNotificacaoTransbordo({
                                contatoNome: (sessaoOnboarding && sessaoOnboarding.clienteNome) || identidade.nomeCliente || remetenteChave,
                                telefone: remetenteChave,
                                motivo: 'Dossiê e Caso Pré-Processual prontos para análise!'
                            });
                        }
                        return true;
                    }

                    // Verifica se o cliente possui parcela pendente no financeiro
                    const parcelas = (config.financeiro && Array.isArray(config.financeiro.parcelas)) ? config.financeiro.parcelas : [];
                    const temParcelaAberta = parcelas.some(p => {
                        const st = String(p.status || 'PENDENTE').toUpperCase();
                        const telP = apenasNumeros(p.clienteTelefone || p.telefone || '');
                        return st !== 'PAGO' && telP && (telP === remetenteChave || remetenteChave.endsWith(telP) || telP.endsWith(remetenteChave));
                    });
                    if (temParcelaAberta) {
                        const resPix = await processarComprovanteRecebido(remetenteChave, bufferMidia, mimeType, apiKey, config);
                        salvarConfigDisco(config, true);

                        // Se o laudo acusar documento civil, despacha para onboarding
                        if (resPix && resPix.laudo && resPix.laudo.ehDocumentoCivil) {
                            const resOnb = await processarMidiaOnboarding({
                                clienteTelefone: remetenteChave,
                                clienteNome: identidade.nomeCliente || 'Cliente',
                                buffer: bufferMidia,
                                mimetype: mimeType,
                                apiKey
                            }, config);
                            salvarConfigDisco(config, true);
                            if (mainWindow && !mainWindow.isDestroyed()) {
                                mainWindow.webContents.send('bot-processos-sync', config);
                            }
                            if (resOnb && resOnb.mensagemFeedbackWhatsApp && client) {
                                await client.sendMessage(msg.from, resOnb.mensagemFeedbackWhatsApp);
                            }
                            return true;
                        }

                        if (mainWindow && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('bot-processos-sync', config);
                        }
                        if (resPix && resPix.mensagemFeedbackWhatsApp && client) {
                            await client.sendMessage(msg.from, resPix.mensagemFeedbackWhatsApp);
                        }
                        return true;
                    }
                }
            } catch (errMidia) {
                console.error('Erro ao processar mídia visual (Onboarding/PIX) no WhatsApp:', errMidia);
            }
        }

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
                        sugestoesResposta: resAudio.sugestoesResposta,
                        nivelUrgencia: resAudio.nivelUrgencia,
                        motivoUrgencia: resAudio.motivoUrgencia,
                        cronologiaFatos: resAudio.cronologiaFatos
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

        // MODO SEGURO / ROBÔ PAUSADO GLOBALMENTE:
        // Se ativado pelo advogado, nenhuma mensagem ou menu automático sai.
        // O contato é encaminhado silenciosamente para a Fila do Advogado em modo espera.
        if (config.roboPausadoGlobal === true || config.modoSeguroAtivo === true) {
            const horaMsg = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const novaMsg = { de: 'cliente', texto: textoOriginal, hora: horaMsg };
            if (!historicoConversas[remetenteChave]) historicoConversas[remetenteChave] = [];
            historicoConversas[remetenteChave].push(novaMsg);

            await anexarMensagemOuAudioAoPausado(remetenteChave, {
                novaMsg,
                contexto: { apiKey: config.gemini_api_key || process.env.GEMINI_API_KEY },
                motivo: 'Modo Seguro / Robô Pausado pelo Advogado'
            });

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', {
                    numero: identidade.telefoneFormatado,
                    nome: identidade.nomeCliente || '',
                    exibicao: identidade.exibicao,
                    msg: `[Modo Seguro - Fila] ${textoOriginal}`,
                    tipo: 'cliente',
                    origem: 'cliente',
                    hora: horaMsg
                });
            }
            return false;
        }

        const gatilhoDigitado = extrairGatilhoLimpo(textoOriginal);

        const registroPausa = contatosPausados[remetenteChave] || contatosPausados[msg.from];
        const tsPausa = typeof registroPausa === 'object' ? registroPausa.timestamp : registroPausa;
        if (tsPausa && (Date.now() - tsPausa < 24 * 60 * 60 * 1000)) {
            // Contato já em pausa: silencia robô, anexa cumulativamente mensagem/áudio e reavalia urgência
            const horaMsg = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const novaMsg = {
                de: 'cliente',
                texto: textoOriginal,
                hora: horaMsg
            };

            if (!historicoConversas[remetenteChave]) historicoConversas[remetenteChave] = [];
            historicoConversas[remetenteChave].push(novaMsg);

            const novoAudio = dadosAudiosPorContato[remetenteChave] ? {
                audioBase64: dadosAudiosPorContato[remetenteChave].audioBase64,
                mimeType: dadosAudiosPorContato[remetenteChave].mimeType,
                transcricao: dadosAudiosPorContato[remetenteChave].transcricao,
                hora: horaMsg
            } : null;

            await anexarMensagemOuAudioAoPausado(remetenteChave, {
                novaMsg,
                novoAudio,
                contexto: { apiKey: config.gemini_api_key || process.env.GEMINI_API_KEY }
            });

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', {
                    numero: identidade.telefoneFormatado,
                    nome: identidade.nomeCliente || '',
                    exibicao: identidade.exibicao,
                    msg: `[Fila Humana] ${textoOriginal}`,
                    tipo: 'cliente',
                    origem: 'cliente',
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
                tipo: 'cliente',
                origem: 'cliente',
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
            const textoEnviado = prefixoHorario + txt;
            await enviarMensagemSegura(msg, msg.from, textoEnviado);
            if (!historicoConversas[remetenteChave]) historicoConversas[remetenteChave] = [];
            historicoConversas[remetenteChave].push({
                de: 'robo',
                texto: textoEnviado,
                hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', {
                    numero: identidade.telefoneFormatado,
                    nome: identidade.nomeCliente || identidade.exibicao || 'Cliente',
                    exibicao: identidade.exibicao,
                    msg: textoEnviado,
                    tipo: 'robo',
                    origem: 'robo',
                    hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        };

        const colocarNaFilaHumana = async (mensagemConfirmacao, motivo = 'Opção "Falar com Advogado"', opcoesExtras = {}) => {
            const audioSalvo = dadosAudiosPorContato[remetenteChave] || {};
            const acoesItem = opcoesExtras.acoes || null;
            const msgsIniciais = (historicoConversas[remetenteChave] || []).slice(-10);
            const audiosIniciais = audioSalvo.audioBase64 ? [{
                id: 'audio_1',
                audioBase64: audioSalvo.audioBase64,
                mimeType: audioSalvo.mimeType || 'audio/webm',
                transcricao: audioSalvo.transcricao || '',
                hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }] : [];

            contatosPausados[remetenteChave] = {
                timestamp: Date.now(),
                nome: identidade.nomeCliente || '',
                telefone: identidade.telefoneFormatado,
                exibicao: identidade.exibicao,
                motivo: motivo,
                idChat: msg.from,
                origem: 'WHATSAPP',
                mensagens: msgsIniciais,
                historicoMensagens: [...msgsIniciais],
                historicoAudios: audiosIniciais,
                audioBase64: audioSalvo.audioBase64 || null,
                transcricao: audioSalvo.transcricao || null,
                resumo: audioSalvo.resumo || null,
                sugestoesResposta: audioSalvo.sugestoesResposta || null,
                nivelUrgencia: opcoesExtras.nivelUrgencia || audioSalvo.nivelUrgencia || 'ROTINA',
                motivoUrgencia: audioSalvo.motivoUrgencia || motivo,
                cronologiaFatos: audioSalvo.cronologiaFatos || [],
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
            const msgFinalConfirmacao = (isForaDeExpediente(config) && /já está chegando|chegando para|assumir o seu atendimento|assumir seu atendimento/i.test(String(mensagemConfirmacao || '')))
                ? "👨‍⚖️ Sua solicitação foi registrada com prioridade para o próximo horário de expediente."
                : mensagemConfirmacao;
            await responderCliente(msgFinalConfirmacao);
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

        // Interceptação imediata de emergência crítica antes de saudações/menu
        // (Examina texto original para que 'Bom dia, tivemos um vazamento...' não seja engolido por saudações)
        if (isMensagemCritica(textoOriginal, config)) {
            await colocarNaFilaHumana(
                "👨‍⚖️ Mensagem com prioridade crítica identificada. Nossa equipe jurídica foi acionada em alerta máximo.",
                "Emergência: " + textoOriginal,
                { nivelUrgencia: 'CRITICA' }
            );
            return true;
        }

        // Interceptação de Horário de Almoço (suprime envio de menu numérico)
        if (estaEmHorarioAlmoco(config)) {
            const ultimoAlmoco = avisoForaHorarioRecente[remetenteChave + '_almoco'] || 0;
            if (Date.now() - ultimoAlmoco >= 15 * 60 * 1000) {
                avisoForaHorarioRecente[remetenteChave + '_almoco'] = Date.now();
                const msgAlmoco = ((config.agenda && config.agenda.msg_almoco) || "Nosso escritório está em intervalo de almoço no momento. Retornaremos em breve!").trim();
                await responderCliente(msgAlmoco);
            }
            return true;
        }

        // Seleção de processo quando o CPF/CNPJ possui múltiplos processos vinculados
        if (estadoAtual === 'selecionando_processo' && gatilhoDigitado !== '0') {
            const listaSel = processosSelecionaveisPorContato[remetenteChave] || [];
            const idxEscolha = parseInt(gatilhoDigitado, 10) - 1;
            if (!Number.isNaN(idxEscolha) && idxEscolha >= 0 && idxEscolha < listaSel.length) {
                const procEscolhido = listaSel[idxEscolha];
                delete processosSelecionaveisPorContato[remetenteChave];
                await responderMultiplosProcessosOuUnico(config, [procEscolhido], remetenteChave, responderCliente);
                return true;
            }
        }

        // Busca direta por CPF/CNPJ ou Número de Processo antes das saudações (ex: "Bom dia CPF 12345678900")
        const digitosDiretos = apenasNumeros(textoOriginal);
        if (digitosDiretos.length >= 9 && estadoAtual !== 'aguardando_processo') {
            const procsDiretos = buscarProcessosPorNumero(config, digitosDiretos);
            if (procsDiretos.length > 0) {
                await responderMultiplosProcessosOuUnico(config, procsDiretos, remetenteChave, responderCliente);
                return true;
            }
        }

        const saudacoes = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "menu", "inicio", "início", "ajuda", "help"];
        if (gatilhoDigitado === "0" || saudacoes.some(s => gatilhoDigitado === s || gatilhoDigitado.startsWith(s + " "))) {
            delete processosSelecionaveisPorContato[remetenteChave];
            const procCadastrado = buscarProcessoPorTelefoneCliente(config, remetenteChave);
            if (procCadastrado && gatilhoDigitado !== "0") {
                const nomeRec = procCadastrado.nome || identidade.nomeCliente || "Cliente";
                estadosUsuarios[remetenteChave] = 'pos_consulta_processo';
                const msgRecorrente = `Olá, *${nomeRec}*! Que bom ter você em contato novamente.\nLocalizamos seu processo ativo: *${procCadastrado.numero || procCadastrado.numeroProcesso}*.\n\n` +
                    (await formatarMensagemProcesso(config, procCadastrado, remetenteChave));
                await responderCliente(msgRecorrente);
                return true;
            }
            estadosUsuarios[remetenteChave] = 'raiz';
            await responderCliente(montarTextoEtapa(config.fluxo.raiz, config, identidade));
            return true;
        }

        if (estadoAtual === 'aguardando_processo') {
            const digitos = apenasNumeros(textoOriginal);
            const procsAchados = buscarProcessosPorNumero(config, digitos);
            if (procsAchados.length > 0) {
                await responderMultiplosProcessosOuUnico(config, procsAchados, remetenteChave, responderCliente);
                return true;
            } else {
                const msgNaoEncontrado = tplsProc.msg_nao_encontrado || criarConfigPadrao().processos.mensagens.msg_nao_encontrado;
                await responderCliente(msgNaoEncontrado);
                return true;
            }
        }

        if (estadoAtual === 'aguardando_relato') {
            await colocarNaFilaHumana(
                "👨‍⚖️ Recebemos seu relato! Um advogado da nossa equipe irá analisar seu caso e responder em breve.",
                "Relato de nova consulta: " + textoOriginal
            );
            return true;
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
                await responderCliente(montarTextoEtapa(proxEtapa || config.fluxo.raiz, config, identidade));
                return true;
            }
            if (opcaoEscolhida.tipo === 'processo') {
                estadosUsuarios[remetenteChave] = 'aguardando_processo';
                await responderCliente(opcaoEscolhida.resposta || "Por favor, digite apenas o seu *CPF* ou o *Número do Processo*:");
                return true;
            }
            if (opcaoEscolhida.resposta) {
                if (Boolean(acoes.aguardarRelatoLivre) || opcaoEscolhida.tipo === 'relato') {
                    estadosUsuarios[remetenteChave] = 'aguardando_relato';
                }
                await responderCliente(opcaoEscolhida.resposta);
                return true;
            }
        }

        // Tratamento humanizado de dúvidas livres ou mensagens fora das opções numéricas
        const ehPerguntaOuRelato = textoOriginal.includes('?') ||
            /\b(quanto|como|qual|quais|onde|posso|tem|aceita|duvida|dúvida|valor|custo|advogado|consulta|doutor|doutora|urgente|ajuda|preciso|processo|problema|caso|audiencia|acordo)\b/i.test(textoOriginal) ||
            textoOriginal.trim().split(/\s+/).length >= 4;

        if (ehPerguntaOuRelato) {
            await colocarNaFilaHumana(
                "👨‍⚖️ Compreendi sua mensagem! Para fornecer uma orientação jurídica precisa para sua dúvida, estou transferindo seu contato para um de nossos advogados.",
                "Dúvida livre no fluxo: " + textoOriginal
            );
            return true;
        }

        if (estadoAtual !== 'raiz' && estadoAtual !== 'pos_consulta_processo') {
            await responderCliente("Não identifiquei essa opção nesta etapa. Por favor, digite o número correspondente à opção desejada ou digite *0* para voltar ao Menu Principal.");
            return true;
        }

        estadosUsuarios[remetenteChave] = 'raiz';
        await responderCliente(montarTextoEtapa(config.fluxo.raiz, config, identidade));
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
        width: 1280,
        height: 720,
        minWidth: 1024,
        minHeight: 650,
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
            clientId: "advocacia-desktop-session",
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

    // Gerenciamento de debounce para rajadas de mensagens no WhatsApp real
const buffersRajadasPorContato = {};
const timersDebouncePorContato = {};

async function agendarProcessamentoComDebounce(msg, fnProcessar) {
    if (!msg || !msg.from) return fnProcessar(msg);
    const chave = String(msg.from).replace(/\D/g, "") || msg.from;
    const texto = String(msg.body || "").trim();

    if (msg.hasMedia || !texto || /^[0-9]$/.test(texto) || texto.length > 80) {
        if (timersDebouncePorContato[chave]) {
            clearTimeout(timersDebouncePorContato[chave]);
            delete timersDebouncePorContato[chave];
        }
        delete buffersRajadasPorContato[chave];
        return fnProcessar(msg);
    }

    if (!buffersRajadasPorContato[chave]) {
        buffersRajadasPorContato[chave] = [];
    }
    buffersRajadasPorContato[chave].push(texto);

    if (timersDebouncePorContato[chave]) {
        clearTimeout(timersDebouncePorContato[chave]);
    }

    timersDebouncePorContato[chave] = setTimeout(async () => {
        const msgsAcumuladas = buffersRajadasPorContato[chave] || [];
        delete buffersRajadasPorContato[chave];
        delete timersDebouncePorContato[chave];

        if (msgsAcumuladas.length > 1) {
            msg.body = msgsAcumuladas.join(" ");
        }
        try {
            await fnProcessar(msg);
        } catch (err) {
            console.error("Erro no debounce de mensagem:", err);
        }
    }, 2500);
}

    client.on('message', async (msg) => {
        await agendarProcessamentoComDebounce(msg, processarMensagemEntrada);
    });

    try {
        await client.initialize();
    } catch (e) {
        console.error('[WhatsApp Client] Falha na inicialização da sessão (SingletonLock/Chromium):', e && e.message ? e.message : e);
        limparLocksTravados();
        iniciandoBot = false;
        atualizarStatusUI('disconnected', 'Reiniciando motor após detecção e liberação preventiva de SingletonLock...');
        agendarReconexaoBackoff();
    }
}

// IPC: Abrir documento físico anexado / auditado no leitor padrão do sistema
ipcMain.handle('abrir-documento-anexo', async (event, caminhoArquivo) => {
    try {
        if (!caminhoArquivo) return { sucesso: false, erro: 'Caminho não fornecido' };
        const fsMod = require('fs');
        const pathMod = require('path');
        let resolved = pathMod.isAbsolute(caminhoArquivo) ? caminhoArquivo : pathMod.resolve(process.cwd(), caminhoArquivo);
        if (!fsMod.existsSync(resolved)) {
            const baseDir = pathMod.resolve(process.cwd(), 'documentos_clientes');
            const posRel = pathMod.join(baseDir, caminhoArquivo);
            if (fsMod.existsSync(posRel)) resolved = posRel;
        }
        if (fsMod.existsSync(resolved)) {
            await shell.openPath(resolved);
            return { sucesso: true, caminho: resolved };
        }
        return { sucesso: false, erro: 'Arquivo não encontrado no disco: ' + caminhoArquivo };
    } catch (err) {
        console.error('[IPC abrir-documento-anexo] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

// IPC: Listar documentos de um cliente do disco físico
ipcMain.handle('listar-documentos-cliente', async (event, clienteId) => {
    try {
        const { listarDocumentosCliente } = require('./src/documentos/armazenamentoDocs');
        const docs = typeof listarDocumentosCliente === 'function' ? listarDocumentosCliente(clienteId) : [];
        return { sucesso: true, docs: docs || [] };
    } catch (err) {
        console.error('[IPC listar-documentos-cliente] Erro:', err);
        return { sucesso: false, erro: err.message, docs: [] };
    }
});

function sanitizarConfigParaRenderer(cfg) {
    if (!cfg || typeof cfg !== 'object') return cfg;
    const copia = JSON.parse(JSON.stringify(cfg));
    // Mascara apiKey deixando visível apenas os últimos 4 dígitos para visualização segura no frontend
    const chaveReal = extrairChaveApiPlana(copia)
        || (typeof copia.gemini_api_key_cifrada === 'string' && copia.gemini_api_key_cifrada.trim()
            ? decifrarChaveApi(copia.gemini_api_key_cifrada)
            : '');
    if (chaveReal && typeof chaveReal === 'string' && chaveReal.trim()) {
        const limpa = chaveReal.trim();
        copia.geminiApiKeyMascarada = limpa.length > 8 ? `••••••••••••${limpa.slice(-4)}` : '••••••••';
        copia.temApiKeyConfigurada = true;
    } else if (typeof copia.geminiApiKeyMascarada === 'string' && copia.geminiApiKeyMascarada.trim()) {
        copia.temApiKeyConfigurada = Boolean(copia.temApiKeyConfigurada !== false);
    } else {
        copia.geminiApiKeyMascarada = '';
        copia.temApiKeyConfigurada = false;
    }
    removerCamposChavePlana(copia);
    delete copia.gemini_api_key_cifrada;
    return copia;
}

ipcMain.handle('obter-config', () => sanitizarConfigParaRenderer(carregarConfig()));
ipcMain.handle('obter-versao-app', () => `v2.0 (Executive Suite)`);
ipcMain.handle('obter-estado-conexao', () => ({ status: statusAtualBot, qr: ultimoQrDataUrl, subStatus: subStatusDetalhado, tentativa: tentativasReconexao }));
ipcMain.handle('salvar-config', (e, nc) => {
    // Campos de runtime e seções gerenciadas por IPCs próprios pertencem ao processo principal:
    // o renderer pode guardar cópias parciais que sobrescreveriam PIX, parcelas e métricas.
    const atualEmMemoria = carregarConfig();
    [
        'metricasReais',
        'mapaNomes',
        'mapaTelefones',
        'configuracaoCobranca',
        'financeiro',
        'onboardingSessoes'
    ].forEach(k => {
        if (atualEmMemoria && atualEmMemoria[k] !== undefined) nc[k] = atualEmMemoria[k];
    });
    // Mescla dossiesClientes preservando edições manuais do usuário no renderer e docs recebidos em background
    if (atualEmMemoria && atualEmMemoria.dossiesClientes && typeof atualEmMemoria.dossiesClientes === 'object') {
        const dossiesRenderer = (nc.dossiesClientes && typeof nc.dossiesClientes === 'object') ? nc.dossiesClientes : {};
        nc.dossiesClientes = { ...atualEmMemoria.dossiesClientes, ...dossiesRenderer };
    }
    // Se nomeEscritorio foi definido, atualiza o título genérico da saudação caso ainda seja o padrão
    if (nc.nomeEscritorio && String(nc.nomeEscritorio).trim() && nc.fluxo?.raiz?.mensagem) {
        const esc = String(nc.nomeEscritorio).trim();
        if (nc.fluxo.raiz.mensagem.includes('⚖️ *Escritório de Advocacia*')) {
            nc.fluxo.raiz.mensagem = nc.fluxo.raiz.mensagem.replace('⚖️ *Escritório de Advocacia*', `⚖️ *${esc}*`);
        }
    }
    if (nc.gemini_api_key === undefined && atualEmMemoria && atualEmMemoria.gemini_api_key !== undefined) {
        nc.gemini_api_key = atualEmMemoria.gemini_api_key;
    }
    // Permite ao usuário atualizar a GEMINI_API_KEY diretamente pela interface de Configurações
    if (typeof nc.nova_gemini_api_key === 'string') {
        const chaveNova = nc.nova_gemini_api_key.trim();
        if (chaveNova) {
            nc.gemini_api_key = chaveNova;
            process.env.GEMINI_API_KEY = chaveNova;
        } else if (nc.remover_gemini_api_key) {
            delete nc.gemini_api_key;
            delete nc.gemini_api_key_cifrada;
            delete nc.geminiApiKeyMascarada;
            delete nc.temApiKeyConfigurada;
            delete process.env.GEMINI_API_KEY;
        }
        delete nc.nova_gemini_api_key;
        delete nc.remover_gemini_api_key;
    }
    salvarConfigDisco(nc, true);
    if (typeof nc.iniciar_com_windows !== 'undefined') {
        configurarAutoStartWindows(nc.iniciar_com_windows);
    }
    return true;
});
ipcMain.handle('restaurar-backup-completo', (e, backupCfg) => {
    try {
        if (!backupCfg || typeof backupCfg !== 'object') {
            return { sucesso: false, erro: 'Estrutura de backup inválida.' };
        }
        const atualEmMemoria = carregarConfig();
        const restaurado = JSON.parse(JSON.stringify(backupCfg));

        hidratarChaveApiAoCarregar(backupCfg, restaurado);

        if (!restaurado.gemini_api_key && atualEmMemoria && atualEmMemoria.gemini_api_key) {
            restaurado.gemini_api_key = atualEmMemoria.gemini_api_key;
        }
        if (!restaurado.processos) restaurado.processos = { lista: [] };
        if (!restaurado.financeiro) restaurado.financeiro = { parcelas: [] };
        if (!restaurado.dossiesClientes) restaurado.dossiesClientes = {};
        if (!restaurado.onboardingSessoes) restaurado.onboardingSessoes = {};

        salvarConfigDisco(restaurado, true);
        const configSanitizada = sanitizarConfigParaRenderer(restaurado);
        if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-processos-sync', configSanitizada);
        }
        return { sucesso: true, config: configSanitizada };
    } catch (err) {
        console.error('[IPC restaurar-backup-completo] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
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
    const numLimpo = apenasNumeros(num);
    delete contatosPausados[num];
    if (numLimpo) delete contatosPausados[numLimpo];
    if (configEmMemoria) salvarConfigDisco(configEmMemoria, true);
    emitirPausados();
    return contatosPausados;
});
ipcMain.handle('sincronizar-servidor-nuvem', async (event, { urlServidor, token } = {}) => {
    try {
        const urlBase = String(urlServidor || '').trim().replace(/\/+$/, '');
        if (!urlBase) {
            return { sucesso: false, erro: 'Informe a URL do seu Servidor Nuvem antes de sincronizar.' };
        }
        const tokenLimpo = String(token || '').trim();
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        if (tokenLimpo) {
            headers['Authorization'] = `Bearer ${tokenLimpo}`;
            headers['X-API-Key'] = tokenLimpo;
        }

        // 1. Consulta /status do servidor remoto
        const resStatus = await fetch(`${urlBase}/status`, { headers });
        if (resStatus.status === 401) {
            return { sucesso: false, erro: 'Não autorizado: Token de segurança inválido ou ausente.' };
        }
        if (!resStatus.ok) {
            return { sucesso: false, erro: `Servidor retornou erro HTTP ${resStatus.status}` };
        }
        const dadosStatus = await resStatus.json();
        const statusRemoto = dadosStatus.status || dadosStatus.botStatus || 'CONNECTED';

        // 2. Consulta /pausados (ou /export-config) do servidor remoto
        let contatosRemotos = {};
        try {
            const resPausados = await fetch(`${urlBase}/pausados`, { headers });
            if (resPausados.ok) {
                const dadosPausados = await resPausados.json();
                contatosRemotos = dadosPausados.contatosPausados || dadosPausados.pausados || {};
            } else if (dadosStatus.contatosPausados) {
                contatosRemotos = dadosStatus.contatosPausados;
            }
        } catch (_) {
            if (dadosStatus.contatosPausados) {
                contatosRemotos = dadosStatus.contatosPausados;
            }
        }

        // 3. Mescla com segurança os contatos pausados remotos na fila do desktop local
        let alterados = 0;
        if (contatosRemotos && typeof contatosRemotos === 'object') {
            for (const [chave, item] of Object.entries(contatosRemotos)) {
                if (!contatosPausados[chave]) {
                    contatosPausados[chave] = item;
                    alterados++;
                } else {
                    contatosPausados[chave] = {
                        ...contatosPausados[chave],
                        ...item
                    };
                    alterados++;
                }
            }
        }

        if (alterados > 0) {
            emitirPausados();
        }

        return {
            sucesso: true,
            status: statusRemoto,
            statusServidor: statusRemoto,
            contatosPausados,
            pausados: contatosPausados,
            totalPausadosSincronizados: Object.keys(contatosPausados).length,
            dadosStatus
        };
    } catch (err) {
        return { sucesso: false, erro: 'Falha de conexão com o servidor: ' + (err ? err.message : 'Erro desconhecido') };
    }
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

// Status de disponibilidade da IA (sem expor a chave do proprietário ao cliente)
ipcMain.handle('ia-obter-status', async () => {
    try {
        const { obterApiKeyAtiva } = require('./src/ia/tradutorJuridico');
        const config = carregarConfig();
        const chave = obterApiKeyAtiva(undefined, config);
        return { ativo: Boolean(chave && chave.length > 10) };
    } catch (_) {
        return { ativo: false };
    }
});

// Teste de Conexão com Google Gemini API
ipcMain.handle('ia-testar-conexao', async (event, chaveManual) => {
    try {
        const config = carregarConfig();
        const chaveLimpa = (typeof chaveManual === 'string' && chaveManual.trim()) ? chaveManual.trim() : undefined;
        const resultado = await traduzirAndamentoJuridico(
            `Vistos. Especifiquem as partes as provas que pretendem produzir, justificando sua pertinência em 15 dias. [Teste #${Date.now()}]`,
            {
                apiKey: chaveLimpa,
                config,
                timeoutMs: 8000,
                desativarPersistencia: true
            }
        );
        if (resultado.fonte === 'ia' || resultado.fonte === 'cache' || resultado.texto) {
            return { success: true, mensagem: `Conectado com sucesso à IA Gemini (${resultado.modelo || 'gemini-flash'})!`, texto: resultado.texto, modelo: resultado.modelo || 'gemini-flash' };
        }
        return { success: false, mensagem: `Não foi possível conectar (${resultado.erro || 'verifique a conexão com o serviço de IA'}).` };
    } catch (err) {
        return { success: false, error: err.message, mensagem: err.message };
    }
});

// SIMULADOR DE CHAT CLIENTE (SANDBOX LOCAL — FUNCIONA 100% SEM WHATSAPP CONECTADO)
async function executarSimulacaoMensagem(payload = {}) {
    try {
        const { texto, telefone, nome } = payload;
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

        // Obedece a lista de Contatos Ignorados exatamente como em produção
        if (isContactIgnored(remetenteChave) || isContactIgnored(telLimpo) || isContactIgnored(chatId) || (Array.isArray(config.ignorados) && isContactIgnored(telLimpo, config.ignorados))) {
            return {
                sucesso: true,
                success: true,
                ignorado: true,
                resposta: '',
                transbordo: false,
                pausado: false,
                motivo: 'CONTATO_IGNORADO'
            };
        }

        // Simulação Real de Envio de Documentos e Comprovantes PIX (Subagente 1)
        if (payload && (payload.midia || payload.arquivoBase64 || payload.buffer)) {
            const midiaObj = payload.midia || {};
            let rawBase64 = String(midiaObj.base64 || payload.arquivoBase64 || (Buffer.isBuffer(payload.buffer) ? payload.buffer.toString('base64') : '')).trim();
            let mimeDetectado = midiaObj.mimetype || payload.mimetype || '';

            // Sanitiza prefixo data:...;base64, se presente
            if (rawBase64.startsWith('data:')) {
                const virgulaIdx = rawBase64.indexOf(',');
                if (virgulaIdx !== -1) {
                    const matchMime = rawBase64.slice(0, virgulaIdx).match(/^data:([^;]+);base64/i);
                    if (matchMime && matchMime[1]) {
                        mimeDetectado = matchMime[1].trim();
                    }
                    rawBase64 = rawBase64.slice(virgulaIdx + 1).trim();
                }
            }
            const buffer = Buffer.from(rawBase64, 'base64');

            // Detecção rigorosa por Magic Bytes (prevalece sobre extensões ou rótulos genéricos)
            if (buffer.length >= 4) {
                if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
                    mimeDetectado = 'image/png';
                } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
                    mimeDetectado = 'image/jpeg';
                } else if (buffer.slice(0, 4).toString('utf-8') === '%PDF') {
                    mimeDetectado = 'application/pdf';
                } else if (buffer.slice(0, 4).toString('utf-8') === 'RIFF') {
                    mimeDetectado = 'image/webp';
                }
            }
            const mimeType = mimeDetectado || 'image/jpeg';
            const extFinal = mimeType.includes('pdf') ? 'pdf' : (mimeType.includes('png') ? 'png' : 'jpg');
            const nomeArquivo = midiaObj.filename || payload.nomeOriginal || `midia_sim_${Date.now()}.${extFinal}`;

            const { obterApiKeyAtiva } = require('./src/ia/tradutorJuridico');
            const apiKey = obterApiKeyAtiva(payload.apiKey || midiaObj.apiKey, config);

            const { obterSessaoAtiva, processarMidiaOnboarding } = require('./src/onboarding/onboardingController');
            const { processarComprovanteRecebido } = require('./src/financeiro/gestaoFinanceira');
            const { auditarDocumentoMultimodal } = require('./src/documentos/validadorDocumentos');

            const sessaoAtiva = obterSessaoAtiva(remetenteChave, config);
            const corpoMin = String(mockMsg.body || '').toLowerCase();
            const nomeMin = String(nomeArquivo || '').toLowerCase();

            // Detecção precisa de intenção PIX: só é PIX se tiver palavras explícitas de pagamento/transferência e NÃO for documento civil
            const palavrasCivil = ['rg', 'cnh', 'documento', 'residencia', 'filiacao', 'ctps', 'certidao', 'identidade', 'endereco'];
            const contemCivil = palavrasCivil.some(pc => corpoMin.includes(pc) || nomeMin.includes(pc));
            const palavrasPix = ['pix', 'comprovante', 'pagamento', 'transferencia', 'ted', 'deposito', 'recibo'];
            const contemPix = palavrasPix.some(pp => corpoMin.includes(pp) || nomeMin.includes(pp));
            const parecePix = contemPix && !contemCivil;

            // Só direciona para Dossiê Civil se NÃO parecer comprovante PIX
            if (!parecePix && (sessaoAtiva || contemCivil)) {
                // Tenta validar como documento civil primeiro
                try {
                    const resOnb = await processarMidiaOnboarding({
                        clienteTelefone: remetenteChave,
                        clienteNome: identidade.nomeCliente || 'Cliente',
                        buffer,
                        mimetype: mimeType,
                        nomeOriginal: nomeArquivo,
                        apiKey
                    }, config);
                    salvarConfigDisco(config, true);
                    if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('bot-processos-sync', config);
                    }
                    return {
                        success: true,
                        sucesso: true,
                        resposta: resOnb.mensagemFeedbackWhatsApp || "📄 Documento recebido e auditado pela IA!",
                        onboarding: resOnb
                    };
                } catch (errOnb) {
                    console.warn('[Simulador] Tentativa de documento civil falhou, avaliando fallback:', errOnb.message);
                }
            }

            // Se for PIX ou fallback
            const resPix = await processarComprovanteRecebido(remetenteChave, buffer, mimeType, apiKey, config);
            salvarConfigDisco(config, true);

            // Se o validador PIX detectou que era documento civil pessoal, converte graciosamente para onboarding
            if (!parecePix && resPix && resPix.laudo && resPix.laudo.ehDocumentoCivil) {
                try {
                    const resOnb = await processarMidiaOnboarding({
                        clienteTelefone: remetenteChave,
                        clienteNome: identidade.nomeCliente || 'Cliente',
                        buffer,
                        mimetype: mimeType,
                        nomeOriginal: nomeArquivo,
                        apiKey
                    }, config);
                    salvarConfigDisco(config, true);
                    if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('bot-processos-sync', config);
                    }
                    return {
                        success: true,
                        sucesso: true,
                        resposta: resOnb.mensagemFeedbackWhatsApp || "📄 Documento civil identificado e arquivado no seu Dossiê!",
                        onboarding: resOnb
                    };
                } catch (eOnb) {}
            }

            if (resPix && resPix.resultadoBaixa && resPix.resultadoBaixa.success) {
                if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('notificacao-pagamento', resPix.resultadoBaixa);
                }
            }
            return {
                success: true,
                sucesso: true,
                resposta: resPix.mensagemFeedbackWhatsApp || (resPix.comprovanteValido ? "✅ Comprovante PIX validado com sucesso!" : "⚠️ Comprovante com divergência."),
                pix: resPix
            };
        }

        // Espelha o fluxo real: contato pausado (aguardando advogado)
        // No simulador, se o usuário digitar 0, reiniciar, menu ou pedir despausa, libera imediatamente
        const querDespausar = ['0', 'reiniciar', 'reset', 'menu', 'voltar', 'inicio', 'início'].includes(gatilhoDigitado) || Boolean(payload && payload.despausarSePausado);
        if (querDespausar && contatosPausados[remetenteChave]) {
            delete contatosPausados[remetenteChave];
            delete estadosUsuarios[remetenteChave];
            emitirPausados();
        } else {
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

                if (contatosPausados[remetenteChave]) {
                    if (!Array.isArray(contatosPausados[remetenteChave].mensagens)) contatosPausados[remetenteChave].mensagens = [];
                    contatosPausados[remetenteChave].mensagens.push(novaMsg);
                }

                await anexarMensagemOuAudioAoPausado(remetenteChave, {
                    novaMsg,
                    contexto: { apiKey: config.gemini_api_key || process.env.GEMINI_API_KEY }
                });

                if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('bot-log', {
                        numero: identidade.telefoneFormatado,
                        nome: identidade.nomeCliente || '',
                        exibicao: identidade.exibicao,
                        msg: `[Fila Humana] ${mockMsg.body}`,
                        tipo: 'cliente',
                        origem: 'cliente',
                        hora: horaAtual
                    });
                }

                return {
                    success: true,
                    sucesso: true,
                    resposta: "⏸️ *Mensagem registrada:* O robô permanece em pausa pois o contato está na *Fila de Espera* do advogado.\n\n💡 _Dica do Simulador:_ Digite *0* ou clique no botão *🔄 Resetar Conversa* no topo para despausar e retornar ao Menu Inicial.",
                    pausado: true,
                    transbordo: false,
                    podeDespausar: true,
                    itemPausado: contatosPausados[remetenteChave]
                };
            }
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
        if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-log', {
                numero: identidade.telefoneFormatado,
                nome: identidade.nomeCliente || '',
                exibicao: identidade.exibicao,
                msg: mockMsg.body,
                tipo: 'cliente',
                origem: 'cliente',
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
            if (!historicoConversas[remetenteChave]) historicoConversas[remetenteChave] = [];
            historicoConversas[remetenteChave].push({
                de: 'robo',
                texto: respostaSimulada,
                hora: horaLog()
            });
        };
        const finalizarSimulacao = () => {
            if (respostaSimulada && mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', {
                    numero: identidade.telefoneFormatado,
                    nome: identidade.nomeCliente || identidade.exibicao || 'Cliente',
                    exibicao: identidade.exibicao,
                    msg: respostaSimulada,
                    tipo: 'robo',
                    origem: 'robo',
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

            const audiosIniciais = (registroExistente && Array.isArray(registroExistente.historicoAudios))
                ? [...registroExistente.historicoAudios]
                : (audioSalvo.audioBase64 ? [{
                    id: 'audio_1',
                    audioBase64: audioSalvo.audioBase64,
                    mimeType: audioSalvo.mimeType || 'audio/webm',
                    transcricao: audioSalvo.transcricao || '',
                    hora: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }] : []);

            contatosPausados[remetenteChave] = {
                timestamp: Date.now(),
                nome: identidade.nomeCliente || '',
                telefone: identidade.telefoneFormatado,
                exibicao: identidade.exibicao,
                motivo: motivo,
                idChat: mockMsg.from,
                origem: 'SIMULADOR',
                mensagens: msgsIniciais,
                historicoMensagens: [...msgsIniciais],
                historicoAudios: audiosIniciais,
                audioBase64: audioSalvo.audioBase64 || null,
                transcricao: audioSalvo.transcricao || null,
                resumo: audioSalvo.resumo || null,
                sugestoesResposta: audioSalvo.sugestoesResposta || null,
                nivelUrgencia: opcoesExtras.nivelUrgencia || audioSalvo.nivelUrgencia || 'ROTINA',
                motivoUrgencia: audioSalvo.motivoUrgencia || motivo,
                cronologiaFatos: audioSalvo.cronologiaFatos || [],
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
            const msgFinalConfirmacao = (isForaDeExpediente(config) && /já está chegando|chegando para|assumir o seu atendimento|assumir seu atendimento/i.test(String(mensagemConfirmacao || '')))
                ? "👨‍⚖️ Sua solicitação foi registrada com prioridade para o próximo horário de expediente."
                : mensagemConfirmacao;
            await responderCliente(msgFinalConfirmacao);
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

        // Helper que busca no banco ou retorna processo demonstrativo para o CPF de teste padrão do Simulador (123.456.789-00)
        const buscarProcessosSimulador = (digitos) => {
            let procs = buscarProcessosPorNumero(config, digitos);
            if ((!procs || procs.length === 0) && digitos === '12345678900') {
                const lista = Array.isArray(config.processos) ? config.processos : ((config.processos && config.processos.lista) || []);
                const proc = lista[0] || {
                    id: 'proc_demo_simulador',
                    numero: '0004589-72.2025.8.26.0100',
                    numeroProcesso: '0004589-72.2025.8.26.0100',
                    cpf: '12345678900',
                    nome: nomeCliente || 'Cliente Demonstração',
                    resumo: 'Vistos. Julgo PROCEDENTE o pedido inicial para condenar a parte ré ao pagamento de R$ 18.500,00 a título de indenização, bem como determino a expedição imediata de alvará eletrônico após o trânsito em julgado.',
                    atualizadoEm: new Date().toLocaleDateString('pt-BR')
                };
                return [proc];
            }
            return procs;
        };

        // Interceptação imediata de emergência crítica antes de saudações/menu
        if (isMensagemCritica(mockMsg.body, config)) {
            await colocarNaFilaHumana(
                "👨‍⚖️ Mensagem com prioridade crítica identificada. Nossa equipe jurídica foi acionada em alerta máximo.",
                "Emergência: " + mockMsg.body,
                { nivelUrgencia: 'CRITICA' }
            );
            return finalizarSimulacao();
        }

        // Interceptação de Horário de Almoço no Simulador (suprime envio de menu numérico)
        if (estaEmHorarioAlmoco(config) || (payload && payload.testarAlmoco)) {
            const ultimoAlmoco = avisoForaHorarioRecente[remetenteChave + '_almoco'] || 0;
            if (Date.now() - ultimoAlmoco >= 15 * 60 * 1000 || (payload && payload.testarAlmoco)) {
                avisoForaHorarioRecente[remetenteChave + '_almoco'] = Date.now();
                const msgAlmoco = ((config.agenda && config.agenda.msg_almoco) || "Nosso escritório está em intervalo de almoço no momento. Retornaremos em breve!").trim();
                await responderCliente(msgAlmoco);
            }
            return finalizarSimulacao();
        }

        // Seleção de processo quando o CPF/CNPJ possui múltiplos processos vinculados
        if (estadoAtual === 'selecionando_processo' && gatilhoDigitado !== '0') {
            const listaSel = processosSelecionaveisPorContato[remetenteChave] || [];
            const idxEscolha = parseInt(gatilhoDigitado, 10) - 1;
            if (!Number.isNaN(idxEscolha) && idxEscolha >= 0 && idxEscolha < listaSel.length) {
                const procEscolhido = listaSel[idxEscolha];
                delete processosSelecionaveisPorContato[remetenteChave];
                await responderMultiplosProcessosOuUnico(config, [procEscolhido], remetenteChave, responderCliente);
                return finalizarSimulacao();
            }
        }

        // Busca direta por CPF/CNPJ ou Número de Processo antes das saudações (ex: "Bom dia CPF 12345678900")
        const digitosDiretos = apenasNumeros(mockMsg.body);
        if (digitosDiretos.length >= 9 && estadoAtual !== 'aguardando_processo') {
            const procsDiretos = buscarProcessosSimulador(digitosDiretos);
            if (procsDiretos.length > 0) {
                await responderMultiplosProcessosOuUnico(config, procsDiretos, remetenteChave, responderCliente);
                return finalizarSimulacao();
            }
        }

        const saudacoes = ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "menu", "inicio", "início", "ajuda", "help"];
        if (gatilhoDigitado === "0" || saudacoes.some(s => gatilhoDigitado === s || gatilhoDigitado.startsWith(s + " "))) {
            delete processosSelecionaveisPorContato[remetenteChave];
            const procCadastrado = buscarProcessoPorTelefoneCliente(config, remetenteChave);
            if (procCadastrado && gatilhoDigitado !== "0" && remetenteChave !== "5511999998888") {
                const nomeRec = procCadastrado.nome || identidade.nomeCliente || "Cliente";
                estadosUsuarios[remetenteChave] = 'pos_consulta_processo';
                const msgRecorrente = `Olá, *${nomeRec}*! Que bom ter você em contato novamente.\nLocalizamos seu processo ativo: *${procCadastrado.numero || procCadastrado.numeroProcesso}*.\n\n` +
                    (await formatarMensagemProcesso(config, procCadastrado, remetenteChave));
                await responderCliente(msgRecorrente);
                return finalizarSimulacao();
            }
            estadosUsuarios[remetenteChave] = 'raiz';
            await responderCliente(montarTextoEtapa(config.fluxo.raiz, config, identidade));
            return finalizarSimulacao();
        }

        if (estadoAtual === 'aguardando_processo') {
            const digitos = apenasNumeros(mockMsg.body);
            const procsAchados = buscarProcessosSimulador(digitos);
            if (procsAchados.length > 0) {
                await responderMultiplosProcessosOuUnico(config, procsAchados, remetenteChave, responderCliente);
                return finalizarSimulacao();
            } else {
                const msgNaoEncontrado = tplsProc.msg_nao_encontrado || criarConfigPadrao().processos.mensagens.msg_nao_encontrado;
                await responderCliente(msgNaoEncontrado);
                return finalizarSimulacao();
            }
        }

        if (estadoAtual === 'aguardando_relato') {
            await colocarNaFilaHumana(
                "👨‍⚖️ Recebemos seu relato! Um advogado da nossa equipe irá analisar seu caso e responder em breve.",
                "Relato de nova consulta: " + mockMsg.body
            );
            return finalizarSimulacao();
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
                await responderCliente(montarTextoEtapa(proxEtapa || config.fluxo.raiz, config, identidade));
                return finalizarSimulacao();
            }
            if (opcaoEscolhida.tipo === 'processo') {
                estadosUsuarios[remetenteChave] = 'aguardando_processo';
                await responderCliente(opcaoEscolhida.resposta || "Por favor, digite apenas o seu *CPF* ou o *Número do Processo*:");
                return finalizarSimulacao();
            }
            if (opcaoEscolhida.resposta) {
                if (Boolean(acoes.aguardarRelatoLivre) || opcaoEscolhida.tipo === 'relato') {
                    estadosUsuarios[remetenteChave] = 'aguardando_relato';
                }
                await responderCliente(opcaoEscolhida.resposta);
                return finalizarSimulacao();
            }
        }

        // Tratamento humanizado de dúvidas livres ou mensagens fora das opções numéricas
        const ehPerguntaOuRelato = mockMsg.body.includes('?') ||
            /\b(quanto|como|qual|quais|onde|posso|tem|aceita|duvida|dúvida|valor|custo|advogado|consulta|doutor|doutora|urgente|ajuda|preciso|processo|problema|caso|audiencia|acordo)\b/i.test(mockMsg.body) ||
            mockMsg.body.trim().split(/\s+/).length >= 4;

        if (ehPerguntaOuRelato) {
            await colocarNaFilaHumana(
                "👨‍⚖️ Compreendi sua mensagem! Para fornecer uma orientação jurídica precisa para sua dúvida, estou transferindo seu contato para um de nossos advogados.",
                "Dúvida livre no fluxo: " + mockMsg.body
            );
            return finalizarSimulacao();
        }

        if (estadoAtual !== 'raiz' && estadoAtual !== 'pos_consulta_processo') {
            await responderCliente("Não identifiquei essa opção nesta etapa. Por favor, digite o número correspondente à opção desejada ou digite *0* para voltar ao Menu Principal.");
            return finalizarSimulacao();
        }

        estadosUsuarios[remetenteChave] = 'raiz';
        await responderCliente(montarTextoEtapa(config.fluxo.raiz, config, identidade));
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

            const resumoPeca = (cat.resumoCliente && cat.resumoCliente.trim() && !['Documento anexado ao processo.', 'Documento anexado aos autos.'].includes(cat.resumoCliente.trim()))
                ? cat.resumoCliente.trim()
                : ([cat.tipoPeca, cat.assunto, cat.decisao].filter(x => x && x !== '-').join(' — ') || `Peça anexada (${nomeArquivo})`);
            const linhaAtualizacao = `[${doc.anexadoEm}] (${cat.tipoPeca || 'PEÇA'}) ${resumoPeca}`;
            const resumoAtual = String(proc.resumo || '').trim();
            if (!resumoAtual) {
                proc.resumo = linhaAtualizacao;
            } else if (!resumoAtual.includes(resumoPeca)) {
                proc.resumo = `${linhaAtualizacao}\n${resumoAtual}`;
            }
            proc.temAtualizacao = true;
            proc._resetarVistos = true;
            proc.dataAtualizacaoTexto = doc.anexadoEm;

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

// TRANSCRIÇÃO DE ÁUDIO E COPILOT ONE-CLICK COM URGÊNCIA & CRONOLOGIA
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

        // Enriquecer e sincronizar cumulativamente com contato pausado
        const telLimpo = apenasNumeros((contexto && (contexto.telefone || contexto.numero || contexto.chave)) || '');
        if (telLimpo) {
            dadosAudiosPorContato[telLimpo] = {
                audioBase64,
                mimeType,
                transcricao: resultado.transcricao,
                resumo: resultado.resumo,
                sugestoesResposta: resultado.sugestoesResposta,
                nivelUrgencia: resultado.nivelUrgencia,
                motivoUrgencia: resultado.motivoUrgencia,
                cronologiaFatos: resultado.cronologiaFatos
            };
            if (contatosPausados[telLimpo]) {
                const horaAtual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                await anexarMensagemOuAudioAoPausado(telLimpo, {
                    novaMsg: {
                        de: 'cliente',
                        texto: `🎙️ [Mensagem de Voz]: "${resultado.transcricao || 'Áudio enviado'}"`,
                        hora: horaAtual
                    },
                    novoAudio: {
                        audioBase64,
                        mimeType,
                        transcricao: resultado.transcricao,
                        hora: horaAtual
                    },
                    contexto: contextoFinal
                });
            }
        }

        return resultado;
    } catch (err) {
        return {
            sucesso: false,
            erro: err.message,
            transcricao: "[Não foi possível processar o áudio]",
            resumo: "• Erro interno ao despachar áudio.",
            nivelUrgencia: "ROTINA",
            motivoUrgencia: "Falha técnica ao processar áudio",
            cronologiaFatos: [],
            sugestoesResposta: [
                "Olá! Recebi seu áudio e já estou verificando sua solicitação.",
                "Poderia nos resumir o seu pedido por texto enquanto abro sua ficha?",
                "Entendido. Em breve retornaremos com a orientação jurídica necessária."
            ]
        };
    }
});

// ANALISAR URGÊNCIA E CRONOLOGIA DE MENSAGENS ACUMULADAS
ipcMain.handle('ia-analisar-urgencia-cronologia', async (event, dados = {}) => {
    try {
        const { analisarUrgenciaECronologia } = require('./src/ia/tradutorJuridico');
        const cfg = typeof carregarConfig === 'function' ? carregarConfig() : {};
        const apiKey = (dados && dados.apiKey) || cfg.gemini_api_key || process.env.GEMINI_API_KEY;
        return await analisarUrgenciaECronologia(dados.texto || '', { ...(dados || {}), apiKey });
    } catch (err) {
        return {
            sucesso: false,
            erro: err.message,
            nivelUrgencia: 'ROTINA',
            motivoUrgencia: 'Consulta rotineira',
            cronologiaFatos: [],
            sugestoesResposta: []
        };
    }
});

// RESPONDER CLIENTE PAUSADO (MANTÉM CLIENTE PAUSADO ATÉ LIBERAÇÃO EXPLÍCITA DO ADVOGADO)
ipcMain.handle('responder-cliente-pausado', async (event, { chave, textoResposta, despausar = false }) => {
    try {
        const numLimpo = apenasNumeros(chave);
        const item = contatosPausados[numLimpo] || contatosPausados[chave];
        if (item) {
            if (item.origem === 'WHATSAPP' && client && item.idChat) {
                try {
                    const cfgAtual = carregarConfig();
                    const prefixoAdv = cfgAtual?.tomCorporativo ? '' : '*Atendimento Jurídico:*\n\n';
                    await client.sendMessage(item.idChat, `${prefixoAdv}${textoResposta}`);
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

            const horaEnvio = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const registroMsg = { de: 'advogado', texto: textoResposta, hora: horaEnvio };
            if (!Array.isArray(item.historicoMensagens)) item.historicoMensagens = [];
            item.historicoMensagens.push(registroMsg);
            if (!Array.isArray(item.mensagens)) item.mensagens = [];
            item.mensagens.push(registroMsg);

            if (historicoConversas[numLimpo]) {
                historicoConversas[numLimpo].push(registroMsg);
            }

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-log', {
                    numero: item.telefone || `+${numLimpo}`,
                    nome: item.nome || item.exibicao || 'Cliente',
                    exibicao: item.exibicao || item.nome || 'Cliente',
                    msg: textoResposta,
                    tipo: 'advogado',
                    origem: 'advogado',
                    hora: horaEnvio
                });
            }

            if (despausar) {
                delete contatosPausados[numLimpo];
                delete contatosPausados[chave];
            }
            emitirPausados();
            return { sucesso: true, despausado: Boolean(despausar), pausado: !despausar, itemPausado: contatosPausados[numLimpo] || contatosPausados[chave] || null };
        }
        return { sucesso: false, erro: 'Contato não localizado na fila.' };
    } catch (err) {
        return { sucesso: false, erro: err.message };
    }
});

// SUGERIR RESPOSTA COM IA SOB DEMANDA NA FILA DO ADVOGADO (CHAVE INTERNA DO BACKEND)
ipcMain.handle('fila-sugerir-resposta-ia', async (event, dados = {}) => {
    try {
        const { sugerirRespostaFilaComIA, obterApiKeyAtiva } = require('./src/ia/tradutorJuridico');
        const cfg = typeof carregarConfig === 'function' ? carregarConfig() : {};
        const numLimpo = apenasNumeros(dados.chave || '');
        const item = contatosPausados[numLimpo] || contatosPausados[dados.chave] || {};
        const payload = {
            nome: dados.nome || item.nome || '',
            motivo: dados.motivo || item.motivoUrgencia || item.motivo || '',
            transcricao: dados.transcricao || item.transcricao || '',
            resumo: dados.resumo || item.resumo || '',
            historicoMensagens: (Array.isArray(dados.historicoMensagens) && dados.historicoMensagens.length > 0)
                ? dados.historicoMensagens
                : (item.historicoMensagens || item.mensagens || [])
        };
        const apiKey = obterApiKeyAtiva(undefined, cfg);
        return await sugerirRespostaFilaComIA(payload, { config: cfg, ...(apiKey ? { apiKey } : {}) });
    } catch (err) {
        return {
            sucesso: true,
            sugestao: 'Olá! Recebi sua mensagem e já estou analisando seu caso pessoalmente. Como posso ajudar neste momento?',
            fonte: 'fallback',
            erro: err.message
        };
    }
});

// MELHORAR MENSAGEM COM IA (TERMOS TÉCNICOS ACESSÍVEIS, EMOJIS E INTERAÇÕES)
ipcMain.handle('ia-melhorar-mensagem', async (event, dados = {}) => {
    try {
        const texto = typeof dados === 'string' ? dados : (dados && dados.texto ? dados.texto : '');
        const contexto = (dados && typeof dados === 'object' && dados.contexto) ? dados.contexto : (typeof dados === 'object' ? dados : {});
        const { melhorarMensagemComIA, melhorarMensagemLocalmente } = require('./src/ia/tradutorJuridico');
        const cfg = typeof carregarConfig === 'function' ? carregarConfig() : {};
        const chaveResolvida = (contexto && contexto.apiKey) || cfg.gemini_api_key || (cfg.ia && cfg.ia.gemini_api_key) || (cfg.processos && cfg.processos.gemini_api_key) || process.env.GEMINI_API_KEY || undefined;
        const contextoFinal = {
            config: cfg,
            ...(chaveResolvida ? { apiKey: chaveResolvida } : {}),
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

// =========================================================================
// ONBOARDING DIGITAL, DOSSIÊ DE CLIENTES & GESTÃO FINANCEIRA (PIX)
// =========================================================================

ipcMain.handle('iniciar-onboarding', async (event, payload = {}) => {
    try {
        const { iniciarSessaoOnboarding } = require('./src/onboarding/onboardingController');
        const cfg = carregarConfig();
        const clienteTelefone = payload.clienteTelefone || payload.telefone || '';
        const clienteNome = payload.clienteNome || payload.nome || 'Cliente';
        const preset = payload.preset || 'Geral';
        const itensPersonalizados = Array.isArray(payload.itensPersonalizados) ? payload.itensPersonalizados : null;
        const mensagemPersonalizada = payload.mensagemPersonalizada || payload.mensagem || '';

        const sessao = iniciarSessaoOnboarding(clienteTelefone, clienteNome, preset, cfg, {
            mensagemPersonalizada,
            itensPersonalizados
        });
        salvarConfigDisco(cfg);

        const msgTextoDisparo = sessao.mensagemDisparo || sessao.mensagemSolicitacaoWhatsApp || '';

        // Dispara mensagem estruturada no WhatsApp se estiver conectado e solicitado
        if (payload.enviarWhatsApp !== false && client && (statusAtualBot === 'ready' || statusAtualBot === 'CONECTADO') && msgTextoDisparo) {
            const digitos = apenasNumeros(clienteTelefone);
            if (digitos) {
                try {
                    const chatId = digitos.includes('@') ? digitos : `${digitos}@c.us`;
                    await client.sendMessage(chatId, msgTextoDisparo);
                } catch (errEnvio) {
                    console.warn('[Onboarding] Aviso ao enviar mensagem WhatsApp:', errEnvio.message);
                }
            }
        }

        // Atualiza status na fila humana se o contato estiver pausado
        const chave = apenasNumeros(clienteTelefone);
        if (chave) {
            contatosPausados[chave] = contatosPausados[chave] || {
                telefone: clienteTelefone,
                nome: clienteNome,
                timestamp: Date.now()
            };
            contatosPausados[chave].statusOnboarding = 'DOCS_SOLICITADOS';
            contatosPausados[chave].presetOnboarding = preset;
            emitirPausados();
        }

        // Notifica o Simulador de WhatsApp na tela para exibir o balão do advogado imediatamente
        if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed() && msgTextoDisparo) {
            try {
                mainWindow.webContents.send('simulador-resposta-advogado', {
                    telefone: clienteTelefone,
                    chave,
                    texto: msgTextoDisparo,
                    tipo: 'onboarding_solicitacao',
                    timestamp: Date.now()
                });
            } catch (errSim) {
                console.warn('[Onboarding] Aviso ao notificar simulador:', errSim.message);
            }
        }

        return {
            sucesso: true,
            sessao,
            mensagemDisparo: msgTextoDisparo,
            mensagemSolicitacaoWhatsApp: msgTextoDisparo
        };
    } catch (err) {
        console.error('[IPC iniciar-onboarding] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('obter-dossies', async () => {
    try {
        const { obterDossies } = require('./src/onboarding/onboardingController');
        const cfg = carregarConfig();
        const resultado = obterDossies(cfg);
        const mapa = (resultado && typeof resultado === 'object') ? resultado : (cfg.dossiesClientes || {});
        const lista = Object.values(mapa);
        return {
            sucesso: true,
            mapa,
            lista,
            ...mapa,
            configuracaoCobranca: cfg.configuracaoCobranca || {},
            financeiro: cfg.financeiro || { parcelas: [], comprovantesRecebidos: [] }
        };
    } catch (err) {
        console.error('[IPC obter-dossies] Erro:', err);
        return { sucesso: false, erro: err.message, lista: [], mapa: {}, sessoesOnboarding: {} };
    }
});
ipcMain.handle('copiar-qualificacao-cpc', async (event, payload = {}) => {
    try {
        const { gerarQualificacaoCPC } = require('./src/onboarding/formatadorCPC');
        const cfg = carregarConfig();
        let qualificacaoDados = payload.qualificacao || payload;
        if (payload.clienteId || payload.telefone) {
            const chave = apenasNumeros(payload.clienteId || payload.telefone);
            const dossie = cfg.dossiesClientes && cfg.dossiesClientes[chave];
            if (dossie && dossie.civil) {
                qualificacaoDados = { ...dossie.civil, ...(payload.qualificacao || payload) };
            }
        }
        const textoCPC = gerarQualificacaoCPC(qualificacaoDados);
        try {
            const { clipboard } = require('electron');
            if (clipboard && typeof clipboard.writeText === 'function') {
                clipboard.writeText(textoCPC);
            }
        } catch (errClip) {}
        return { sucesso: true, texto: textoCPC };
    } catch (err) {
        console.error('[IPC copiar-qualificacao-cpc] Erro:', err);
        return { sucesso: false, erro: err.message, texto: '' };
    }
});

ipcMain.handle('salvar-config-cobranca', async (event, novaConfig = {}) => {
    try {
        const { salvarConfiguracaoCobranca } = require('./src/financeiro/gestaoFinanceira');
        const cfg = carregarConfig();
        const configSalva = salvarConfiguracaoCobranca(novaConfig, cfg);
        salvarConfigDisco(cfg);
        return { sucesso: true, configuracaoCobranca: configSalva };
    } catch (err) {
        console.error('[IPC salvar-config-cobranca] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('disparar-regua-cobranca', async (event, opcoes = {}) => {
    try {
        const { dispararReguaCobranca } = require('./src/financeiro/gestaoFinanceira');
        const cfg = carregarConfig();
        const enviarMsgFn = async (telefone, mensagem) => {
            const digitos = apenasNumeros(telefone);
            if (client && (statusAtualBot === 'ready' || statusAtualBot === 'CONECTADO') && digitos) {
                const chatId = digitos.includes('@') ? digitos : `${digitos}@c.us`;
                await client.sendMessage(chatId, mensagem);
                return true;
            }
            return true; // Simulado com sucesso quando WhatsApp offline
        };
        const relatorio = await dispararReguaCobranca(cfg, {
            enviarMensagemWhatsApp: enviarMsgFn,
            delayMsOverride: typeof opcoes.delayMs === 'number' ? opcoes.delayMs : 50,
            ignorarDiaSemana: opcoes.ignorarDiaDaSemana !== undefined ? opcoes.ignorarDiaDaSemana : true,
            apenasParcelaId: opcoes.apenasParcelaId || null
        });
        salvarConfigDisco(cfg);
        return relatorio;
    } catch (err) {
        console.error('[IPC disparar-regua-cobranca] Erro:', err);
        return { sucesso: false, erro: err.message, enviados: 0 };
    }
});

// Agendador semanal automático da Régua PIX (verifica a cada 60s sem duplicar no mesmo dia)
let ultimaDataDisparoAutoPix = '';
setInterval(async () => {
    try {
        if (!client || (statusAtualBot !== 'ready' && statusAtualBot !== 'CONECTADO')) return;
        const cfg = carregarConfig();
        const cob = cfg?.configuracaoCobranca;
        if (!cob || !cob.chavePix || cob.modoAprovacao === 'DESATIVADO') return;

        const agora = new Date();
        const hojeISO = agora.toISOString().slice(0, 10);
        if (ultimaDataDisparoAutoPix === hojeISO) return;

        const horaAtual = agora.toTimeString().slice(0, 5);
        const horaAlvo = String(cob.horarioEnvio || '09:30').trim();
        if (horaAtual < horaAlvo) return;

        ultimaDataDisparoAutoPix = hojeISO;
        const { dispararReguaCobranca } = require('./src/financeiro/gestaoFinanceira');
        const enviarMsgFn = async (telefone, mensagem) => {
            const digitos = apenasNumeros(telefone);
            if (client && (statusAtualBot === 'ready' || statusAtualBot === 'CONECTADO') && digitos) {
                const chatId = digitos.includes('@') ? digitos : `${digitos}@c.us`;
                await client.sendMessage(chatId, mensagem);
                return true;
            }
            return false;
        };
        const rel = await dispararReguaCobranca(cfg, {
            enviarMensagemWhatsApp: enviarMsgFn,
            ignorarDiaSemana: false,
            dataReferencia: agora
        });
        if (rel && rel.totalEnviados > 0) {
            salvarConfigDisco(cfg);
            console.log(`[Régua PIX Automática] ${rel.totalEnviados} lembrete(s) enviado(s) em ${hojeISO}.`);
        }
    } catch (err) {
        console.error('[Régua PIX Automática] Erro:', err.message);
    }
}, 60 * 1000);

// Agendador periódico de Lembrete de Dossiê Parcial (48 horas)
setInterval(async () => {
    try {
        if (!client || (statusAtualBot !== 'ready' && statusAtualBot !== 'CONECTADO')) return;
        const cfg = carregarConfig();
        const { verificarLembretesDossieParcial } = require('./src/onboarding/onboardingController');
        const enviarMsgFn = async (telefone, mensagem) => {
            const digitos = apenasNumeros(telefone);
            if (client && (statusAtualBot === 'ready' || statusAtualBot === 'CONECTADO') && digitos) {
                const chatId = digitos.includes('@') ? digitos : `${digitos}@c.us`;
                await client.sendMessage(chatId, mensagem);
                return true;
            }
            return false;
        };
        const rel = await verificarLembretesDossieParcial(cfg, {
            enviarMensagemWhatsApp: enviarMsgFn,
            isContactIgnored: (tel, c) => isContactIgnored(tel, c)
        });
        if (rel && rel.totalEnviados > 0) {
            salvarConfigDisco(cfg);
            console.log(`[Lembrete Dossiê Parcial] ${rel.totalEnviados} lembrete(s) automático(s) de 48h disparado(s).`);
            if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-processos-sync', cfg);
            }
        }
    } catch (err) {
        console.error('[Lembrete Dossiê Parcial] Erro no agendador:', err.message);
    }
}, 60 * 1000);

ipcMain.handle('dar-baixa-parcela', async (event, payload = {}) => {
    try {
        const { darBaixaParcela } = require('./src/financeiro/gestaoFinanceira');
        const cfg = carregarConfig();
        const parcelaId = typeof payload === 'string' ? payload : (payload.parcelaId || payload.id);
        const dadosPagamento = (typeof payload === 'object' && payload !== null) ? (payload.dadosPagamento || payload) : {};
        const resultado = darBaixaParcela(parcelaId, cfg, dadosPagamento);
        if (resultado.sucesso) {
            salvarConfigDisco(cfg);
            // Notificação suave para a interface
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('notificacao-pagamento', resultado);
            }
            // Notificação nativa não invasiva do Windows
            try {
                if (Notification && typeof Notification.isSupported === 'function' && Notification.isSupported()) {
                    new Notification({
                        title: resultado.quitacaoTotal ? '🎉 Honorários Totalmente Quitados!' : '💰 Pagamento Recebido',
                        body: resultado.mensagemNotificacao || `${resultado.clienteNome} pagou R$ ${resultado.valorPago}`
                    }).show();
                }
            } catch (errNotif) {}
        }
        return resultado;
    } catch (err) {
        console.error('[IPC dar-baixa-parcela] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('obter-metricas-financeiras', async () => {
    try {
        const { obterMetricasFinanceiras } = require('./src/financeiro/gestaoFinanceira');
        const cfg = carregarConfig();
        const metricas = obterMetricasFinanceiras(cfg);
        return { sucesso: true, success: true, metricas };
    } catch (err) {
        console.error('[IPC obter-metricas-financeiras] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('calcular-encargos-parcela', async (event, payload = {}) => {
    try {
        const { calcularEncargosParcela } = require('./src/financeiro/gestaoFinanceira');
        const cfg = carregarConfig();
        const parcela = payload.parcela || payload;
        const dataRef = payload.dataReferencia || null;
        const res = calcularEncargosParcela(parcela, cfg, dataRef);
        return { sucesso: true, ...res };
    } catch (err) {
        console.error('[IPC calcular-encargos-parcela] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('excluir-contrato-financeiro', async (event, payload = {}) => {
    try {
        const { excluirContratoFinanceiro } = require('./src/financeiro/gestaoFinanceira');
        const cfg = carregarConfig();
        const identificador = typeof payload === 'string' ? payload : (payload.contratoId || payload.id || payload.clienteTelefone);
        const arquivar = payload.arquivar !== false;
        const res = excluirContratoFinanceiro(identificador, cfg, arquivar);
        salvarConfigDisco(cfg);
        return { sucesso: true, success: true, ...res };
    } catch (err) {
        console.error('[IPC excluir-contrato-financeiro] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('financeiro-adicionar-parcela', async (event, dadosParcela = {}) => {
    try {
        const { adicionarParcela } = require('./src/financeiro/gestaoFinanceira');
        const cfg = carregarConfig();
        const nova = adicionarParcela(dadosParcela, cfg);
        salvarConfigDisco(cfg);
        return { sucesso: true, parcela: nova, parcelas: cfg.financeiro.parcelas };
    } catch (err) {
        console.error('[IPC financeiro-adicionar-parcela] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('onboarding-processar-midia', async (event, payload = {}) => {
    try {
        const { processarMidiaOnboarding } = require('./src/onboarding/onboardingController');
        const cfg = carregarConfig();
        const buffer = Buffer.isBuffer(payload.buffer)
            ? payload.buffer
            : Buffer.from(String(payload.base64 || ''), 'base64');
        const resultado = await processarMidiaOnboarding({
            clienteTelefone: payload.clienteTelefone || payload.telefone,
            clienteNome: payload.clienteNome || payload.nome,
            buffer,
            mimetype: payload.mimetype || 'image/jpeg',
            nomeOriginal: payload.nomeOriginal || 'documento.jpg',
            apiKey: cfg.gemini_api_key || process.env.GEMINI_API_KEY
        }, cfg);
        salvarConfigDisco(cfg);
        if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-processos-sync', cfg);
        }
        return resultado;
    } catch (err) {
        console.error('[IPC onboarding-processar-midia] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('onboarding-consolidar-dossie', async (event, payload = {}) => {
    try {
        const { consolidarDossie } = require('./src/onboarding/onboardingController');
        const cfg = carregarConfig();
        const tel = typeof payload === 'string' ? payload : (payload.clienteTelefone || payload.telefone);
        const dossie = consolidarDossie(tel, cfg);
        salvarConfigDisco(cfg);
        if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('bot-processos-sync', cfg);
        }
        return { sucesso: Boolean(dossie), dossie };
    } catch (err) {
        console.error('[IPC onboarding-consolidar-dossie] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('onboarding-verificar-lembretes-parciais', async (event, payload = {}) => {
    try {
        const { verificarLembretesDossieParcial } = require('./src/onboarding/onboardingController');
        const cfg = carregarConfig();
        const enviarMsgFn = async (telefone, mensagem) => {
            const digitos = apenasNumeros(telefone);
            if (client && (statusAtualBot === 'ready' || statusAtualBot === 'CONECTADO') && digitos) {
                const chatId = digitos.includes('@') ? digitos : `${digitos}@c.us`;
                await client.sendMessage(chatId, mensagem);
                return true;
            }
            return false;
        };
        const rel = await verificarLembretesDossieParcial(cfg, {
            ...payload,
            enviarMensagemWhatsApp: payload.simulacao ? null : enviarMsgFn,
            isContactIgnored: (tel, c) => isContactIgnored(tel, c)
        });
        if (rel && rel.totalEnviados > 0) {
            salvarConfigDisco(cfg);
            if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-processos-sync', cfg);
            }
        }
        return { sucesso: true, ...rel };
    } catch (err) {
        console.error('[IPC onboarding-verificar-lembretes-parciais] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('onboarding-gerar-kit-inicial', async (event, payload = {}) => {
    try {
        const { gerarKitInicial } = require('./src/onboarding/geradorKitInicial');
        const cfg = carregarConfig();
        const rawId = payload.clienteId || payload.clienteTelefone || payload.telefone || '';
        const chaveNum = apenasNumeros(rawId);
        const dossiesMapa = cfg.dossiesClientes || {};
        const dossie = payload.dossie || dossiesMapa[rawId] || dossiesMapa[chaveNum] || {
            clienteId: chaveNum || rawId,
            clienteTelefone: chaveNum || rawId,
            clienteNome: payload.qualificacao?.nomeCompleto || 'Cliente',
            civil: payload.qualificacao || {}
        };

        const statusUpper = String(dossie.status || '').toUpperCase();
        if (statusUpper && statusUpper !== 'CONSOLIDADO' && !payload.forcar) {
            return {
                sucesso: false,
                erro: `Dossiê precisa estar com status CONSOLIDADO para gerar o Kit Inicial (status atual: ${statusUpper}).`
            };
        }

        const escritorio = {
            nomeEscritorio: cfg.nomeEscritorio || cfg.configuracaoCobranca?.beneficiario || 'Escritório de Advocacia',
            nomeAdvogado: cfg.nomeAdvogado || cfg.advogadoResponsavel || cfg.nomeEscritorio || 'Advogado(a) Responsável',
            oab: cfg.oab || cfg.numeroOab || 'OAB/UF [Registro]',
            cnpj: cfg.cnpj || cfg.configuracaoCobranca?.cnpj || '',
            enderecoEscritorio: cfg.enderecoEscritorio || '',
            cidade: cfg.configuracaoCobranca?.cidade || cfg.cidadeEscritorio || 'Brasília/DF',
            ...(payload.escritorio || {})
        };

        const res = await gerarKitInicial({
            dossie,
            qualificacao: payload.qualificacao || null,
            escritorio,
            contrato: payload.contrato || {},
            incluirHipossuficiencia: payload.incluirHipossuficiencia !== false
        });

        if (dossiesMapa[rawId] || dossiesMapa[chaveNum]) {
            const targetKey = dossiesMapa[rawId] ? rawId : chaveNum;
            cfg.dossiesClientes[targetKey].kitInicial = {
                geradoEm: new Date().toISOString(),
                pastaKit: res.pastaKit,
                pastaCpf: res.pastaCpf,
                arquivos: res.arquivos
            };
            salvarConfigDisco(cfg);
            if (mainWindow && typeof mainWindow.isDestroyed === 'function' && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('bot-processos-sync', cfg);
            }
        }

        return res;
    } catch (err) {
        console.error('[IPC onboarding-gerar-kit-inicial] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

ipcMain.handle('onboarding-enviar-kit-whatsapp', async (event, payload = {}) => {
    try {
        const { montarMensagemKitWhatsapp } = require('./src/onboarding/geradorKitInicial');
        const cfg = carregarConfig();
        const rawId = payload.clienteTelefone || payload.clienteId || payload.telefone || '';
        const chaveNum = apenasNumeros(rawId);
        const dossiesMapa = cfg.dossiesClientes || {};
        const dossie = dossiesMapa[rawId] || dossiesMapa[chaveNum] || {};

        const arquivos = Array.isArray(payload.arquivos) && payload.arquivos.length > 0
            ? payload.arquivos
            : (dossie.kitInicial?.arquivos || []);

        const nomeCliente = payload.clienteNome || dossie.clienteNome || dossie.civil?.nomeCompleto || 'Cliente';
        const beneficiario = cfg.configuracaoCobranca?.beneficiario || cfg.nomeEscritorio || 'Escritório de Advocacia';
        const mensagem = montarMensagemKitWhatsapp({
            clienteNome: nomeCliente,
            beneficiario,
            arquivos,
            valorEntrada: payload.valorEntrada || 0,
            txid: payload.txid || `KIT${chaveNum.slice(-8) || 'INICIAL'}`,
            config: cfg
        });

        const digitos = apenasNumeros(dossie.clienteTelefone || rawId);
        if (client && (statusAtualBot === 'ready' || statusAtualBot === 'CONECTADO') && digitos && !payload.simulacao) {
            const chatId = digitos.includes('@') ? digitos : `${digitos}@c.us`;
            await client.sendMessage(chatId, mensagem);
            let arquivosEnviados = 0;
            for (const arq of arquivos) {
                if (arq && arq.caminho && fs.existsSync(arq.caminho)) {
                    const media = MessageMedia.fromFilePath(arq.caminho);
                    await client.sendMessage(chatId, media, { sendMediaAsDocument: true });
                    arquivosEnviados++;
                }
            }
            return { sucesso: true, modo: 'whatsapp', arquivosEnviados, mensagem };
        }

        return {
            sucesso: true,
            modo: 'simulacao',
            aviso: 'WhatsApp não conectado no momento — mensagem completa preparada com instruções Gov.br e PIX.',
            mensagem,
            arquivos
        };
    } catch (err) {
        console.error('[IPC onboarding-enviar-kit-whatsapp] Erro:', err);
        return { sucesso: false, erro: err.message };
    }
});

module.exports = {
    traduzirAndamentoParaCliente,
    formatarMensagemProcesso,
    buscarProcessoPorNumero,
    processarMensagemEntrada,
    executarSimulacaoMensagem,
    resetarConversaSimulador,
    cifrarChaveApi,
    decifrarChaveApi,
    prepararConfigParaDisco,
    hidratarChaveApiAoCarregar,
    carregarConfig,
    salvarConfigDisco,
    sanitizarConfigParaRenderer
};

