import type { FrameFeatures } from "../analysis/frameAnalyzer";
import type { SoundSignature, VariableName } from "../types/soundSignature";

/**
 * Mapeo científico → Web Audio API (función pura y testeable).
 *
 * Principio estricto: si una variable tiene quality === "missing" o value === null,
 * NO se reemplaza por 0. Se reporta en `missingVariables` y su voz/capa queda inactiva.
 */

export type MusicalScaleId = "dorian" | "lydian" | "minor_pent" | "harmonic_minor";

const SCALES: Record<MusicalScaleId, number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  minor_pent: [0, 3, 5, 7, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
};

export interface SonificationTargets {
  baseFreqHz: number;
  overtoneDensity: number; // 0..1 (NDVI + canopy visual)
  filterCutoffHz: number; // 240..7200 Hz (luminancia + humedad)
  filterQ: number; // 0.7..9 (humedad específica)
  lfoRateHz: number; // 0.08..6 Hz (velocidad viento)
  lfoDepthHz: number; // 40..1200 Hz (varianza espacial)
  stereoPan: number; // -0.85..+0.85 (barrido longitud + viento zonal)
  noiseTextureGain: number; // 0..0.22 (densidad de bordes Sobel)
  fireProbability: number; // 0..1 (fuego numérico + hotspot visual)
  reverbWet: number; // 0..0.75 (fracción de nubes + nubosidad visual)
  scannerPitchHz: number; // tono agudo que sigue latitud centroide del cabezal
  scannerGain: number; // 0..0.16
  missingVariables: VariableName[];
  activeVoices: {
    climatePad: boolean;
    humidityFilter: boolean;
    windLfo: boolean;
    vegetationHarmonics: boolean;
    fireGranular: boolean;
    cloudReverb: boolean;
  };
}

const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);

export function quantizeMidiToScale(midiFloat: number, scaleId: MusicalScaleId): number {
  const scale = SCALES[scaleId];
  const baseMidi = Math.round(midiFloat);
  const octave = Math.floor(baseMidi / 12);
  const semi = ((baseMidi % 12) + 12) % 12;

  let closest = scale[0];
  let bestDist = Infinity;
  for (const s of scale) {
    const d = Math.abs(s - semi);
    if (d < bestDist) {
      bestDist = d;
      closest = s;
    }
  }
  return 440 * Math.pow(2, (octave * 12 + closest - 69) / 12);
}

export function selectScaleFromHue(dominantHueDeg: number): MusicalScaleId {
  if (dominantHueDeg < 55 || dominantHueDeg >= 330) return "harmonic_minor"; // cálidos / fuego
  if (dominantHueDeg < 165) return "lydian"; // verdes / vegetación
  if (dominantHueDeg < 255) return "dorian"; // océano / azul
  return "minor_pent"; // violeta / polar
}

