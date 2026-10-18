/**
 * =========================================================================
 * ADVOCACIA STUDIO PRO v2.0 - SERVIDOR HEADLESS (SAAS / NUVEM 24/7)
 * =========================================================================
 * 
 * Permite a execução autônoma do bot no Linux/Docker/VPS sem interface gráfica (Electron).
 * Suporte a:
 * - Docker / Docker Compose / Kubernetes / PM2
 * - Servidor HTTP embutido com /status, /qr-status, /health, /qr, /pausados para monitoramento remoto
 * - Persistência de Sessão WhatsApp LocalAuth em ./wwebjs_auth_session_v2
 * - Puppeteer headless otimizado com flag --single-process para VPS/ARM
 * - Captura e transcrição multimodal de áudios de clientes com IA Gemini
 * - Fila de transbordo humano cumulativa com Detector de Urgência e Cronologia dos Fatos
 * - Resiliência e auto-recuperação anti-crash
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const {
    traduzirAndamentoParaCliente,
    processarAudioECopilot,
    analisarUrgenciaECronologia
} = require('./src/ia/tradutorJuridico');
const { criarConfigPadraoV2, migrarConfigV1ParaV2 } = require('./migracao');

// 1. Carregamento de variáveis de ambiente (.env)
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

const PORT = parseInt(process.env.PORT || '3000', 10);
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, 'config.json');
const SESSION_PATH = process.env.SESSION_PATH || path.join(__dirname, 'wwebjs_auth_session_v2');
const API_SECRET_TOKEN = (process.env.API_SECRET_TOKEN || '').trim();

// Autenticação REST flexível para nuvem e containers
function verificarAutenticacao(req, parsedUrl) {
    const secret = (process.env.API_SECRET_TOKEN !== undefined)
        ? String(process.env.API_SECRET_TOKEN).trim()
        : API_SECRET_TOKEN;
    if (!secret) return true; // Retrocompatível quando não configurado localmente

    const headers = (req && req.headers) || {};
    const authHeader = String(headers['authorization'] || headers['Authorization'] || '').trim();
    const apiKeyHeader = String(headers['x-api-key'] || headers['X-API-KEY'] || headers['X-Api-Key'] || headers['x-api-token'] || '').trim();

    let queryToken = '';
    if (parsedUrl) {
        if (parsedUrl.query && parsedUrl.query.token) {
            queryToken = String(parsedUrl.query.token).trim();
        } else if (parsedUrl.searchParams && typeof parsedUrl.searchParams.get === 'function') {
            queryToken = String(parsedUrl.searchParams.get('token') || '').trim();
        }
    } else if (req && req.url) {
        try {
            const tempUrl = new URL(req.url, 'http://localhost');
            queryToken = String(tempUrl.searchParams.get('token') || '').trim();
        } catch (e) {}
    }

    const bearerToken = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    return (bearerToken === secret || apiKeyHeader === secret || queryToken === secret);
}

// Leitor seguro de corpo POST (JSON) com proteção de limite de payload
function lerCorpoJson(req, limiteBytes = 5 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        let tamanho = 0;
        const chunks = [];
        req.on('data', chunk => {
            tamanho += chunk.length;
            if (tamanho > limiteBytes) {
                req.destroy(new Error('Payload Too Large'));
                return reject(new Error('Payload Too Large'));
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf-8');
                if (!raw || !raw.trim()) return resolve({});
                resolve(JSON.parse(raw));
            } catch (err) {
                reject(new Error('JSON Inválido: ' + err.message));
            }
        });
        req.on('error', reject);
    });
}

// Proteção anti-crash
process.on('uncaughtException', (err) => {
    console.error('[Proteção Anti-Crash Headless] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[Proteção Anti-Crash Headless] unhandledRejection:', reason);
});

// Estado do servidor e monitoramento de conexão
let qrCodeAtual = null;
let statusConexao = 'DISCONNECTED'; // DISCONNECTED, QR_READY, CONNECTED
let ultimoQrDataUrl = '';
let momentoConexao = 0;
let totalMensagensProcessadas = 0;
let client = null;

let configEmMemoria = null;
let contatosPausados = {};
let dadosAudiosPorContato = {};
let historicoConversas = {};
let estadosUsuarios = {};
let avisoForaHorarioRecente = {};
let mensagensJaProcessadas = new Set();

// Frases padrão de transbordo direto para atendimento humano
const FRASES_TRANSBORDO_DIRETO = [
    'falar com advogado', 'falar com o advogado', 'chamar advogado',
    'quero falar com advogado', 'atendimento humano', 'humano', 'advogado',
    'falar com atendente', 'atendente', 'urgente'
];

// Funções utilitárias
function apenasNumeros(str) {
    return String(str || '').replace(/\D/g, '');
}

function carregarConfig() {
    if (configEmMemoria) return configEmMemoria;
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
            configEmMemoria = JSON.parse(raw);
            return configEmMemoria;
        }
    } catch (e) {
        console.error('[Server] Erro ao carregar config.json:', e);
    }
    configEmMemoria = criarConfigPadraoV2();
    return configEmMemoria;
}

function salvarConfigDisco(cfg) {
    if (!cfg) return;
    configEmMemoria = cfg;
    const tmpPath = `${CONFIG_PATH}.tmp`;
    const backupPath = path.join(path.dirname(CONFIG_PATH), 'config.backup.json');
    try {
        const payload = JSON.stringify(cfg, null, 2);
        fs.writeFileSync(tmpPath, payload, 'utf-8');
        if (fs.existsSync(CONFIG_PATH)) {
            try {
                fs.copyFileSync(CONFIG_PATH, backupPath);
            } catch (errBackup) {}
        }
        fs.renameSync(tmpPath, CONFIG_PATH);
    } catch (e) {
        console.error('[Server] Erro ao gravar config.json no disco:', e);
        try {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        } catch (errClean) {}
    }
}

function isContactIgnored(numeroOuId) {
    const cfg = carregarConfig();
    const lista = cfg.contatosIgnorados || [];
    const digitos = apenasNumeros(numeroOuId);
    if (!digitos) return false;
    return lista.some(item => {
        const itemDig = apenasNumeros(typeof item === 'object' && item !== null ? (item.numero || item.telefone) : item);
        return itemDig === digitos;
    });
}

function verificarExpediente(cfg) {
    if (!cfg || !cfg.agenda) return { aberto: true, motivo: null };
    const agora = new Date();
    const diaSemana = agora.getDay().toString();
    const regraDia = cfg.agenda[diaSemana];

    if (!regraDia || !regraDia.ativo) {
        return { aberto: false, motivo: 'fora_expediente', msg: cfg.agenda.msg_fora_expediente };
    }

    const agoraMin = agora.getHours() * 60 + agora.getMinutes();
    const [hAb, mAb] = (regraDia.abertura || '08:00').split(':').map(Number);
    const [hFe, mFe] = (regraDia.fechamento || '18:00').split(':').map(Number);
    const aberturaMin = hAb * 60 + mAb;
    const fechamentoMin = hFe * 60 + mFe;

    if (agoraMin < aberturaMin || agoraMin >= fechamentoMin) {
        return { aberto: false, motivo: 'fora_expediente', msg: cfg.agenda.msg_fora_expediente };
    }

    if (cfg.agenda.almoco_ativo) {
        const [hAlmIni, mAlmIni] = (cfg.agenda.almoco_inicio || '12:00').split(':').map(Number);
        const [hAlmFim, mAlmFim] = (cfg.agenda.almoco_fim || '13:30').split(':').map(Number);
        const almocoIniMin = hAlmIni * 60 + mAlmIni;
        const almocoFimMin = hAlmFim * 60 + mAlmFim;
        if (agoraMin >= almocoIniMin && agoraMin < almocoFimMin) {
            return { aberto: false, motivo: 'almoco', msg: cfg.agenda.msg_almoco };
        }
    }

    return { aberto: true, motivo: null };
}

function montarTextoEtapa(etapa) {
    if (!etapa) return "Olá! Como podemos orientar você hoje?";
    let txt = (etapa.mensagem || '') + "\n\n";
    (etapa.opcoes || []).forEach(op => {
        txt += `*${op.gatilho}* - ${op.rotulo}\n`;
    });
    return txt.trim();
}

function buscarProcessoPorNumero(config, digitosBusca) {
    if (!config || !config.processos) return null;
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
    const tpls = (config.processos && config.processos.mensagens) || {};
    const temResumo = Boolean(proc.temAtualizacao && proc.resumo && proc.resumo.trim());

    if (!proc.consultasPorContato) proc.consultasPorContato = {};
    const ultimaConsulta = proc.consultasPorContato[remetenteChave];
    const agoraTexto = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

    let modelo = tpls.msg_sem_atualizacao || "⚖️ *Consulta Processual*\n\nOlá, *{nome}*! Seu processo nº *{processo}* não possui movimentações no momento.";
    if (temResumo) {
        if (ultimaConsulta && !proc._resetarVistos) {
            modelo = tpls.msg_ja_visto || "⚖️ *Consulta Processual*\n\nOlá, *{nome}*! Não houve novas movimentações desde *{ultima_consulta}*.\n\n{resumo}";
        } else {
            modelo = tpls.msg_com_atualizacao || "⚖️ *Andamento Processual*\n\nOlá, *{nome}*!\nProcesso: *{processo}*\n\n📋 *Resumo ({data}):*\n{resumo}";
        }
    }

    proc.consultasPorContato[remetenteChave] = agoraTexto;
    proc._resetarVistos = false;
    salvarConfigDisco(config);

    let resumoParaExibir = proc.resumo || 'Sem detalhes adicionais.';
    if (temResumo) {
        try {
            resumoParaExibir = await traduzirAndamentoParaCliente(proc, proc.resumo, config);
        } catch (e) {
            resumoParaExibir = proc.resumo;
        }
    }

    return String(modelo || '')
        .replace(/\{nome\}/g, proc.nome || 'Cliente')
        .replace(/\{cpf\}/g, proc.cpf || '-')
        .replace(/\{processo\}/g, proc.numero || proc.numeroProcesso || '-')
        .replace(/\{resumo\}/g, resumoParaExibir)
        .replace(/\{data\}/g, proc.dataAtualizacaoTexto || agoraTexto)
        .replace(/\{ultima_consulta\}/g, ultimaConsulta || agoraTexto);
}

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
        item.mensagens.push(novaMsg);
        item.historicoMensagens.push(novaMsg);
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
        const cfg = carregarConfig();
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
        console.error('[Server] Erro ao analisar urgência/cronologia consolidada:', errAnalise);
    }

    return item;
}

async function processarMensagemEntrada(msg) {
    try {
        if (!msg || msg.fromMe || msg.isStatus || msg.broadcast) return false;
        if (!msg.from || msg.from.includes('@g.us') || msg.from.includes('@newsletter') || msg.from.includes('@broadcast')) return false;

        const senderId = msg.from || '';
        if (isContactIgnored(senderId)) return false;

        const msgId = msg.id?._serialized || `${msg.from}_${msg.timestamp}_${msg.body}`;
        if (mensagensJaProcessadas.has(msgId)) return false;

        const ehAudio = Boolean(msg.hasMedia && (msg.type === 'ptt' || msg.type === 'audio'));
        const ehMidiaVisual = Boolean(msg.hasMedia && !ehAudio);
        let textoOriginal = String(msg.body || '').trim();
        if (!textoOriginal && !ehAudio && !ehMidiaVisual) return false;
        if (ehAudio && !textoOriginal) {
            textoOriginal = '[Mensagem de Voz enviada pelo cliente]';
        } else if (ehMidiaVisual && !textoOriginal) {
            textoOriginal = '[Documento ou Comprovante enviado pelo cliente]';
        }

        mensagensJaProcessadas.add(msgId);
        if (mensagensJaProcessadas.size > 2000) {
            const primeiroItem = mensagensJaProcessadas.values().next().value;
            mensagensJaProcessadas.delete(primeiroItem);
        }

        totalMensagensProcessadas++;
        const config = carregarConfig();
        const remetenteChave = apenasNumeros(senderId);

        if (isContactIgnored(remetenteChave)) return false;

        // Se for documento/imagem (Onboarding Digital ou Comprovante PIX)
        if (ehMidiaVisual && typeof msg.downloadMedia === 'function') {
            try {
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    const bufferMidia = Buffer.from(media.data, 'base64');
                    const mimeType = media.mimetype || 'image/jpeg';
                    const nomeArquivo = media.filename || `midia_${Date.now()}.${mimeType.includes('pdf') ? 'pdf' : 'jpg'}`;
                    const apiKey = config.gemini_api_key || process.env.GEMINI_API_KEY;
                    const { obterSessaoAtiva, processarMidiaOnboarding } = require('./src/onboarding/onboardingController');
                    const { processarComprovanteRecebido } = require('./src/financeiro/gestaoFinanceira');

                    const sessaoAtiva = obterSessaoAtiva(remetenteChave, config);
                    const legMin = String(msg.body || '').toLowerCase();
                    const parecePix = legMin.includes('pix') || legMin.includes('comprovante') || legMin.includes('pagamento');

                    if (sessaoAtiva && !parecePix) {
                        const resOnb = await processarMidiaOnboarding({
                            clienteTelefone: remetenteChave,
                            clienteNome: config.mapaNomes?.[remetenteChave] || sessaoAtiva.clienteNome || 'Cliente WhatsApp',
                            buffer: bufferMidia,
                            mimetype: mimeType,
                            nomeOriginal: nomeArquivo,
                            apiKey
                        }, config);
                        salvarConfigDisco(config);
                        if (resOnb && resOnb.mensagemFeedbackWhatsApp && client) {
                            await client.sendMessage(msg.from, resOnb.mensagemFeedbackWhatsApp);
                        }
                        return true;
                    } else {
                        const resPix = await processarComprovanteRecebido({
                            clienteTelefone: remetenteChave,
                            clienteNome: config.mapaNomes?.[remetenteChave] || 'Cliente WhatsApp',
                            buffer: bufferMidia,
                            mimetype: mimeType,
                            apiKey
                        }, config);
                        salvarConfigDisco(config);
                        if (resPix && resPix.mensagemFeedbackWhatsApp && client) {
                            await client.sendMessage(msg.from, resPix.mensagemFeedbackWhatsApp);
                        }
                        if (resPix && resPix.sucesso) return true;
                    }
                }
            } catch (errMidia) {
                console.error('[Server] Erro ao processar mídia visual:', errMidia);
            }
        }

        // Se for áudio do WhatsApp, faz download e processa via Gemini Multimodal
        if (ehAudio && typeof msg.downloadMedia === 'function') {
            try {
                const media = await msg.downloadMedia();
                if (media && media.data) {
                    const audioBase64 = media.data;
                    const mimeType = media.mimetype || 'audio/ogg';
                    const resAudio = await processarAudioECopilot(audioBase64, mimeType, {
                        telefone: remetenteChave,
                        apiKey: config.gemini_api_key || process.env.GEMINI_API_KEY
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
                console.error('[Server] Erro ao baixar/processar áudio no WhatsApp:', errAudio);
            }
        }

        // Se contato já está em transbordo/pausa, acumula mensagem/áudio e reavalia urgência
        if (contatosPausados[remetenteChave]) {
            const horaMsg = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const novaMsg = { de: 'cliente', texto: textoOriginal, hora: horaMsg };
            
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
            console.log(`[Server] Mensagem/áudio cumulativo anexado ao contato pausado ${remetenteChave}`);
            return false;
        }

        const responder = async (textoResposta) => {
            if (!textoResposta) return;
            try {
                await client.sendMessage(msg.from, textoResposta);
            } catch (e) {
                console.error('[Server] Erro ao enviar resposta:', e.message);
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
                nome: config.mapaNomes?.[remetenteChave] || 'Cliente WhatsApp',
                telefone: config.mapaTelefones?.[remetenteChave] || `+${remetenteChave}`,
                motivo,
                idChat: msg.from,
                origem: 'WHATSAPP_SERVER',
                mensagens: msgsIniciais,
                historicoMensagens: [...msgsIniciais],
                historicoAudios: audiosIniciais,
                audioBase64: audioSalvo.audioBase64 || null,
                transcricao: audioSalvo.transcricao || null,
                resumo: audioSalvo.resumo || null,
                sugestoesResposta: audioSalvo.sugestoesResposta || null,
                nivelUrgencia: audioSalvo.nivelUrgencia || 'ROTINA',
                motivoUrgencia: audioSalvo.motivoUrgencia || motivo,
                cronologiaFatos: audioSalvo.cronologiaFatos || [],
                acoes: acoesItem,
                aguardandoAudioRelato: Boolean(acoesItem && acoesItem.aguardarAudioRelato)
            };

            estadosUsuarios[remetenteChave] = 'transbordo_humano';
            await responder(mensagemConfirmacao);
            return true;
        };

        const estadoAtual = estadosUsuarios[remetenteChave] || 'raiz';

        // 1. Verificação de expediente
        const statusExpediente = verificarExpediente(config);
        if (!statusExpediente.aberto && !avisoForaHorarioRecente[remetenteChave]) {
            avisoForaHorarioRecente[remetenteChave] = Date.now();
            await responder(statusExpediente.msg);
        }

        // 2. Se aguardando documento do processo
        if (estadoAtual === 'aguardando_processo') {
            const digitos = apenasNumeros(textoOriginal);
            if (textoOriginal === '0') {
                estadosUsuarios[remetenteChave] = 'raiz';
                await responder(montarTextoEtapa(config.fluxo.raiz));
                return true;
            }

            const proc = buscarProcessoPorNumero(config, digitos);
            if (proc) {
                estadosUsuarios[remetenteChave] = 'pos_consulta_processo';
                const msgProc = await formatarMensagemProcesso(config, proc, remetenteChave);
                await responder(msgProc);
            } else {
                const tpls = config.processos?.mensagens || {};
                await responder(tpls.msg_nao_encontrado || "⚠️ Processo ou CPF não localizado. Digite novamente ou 0 para voltar.");
            }
            return true;
        }

        // 3. Pós consulta do processo
        if (estadoAtual === 'pos_consulta_processo') {
            if (textoOriginal === '1') {
                estadosUsuarios[remetenteChave] = 'raiz';
                const tpls = config.processos?.mensagens || {};
                await responder(tpls.msg_encerrar_conversa || "✅ Atendimento finalizado. Conte sempre conosco!");
                return true;
            } else if (textoOriginal === '2') {
                const tpls = config.processos?.mensagens || {};
                await colocarNaFilaHumana(tpls.msg_chamar_advogado_pos_proc || "👨‍⚖️ Um advogado da nossa equipe já foi avisado e já está chegando.");
                return true;
            }
        }

        // 4. Verificação de palavras-chave para transbordo
        const textoMin = textoOriginal.toLowerCase();
        if (FRASES_TRANSBORDO_DIRETO.some(f => textoMin === f || textoMin.includes(f))) {
            const opHumano = (config.fluxo && config.fluxo.raiz && Array.isArray(config.fluxo.raiz.opcoes))
                ? config.fluxo.raiz.opcoes.find(o => o.tipo === 'humano')
                : null;
            const msgConfirmacao = (opHumano && opHumano.resposta)
                || "👨‍⚖️ Sua solicitação foi recebida! Um advogado da nossa equipe assumirá esta conversa em instantes.";
            await colocarNaFilaHumana(msgConfirmacao, 'Solicitação direta de atendimento humano');
            return true;
        }

        // 5. Navegação no Menu
        const etapaObj = (estadoAtual === 'raiz') ? config.fluxo.raiz : (config.fluxo.etapas?.[estadoAtual] || config.fluxo.raiz);
        const opcaoEscolhida = (etapaObj.opcoes || []).find(op => op.gatilho === textoOriginal.trim());

        if (opcaoEscolhida) {
            const acoes = opcaoEscolhida.acoes || {};
            const deveEncaminharFila = Boolean(
                acoes.encaminharFilaHumana ||
                acoes.pausarRobo ||
                opcaoEscolhida.tipo === 'humano'
            );

            if (deveEncaminharFila) {
                const msgConfirmacao = opcaoEscolhida.resposta || "Perfeito! Sua solicitação foi encaminhada para a nossa equipe.";
                const motivoFila = acoes.motivoFila || opcaoEscolhida.rotulo || 'Novo Atendimento';
                await colocarNaFilaHumana(msgConfirmacao, motivoFila, { acoes });
                return true;
            }

            if (opcaoEscolhida.tipo === 'processo') {
                estadosUsuarios[remetenteChave] = 'aguardando_processo';
                await responder(opcaoEscolhida.resposta || "Por gentileza, digite apenas o seu CPF ou o Número do Processo:");
                return true;
            } else if (opcaoEscolhida.tipo === 'submenu') {
                const destino = opcaoEscolhida.destino;
                if (destino === 'raiz') {
                    estadosUsuarios[remetenteChave] = 'raiz';
                    await responder(montarTextoEtapa(config.fluxo.raiz));
                } else if (config.fluxo.etapas?.[destino]) {
                    estadosUsuarios[remetenteChave] = destino;
                    await responder(montarTextoEtapa(config.fluxo.etapas[destino]));
                }
                return true;
            } else if (opcaoEscolhida.tipo === 'texto') {
                await responder(opcaoEscolhida.resposta || "Compreendido.");
                return true;
            }
        }

        // Fallback: Menu Raiz
        estadosUsuarios[remetenteChave] = 'raiz';
        await responder(montarTextoEtapa(config.fluxo.raiz));
        return true;
    } catch (e) {
        console.error('[Server] Erro no processamento de mensagem:', e);
        return false;
    }
}

function obterCaminhoNavegador() {
    if (process.platform !== 'win32') return undefined;
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

// Inicialização do WhatsApp Client
async function iniciarBotHeadless() {
    console.log('[Headless] Configurando cliente WhatsApp Web com LocalAuth e flags de produção...');
    if (client) {
        try {
            await client.destroy();
        } catch (e) {
            console.warn('[Headless] Aviso ao destruir cliente anterior:', e.message);
        }
        client = null;
    }
    statusConexao = 'DISCONNECTED';

    const puppeteerArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions'
    ];

    const execPath = process.env.PUPPETEER_EXECUTABLE_PATH || obterCaminhoNavegador();

    client = new Client({
        authStrategy: new LocalAuth({
            clientId: 'advocacia-server-session',
            dataPath: SESSION_PATH
        }),
        webVersionCache: {
            type: 'none'
        },
        puppeteer: {
            headless: true,
            executablePath: execPath,
            args: puppeteerArgs
        }
    });

    client.on('qr', async (qr) => {
        qrCodeAtual = qr;
        statusConexao = 'QR_READY';
        console.log('⚡ Novo QR Code gerado.');
        try {
            ultimoQrDataUrl = await qrcode.toDataURL(qr);
            const qrAscii = await qrcode.toString(qr, { type: 'terminal', small: true });
            console.log(qrAscii);
        } catch (e) {
            console.log(`[QR String] ${qr}`);
        }
        console.log(`\nOu acesse: http://localhost:${PORT}/qr (ou /qr-status)\n`);
    });

    client.on('ready', () => {
        qrCodeAtual = null;
        statusConexao = 'CONNECTED';
        momentoConexao = Math.floor(Date.now() / 1000);
        console.log('✅ WhatsApp conectado e pronto para operação 24/7.');
        console.log(`   Sessão salva em: ${SESSION_PATH}`);
        console.log(`   Endpoint de status: http://localhost:${PORT}/status\n`);
    });

    client.on('disconnected', (reason) => {
        qrCodeAtual = null;
        statusConexao = 'DISCONNECTED';
        console.warn(`⚠️ [Headless] WhatsApp desconectado: ${reason}. Tentando reconectar em 10s...`);
        setTimeout(() => iniciarBotHeadless(), 10000);
    });

    client.on('message', async (msg) => {
        try {
            await processarMensagemEntrada(msg);
        } catch (err) {
            console.error('[Headless] Erro ao processar mensagem de entrada:', err);
        }
    });

    try {
        await client.initialize();
    } catch (err) {
        console.error('[Headless] Falha ao inicializar WhatsApp:', err.message);
        setTimeout(() => iniciarBotHeadless(), 15000);
    }
}

// Servidor HTTP embutido para monitoramento, sincronização e health check
const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

        // Helper res.json compatível com Express e CORS completo
        res.json = (data, statusCode = 200) => {
            res.writeHead(statusCode, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, X-API-Key'
            });
            res.end(JSON.stringify(data, null, 2));
        };

        if (req.method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, X-API-Key'
            });
            res.end();
            return;
        }

        // 1. Endpoint /health (100% público para Health Check de Containers, Docker e Render Ping)
        if (url.pathname === '/health') {
            return res.json({
                status: 'online',
                porta: PORT,
                uptime: process.uptime(),
                uptimeSegundos: Math.floor(process.uptime()),
                timestamp: new Date().toISOString(),
                botStatus: statusConexao
            });
        }

        // 2. Endpoint /status (Protegido por token)
        if (url.pathname === '/status') {
            if (!verificarAutenticacao(req, url)) {
                return res.json({ erro: 'Não autorizado' }, 401);
            }
            const cfg = carregarConfig();
            const listaProcessos = (cfg && cfg.processos && Array.isArray(cfg.processos.lista)) ? cfg.processos.lista : [];
            return res.json({
                status: statusConexao,
                uptime: process.uptime(),
                uptimeSegundos: Math.floor(process.uptime()),
                timestamp: new Date().toISOString(),
                botStatus: statusConexao,
                momentoConexao,
                totalProcessosCadastrados: listaProcessos.length,
                totalMensagensProcessadas,
                contatosPausadosQtd: Object.keys(contatosPausados).length,
                contatosPausados
            });
        }

        // 3. Endpoint /qr-status (Protegido por token)
        if (url.pathname === '/qr-status') {
            if (!verificarAutenticacao(req, url)) {
                return res.json({ erro: 'Não autorizado' }, 401);
            }
            return res.json({
                status: statusConexao,
                qr: qrCodeAtual,
                qrDataUrl: ultimoQrDataUrl
            });
        }

        // 4. Endpoint /pausados (Protegido por token para sincronização com Desktop)
        if (url.pathname === '/pausados') {
            if (!verificarAutenticacao(req, url)) {
                return res.json({ erro: 'Não autorizado' }, 401);
            }
            return res.json({
                sucesso: true,
                total: Object.keys(contatosPausados).length,
                contatosPausados
            });
        }

        // 5. Endpoint /export-config (Exporta configuração persistida e contatos em atendimento)
        if (url.pathname === '/export-config') {
            if (!verificarAutenticacao(req, url)) {
                return res.json({ erro: 'Não autorizado' }, 401);
            }
            return res.json({
                sucesso: true,
                config: carregarConfig(),
                contatosPausados
            });
        }

        // 6. Endpoint /import-config (Recebe payload JSON, sincroniza estado e grava atomicamente)
        if (url.pathname === '/import-config') {
            if (!verificarAutenticacao(req, url)) {
                return res.json({ erro: 'Não autorizado' }, 401);
            }
            if (req.method !== 'POST') {
                return res.json({ erro: 'Método não permitido. Utilize POST.' }, 405);
            }
            try {
                const corpo = await lerCorpoJson(req);
                if (!corpo || typeof corpo !== 'object') {
                    return res.json({ erro: 'JSON inválido ou corpo vazio' }, 400);
                }

                // Mescla configurações enviadas
                if (corpo.config && typeof corpo.config === 'object') {
                    const configAtual = carregarConfig();
                    configEmMemoria = {
                        ...configAtual,
                        ...corpo.config
                    };
                    salvarConfigDisco(configEmMemoria);
                }

                // Mescla contatos pausados enviados
                if (corpo.contatosPausados && typeof corpo.contatosPausados === 'object') {
                    for (const [chave, item] of Object.entries(corpo.contatosPausados)) {
                        if (item && typeof item === 'object') {
                            contatosPausados[chave] = {
                                ...(contatosPausados[chave] || {}),
                                ...item
                            };
                        }
                    }
                }

                return res.json({
                    sucesso: true,
                    mensagem: 'Configuração e fila sincronizadas com sucesso'
                });
            } catch (errCorpo) {
                return res.json({ erro: 'Erro ao processar corpo JSON: ' + errCorpo.message }, 400);
            }
        }

        // 7. Endpoint /qr (Interface visual para escanear QR Code, protegida por token)
        if (url.pathname === '/qr') {
            if (!verificarAutenticacao(req, url)) {
                return res.json({ erro: 'Não autorizado' }, 401);
            }
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            if (statusConexao === 'CONNECTED') {
                res.end(`
                    <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0d1117;color:#fff;">
                        <h1 style="color:#2ea043;">✅ WhatsApp Conectado e Operante!</h1>
                        <p>O robô já está atendendo normalmente 24/7.</p>
                        <a href="/status" style="color:#58a6ff;">Ver Status da API</a>
                    </body></html>
                `);
            } else if (ultimoQrDataUrl) {
                res.end(`
                    <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0d1117;color:#fff;">
                        <h1 style="color:#e5c158;">📱 Escaneie o QR Code do WhatsApp</h1>
                        <p>Abra seu WhatsApp > Dispositivos conectados > Conectar dispositivo</p>
                        <img src="${ultimoQrDataUrl}" style="border:8px solid #fff;border-radius:12px;margin:20px auto;display:block;" />
                        <script>setTimeout(() => location.reload(), 15000);</script>
                    </body></html>
                `);
            } else {
                res.end(`
                    <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0d1117;color:#fff;">
                        <h1>Aguardando geração do QR Code...</h1>
                        <p>Status atual: <strong>${statusConexao}</strong></p>
                        <p>Recarregando em 3 segundos...</p>
                        <script>setTimeout(() => location.reload(), 3000);</script>
                    </body></html>
                `);
            }
            return;
        }

        // Dashboard minimalista raiz
        if (url.pathname === '/' || url.pathname === '') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Advocacia Studio Pro v2.0 - Headless Server</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 40px; margin: 0; }
                        .card { background: #151d2d; border: 1px solid #1e293b; border-radius: 16px; padding: 24px; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
                        h1 { color: #d4af37; font-size: 20px; margin-top: 0; }
                        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 12px; }
                        .status-ready { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid rgba(34,197,94,0.4); }
                        .status-wait { background: rgba(234,179,8,0.2); color: #facc15; border: 1px solid rgba(234,179,8,0.4); }
                        .btn { display: inline-block; background: linear-gradient(135deg, #d4af37, #aa820a); color: #000; font-weight: bold; text-decoration: none; padding: 10px 20px; border-radius: 10px; margin-top: 15px; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Advocacia Studio Pro v2.0 • Headless Cloud</h1>
                        <p>Status: <span class="status-badge ${statusConexao === 'CONNECTED' ? 'status-ready' : 'status-wait'}">${statusConexao}</span></p>
                        <p>Uptime: ${Math.floor(process.uptime())} segundos</p>
                        <p>Mensagens atendidas: ${totalMensagensProcessadas}</p>
                        <p>Contatos em fila humana: ${Object.keys(contatosPausados).length}</p>
                        <a class="btn" href="/qr">Ver QR Code</a>
                        <a class="btn" style="background:#1e293b;color:#94a3b8;margin-left:10px;" href="/status">API /status</a>
                        <a class="btn" style="background:#1e293b;color:#94a3b8;margin-left:10px;" href="/qr-status">API /qr-status</a>
                    </div>
                </body>
                </html>
            `);
            return;
        }

        return res.json({ erro: 'Rota não encontrada' }, 404);
    } catch (errGlobal) {
        console.error('[Server HTTP] Erro não tratado na requisição:', errGlobal);
        try {
            if (typeof res.json === 'function') {
                res.json({ erro: 'Erro interno no servidor' }, 500);
            } else {
                res.writeHead(500, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ erro: 'Erro interno no servidor' }));
            }
        } catch (e) {}
    }
});

// Sistema Keep-Alive Anti-Sleep para Render Free Tier (evita suspensão após 15 min de inatividade)
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || 'https://advocacia-2-0.onrender.com';
function iniciarKeepAliveAntiSleep() {
    console.log(`[Keep-Alive Anti-Sleep] Ativado para o endpoint público: ${RENDER_EXTERNAL_URL}/health`);
    // Ping a cada 10 minutos (Render dorme com 15 min de inatividade)
    setInterval(() => {
        try {
            const https = require('https');
            const urlAlvo = `${RENDER_EXTERNAL_URL}/health`;
            https.get(urlAlvo, (res) => {
                console.log(`[Keep-Alive Anti-Sleep] Ping preventivo realizado com sucesso (${res.statusCode}) às ${new Date().toLocaleTimeString('pt-BR')}`);
            }).on('error', (err) => {
                console.warn(`[Keep-Alive Anti-Sleep] Aviso no ping: ${err.message}`);
            });
        } catch (e) {
            console.warn('[Keep-Alive Anti-Sleep] Erro na execução do ping:', e.message);
        }
    }, 10 * 60 * 1000);
}

// Inicialização autônoma se executado diretamente
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`\n🚀 [Server Headless] Servidor HTTP operando na porta ${PORT}`);
        console.log(`   Painel: http://localhost:${PORT}`);
        console.log(`   Status API: http://localhost:${PORT}/status`);
        console.log(`   QR Status API: http://localhost:${PORT}/qr-status\n`);
        iniciarBotHeadless();
        iniciarKeepAliveAntiSleep();
    });
}

module.exports = {
    server,
    verificarAutenticacao,
    salvarConfigDisco,
    carregarConfig,
    lerCorpoJson,
    iniciarBotHeadless,
    contatosPausados,
    buscarProcessoPorNumero,
    isContactIgnored
};
