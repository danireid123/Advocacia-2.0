/**
 * =========================================================================
 * ADVOCACIA STUDIO PRO v2.0 - SERVIDOR HEADLESS (SAAS / NUVEM 24/7)
 * =========================================================================
 * 
 * Permite a execução autônoma do bot no Linux/Docker/VPS sem interface gráfica (Electron).
 * Suporte a:
 * - Docker / Docker Compose / Kubernetes / PM2
 * - Servidor HTTP embutido com /health, /status, /qr para monitoramento remoto
 * - Geração de QR Code no terminal e endpoint web
 * - Tradução jurídica Gemini 1.5 Flash integrada
 * - Transbordo humano e salvamento automático do config.json
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { traduzirAndamentoParaCliente } = require('./src/ia/tradutorJuridico');

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

// Proteção anti-crash
process.on('uncaughtException', (err) => {
    console.error('[Proteção Anti-Crash Headless] uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('[Proteção Anti-Crash Headless] unhandledRejection:', reason);
});

// Estado do servidor
let configEmMemoria = null;
let contatosPausados = {};
let estadosUsuarios = {};
let avisoForaHorarioRecente = {};
let mensagensJaProcessadas = new Set();
let statusAtualBot = 'initializing';
let ultimoQrCodeAscii = '';
let ultimoQrDataUrl = '';
let momentoConexao = 0;
let totalMensagensProcessadas = 0;
let client = null;

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
    const { criarConfigPadraoV2 } = require('./migracao');
    configEmMemoria = criarConfigPadraoV2();
    return configEmMemoria;
}

function salvarConfigDisco(cfg) {
    if (!cfg) return;
    configEmMemoria = cfg;
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch (e) {
        console.error('[Server] Erro ao gravar config.json no disco:', e);
    }
}

function isContactIgnored(numeroOuId) {
    const cfg = carregarConfig();
    const lista = cfg.contatosIgnorados || [];
    const digitos = apenasNumeros(numeroOuId);
    if (!digitos) return false;
    return lista.some(item => {
        const itemDig = apenasNumeros(typeof item === 'object' && item !== null ? item.numero : item);
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

async function processarMensagemEntrada(msg) {
    try {
        if (!msg || msg.fromMe || msg.isStatus || msg.broadcast) return false;
        if (!msg.from || msg.from.includes('@g.us') || msg.from.includes('@newsletter') || msg.from.includes('@broadcast')) return false;

        const senderId = msg.from || '';
        if (isContactIgnored(senderId)) return false;

        const msgId = msg.id?._serialized || `${msg.from}_${msg.timestamp}_${msg.body}`;
        if (mensagensJaProcessadas.has(msgId)) return false;
        mensagensJaProcessadas.add(msgId);

        const textoOriginal = String(msg.body || '').trim();
        if (!textoOriginal) return false;

        totalMensagensProcessadas++;
        const config = carregarConfig();
        const remetenteChave = apenasNumeros(senderId);

        if (isContactIgnored(remetenteChave)) return false;

        if (contatosPausados[remetenteChave]) {
            console.log(`[Headless] Mensagem recebida de contato em transbordo humano: ${remetenteChave}`);
            return false;
        }

        const responder = async (textoResposta) => {
            if (!textoResposta) return;
            try {
                await client.sendMessage(msg.from, textoResposta);
            } catch (e) {
                console.error('[Headless] Erro ao enviar resposta:', e.message);
            }
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
                estadosUsuarios[remetenteChave] = 'transbordo_humano';
                contatosPausados[remetenteChave] = {
                    telefone: remetenteChave,
                    nome: 'Cliente WhatsApp',
                    pausadoEm: new Date().toISOString()
                };
                const tpls = config.processos?.mensagens || {};
                await responder(tpls.msg_chamar_advogado_pos_proc || "👨‍⚖️ Um advogado da nossa equipe já foi avisado e já está chegando.");
                return true;
            }
        }

        // 4. Verificação de palavras-chave para transbordo
        const textoMin = textoOriginal.toLowerCase();
        if (textoMin.includes('advogado') || textoMin.includes('humano') || textoMin.includes('atendente')) {
            estadosUsuarios[remetenteChave] = 'transbordo_humano';
            contatosPausados[remetenteChave] = {
                telefone: remetenteChave,
                nome: 'Cliente WhatsApp',
                pausadoEm: new Date().toISOString()
            };
            await responder("👨‍⚖️ Sua solicitação foi recebida! Um advogado da nossa equipe assumirá esta conversa em instantes.");
            return true;
        }

        // 5. Navegação no Menu
        const etapaObj = (estadoAtual === 'raiz') ? config.fluxo.raiz : (config.fluxo.etapas?.[estadoAtual] || config.fluxo.raiz);
        const opcaoEscolhida = (etapaObj.opcoes || []).find(op => op.gatilho === textoOriginal.trim());

        if (opcaoEscolhida) {
            if (opcaoEscolhida.tipo === 'processo') {
                estadosUsuarios[remetenteChave] = 'aguardando_processo';
                await responder(opcaoEscolhida.resposta || "Por gentileza, digite apenas o seu CPF ou o Número do Processo:");
                return true;
            } else if (opcaoEscolhida.tipo === 'humano') {
                estadosUsuarios[remetenteChave] = 'transbordo_humano';
                contatosPausados[remetenteChave] = {
                    telefone: remetenteChave,
                    nome: 'Cliente WhatsApp',
                    pausadoEm: new Date().toISOString()
                };
                await responder(opcaoEscolhida.resposta || "Perfeito! Um advogado já foi chamado.");
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
        console.error('[Headless] Erro no processamento de mensagem:', e);
        return false;
    }
}

// Inicialização do WhatsApp Client
async function iniciarBotHeadless() {
    console.log('[Headless] Configurando cliente WhatsApp Web em modo autônomo...');
    statusAtualBot = 'initializing';

    client = new Client({
        authStrategy: new LocalAuth({
            dataPath: SESSION_PATH
        }),
        puppeteer: {
            headless: 'new',
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    client.on('qr', async (qr) => {
        statusAtualBot = 'qr_ready';
        ultimoQrDataUrl = await qrcode.toDataURL(qr);
        console.log('\n=============================================================');
        console.log('📌 QR CODE GERADO COM SUCESSO! ESCANEIE COM SEU WHATSAPP:');
        console.log('=============================================================\n');
        try {
            ultimoQrCodeAscii = await qrcode.toString(qr, { type: 'terminal', small: true });
            console.log(ultimoQrCodeAscii);
        } catch (e) {
            console.log(`[QR String] ${qr}`);
        }
        console.log(`\nOu acesse: http://localhost:${PORT}/qr para escanear via navegador.\n`);
    });

    client.on('ready', () => {
        statusAtualBot = 'ready';
        momentoConexao = Math.floor(Date.now() / 1000);
        console.log('\n✅ [Headless] WhatsApp Conectado e Operante com Sucesso!');
        console.log(`   Sessão salva em: ${SESSION_PATH}`);
        console.log(`   Endpoint de métricas: http://localhost:${PORT}/health\n`);
    });

    client.on('disconnected', (reason) => {
        statusAtualBot = 'disconnected';
        console.warn(`[Headless] WhatsApp desconectado: ${reason}. Tentando reconectar em 10s...`);
        setTimeout(() => iniciarBotHeadless(), 10000);
    });

    client.on('message', async (msg) => {
        await processarMensagemEntrada(msg);
    });

    try {
        await client.initialize();
    } catch (err) {
        console.error('[Headless] Falha ao inicializar WhatsApp:', err.message);
        setTimeout(() => iniciarBotHeadless(), 15000);
    }
}

// Servidor HTTP embutido para monitoramento e health check
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/health' || url.pathname === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const cfg = carregarConfig();
        const listaProcessos = cfg.processos?.lista || [];
        res.end(JSON.stringify({
            status: 'ok',
            botStatus: statusAtualBot,
            uptimeSegundos: Math.floor(process.uptime()),
            momentoConexao,
            totalProcessosCadastrados: listaProcessos.length,
            totalMensagensProcessadas,
            contatosPausadosQtd: Object.keys(contatosPausados).length,
            contatosPausados
        }, null, 2));
        return;
    }

    if (url.pathname === '/qr') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        if (statusAtualBot === 'ready') {
            res.end(`
                <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#0d1117;color:#fff;">
                    <h1 style="color:#2ea043;">✅ WhatsApp Conectado e Operante!</h1>
                    <p>O robô já está atendendo normalmente.</p>
                    <a href="/health" style="color:#58a6ff;">Ver Métricas</a>
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
                    <p>Recarregando em 3 segundos...</p>
                    <script>setTimeout(() => location.reload(), 3000);</script>
                </body></html>
            `);
        }
        return;
    }

    // Dashboard minimalista
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
                <h1>Advocacia Studio Pro v2.0</h1>
                <p>Status: <span class="status-badge ${statusAtualBot === 'ready' ? 'status-ready' : 'status-wait'}">${statusAtualBot.toUpperCase()}</span></p>
                <p>Uptime: ${Math.floor(process.uptime())} segundos</p>
                <p>Mensagens atendidas: ${totalMensagensProcessadas}</p>
                <p>Contatos em transbordo: ${Object.keys(contatosPausados).length}</p>
                <a class="btn" href="/qr">Ver QR Code</a>
                <a class="btn" style="background:#1e293b;color:#94a3b8;margin-left:10px;" href="/health">API /health</a>
            </div>
        </body>
        </html>
    `);
});

// Inicialização
server.listen(PORT, () => {
    console.log(`\n🚀 [Server Headless] Servidor HTTP operando na porta ${PORT}`);
    console.log(`   Painel: http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
    iniciarBotHeadless();
});
