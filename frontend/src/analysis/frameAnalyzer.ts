/**
 * Analizador visual de frames EIC en tiempo real (función pura sobre RGBA).
 * Calcula luminancia media, matiz dominante, densidad de bordes Sobel, varianza espacial
 * y lectura en la columna del cabezal vertical (playhead).
 */

export interface PlayheadColumnSample {
  /** Posición normalizada del cabezal [0..1] de oeste (-180°) a este (+180°). */
  normalizedX: number;
  longitudeDeg: number;
  /** Centroide vertical ponderado por energía visual, convertido a latitud [-90..+90]. */
  centroidLatitudeDeg: number;
  /** Energía media normalizada de la columna [0..1]. */
  columnEnergy: number;
  /** Proporción de píxeles cálidos/fuego en la columna [0..1]. */
  hotspotActivity: number;
  /** Proporción de píxeles verdes/vegetación en la columna [0..1]. */
  canopyActivity: number;
  /** Proporción de píxeles brillantes neutros (nubes) en la columna [0..1]. */
  cloudActivity: number;
  /** Perfil muestreado verticalmente (de norte a sur) para HUD. */
  verticalProfile: number[];
  /** Posición horizontal normalizada [0..1] del haz sobre el viewport completo. */
  beamViewportX?: number;
  /** Posición vertical normalizada [0..1] de la retícula sobre el viewport completo. */
  reticleViewportY?: number;
}

export interface FrameFeatures {
  meanLuminance: number;
  spatialVariance: number;
  edgeDensity: number;
  dominantHueDeg: number;
  hueHistogram: number[];
  playhead: PlayheadColumnSample;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function rgbToHueDeg(r: number, g: number, b: number): { hue: number; sat: number; val: number } {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const val = max / 255;
  const sat = max === 0 ? 0 : d / max;
  if (d === 0) return { hue: 0, sat, val };

  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;

  let deg = h * 60;
  if (deg < 0) deg += 360;
  return { hue: deg, sat, val };
}

/**
 * Extrae características visuales de un buffer RGBA (Canvas ImageData.data).
 * Puede correrse a 10-15 Hz en un canvas reducido (ej. 192x96) sin bloquear el hilo principal.
 */
export function analyzeImageData(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  playheadNormalizedX: number,
  profileBins = 16,
): FrameFeatures {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return {
      meanLuminance: 0,
      spatialVariance: 0,
      edgeDensity: 0,
      dominantHueDeg: 200,
      hueHistogram: new Array(12).fill(0),
      playhead: {
        normalizedX: clamp01(playheadNormalizedX),
        longitudeDeg: 0,
        centroidLatitudeDeg: 0,
        columnEnergy: 0,
        hotspotActivity: 0,
        canopyActivity: 0,
        cloudActivity: 0,
        verticalProfile: new Array(profileBins).fill(0),
      },
    };
  }

  const totalPixels = width * height;
  const lums = new Float32Array(totalPixels);
  const hueBins = new Array<number>(12).fill(0);

  let lumSum = 0;
  let activeTotal = 0;
  for (let i = 0; i < totalPixels; i++) {
    const off = i * 4;
    if (rgba[off + 3] === 0) {
      lums[i] = 0;
      continue;
    }
    activeTotal++;
    const r = rgba[off];
    const g = rgba[off + 1];
    const b = rgba[off + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    lums[i] = lum;
    lumSum += lum;

    const hsv = rgbToHueDeg(r, g, b);
    if (hsv.sat > 0.14 && hsv.val > 0.08) {
      const bin = Math.floor(hsv.hue / 30) % 12;
      hueBins[bin] += hsv.sat * hsv.val;
    }
  }

  const meanLuminance = activeTotal > 0 ? lumSum / activeTotal : 0;

  let varSum = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (rgba[i * 4 + 3] === 0) continue;
    const diff = lums[i] - meanLuminance;
    varSum += diff * diff;
  }
  const spatialVariance = activeTotal > 0 ? clamp01((varSum / activeTotal) * 6) : 0;

