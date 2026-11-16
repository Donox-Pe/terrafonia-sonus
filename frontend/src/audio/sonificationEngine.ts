import type { SonificationTargets } from "./mapping";

export type VoiceKey = keyof SonificationTargets["activeVoices"];
export type VoiceSolo = VoiceKey | "all";

/**
 * Motor Web Audio API de TerraFonía.
 *
 * Características técnicas obligatorias:
 *  - Un solo AudioContext creado tras gesto del usuario.
 *  - Todas las actualizaciones usan setTargetAtTime() para evitar clics digitales.
 *  - AnalyserNode compartido para UI (espectro + forma de onda) y Logo 3D SONUS.
 *  - Arquitectura modular: drone climático + armónicos bióticos (NDVI) + cabezal scanner
 *    + ruido textural (bordes Sobel) + crackle granular (fuego) + reverb convolver (nubes).
 */

function createSyntheticImpulseResponse(ctx: AudioContext, durationSec = 2.1, decay = 2.6): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * durationSec);
  const buffer = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, decay);
      data[i] = (Math.random() * 2 - 1) * env;
    }
  }
  return buffer;
}

function createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const out = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    // Ruido rosado/marrón suave para aire y bordes sin estridencia.
    last = (last + 0.04 * white) / 1.04;
    out[i] = last * 3.2;
  }
  return buffer;
}

