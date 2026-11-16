import { describe, expect, it } from "vitest";
import { SignatureStore } from "./signatureStore.js";

describe("SignatureStore", () => {
  const store = new SignatureStore("/nonexistent-cache-dir-for-unit-test");

  it("declara origen simulado y no verificado por defecto", () => {
    const prov = store.getProvenanceSummary();
    expect(prov.mode).toBe("simulated");
    expect(prov.verifiedNasaDataAvailable).toBe(false);
    expect(prov.earthdataConfigured).toBe(false);
  });

  it("lista presets incluyendo la prueba de dato faltante", () => {
    const presets = store.listPresets();
    expect(presets.length).toBeGreaterThanOrEqual(5);
    expect(presets.some((p) => p.id === "missing_dropout" && p.hasMissingDemo)).toBe(true);
  });

  it("jamás convierte valores faltantes en 0", () => {
    const sig = store.getSignature({ presetId: "missing_dropout", phase: 1.4 });
    expect(sig.variables.qv2m.value).toBeNull();
    expect(sig.variables.qv2m.quality).toBe("missing");
    expect(sig.variables.ndvi.value).toBeNull();
    expect(sig.variables.ndvi.quality).toBe("missing");
    expect(sig.provenance.origin).toBe("simulated");
    expect(sig.provenance.verified).toBe(false);
  });

  it("preserva unidades físicas y calidad ok en lecturas válidas", () => {
    const sig = store.getSignature({ presetId: "amazonia", date: "2026-11-11", phase: 0 });
    expect(sig.variables.t2m.unit).toBe("K");
    expect(sig.variables.t2m.quality).toBe("ok");
    expect(sig.variables.t2m.value).toBeGreaterThan(250);
    expect(sig.timestamp).toBe("2026-11-11T12:00:00Z");
  });
});
