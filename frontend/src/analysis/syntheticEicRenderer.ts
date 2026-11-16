import type { LayerToggles, SoundSignature } from "../types/soundSignature";
import { fbm, getEarthBaseAssets } from "./earthTexture";

/**
 * Renderizador sintético de información terrestre (EIC).
 *
 * Combina una base geográfica realista generada de forma procedural (`earthTexture.ts`)
 * con las capas dinámicas de Fuego, NDVI y Nubes del `SoundSignature` activo.
 * IMPORTANTE: Genera frames sintéticos locales etiquetados (NO es imagen NASA GIBS en vivo).
 */

const HOTSPOT_CLUSTERS: Array<[number, number]> = [
  [-58, -11], // Amazonia sur
  [-64, -7],  // Acre / Rondonia
  [19, -8],   // Cuenca del Congo
  [26, -12],  // Katanga / Zambia
  [104, 15],  // Sudeste asiático
  [-118, 36], // California
  [134, -22], // Interior australiano
  [11, 12],   // Sahel central
];

const toCanvasX = (lon: number, w: number) => ((lon + 180) / 360) * w;
const toCanvasY = (lat: number, h: number) => ((90 - lat) / 180) * h;

/** Pinta únicamente la superficie terrestre (sin nubes) para que la esfera 3D superior aplique nubes y sombras reales. */
export function renderEarthCrustForGlobe(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sig: SoundSignature,
  layers: LayerToggles,
  timeSec: number,
): void {
  const base = getEarthBaseAssets();

  if (base) {
    ctx.drawImage(base.canvas, 0, 0, w, h);
  } else {
    const fallbackBg = ctx.createLinearGradient(0, 0, 0, h);
    fallbackBg.addColorStop(0, "#061529");
    fallbackBg.addColorStop(0.5, "#092140");
    fallbackBg.addColorStop(1, "#061529");
    ctx.fillStyle = fallbackBg;
    ctx.fillRect(0, 0, w, h);
  }

  // Realce sutil NDVI
  const ndviOk = sig.variables.ndvi.quality === "ok" && sig.variables.ndvi.value !== null;
  if (layers.ndvi && ndviOk) {
    const ndviVal = Math.max(0, Math.min(1, sig.variables.ndvi.value!));
    if (ndviVal > 0.25) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(34, 197, 94, ${((ndviVal - 0.2) * 0.22).toFixed(3)})`;
      ctx.fillRect(0, h * 0.16, w, h * 0.68);
      ctx.restore();
    }
  }

  // Focos de calor MODIS (puntos nítidos emisivos)
  const fireOk = sig.variables.fireCount.quality === "ok" && sig.variables.fireCount.value !== null;
  if (layers.fire && fireOk && (sig.variables.fireCount.value ?? 0) > 0) {
    const count = sig.variables.fireCount.value!;
    const intensity = Math.min(1, count / 18);
    HOTSPOT_CLUSTERS.forEach(([lon, lat], idx) => {
      const fx = toCanvasX(lon, w);
      const fy = toCanvasY(lat, h);
      const r = Math.max(4, w * (0.008 + intensity * 0.012));
      const pulse = 0.82 + 0.18 * Math.sin(timeSec * 3.2 + idx * 1.4);
      const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * pulse);
      grad.addColorStop(0, "rgba(255, 245, 175, 0.98)");
      grad.addColorStop(0.32, "rgba(255, 108, 24, 0.9)");
      grad.addColorStop(0.7, "rgba(220, 38, 38, 0.35)");
      grad.addColorStop(1, "rgba(220, 38, 38, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fx, fy, r * pulse, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

export function renderSyntheticEarthData(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sig: SoundSignature,
  layers: LayerToggles,
  timeSec: number,
): void {
  const base = getEarthBaseAssets();

  if (base) {
    ctx.drawImage(base.canvas, 0, 0, w, h);
  } else {
    const fallbackBg = ctx.createLinearGradient(0, 0, 0, h);
    fallbackBg.addColorStop(0, "#081730");
    fallbackBg.addColorStop(0.5, "#0b2447");
    fallbackBg.addColorStop(1, "#081730");
    ctx.fillStyle = fallbackBg;
    ctx.fillRect(0, 0, w, h);
  }

  // Modulación visual NDVI (solo cuando quality === "ok" y la capa está activa)
  const ndviOk = sig.variables.ndvi.quality === "ok" && sig.variables.ndvi.value !== null;
  if (layers.ndvi && ndviOk) {
    const ndviVal = Math.max(0, Math.min(1, sig.variables.ndvi.value!));
    if (ndviVal > 0.15) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.fillStyle = `rgba(34, 197, 94, ${(ndviVal * 0.16).toFixed(3)})`;
      ctx.fillRect(0, h * 0.2, w, h * 0.56);
      ctx.restore();
    }
  }

  // Terminador solar sutil + brillo atmosférico ecuatorial
  const t2mOk = sig.variables.t2m.quality === "ok" && sig.variables.t2m.value !== null;
  const warmth = t2mOk ? Math.max(0, Math.min(1, (sig.variables.t2m.value! - 255) / 60)) : 0.45;
  if (warmth > 0.55) {
    ctx.save();
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = `rgba(251, 146, 60, ${((warmth - 0.55) * 0.25).toFixed(3)})`;
    ctx.fillRect(0, h * 0.25, w, h * 0.5);
    ctx.restore();
  }

  // Capa FUEGO (MODIS Active Fire simulado)
  const fireOk = sig.variables.fireCount.quality === "ok" && sig.variables.fireCount.value !== null;
  if (layers.fire && fireOk && (sig.variables.fireCount.value ?? 0) > 0) {
    const count = sig.variables.fireCount.value!;
    const intensity = Math.min(1, count / 18);
    HOTSPOT_CLUSTERS.forEach(([lon, lat], idx) => {
      const fx = toCanvasX(lon, w);
      const fy = toCanvasY(lat, h);
      const r = Math.max(4, w * (0.015 + intensity * 0.022));
      const pulse = 0.78 + 0.22 * Math.sin(timeSec * 3.2 + idx * 1.4);
      const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * pulse);
      grad.addColorStop(0, "rgba(255, 240, 150, 0.98)");
      grad.addColorStop(0.28, "rgba(255, 110, 28, 0.92)");
      grad.addColorStop(0.65, "rgba(220, 38, 38, 0.45)");
      grad.addColorStop(1, "rgba(220, 38, 38, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fx, fy, r * pulse, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // 4. Capa NUBES orgánica (bandas ciclónicas suaves con fBm ligero)
  const cloudOk = sig.variables.cloudFraction.quality === "ok" && sig.variables.cloudFraction.value !== null;
  if (layers.clouds && cloudOk) {
    const cf = sig.variables.cloudFraction.value!;
    const alpha = Math.max(0.1, cf * 0.68);
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const n = fbm(i * 1.37, 0.45, 2);
      const drift = (timeSec * (5 + (i % 5) * 1.8)) % (w + w * 0.4);
      const cx = ((i * w * 0.11 + drift) % (w + w * 0.25)) - w * 0.12;
      const cy = h * (0.12 + n * 0.76);
      const rw = w * (0.06 + cf * 0.08 + (i % 3) * 0.02);
      const rh = h * (0.032 + (i % 4) * 0.008);

      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rw);
      g.addColorStop(0, `rgba(240, 248, 255, ${alpha.toFixed(3)})`);
      g.addColorStop(0.55, `rgba(218, 236, 255, ${(alpha * 0.42).toFixed(3)})`);
      g.addColorStop(1, "rgba(218, 236, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rw, rh, 0.18 * Math.sin(i), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 5. Resalte sutil de la región activa para análisis/referencia
  const [latMin, latMax] = sig.region.lat;
  const [lonMin, lonMax] = sig.region.lon;
  const rx0 = toCanvasX(lonMin, w);
  const rx1 = toCanvasX(lonMax, w);
  const ry0 = toCanvasY(latMax, h);
  const ry1 = toCanvasY(latMin, h);
  ctx.save();
  ctx.strokeStyle = "rgba(95, 227, 255, 0.52)";
  ctx.lineWidth = Math.max(1, w * 0.0025);
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(rx0, ry0, Math.max(6, rx1 - rx0), Math.max(6, ry1 - ry0));
  ctx.restore();
}

export function drawJarvisOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  playheadNormX: number,
  centroidLatDeg: number,
): void {
  ctx.save();
  const px = playheadNormX * w;
  const beam = ctx.createLinearGradient(px - 28, 0, px + 28, 0);
  beam.addColorStop(0, "rgba(95, 227, 255, 0)");
  beam.addColorStop(0.45, "rgba(95, 227, 255, 0.25)");
  beam.addColorStop(0.5, "rgba(180, 250, 255, 0.92)");
  beam.addColorStop(0.55, "rgba(95, 227, 255, 0.25)");
  beam.addColorStop(1, "rgba(95, 227, 255, 0)");
  ctx.fillStyle = beam;
  ctx.fillRect(px - 28, 0, 56, h);

  ctx.strokeStyle = "#9ff4ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, h);
  ctx.stroke();

  const cy = toCanvasY(centroidLatDeg, h);
  ctx.strokeStyle = "#c9b6ff";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(px, cy, 9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#5fe3ff";
  ctx.beginPath();
  ctx.arc(px, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
