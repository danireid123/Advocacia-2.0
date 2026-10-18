/**
 * Sintetizador Harmônico de Alerta Sonoro de Transbordo Humano
 * Opera 100% via Web Audio API do navegador / Electron Renderer.
 * Zero dependência de arquivos .wav ou codecs externos.
 */
class SoundAlert {
  constructor() {
    this.audioCtx = null;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContextClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        const p = this.audioCtx.resume();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (e) {}
    }
  }

  /**
   * Dispara o sino de transbordo (Acorde Mi5 -> Lá5: 659.25Hz -> 880Hz)
   */
  playTransbordoChime() {
    try {
      this.init();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      const notes = [
        { freq: 659.25, start: now },
        { freq: 880.00, start: now + 0.12 }
      ];

      notes.forEach(({ freq, start }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        // Curva suave de decaimento natural de sino acústico
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.28, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 1.25);
      });
    } catch (e) {
      console.warn('Alerta sonoro Web Audio API não pôde ser executado:', e);
    }
  }

  /**
   * Dispara alerta sonoro diferenciado para URGÊNCIA MÁXIMA (Furador de Fila)
   * Sequência rápida tríade Lá5 -> Dó6 -> Mi6 com modulação marcante.
   */
  playUrgencyAlert() {
    try {
      this.init();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      const notes = [
        { freq: 880.00, start: now },
        { freq: 1046.50, start: now + 0.09 },
        { freq: 1318.51, start: now + 0.18 },
        { freq: 1318.51, start: now + 0.32 }
      ];

      notes.forEach(({ freq, start }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(start);
        osc.stop(start + 0.75);
      });
    } catch (e) {
      console.warn('Alerta sonoro de urgência não pôde ser executado:', e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.SoundAlert = SoundAlert;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SoundAlert };
}
