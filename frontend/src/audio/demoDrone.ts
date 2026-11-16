/**
 * Sonido de PRUEBA sintético.
 *
 * Existe únicamente para que el logo 3D pueda reaccionar a audio real mientras
 * se desarrolla la interfaz. NO es sonificación de datos NASA: la UI lo
 * etiqueta como "sonido de prueba". La sonificación real llegará en la Fase 3.
 *
 * Cadena: [bajo sine + pad saw + quinta triangle] → lowpass (LFO) → master → analyser → salida
 *                          + "pings" pentatónicos aleatorios (aportan agudos)
 */
const PENTATONIC_HZ = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1318.5];

export class DemoDrone {
  private ctx: AudioContext | null = null;
  private nodes: AudioNode[] = [];
  private sources: OscillatorNode[] = [];
  private timer: number | null = null;
  analyser: AnalyserNode | null = null;

  get running(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  /** Debe llamarse desde un gesto del usuario (política de autoplay). */
  async start(): Promise<void> {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    master.gain.setTargetAtTime(0.18, ctx.currentTime, 0.4);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 5;
    filter.frequency.value = 900;

    // LFO lento sobre la frecuencia de corte.
    const lfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.13;
    lfoDepth.gain.value = 650;
    lfo.connect(lfoDepth).connect(filter.frequency);

    const mk = (type: OscillatorType, hz: number, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = hz;
      g.gain.value = gain;
      osc.connect(g).connect(filter);
      this.sources.push(osc);
      return osc;
    };
    const bass = mk("sine", 55, 0.9);
    const pad = mk("sawtooth", 110, 0.18);
    const fifth = mk("triangle", 164.81, 0.25);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    this.analyser = analyser;

    filter.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    this.nodes.push(master, filter, lfoDepth, analyser);
    for (const o of [lfo, bass, pad, fifth]) o.start();
    this.sources.push(lfo);

    // "Pings" ocasionales: sine con envolvente corta, directo al master.
    this.timer = window.setInterval(() => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = PENTATONIC_HZ[Math.floor(Math.random() * PENTATONIC_HZ.length)];
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.35, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
      osc.connect(g).connect(master);
      osc.start(now);
      osc.stop(now + 1.2);
    }, 650);
  }

  async stop(): Promise<void> {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* ya detenido */
      }
    }
    this.sources = [];
    this.nodes.forEach((n) => n.disconnect());
    this.nodes = [];
    this.analyser = null;
    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}