export function computeSonificationTargets(
  sig: SoundSignature,
  frame: FrameFeatures,
  modulationAmount = 0.65,
  forcedScale?: MusicalScaleId,
): SonificationTargets {
  const missingVariables: VariableName[] = [];
  const getValid = (k: VariableName): number | null => {
    const reading = sig.variables[k];
    if (!reading || reading.quality === "missing" || reading.value === null || !Number.isFinite(reading.value)) {
      missingVariables.push(k);
      return null;
    }
    return reading.value;
  };

  const t2m = getValid("t2m");
  const qv2m = getValid("qv2m");
  const u10m = getValid("u10m");
  const v10m = getValid("v10m");
  const ndvi = getValid("ndvi");
  const fire = getValid("fireCount");
  const cloud = getValid("cloudFraction");

  const scale = forcedScale ?? selectScaleFromHue(frame.dominantHueDeg);

  // 1. Temperatura -> registro tonal cuantizado a escala (si falta T2M, mantiene registro neutro sin falsificar)
  const tempNorm = t2m !== null ? clamp((t2m - 250) / 65, 0, 1) : 0.45;
  const baseMidi = 40 + tempNorm * 22; // E2..D4
  const baseFreqHz = quantizeMidiToScale(baseMidi, scale);

  // 2. Cabezal vertical -> tono guía según latitud centroide (-90..+90) y energía real bajo el haz
  const latNorm = clamp((frame.playhead.centroidLatitudeDeg + 90) / 180, 0, 1);
  const scannerPitchHz = quantizeMidiToScale(60 + latNorm * 24, scale);
  const surfaceAccent = frame.playhead.hotspotActivity * 0.25 + frame.playhead.canopyActivity * 0.15;
  const scannerGain = clamp((frame.playhead.columnEnergy + surfaceAccent) * 0.22, 0, 0.24);

  // 3. Luminancia visual + humedad -> cutoff y resonancia
  const lumNorm = clamp(frame.meanLuminance, 0, 1);
  const humNorm = qv2m !== null ? clamp(qv2m / 0.022, 0, 1) : null;
  const filterCutoffHz = 320 + lumNorm * 3800 + (humNorm ?? 0.35) * 1400;
  const filterQ = humNorm !== null ? 1.0 + humNorm * 6.5 : 0.9;

  // 4. Viento (u10m, v10m) -> tasa de LFO y contribución de paneo
  const windActive = u10m !== null && v10m !== null;
  const windSpeed = windActive ? Math.hypot(u10m!, v10m!) : 0;
  const lfoRateHz = windActive ? clamp(0.18 + (windSpeed / 18) * 4.5 * modulationAmount, 0.08, 6.0) : 0.1;
  const lfoDepthHz = clamp((120 + frame.spatialVariance * 1100) * modulationAmount, 30, 1400);

  // Paneo principal conducido por el barrido de longitud [-1..+1], con matiz de u10m si existe
  const lonPan = clamp((frame.playhead.normalizedX - 0.5) * 1.7, -0.85, 0.85);
  const windPan = u10m !== null ? clamp(u10m / 18, -0.35, 0.35) : 0;
  const stereoPan = clamp(lonPan * 0.8 + windPan * 0.2, -0.85, 0.85);

  // 5. NDVI -> densidad armónica conducida por la vegetación real bajo el haz (silencio sobre agua/desierto sin verde)
  const harmonicScale = 0.35 + clamp(modulationAmount, 0, 1) * 0.85;
  const localCanopy = clamp(frame.playhead.canopyActivity * 3.8, 0, 1);
  const overtoneDensity =
    ndvi !== null && localCanopy > 0.02
      ? clamp(localCanopy * (0.35 + Math.max(0, ndvi) * 0.65) * (ndvi > 0 ? 1 : 0.25) * harmonicScale, 0, 1)
      : 0;

  // 6. Fuego -> probabilidad granular conducida por el contacto real del haz con focos activos (silencio sobre el agua)
  const localHotspot = clamp(frame.playhead.hotspotActivity * 7.5, 0, 1);
  const regionalFireBoost = fire !== null && fire > 0 ? clamp(fire / 40, 0.25, 1) : 0;
  const fireProbability =
    fire !== null && fire > 0 && localHotspot > 0.02
      ? clamp(localHotspot * (0.55 + regionalFireBoost * 0.45), 0, 1)
      : 0;

  // 7. Nubes -> mezcla reverb/difusión sensible al paso del haz por cobertura nubosa
  const localClouds = clamp(frame.playhead.cloudActivity * 2.6, 0, 1);
  const reverbWet =
    cloud !== null
      ? localClouds > 0.02
        ? clamp(cloud * 0.14 + localClouds * 0.65, 0.04, 0.75)
        : 0.04
      : 0.05;

  // 8. Bordes Sobel -> textura de aire/ruido filtrado
  const noiseTextureGain = clamp(frame.edgeDensity * 0.18 * (0.4 + modulationAmount * 0.6), 0, 0.22);

  return {
    baseFreqHz: Number(baseFreqHz.toFixed(2)),
    overtoneDensity,
    filterCutoffHz: Number(filterCutoffHz.toFixed(1)),
    filterQ: Number(filterQ.toFixed(2)),
    lfoRateHz: Number(lfoRateHz.toFixed(2)),
    lfoDepthHz: Number(lfoDepthHz.toFixed(1)),
    stereoPan: Number(stereoPan.toFixed(3)),
    noiseTextureGain: Number(noiseTextureGain.toFixed(4)),
    fireProbability: Number(fireProbability.toFixed(3)),
    reverbWet: Number(reverbWet.toFixed(3)),
    scannerPitchHz: Number(scannerPitchHz.toFixed(2)),
    scannerGain: Number(scannerGain.toFixed(4)),
    missingVariables,
    activeVoices: {
      climatePad: t2m !== null,
      humidityFilter: qv2m !== null,
      windLfo: windActive,
      vegetationHarmonics: ndvi !== null,
      fireGranular: fire !== null && fire > 0,
      cloudReverb: cloud !== null,
    },
  };
}
