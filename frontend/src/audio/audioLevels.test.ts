import { describe, expect, it } from "vitest";
import { bandAverages, idleLevels, smoothLevels, SILENT_LEVELS } from "./audioLevels";

const SR = 48000;
const FFT = 1024; // bin ≈ 46.9 Hz

function spectrum(fn: (hz: number) => number): Uint8Array {
  const n = FFT / 2;
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = fn((i * SR) / FFT);
  return a;
}

describe("bandAverages", () => {
  it("espectro vacío ⇒ todo en 0", () => {
    const L = bandAverages(new Uint8Array(FFT / 2), SR, FFT);
    expect(L).toEqual({ bass: 0, mid: 0, treble: 0, energy: 0 });
  });

  it("espectro lleno ⇒ todo en 1", () => {
    const L = bandAverages(new Uint8Array(FFT / 2).fill(255), SR, FFT);
    expect(L.bass).toBe(1);
    expect(L.mid).toBe(1);
    expect(L.treble).toBe(1);
    expect(L.energy).toBeCloseTo(1, 6);
  });

  it("energía solo en graves ⇒ bass alto, treble ≈ 0", () => {
    const L = bandAverages(spectrum((hz) => (hz < 250 ? 255 : 0)), SR, FFT);
    expect(L.bass).toBeGreaterThan(0.6);
    expect(L.treble).toBe(0);
  });

  it("energía solo en agudos ⇒ treble alto, bass ≈ 0", () => {
    const L = bandAverages(spectrum((hz) => (hz >= 2000 && hz <= 8000 ? 255 : 0)), SR, FFT);
    expect(L.treble).toBeGreaterThan(0.9);
    expect(L.bass).toBe(0);
  });

  it("siempre devuelve valores dentro de [0, 1]", () => {
    const L = bandAverages(spectrum((hz) => (hz * 7) % 256), SR, FFT);
    for (const v of Object.values(L)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("smoothLevels", () => {
  const loud = { bass: 1, mid: 1, treble: 1, energy: 1 };

  it("sube más rápido de lo que baja (ataque > caída)", () => {
    const up = smoothLevels(SILENT_LEVELS, loud).bass;
    const down = 1 - smoothLevels(loud, SILENT_LEVELS).bass;
    expect(up).toBeGreaterThan(down);
  });

  it("converge al objetivo tras muchas iteraciones", () => {
    let cur = { ...SILENT_LEVELS };
    for (let i = 0; i < 200; i++) cur = smoothLevels(cur, loud);
    expect(cur.energy).toBeCloseTo(1, 3);
  });
});

describe("idleLevels", () => {
  it("se mantiene bajo y acotado en el tiempo", () => {
    for (let t = 0; t < 60; t += 0.7) {
      const L = idleLevels(t);
      for (const v of Object.values(L)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(0.35);
      }
    }
  });
});
