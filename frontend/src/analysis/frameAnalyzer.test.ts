import { describe, expect, it } from "vitest";
import { analyzeImageData } from "./frameAnalyzer";

function makeSolidRgba(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    arr[i * 4] = r;
    arr[i * 4 + 1] = g;
    arr[i * 4 + 2] = b;
    arr[i * 4 + 3] = 255;
  }
  return arr;
}

describe("analyzeImageData", () => {
  it("maneja frames negros uniformes con luminancia 0 y bordes 0", () => {
    const f = analyzeImageData(makeSolidRgba(24, 12, 0, 0, 0), 24, 12, 0.5);
    expect(f.meanLuminance).toBe(0);
    expect(f.edgeDensity).toBe(0);
    expect(f.playhead.longitudeDeg).toBe(0);
  });

  it("detecta hotspot rojo y centroide en hemisferio norte", () => {
    const w = 20;
    const h = 20;
    const arr = makeSolidRgba(w, h, 8, 12, 24);
    // Columna derecha (playhead=0.9 -> x≈17) en fila superior (norte) con fuego rojo intenso
    const x = Math.floor(0.9 * (w - 1));
    for (let y = 1; y <= 4; y++) {
      const idx = (y * w + x) * 4;
      arr[idx] = 255;
      arr[idx + 1] = 45;
      arr[idx + 2] = 10;
    }
    const f = analyzeImageData(arr, w, h, 0.9);
    expect(f.playhead.longitudeDeg).toBeCloseTo(144, 1);
    expect(f.playhead.hotspotActivity).toBeGreaterThan(0.1);
    expect(f.playhead.centroidLatitudeDeg).toBeGreaterThan(30);
  });

  it("detecta gradiente de bordes en patrón de tablero", () => {
    const w = 16;
    const h = 16;
    const arr = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = (x + y) % 2 === 0 ? 255 : 0;
        const idx = (y * w + x) * 4;
        arr[idx] = v;
        arr[idx + 1] = v;
        arr[idx + 2] = v;
        arr[idx + 3] = 255;
      }
    }
    const f = analyzeImageData(arr, w, h, 0.25);
    expect(f.meanLuminance).toBeCloseTo(0.5, 1);
    expect(f.spatialVariance).toBeGreaterThan(0.5);
  });
});
