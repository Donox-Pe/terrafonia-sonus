import type { SoundSignature } from "../types/soundSignature";

export interface GlobeRotationOffset {
  yaw: number;
  pitch: number;
}

export interface GlobeViewState {
  rotY: number;
  rotX: number;
  camZ: number;
  fovDeg: number;
  /** Radio horizontal normalizado del disco planetario dentro del viewport [0..0.495]. */
  diskRadiusX: number;
  /** Radio vertical normalizado del disco planetario dentro del viewport [0..0.495]. */
  diskRadiusY: number;
  /** Tangente del semiángulo aparente de la esfera unitaria. */
  tanAlpha: number;
}

export interface ProjectedColumnGeo {
  longitudeDeg: number;
  latitudeDeg: number;
  /** Posición vertical normalizada [0..1] dentro del viewport del centroide escaneado. */
  reticleViewportY: number;
  /** Posición horizontal normalizada [0..1] dentro del viewport del haz escáner. */
  beamViewportX: number;
}

const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

/**
 * Calcula la orientación y proyección exacta del globo 3D usado por EarthGlobe3D,
 * permitiendo alinear 1:1 el haz cian y el muestreo de sonificación con el planeta visible.
 */
export function computeGlobeViewState(
  signature: SoundSignature,
  rotationOffset: GlobeRotationOffset,
  zoomFactor: number,
  stageAspect: number,
  timeSec: number,
  playing: boolean,
  reducedMotion: boolean,
): GlobeViewState {
  const centerLon = (signature.region.lon[0] + signature.region.lon[1]) * 0.5;
  const centerLat = (signature.region.lat[0] + signature.region.lat[1]) * 0.5;
  const lonRad = (centerLon * Math.PI) / 180;
  const latRad = clamp((centerLat * Math.PI) / 180, -1.35, 1.35);

  const spin = reducedMotion || !playing ? 0 : Math.sin(timeSec * 0.24) * 0.04;
  const rotY = -Math.PI * 0.5 - lonRad + spin + rotationOffset.yaw;
  const rotX = clamp(latRad + rotationOffset.pitch, -1.35, 1.35);

  const aspect = Math.max(0.4, Number.isFinite(stageAspect) ? stageAspect : 1);
  const safeZoom = clamp(zoomFactor || 1, 0.52, 1.65);
  const camZ = (3.45 * safeZoom) / Math.min(1, aspect * 0.94);

  const fovDeg = 36;
  const fovRad = (fovDeg * Math.PI) / 180;
  const sinAlpha = 1 / Math.max(1.02, camZ);
  const tanAlpha = sinAlpha / Math.sqrt(1 - sinAlpha * sinAlpha);
  const tanHalfFov = Math.tan(fovRad * 0.5);

  const diskRadiusY = clamp((tanAlpha / tanHalfFov) * 0.5, 0.08, 0.495);
  const diskRadiusX = clamp(diskRadiusY / aspect, 0.08, 0.495);

  return {
    rotY,
    rotX,
    camZ,
    fovDeg,
    diskRadiusX,
    diskRadiusY,
    tanAlpha,
  };
}

/**
 * Intersecta un rayo normalizado dentro del cuadrado circunscrito del disco [-1..1]^2
 * con la esfera unitaria rotada por Euler(rotX, rotY, 0, 'XYZ') y devuelve coordenadas geográficas.
 */
export function raycastGlobeDisk(
  diskX: number,
  diskY: number,
  view: GlobeViewState,
): { u: number; v: number; lonDeg: number; latDeg: number } | null {
  const dx = diskX * view.tanAlpha;
  const dy = diskY * view.tanAlpha;
  const dz = -1;
  const invLen = 1 / Math.hypot(dx, dy, dz);
  const rdx = dx * invLen;
  const rdy = dy * invLen;
  const rdz = dz * invLen;

  const b = view.camZ * rdz;
  const c = view.camZ * view.camZ - 1;
  const disc = b * b - c;
  if (disc < 0) return null;

  const tHit = -b - Math.sqrt(disc);
  const px = tHit * rdx;
  const py = tHit * rdy;
  const pz = view.camZ + tHit * rdz;

  const cosX = Math.cos(view.rotX);
  const sinX = Math.sin(view.rotX);
  const cosY = Math.cos(view.rotY);
  const sinY = Math.sin(view.rotY);

  // Inversa de R = Rx(rotX) * Ry(rotY) -> Ry(-rotY) * Rx(-rotX)
  const y1 = py * cosX + pz * sinX;
  const z1 = -py * sinX + pz * cosX;
  const x1 = px;

  const lx = x1 * cosY - z1 * sinY;
  const ly = y1;
  const lz = x1 * sinY + z1 * cosY;

  const theta = Math.acos(clamp(ly, -1, 1));
  let phi = Math.atan2(lz, -lx);
  if (phi < 0) phi += Math.PI * 2;

  const u = phi / (Math.PI * 2);
  const v = theta / Math.PI;

  return {
    u,
    v,
    lonDeg: (u - 0.5) * 360,
    latDeg: 90 - v * 180,
  };
}