export class SonificationEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private mainFilter: BiquadFilterNode | null = null;
  private panner: StereoPannerNode | null = null;

  private bassOsc: OscillatorNode | null = null;
  private bassGain: GainNode | null = null;

  private padOsc: OscillatorNode | null = null;
  private padGain: GainNode | null = null;

  private harmonicOscA: OscillatorNode | null = null;
  private harmonicOscB: OscillatorNode | null = null;
  private harmonicGain: GainNode | null = null;

  private scannerOsc: OscillatorNode | null = null;
  private scannerGain: GainNode | null = null;

  private lfoOsc: OscillatorNode | null = null;
  private lfoDepth: GainNode | null = null;

  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseFilter: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;

  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private convolver: ConvolverNode | null = null;

  private fireTimer: number | null = null;
  private fireProb = 0;
  private soloVoice: VoiceSolo = "all";
  private masterVolume = 0.65;

  analyser: AnalyserNode | null = null;

  setSoloVoice(voice: VoiceSolo): void {
    this.soloVoice = voice;
  }

  get running(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  async start(): Promise<void> {
    if (this.ctx) {
      await this.ctx.resume();
      return;
    }

    const ctx = new AudioContext();
    this.ctx = ctx;
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.setTargetAtTime(0.32 * this.masterVolume, now, 0.18);

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;

    const panner = ctx.createStereoPanner();

    const mainFilter = ctx.createBiquadFilter();
    mainFilter.type = "lowpass";
    mainFilter.frequency.setValueAtTime(1400, now);
    mainFilter.Q.setValueAtTime(2.2, now);

    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(0.82, now);

    const wetGain = ctx.createGain();
    wetGain.gain.setValueAtTime(0.2, now);

    const convolver = ctx.createConvolver();
    convolver.buffer = createSyntheticImpulseResponse(ctx);

    // LFO -> cutoff del filtro principal
    const lfoOsc = ctx.createOscillator();
    lfoOsc.type = "sine";
    lfoOsc.frequency.setValueAtTime(0.4, now);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.setValueAtTime(220, now);
    lfoOsc.connect(lfoDepth).connect(mainFilter.frequency);

    // Voz 1: Sub-bajo climático
    const bassOsc = ctx.createOscillator();
    bassOsc.type = "sine";
    bassOsc.frequency.setValueAtTime(110, now);
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.42, now);
    bassOsc.connect(bassGain).connect(mainFilter);

    // Voz 2: Pad atmosférico
    const padOsc = ctx.createOscillator();
    padOsc.type = "triangle";
    padOsc.frequency.setValueAtTime(220, now);
    const padGain = ctx.createGain();
    padGain.gain.setValueAtTime(0.24, now);
    padOsc.connect(padGain).connect(mainFilter);

    // Voz 3: Parciales bióticos (NDVI)
    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.0, now);
    const harmonicOscA = ctx.createOscillator();
    harmonicOscA.type = "sawtooth";
    harmonicOscA.frequency.setValueAtTime(330, now);
    const harmonicOscB = ctx.createOscillator();
    harmonicOscB.type = "sine";
    harmonicOscB.frequency.setValueAtTime(440, now);
    harmonicOscA.connect(harmonicGain);
    harmonicOscB.connect(harmonicGain);
    harmonicGain.connect(mainFilter);

    // Voz 4: Cabezal de escaneo vertical (playhead melódico sutil)
    const scannerOsc = ctx.createOscillator();
    scannerOsc.type = "sine";
    scannerOsc.frequency.setValueAtTime(523.25, now);
    const scannerGain = ctx.createGain();
    scannerGain.gain.setValueAtTime(0.06, now);
    scannerOsc.connect(scannerGain).connect(panner);

    // Voz 5: Textura de bordes (ruido filtrado)
    const noiseBuffer = createNoiseBuffer(ctx);
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(1250, now);
    noiseFilter.Q.setValueAtTime(1.4, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.03, now);
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(mainFilter);

    // Enrutamiento Dry/Wet -> StereoPanner -> Master -> Analyser -> Salida
    mainFilter.connect(dryGain).connect(panner);
    mainFilter.connect(convolver).connect(wetGain).connect(panner);
    panner.connect(masterGain).connect(analyser).connect(ctx.destination);

    bassOsc.start(now);
    padOsc.start(now);
    harmonicOscA.start(now);
    harmonicOscB.start(now);
    scannerOsc.start(now);
    lfoOsc.start(now);
    noiseSource.start(now);

    this.masterGain = masterGain;
    this.analyser = analyser;
    this.panner = panner;
    this.mainFilter = mainFilter;
    this.bassOsc = bassOsc;
    this.bassGain = bassGain;
    this.padOsc = padOsc;
    this.padGain = padGain;
    this.harmonicOscA = harmonicOscA;
    this.harmonicOscB = harmonicOscB;
    this.harmonicGain = harmonicGain;
    this.scannerOsc = scannerOsc;
    this.scannerGain = scannerGain;
    this.lfoOsc = lfoOsc;
    this.lfoDepth = lfoDepth;
    this.noiseSource = noiseSource;
    this.noiseFilter = noiseFilter;
    this.noiseGain = noiseGain;
    this.dryGain = dryGain;
    this.wetGain = wetGain;
    this.convolver = convolver;

    // Eventos granulares tipo fuego cuando fireProbability > 0
    this.fireTimer = window.setInterval(() => {
      if (!this.ctx || !this.panner || this.ctx.state !== "running") return;
      if (this.fireProb <= 0.01 || Math.random() > this.fireProb * 0.88) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1800 + Math.random() * 2400, t);
      bp.Q.setValueAtTime(5.2, t);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      const peakGain = this.soloVoice === "fireGranular" ? 0.36 : 0.22;
      env.gain.linearRampToValueAtTime(peakGain * Math.max(0.28, this.fireProb), t + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      src.connect(bp).connect(env).connect(this.panner);
      src.start(t, Math.random() * 1.4, 0.12);
    }, 120);
  }

  setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0.32 * this.masterVolume, this.ctx.currentTime, 0.06);
    }
  }

  applyTargets(t: SonificationTargets): void {
    if (!this.ctx || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const tau = 0.09;
    const solo = this.soloVoice;
    const isAll = solo === "all";

    const allowFire = isAll || solo === "fireGranular";
    const allowBass = isAll || solo === "climatePad";
    const allowPad =
      isAll ||
      solo === "climatePad" ||
      solo === "humidityFilter" ||
      solo === "windLfo" ||
      solo === "cloudReverb";
    const allowHarmonics = isAll || solo === "vegetationHarmonics";

    this.fireProb = allowFire && t.activeVoices.fireGranular ? t.fireProbability : 0;

    this.bassOsc?.frequency.setTargetAtTime(t.baseFreqHz * 0.5, now, tau);
    this.padOsc?.frequency.setTargetAtTime(t.baseFreqHz, now, tau);
    this.bassGain?.gain.setTargetAtTime(allowBass ? (t.activeVoices.climatePad ? 0.30 : 0.06) : 0, now, tau);
    const cloudPadGain = t.reverbWet > 0.06 ? 0.16 : 0.02;
    this.padGain?.gain.setTargetAtTime(
      allowPad ? (t.activeVoices.climatePad ? (solo === "cloudReverb" ? cloudPadGain : 0.16) : 0.04) : 0,
      now,
      tau,
    );

    this.harmonicOscA?.frequency.setTargetAtTime(t.baseFreqHz * 1.5, now, tau);
    this.harmonicOscB?.frequency.setTargetAtTime(t.baseFreqHz * 2.0, now, tau);
    const harmonicAmp = solo === "vegetationHarmonics" ? 0.34 : 0.22;
    this.harmonicGain?.gain.setTargetAtTime(
      allowHarmonics && t.activeVoices.vegetationHarmonics ? t.overtoneDensity * harmonicAmp : 0.0,
      now,
      tau,
    );

    this.scannerOsc?.frequency.setTargetAtTime(t.scannerPitchHz, now, 0.07);
    this.scannerGain?.gain.setTargetAtTime(isAll ? t.scannerGain : 0, now, 0.07);

    this.mainFilter?.frequency.setTargetAtTime(t.filterCutoffHz, now, tau);
    this.mainFilter?.Q.setTargetAtTime(solo === "humidityFilter" ? Math.max(4.5, t.filterQ) : t.filterQ, now, tau);
    this.lfoOsc?.frequency.setTargetAtTime(t.lfoRateHz, now, tau);
    this.lfoDepth?.gain.setTargetAtTime(
      solo === "windLfo"
        ? Math.max(380, t.lfoDepthHz)
        : solo === "humidityFilter"
          ? Math.max(240, t.lfoDepthHz)
          : t.activeVoices.windLfo
            ? t.lfoDepthHz
            : 35,
      now,
      tau,
    );

    this.panner?.pan.setTargetAtTime(t.stereoPan, now, 0.06);
    this.noiseGain?.gain.setTargetAtTime(isAll ? t.noiseTextureGain : 0, now, tau);
    if (solo === "cloudReverb") {
      this.dryGain?.gain.setTargetAtTime(0.06, now, tau);
      this.wetGain?.gain.setTargetAtTime(Math.min(0.85, t.reverbWet * 1.2), now, tau);
    } else {
      this.dryGain?.gain.setTargetAtTime(1 - t.reverbWet * 0.55, now, tau);
      this.wetGain?.gain.setTargetAtTime(t.reverbWet, now, tau);
    }
  }

  triggerPulseChime(freqHz = 659.25): void {
    if (!this.ctx || !this.masterGain || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freqHz, now);
    osc.frequency.exponentialRampToValueAtTime(freqHz * 1.5, now + 0.35);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    osc.connect(g).connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.7);
  }

  async stop(): Promise<void> {
    if (this.fireTimer !== null) {
      window.clearInterval(this.fireTimer);
      this.fireTimer = null;
    }
    const stopNode = (n: AudioScheduledSourceNode | null) => {
      if (!n) return;
      try {
        n.stop();
        n.disconnect();
      } catch {
        /* ya detenido */
      }
    };
    stopNode(this.bassOsc);
    stopNode(this.padOsc);
    stopNode(this.harmonicOscA);
    stopNode(this.harmonicOscB);
    stopNode(this.scannerOsc);
    stopNode(this.lfoOsc);
    stopNode(this.noiseSource);

    [
      this.masterGain,
      this.mainFilter,
      this.panner,
      this.bassGain,
      this.padGain,
      this.harmonicGain,
      this.scannerGain,
      this.lfoDepth,
      this.noiseFilter,
      this.noiseGain,
      this.dryGain,
      this.wetGain,
      this.convolver,
      this.analyser,
    ].forEach((n) => n?.disconnect());

    this.bassOsc = null;
    this.padOsc = null;
    this.harmonicOscA = null;
    this.harmonicOscB = null;
    this.scannerOsc = null;
    this.lfoOsc = null;
    this.noiseSource = null;
    this.analyser = null;

    if (this.ctx) {
      await this.ctx.close();
      this.ctx = null;
    }
  }
}
