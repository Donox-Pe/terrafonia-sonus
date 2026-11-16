import { describe, expect, it } from "vitest";
import { computeSonificationTargets } from "../audio/mapping";
import { createLocalFallbackSignature } from "../transport/signatureClient";
import type { FrameFeatures } from "../analysis/frameAnalyzer";
import { explainFrequencyBand, interpretSonusQuery, type SonusAgentContext } from "./sonusAgent";

const SAMPLE_FRAME: FrameFeatures = {
  meanLuminance: 0.42,
  spatialVariance: 0.31,
  edgeDensity: 0.27,
  dominantHueDeg: 120,
  hueHistogram: new Array(12).fill(0),
  playhead: {
    normalizedX: 0.5,
    longitudeDeg: 0,
    centroidLatitudeDeg: 0,
    columnEnergy: 0.55,
    hotspotActivity: 0.3,
    canopyActivity: 0.65,
    cloudActivity: 0.25,
    verticalProfile: new Array(16).fill(0.3),
  },
};

function makeContext(preset = "amazonia", lang: "es" | "en" = "es"): SonusAgentContext {
  const signature = createLocalFallbackSignature(preset, "2024-06-01", 0);
  const targets = computeSonificationTargets(signature, SAMPLE_FRAME, 0.68);
  return {
    lang,
    playing: true,
    signature,
    targets,
    frameFeatures: SAMPLE_FRAME,
    layers: { fire: true, ndvi: true, clouds: true },
    modulationAmount: 0.68,
    sweepSpeed: 0.075,
    scaleChoice: "auto",
  };
}

describe("sonusAgent", () => {
  it("ejecuta navegación de preset y PLAY desde lenguaje natural", () => {
    const res = interpretSonusQuery("llévame al ártico y reproduce", makeContext());
    expect(res.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "setPreset", presetId: "artico" }),
        expect.objectContaining({ type: "setPlaying", playing: true }),
      ]),
    );
  });

  it("explica bandas de frecuencia específicas en Hz y kHz", () => {
    const res = explainFrequencyBand(6, makeContext("amazonia", "es"));
    expect(res).toContain("2.5–4 kHz");
    expect(res).toContain("Fuego");

    const enRes = interpretSonusQuery("what is 120 Hz?", makeContext("sahara", "en"));
    expect(enRes.reply).toContain("60–120 Hz");
  });

  it("reporta variables faltantes sin falsificar ceros", () => {
    const res = interpretSonusQuery("¿hay datos faltantes?", makeContext("missing_dropout", "es"));
    expect(res.reply).toContain("sin dato");
  });

  it("no dispara PLAY por accidente cuando el usuario hace preguntas", () => {
    const q1 = interpretSonusQuery(
      "y si hay fuego sube la temperatura y por lo tanto se escucha mas grave o agudo ?",
      makeContext("amazonia", "es"),
    );
    expect(q1.actions).toHaveLength(0);
    expect(q1.reply).toContain("MÁS AGUDO");

    const q2 = interpretSonusQuery("¿Qué estoy escuchando?", makeContext("amazonia", "es"));
    expect(q2.actions).toHaveLength(0);
    expect(q2.reply).toContain("fundamental");

    const q3 = interpretSonusQuery("¿por qué sigue arriba la barra izquierda?", makeContext("artico", "es"));
    expect(q3.actions).toHaveLength(0);
    expect(q3.reply).toContain("60–250 Hz");
  });

  it("aisla voces individuales en el sintetizador con 'reproduce solo fuego'", () => {
    const res = interpretSonusQuery("reproduce solo fuego", makeContext("amazonia", "es"));
    expect(res.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "setPlaying", playing: true }),
        expect.objectContaining({ type: "setSoloVoice", voice: "fireGranular" }),
      ]),
    );
  });
});
