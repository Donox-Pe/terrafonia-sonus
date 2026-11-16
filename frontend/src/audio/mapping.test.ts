import { describe, expect, it } from "vitest";
import { createLocalFallbackSignature } from "../transport/signatureClient";
import type { FrameFeatures } from "../analysis/frameAnalyzer";
import { computeSonificationTargets, selectScaleFromHue } from "./mapping";

const SAMPLE_FRAME: FrameFeatures = {
  meanLuminance: 0.45,
  spatialVariance: 0.35,
  edgeDensity: 0.4,
  dominantHueDeg: 120,
  hueHistogram: new Array(12).fill(0),
  playhead: {
    normalizedX: 0.75,
    longitudeDeg: 90,
    centroidLatitudeDeg: 45,
    columnEnergy: 0.6,
    hotspotActivity: 0.2,
    canopyActivity: 0.5,
    cloudActivity: 0.2,
    verticalProfile: new Array(16).fill(0.3),
  },
};

describe("computeSonificationTargets", () => {
  it("mantiene las voces de variables faltantes inactivas sin convertir null a 0", () => {
    const missingSig = createLocalFallbackSignature("missing_dropout", "2026-11-11", 0);
    const targets = computeSonificationTargets(missingSig, SAMPLE_FRAME, 0.7);

    expect(targets.missingVariables).toEqual(expect.arrayContaining(["qv2m", "ndvi"]));
    expect(targets.activeVoices.humidityFilter).toBe(false);
    expect(targets.activeVoices.vegetationHarmonics).toBe(false);
    expect(targets.overtoneDensity).toBe(0);
    expect(targets.activeVoices.climatePad).toBe(true);
  });

  it("incrementa la frecuencia base en climas cálidos frente al Ártico", () => {
    const arctic = computeSonificationTargets(
      createLocalFallbackSignature("artico", "2026-11-11", 0),
      SAMPLE_FRAME,
    );
    const sahara = computeSonificationTargets(
      createLocalFallbackSignature("sahara", "2026-11-11", 0),
      SAMPLE_FRAME,
    );

    expect(sahara.baseFreqHz).toBeGreaterThan(arctic.baseFreqHz);
    expect(sahara.activeVoices.fireGranular).toBe(true);
    expect(arctic.activeVoices.fireGranular).toBe(false);
  });

  it("asigna paneo hacia la derecha cuando el cabezal está en longitud este", () => {
    const sig = createLocalFallbackSignature("amazonia", "2026-11-11", 0);
    const eastTargets = computeSonificationTargets(sig, {
      ...SAMPLE_FRAME,
      playhead: { ...SAMPLE_FRAME.playhead, normalizedX: 0.92, longitudeDeg: 151.2 },
    });
    const westTargets = computeSonificationTargets(sig, {
      ...SAMPLE_FRAME,
      playhead: { ...SAMPLE_FRAME.playhead, normalizedX: 0.08, longitudeDeg: -151.2 },
    });

    expect(eastTargets.stereoPan).toBeGreaterThan(0.4);
    expect(westTargets.stereoPan).toBeLessThan(-0.4);
  });

  it("elige escala según matiz visual dominante", () => {
    expect(selectScaleFromHue(20)).toBe("harmonic_minor");
    expect(selectScaleFromHue(120)).toBe("lydian");
    expect(selectScaleFromHue(200)).toBe("dorian");
  });

  it("silencia fuego, vegetación y nubes fuera de su zona bajo el haz", () => {
    const sig = createLocalFallbackSignature("amazonia", "2026-11-11", 0);
    const overWater = computeSonificationTargets(sig, {
      ...SAMPLE_FRAME,
      playhead: {
        ...SAMPLE_FRAME.playhead,
        hotspotActivity: 0,
        canopyActivity: 0,
        cloudActivity: 0,
      },
    });
    const overActive = computeSonificationTargets(sig, {
      ...SAMPLE_FRAME,
      playhead: {
        ...SAMPLE_FRAME.playhead,
        hotspotActivity: 0.2,
        canopyActivity: 0.5,
        cloudActivity: 0.3,
      },
    });

    expect(overWater.fireProbability).toBe(0);
    expect(overWater.overtoneDensity).toBe(0);
    expect(overWater.reverbWet).toBeLessThan(0.06);

    expect(overActive.fireProbability).toBeGreaterThan(0.5);
    expect(overActive.overtoneDensity).toBeGreaterThan(0.4);
    expect(overActive.reverbWet).toBeGreaterThan(0.3);
  });
});