/**
 * Proyecta una textura equirectangular (eqData, eqW x eqH) al disco 3D visible (outW x outH)
 * y calcula simultáneamente las coordenadas reales (lon, lat, retícula) bajo la columna `playheadX`.
 */
export function renderProjectedGlobeDisk(
  eqData: Uint8ClampedArray,
  eqW: number,
  eqH: number,
  outData: Uint8ClampedArray,
  outW: number,
  outH: number,
  view: GlobeViewState,
  playheadX: number,
): ProjectedColumnGeo {
  const normX = clamp(playheadX, 0, 1);
  const targetCol = Math.min(outW - 1, Math.max(0, Math.floor(normX * (outW - 1))));

  let weightTotal = 0;
  let weightedLatSum = 0;
  let weightedLonSin = 0;
  let weightedLonCos = 0;
  let weightedDiskY = 0;

  for (let py = 0; py < outH; py++) {
    const diskY = 1 - ((py + 0.5) / outH) * 2;
    for (let px = 0; px < outW; px++) {
      const diskX = ((px + 0.5) / outW) * 2 - 1;
      const outIdx = (py * outW + px) * 4;

      // Descarte rápido fuera de la envolvente circular aproximada
      if (diskX * diskX + diskY * diskY > 1.02) {
        outData[outIdx] = 0;
        outData[outIdx + 1] = 0;
        outData[outIdx + 2] = 0;
        outData[outIdx + 3] = 0;
        continue;
      }

      const hit = raycastGlobeDisk(diskX, diskY, view);
      if (!hit) {
        outData[outIdx] = 0;
        outData[outIdx + 1] = 0;
        outData[outIdx + 2] = 0;
        outData[outIdx + 3] = 0;
        continue;
      }

      const sx = Math.min(eqW - 1, Math.max(0, Math.floor(hit.u * eqW)));
      const sy = Math.min(eqH - 1, Math.max(0, Math.floor(hit.v * eqH)));
      const srcIdx = (sy * eqW + sx) * 4;

      const r = eqData[srcIdx];
      const g = eqData[srcIdx + 1];
      const b = eqData[srcIdx + 2];

      outData[outIdx] = r;
      outData[outIdx + 1] = g;
      outData[outIdx + 2] = b;
      outData[outIdx + 3] = 255;

      if (px === targetCol) {
        const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        const hotspot = clamp((r - Math.max(g, b) * 0.85) / 140, 0, 1);
        const canopy = clamp((g - Math.max(r, b) * 0.9) / 110, 0, 1);
        const energy = clamp(Math.max(lum * 0.75, hotspot, canopy), 0, 1);
        const w = energy * energy + 0.015;

        const lonRad = (hit.lonDeg * Math.PI) / 180;
        weightedLatSum += hit.latDeg * w;
        weightedLonSin += Math.sin(lonRad) * w;
        weightedLonCos += Math.cos(lonRad) * w;
        weightedDiskY += diskY * w;
        weightTotal += w;
      }
    }
  }

  const beamViewportX = clamp(0.5 + (normX - 0.5) * 2 * view.diskRadiusX, 0.02, 0.98);

  if (weightTotal <= 0) {
    return {
      longitudeDeg: 0,
      latitudeDeg: 0,
      reticleViewportY: 0.5,
      beamViewportX,
    };
  }

  const meanLonRad = Math.atan2(weightedLonSin, weightedLonCos);
  const longitudeDeg = Number(((meanLonRad * 180) / Math.PI).toFixed(1));
  const latitudeDeg = Number((weightedLatSum / weightTotal).toFixed(1));
  const meanDiskY = weightedDiskY / weightTotal;
  const reticleViewportY = clamp(0.5 - meanDiskY * view.diskRadiusY, 0.08, 0.92);

  return {
    longitudeDeg,
    latitudeDeg,
    reticleViewportY,
    beamViewportX,
  };
}
