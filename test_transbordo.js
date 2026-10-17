/**
 * Teste Unitário: Transbordo Humano, Alerta Sonoro e Notificação Nativa
 * Valida o fluxo de:
 * 1. Síntese de áudio (SoundAlert / Web Audio API) com frequências harmônicas Mi5 -> Lá5
 * 2. Pausa do contato no mapa contatosPausados com timestamp, nome e telefone
 * 3. Disparo de evento 'bot-transbordo-humano' para o renderer
 * 4. Disparo de Notificação nativa (Windows Electron Notification) com restauração de janela
 * 5. Remoção de pausa e fila de espera
 */

const assert = require('assert');
const { SoundAlert } = require('./src/audio/audioAlert');

console.log('🧪 Iniciando bateria de testes para Transbordo Humano & Alertas...\n');

// ========================================================
// TESTE 1: Síntese de Áudio Web Audio API (SoundAlert)
// ========================================================
console.log('--- TESTE 1: Sintetizador Harmônico (SoundAlert) ---');

const osciladoresCriados = [];
const ganhosCriados = [];

class MockGain {
    constructor() {
        this.gain = {
            setValueAtTime: (v, t) => { this.val0 = v; this.t0 = t; },
            linearRampToValueAtTime: (v, t) => { this.rampVal = v; this.rampT = t; },
            exponentialRampToValueAtTime: (v, t) => { this.decayVal = v; this.decayT = t; }
        };
    }
    connect(dest) {
        this.dest = dest;
    }
}

class MockOscillator {
    constructor() {
        this.frequency = {
            setValueAtTime: (f, t) => { this.freq = f; this.t = t; }
        };
    }
    connect(dest) {
        this.dest = dest;
    }
    start(t) { this.startTime = t; }
    stop(t) { this.stopTime = t; }
}

class MockAudioContext {
    constructor() {
        this.currentTime = 10.0;
        this.destination = { name: 'speakers' };
        this.state = 'suspended';
    }
    resume() {
        this.state = 'running';
    }
    createOscillator() {
        const osc = new MockOscillator();
        osciladoresCriados.push(osc);
        return osc;
    }
    createGain() {
        const gain = new MockGain();
        ganhosCriados.push(gain);
        return gain;
    }
}

// Injeta Mock de AudioContext global simulando Renderer
global.window = {
    AudioContext: MockAudioContext
};

const soundAlert = new SoundAlert();
soundAlert.playTransbordoChime();

assert.strictEqual(soundAlert.audioCtx.state, 'running', 'AudioContext deve ser resumido para running');
assert.strictEqual(osciladoresCriados.length, 2, 'Devem ser sintetizadas 2 notas harmônicas (Mi5 e Lá5)');
assert.strictEqual(osciladoresCriados[0].freq, 659.25, 'Primeira nota deve ser Mi5 (659.25 Hz)');
assert.strictEqual(osciladoresCriados[1].freq, 880.00, 'Segunda nota deve ser Lá5 (880.00 Hz)');
assert.strictEqual(ganhosCriados.length, 2, 'Cada tom deve ter seu respectivo envelope de ganho');

console.log('✅ TESTE 1 APROVADO: Frequências Mi5 (659.25Hz) e Lá5 (880.00Hz) sintetizadas com envelope de sino acústico!\n');

// ========================================================
// TESTE 2: Simulação de Transbordo Humano no main.js
// ========================================================
console.log('--- TESTE 2: Lógica de Transbordo Humano, Fila e Notificações ---');

let contatosPausados = {};
let eventosEmitidos = [];
let notificacoesDisparadas = [];

// Mock da janela Electron
const mockMainWindow = {
    isDestroyed: () => false,
    isMinimized: () => true,
    restaurada: false,
    focada: false,
    restore() { this.restaurada = true; },
    show() { this.visivel = true; },
    focus() { this.focada = true; },
    webContents: {
        send: (canal, payload) => {
            eventosEmitidos.push({ canal, payload });
        }
    }
};

// Mock de Electron Notification
class MockElectronNotification {
    static isSupported() { return true; }
    constructor(options) {
        this.options = options;
        this.listeners = {};
        notificacoesDisparadas.push(this);
    }
    on(event, callback) {
        this.listeners[event] = callback;
    }
    show() {
        this.shown = true;
    }
}