  // Densidad de bordes (gradiente Sobel aproximado sobre luma interior)
  let edgeSum = 0;
  let edgeCount = 0;
  if (width >= 3 && height >= 3) {
    for (let y = 1; y < height - 1; y++) {
      const row = y * width;
      for (let x = 1; x < width - 1; x++) {
        const tl = lums[row - width + x - 1];
        const t = lums[row - width + x];
        const tr = lums[row - width + x + 1];
        const l = lums[row + x - 1];
        const r = lums[row + x + 1];
        const bl = lums[row + width + x - 1];
        const b = lums[row + width + x];
        const br = lums[row + width + x + 1];

        const gx = -tl + tr - 2 * l + 2 * r - bl + br;
        const gy = -tl - 2 * t - tr + bl + 2 * b + br;
        edgeSum += Math.min(1, Math.hypot(gx, gy) * 0.5);
        edgeCount++;
      }
    }
  }
  const edgeDensity = edgeCount > 0 ? clamp01(edgeSum / edgeCount) : 0;

  let maxBin = 0;
  let maxVal = -1;
  let hueTotal = 0;
  for (let i = 0; i < hueBins.length; i++) {
    hueTotal += hueBins[i];
    if (hueBins[i] > maxVal) {
      maxVal = hueBins[i];
      maxBin = i;
    }
  }
  const normalizedBins = hueTotal > 0 ? hueBins.map((v) => v / hueTotal) : hueBins;
  const dominantHueDeg = hueTotal > 0 ? maxBin * 30 + 15 : 195;

  // Muestreo en columna del cabezal de escaneo (playhead)
  const normX = clamp01(playheadNormalizedX);
  const colX = Math.min(width - 1, Math.max(0, Math.floor(normX * (width - 1))));
  let colEnergySum = 0;
  let activeColPixels = 0;
  let weightedLatSum = 0;
  let weightTotal = 0;
  let hotSum = 0;
  let canopySum = 0;
  let cloudSum = 0;
  const profile = new Array<number>(profileBins).fill(0);
  const binCounts = new Array<number>(profileBins).fill(0);

  for (let y = 0; y < height; y++) {
    const idx = (y * width + colX) * 4;
    if (rgba[idx + 3] === 0) continue;
    activeColPixels++;
    const r = rgba[idx];
    const g = rgba[idx + 1];
    const b = rgba[idx + 2];
    const lum = lums[y * width + colX];

    // Intensidad de actividad de capa en el píxel
    const hotspot = clamp01((r - Math.max(g, b) * 0.85) / 140);
    const canopy = clamp01((g - Math.max(r, b) * 0.9) / 110);
    const satApprox = (Math.max(r, g, b) - Math.min(r, g, b)) / (Math.max(r, g, b) || 1);
    const cloud = lum > 0.56 && satApprox < 0.28 ? lum : 0;

    const pixelEnergy = clamp01(Math.max(lum * 0.75, hotspot, canopy));
    colEnergySum += pixelEnergy;
    hotSum += hotspot;
    canopySum += canopy;
    cloudSum += cloud;

    // Peso vertical (arriba = +90° Norte, abajo = -90° Sur)
    const latDeg = 90 - (y / Math.max(1, height - 1)) * 180;
    const w = pixelEnergy * pixelEnergy + 0.01;
    weightedLatSum += latDeg * w;
    weightTotal += w;

    const pBin = Math.min(profileBins - 1, Math.floor((y / height) * profileBins));
    profile[pBin] += pixelEnergy;
    binCounts[pBin]++;
  }

  for (let b = 0; b < profileBins; b++) {
    if (binCounts[b] > 0) profile[b] = clamp01(profile[b] / binCounts[b]);
  }

  const colDenom = activeColPixels > 0 ? activeColPixels : height;

  return {
    meanLuminance,
    spatialVariance,
    edgeDensity,
    dominantHueDeg,
    hueHistogram: normalizedBins,
    playhead: {
      normalizedX: normX,
      longitudeDeg: Number(((normX - 0.5) * 360).toFixed(1)),
      centroidLatitudeDeg: Number((weightTotal > 0 ? weightedLatSum / weightTotal : 0).toFixed(1)),
      columnEnergy: activeColPixels > 0 ? clamp01(colEnergySum / colDenom) : 0,
      hotspotActivity: activeColPixels > 0 ? clamp01(hotSum / colDenom) : 0,
      canopyActivity: activeColPixels > 0 ? clamp01(canopySum / colDenom) : 0,
      cloudActivity: activeColPixels > 0 ? clamp01(cloudSum / colDenom) : 0,
      verticalProfile: profile,
    },
  };
}
