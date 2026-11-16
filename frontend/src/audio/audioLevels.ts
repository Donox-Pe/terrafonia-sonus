/**
 * Niveles de audio normalizados (0..1) que consume el logo 3D.
 *
 * El logo NO conoce el origen del sonido: solo lee este objeto. Más adelante
 * la sonificación real de TerraFonía escribirá aquí; hoy lo escribe un medidor
 * conectado a un AnalyserNode (o una "respiración" de reposo si no hay audio).
 */
export interface AudioLevels {
  bass: number;
  mid: number;
  treble: number;
  /** Energía global ponderada. */
  energy: number;
}

export const SILENT_LEVELS: Readonly<AudioLevels> = Object.freeze({
  bass: 0,
  mid: 0,
  treble: 0,
  energy: 0,
});

/** Límites de banda en Hz. */
export const BANDS_HZ = {
  bass: [20, 250],
  mid: [250, 2000],
  treble: [2000, 8000],
} as const;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Promedia el espectro (bytes 0..255 de getByteFrequencyData) por banda.
 * Función pura: se prueba sin Web Audio.
 */
export function bandAverages(
  freqData: ArrayLike<number>,
  sampleRate: number,
  fftSize: number,
): AudioLevels {
  const binHz = sampleRate / fftSize;
  const avg = (lo: number, hi: number) => {
    const a = Math.max(0, Math.floor(lo / binHz));
    const b = Math.min(freqData.length - 1, Math.ceil(hi / binHz));
    if (b < a) return 0;
    let sum = 0;
    for (let i = a; i <= b; i++) sum += freqData[i];
    return clamp01(sum / (b - a + 1) / 255);
  };
  const bass = avg(...BANDS_HZ.bass);
  const mid = avg(...BANDS_HZ.mid);
  const treble = avg(...BANDS_HZ.treble);
  return { bass, mid, treble, energy: clamp01(bass * 0.5 + mid * 0.3 + treble * 0.2) };
}

/** Suavizado con ataque rápido y caída lenta (evita parpadeo visual). */
export function smoothLevels(
  prev: AudioLevels,
  next: AudioLevels,
  attack = 0.45,
  release = 0.08,
): AudioLevels {
  const f = (p: number, n: number) => p + (n - p) * (n > p ? attack : release);
  return {
    bass: f(prev.bass, next.bass),
    mid: f(prev.mid, next.mid),
    treble: f(prev.treble, next.treble),
    energy: f(prev.energy, next.energy),
  };
}

/** Niveles de reposo: respiración lenta, para que el logo esté "vivo" sin audio. */
export function idleLevels(timeSeconds: number): AudioLevels {
  const s = (hz: number, ph = 0) => 0.5 + 0.5 * Math.sin(timeSeconds * Math.PI * 2 * hz + ph);
  const bass = 0.12 + 0.1 * s(0.12);
  const mid = 0.1 + 0.07 * s(0.19, 1.3);
  const treble = 0.08 + 0.06 * s(0.31, 2.1);
  return { bass, mid, treble, energy: bass * 0.5 + mid * 0.3 + treble * 0.2 };
}