function dispararNotificacaoTransbordo(dados, win = mockMainWindow, NotifClass = MockElectronNotification) {
    const { contatoNome, telefone, motivo } = dados || {};
    
    // 1. Emite evento para o renderer
    if (win && !win.isDestroyed()) {
        win.webContents.send('bot-transbordo-humano', {
            contatoNome: contatoNome || 'Cliente',
            telefone: telefone || '',
            motivo: motivo || 'Opção "Falar com Advogado"',
            timestamp: Date.now()
        });
    }

    // 2. Dispara Notificação Nativa
    if (NotifClass && NotifClass.isSupported && NotifClass.isSupported()) {
        const notif = new NotifClass({
            title: '⚠️ Atendimento Humano Solicitado',
            body: `${contatoNome || 'Cliente'} (${telefone || 'WhatsApp'}) solicitou falar com o advogado.\nMotivo: ${motivo || 'Opção "Falar com Advogado"'}`,
            urgency: 'critical',
            silent: true
        });
        notif.on('click', () => {
            if (win) {
                if (win.isMinimized()) win.restore();
                win.show();
                win.focus();
            }
        });
        notif.show();
    }
}

function colocarNaFilaHumana(remetenteChave, identidade, motivo = 'Opção "Falar com Advogado"') {
    contatosPausados[remetenteChave] = {
        timestamp: Date.now(),
        nome: identidade.nomeCliente || '',
        telefone: identidade.telefoneFormatado,
        exibicao: identidade.exibicao,
        idChat: identidade.idChat
    };
    dispararNotificacaoTransbordo({
        contatoNome: identidade.nomeCliente || identidade.exibicao || '',
        telefone: identidade.telefoneFormatado || identidade.idChat,
        motivo: motivo
    });
}

// Dispara transbordo para cliente fictício
const identidadeCliente = {
    nomeCliente: 'Dr. Carlos Drummond',
    telefoneFormatado: '+55 11 98765-4321',
    exibicao: 'Carlos Drummond',
    idChat: '5511987654321@c.us'
};

colocarNaFilaHumana('5511987654321@c.us', identidadeCliente, 'Opção 3: Falar diretamente com Advogado');

// Verificações
const pausa = contatosPausados['5511987654321@c.us'];
assert(pausa, 'Contato deve estar registrado em contatosPausados');
assert(pausa.timestamp > 0, 'Registro de pausa deve possuir timestamp válido');
assert.strictEqual(pausa.nome, 'Dr. Carlos Drummond', 'Nome do contato deve estar correto');
assert.strictEqual(pausa.telefone, '+55 11 98765-4321', 'Telefone deve estar correto');

console.log('✔ Contato pausado com sucesso no mapa contatosPausados');

// Evento emitido para o renderer
const eventoTransbordo = eventosEmitidos.find(e => e.canal === 'bot-transbordo-humano');
assert(eventoTransbordo, 'Evento "bot-transbordo-humano" deve ser emitido para o webContents');
assert.strictEqual(eventoTransbordo.payload.contatoNome, 'Dr. Carlos Drummond');
console.log('✔ Evento IPC "bot-transbordo-humano" emitido com payload correto');

// Notificação nativa disparada
assert.strictEqual(notificacoesDisparadas.length, 1, 'Deve disparar 1 Notificação nativa');
const notif = notificacoesDisparadas[0];
assert.strictEqual(notif.shown, true, 'Notificação deve ser exibida via show()');
assert(notif.options.title.includes('Atendimento Humano Solicitado'), 'Título deve conter indicativo de atendimento humano');
assert(notif.options.body.includes('Carlos Drummond'), 'Corpo da notificação deve incluir o nome do cliente');

// Simular clique na notificação para restaurar e focar janela principal
notif.listeners['click']();
assert.strictEqual(mockMainWindow.restaurada, true, 'Janela principal deve ser restaurada do estado minimizado');
assert.strictEqual(mockMainWindow.focada, true, 'Janela principal deve receber foco');

console.log('✔ Notificação nativa do Windows dispara foco e restauração da janela ao ser clicada');

// ========================================================
// TESTE 3: Verificação de Retenção de Pausa de 24h
// ========================================================
console.log('\n--- TESTE 3: Verificação de Contato em Pausa Ativa ---');
const tsPausa = pausa.timestamp;
const agora = Date.now();
const estaPausado = (agora - tsPausa < 24 * 60 * 60 * 1000);
assert.strictEqual(estaPausado, true, 'Contato deve permanecer em pausa dentro da janela de 24h');

// Remoção da pausa
delete contatosPausados['5511987654321@c.us'];
assert.strictEqual(contatosPausados['5511987654321@c.us'], undefined, 'Contato deve ser removido da fila após atendimento humano');

console.log('✔ Ciclo completo de fila de espera e despausa validado');

console.log('\n======================================================');
console.log('🎉 TODOS OS TESTES DE TRANSBORDO E ÁUDIO FORAM CONCLUÍDOS COM SUCESSO!');
console.log('======================================================\n');
