/**
 * Generador y cargador de texturas planetarias para TerraFonía · SONUS.
 *
 * Capas visuales:
 * 1. Base local procedural (`640×320`) inmediata para inicio sin latencia ni red.
 * 2. Descarga pública sin credenciales (CORS) de NASA GIBS WMS (`BlueMarble_ShadedRelief_Bathymetry`
 *    a `2048×1024`) para realismo fotográfico del planeta en vivo.
 * 3. Cubierta de nubes volumétrica (`1024×512`) generada con turbulencia domain-warped fBm
 *    (bandas ciclónicas, sistemas frontales y cúmulos ecuatoriales) para la esfera 3D superior.
 *
 * Rigor científico: cuando se carga la imagen estática pública Blue Marble de NASA GIBS se declara
 * explícitamente como referencia visual, manteniendo los valores numéricos etiquetados como simulados.
 */

type LonLat = [number, number];

export type EarthVisualOrigin = "nasa-gibs-bluemarble" | "synthetic-local";

interface ContinentPolygon {
  id: string;
  points: LonLat[];
}

const CONTINENT_POLYGONS: ContinentPolygon[] = [
  {
    id: "north_america",
    points: [
      [-168, 66], [-161, 59], [-152, 60], [-141, 60], [-134, 57], [-126, 50],
      [-124, 42], [-118, 33], [-111, 24], [-105, 20], [-95, 16], [-87, 14],
      [-83, 10], [-79, 9], [-81, 15], [-88, 21], [-90, 21], [-97, 22],
      [-97, 26], [-90, 29], [-83, 29], [-81, 25], [-80, 31], [-75, 36],
      [-70, 42], [-66, 45], [-60, 46], [-56, 52], [-64, 59], [-76, 62],
      [-80, 52], [-92, 57], [-95, 62], [-86, 67], [-95, 70], [-115, 71],
      [-136, 69], [-156, 71], [-166, 68],
    ],
  },
  {
    id: "greenland",
    points: [
      [-52, 60], [-43, 60], [-36, 66], [-22, 70], [-18, 77], [-25, 82],
      [-48, 83], [-68, 77], [-55, 70], [-53, 64],
    ],
  },
  {
    id: "south_america",
    points: [
      [-78, 9], [-75, 11], [-68, 11], [-61, 10], [-52, 5], [-49, 0],
      [-40, -3], [-35, -6], [-35, -10], [-39, -15], [-40, -21], [-48, -26],
      [-53, -33], [-58, -38], [-65, -43], [-67, -48], [-69, -54], [-74, -53],
      [-75, -45], [-72, -37], [-71, -29], [-70, -18], [-77, -12], [-81, -5],
      [-80, 2], [-77, 7],
    ],
  },
  {
    id: "africa",
    points: [
      [-17, 15], [-16, 22], [-10, 30], [-6, 36], [3, 37], [11, 37], [12, 33],
      [22, 33], [32, 31], [34, 27], [39, 19], [43, 12], [51, 12], [49, 5],
      [41, -2], [40, -11], [35, -20], [33, -26], [28, -33], [19, -35],
      [15, -28], [12, -16], [12, -6], [9, 4], [2, 6], [-8, 5], [-15, 11],
    ],
  },
  {
    id: "madagascar",
    points: [[44, -25], [47, -25], [50, -15], [49, -12], [44, -17]],
  },
  {
    id: "eurasia",
    points: [
      [-9, 37], [-9, 43], [-2, 44], [-5, 48], [2, 51], [8, 54], [8, 57],
      [12, 56], [5, 60], [12, 66], [22, 70], [32, 70], [42, 68], [58, 69],
      [72, 72], [95, 76], [115, 74], [140, 72], [172, 67], [178, 65],
      [162, 59], [156, 51], [142, 54], [136, 44], [129, 36], [126, 35],
      [121, 39], [118, 36], [122, 30], [115, 22], [108, 17], [109, 12],
      [104, 8], [100, 13], [104, 2], [99, 7], [96, 16], [90, 22],
      [81, 15], [77, 8], [72, 20], [67, 25], [57, 26], [50, 29], [56, 22],
      [52, 16], [43, 13], [35, 29], [36, 36], [27, 37], [26, 41], [23, 38],
      [19, 41], [15, 44], [12, 40], [16, 38], [12, 42], [6, 43], [1, 41], [-5, 36],
    ],
  },
  {
    id: "uk_ireland",
    points: [[-6, 50], [1, 51], [0, 55], [-5, 58], [-8, 54]],
  },
  {
    id: "japan",
    points: [[130, 32], [135, 34], [140, 36], [141, 42], [145, 44], [139, 41], [136, 37]],
  },
  {
    id: "indonesia_borneo",
    points: [[96, 5], [105, -5], [114, -7], [118, 4], [109, 2], [100, -1]],
  },
  {
    id: "australia",
    points: [
      [114, -22], [122, -17], [131, -12], [136, -12], [141, -17], [145, -14],
      [150, -22], [153, -28], [150, -37], [142, -38], [135, -35], [129, -32],
      [121, -34], [115, -34], [114, -27],
    ],
  },
  {
    id: "new_zealand",
    points: [[167, -46], [172, -43], [178, -37], [175, -35], [171, -41]],
  },
  {
    id: "antarctica",
    points: [
      [-180, -76], [-150, -78], [-120, -74], [-90, -73], [-64, -64], [-58, -66],
      [-45, -76], [-20, -73], [10, -70], [45, -68], [80, -67], [115, -66],
      [145, -67], [168, -72], [180, -76], [180, -90], [-180, -90],
    ],
  },
];

function hash2(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);

  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);

  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function fbm(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq);
    freq *= 2.04;
    amp *= 0.5;
  }
  return sum;
}

function pointInPoly(lon: number, lat: number, poly: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isLand(lon: number, lat: number): boolean {
  for (const poly of CONTINENT_POLYGONS) {
    if (pointInPoly(lon, lat, poly.points)) return true;
  }
  return false;
}

export interface EarthBaseAssets {
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

const LOCAL_AND_NASA_URLS = [
  "/textures/earth_atmos_2048.jpg",
  "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=BlueMarble_ShadedRelief_Bathymetry&STYLES=default&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg",
  "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=BlueMarble_NextGeneration&STYLES=default&SRS=EPSG:4326&BBOX=-180,-90,180,90&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg",
];

let cachedSynthetic: EarthBaseAssets | null = null;
let cachedNasaBlueMarble: EarthBaseAssets | null = null;
let cachedCloudsCanvas: HTMLCanvasElement | null = null;
let cachedCloudsTextureRef: { needsUpdate: boolean } | null = null;

export function registerCloudTexture(t: { needsUpdate: boolean }) {
  cachedCloudsTextureRef = t;
}
let nasaFetchStarted = false;
const nasaListeners = new Set<(origin: EarthVisualOrigin) => void>();

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));

function buildSyntheticFallback(): EarthBaseAssets | null {
  if (typeof document === "undefined") return null;
  if (cachedSynthetic) return cachedSynthetic;

  const width = 640;
  const height = 320;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const img = ctx.createImageData(width, height);
  const data = img.data;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const lat = 90 - v * 180;
    const absLat = Math.abs(lat);

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const lon = -180 + u * 360;
      const off = (y * width + x) * 4;

      const coastWarpLon = (fbm(u * 14 + 3.1, v * 7 + 1.4, 3) - 0.5) * 4.4;
      const coastWarpLat = (fbm(u * 14 + 9.2, v * 7 + 5.8, 3) - 0.5) * 3.4;
      const land = isLand(lon + coastWarpLon, lat + coastWarpLat);

      const terrain = fbm(u * 18 + 2.5, v * 9 + 1.7, 5);
      const detail = fbm(u * 42 + 8.1, v * 21 + 4.3, 3);

      let r = 0;
      let g = 0;
      let b = 0;

      if (!land) {
        const abyss = fbm(u * 11, v * 6, 3);
        const shelf =
          isLand(lon + coastWarpLon * 1.6 + 2.2, lat + coastWarpLat * 1.6 + 1.5) ||
          isLand(lon + coastWarpLon * 1.6 - 2.2, lat + coastWarpLat * 1.6 - 1.5)
            ? 1
            : 0;
        const polarSea = absLat > 74 ? Math.min(1, (absLat - 74) / 10) * detail : 0;

        r = 7 + abyss * 14 + shelf * 14 + polarSea * 145;
        g = 24 + abyss * 32 + shelf * 46 + polarSea * 165;
        b = 58 + abyss * 42 + shelf * 56 + polarSea * 155;
      } else {
        const inSaharaArabia = lon > -17 && lon < 62 && lat > 13 && lat < 34;
        const inAusDesert = lon > 116 && lon < 143 && lat > -30 && lat < -18;
        const inAtacama = lon > -74 && lon < -64 && lat > -32 && lat < -15;
        const inSouthwestUS = lon > -118 && lon < -99 && lat > 23 && lat < 38;
        const inGobi = lon > 76 && lon < 112 && lat > 36 && lat < 47;

        const desertWeight =
          inSaharaArabia || inAusDesert || inAtacama || inSouthwestUS || inGobi
            ? 0.72 + terrain * 0.28
            : 0;

        const tropical = Math.exp(-Math.pow(lat / 22, 2));
        const greenness =
          Math.max(0, 1 - desertWeight) * (0.35 + 0.65 * tropical) * (0.65 + detail * 0.5);

        const snowWeight = Math.max(
          0,
          Math.min(
            1,
            absLat > 65 ? (absLat - 65) / 12 + (terrain - 0.5) * 0.5 : (terrain - 0.74) * 3.8,
          ),
        );

        const forestR = 26 + detail * 28;
        const forestG = 68 + greenness * 62 + detail * 20;
        const forestB = 34 + detail * 16;

        const aridR = 148 + terrain * 52 + detail * 24;
        const aridG = 122 + terrain * 42 + detail * 18;
        const aridB = 78 + terrain * 28;

        r = forestR * (1 - desertWeight) + aridR * desertWeight;
        g = forestG * (1 - desertWeight) + aridG * desertWeight;
        b = forestB * (1 - desertWeight) + aridB * desertWeight;

        const ridge = Math.max(0, terrain - 0.52) * 1.45;
        r -= ridge * 24;
        g -= ridge * 22;
        b -= ridge * 16;

        if (snowWeight > 0) {
          const s = Math.min(1, snowWeight);
          r = r * (1 - s) + 216 * s;
          g = g * (1 - s) + 230 * s;
          b = b * (1 - s) + 244 * s;
        }
      }

      data[off] = clampByte(r);
      data[off + 1] = clampByte(g);
      data[off + 2] = clampByte(b);
      data[off + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  cachedSynthetic = { width, height, canvas };
  return cachedSynthetic;
}

/** Devuelve el mapa terrestre activo (NASA Blue Marble cuando se descargó, si no el sintético local). */
export function getEarthBaseAssets(): EarthBaseAssets | null {
  if (cachedNasaBlueMarble) return cachedNasaBlueMarble;

  // Si aún no ha cargado, dispara la carga de inmediato
  subscribeNasaBlueMarble(() => {});

  if (cachedNasaBlueMarble) return cachedNasaBlueMarble;
  return buildSyntheticFallback();
}

export function getEarthVisualOrigin(): EarthVisualOrigin {
  return cachedNasaBlueMarble ? "nasa-gibs-bluemarble" : "synthetic-local";
}

/**
 * Descarga en segundo plano la capa pública CORS-enabled BlueMarble_ShadedRelief_Bathymetry
 * de NASA GIBS (sin requerir cuenta Earthdata) y notifica cuando queda lista para WebGL y análisis.
 */
export function subscribeNasaBlueMarble(
  onReady: (origin: EarthVisualOrigin) => void,
): () => void {
  if (typeof document === "undefined" || typeof Image === "undefined") {
    return () => {};
  }

  if (cachedNasaBlueMarble) {
    onReady("nasa-gibs-bluemarble");
    return () => {};
  }

  nasaListeners.add(onReady);

  if (!nasaFetchStarted) {
    nasaFetchStarted = true;

    // Carga síncrona/inmediata del asset local fotográfico si existe en el DOM
    const localImg = new Image();
    localImg.src = "/textures/earth_atmos_2048.jpg";
    localImg.onload = () => {
      const w = localImg.naturalWidth || 2048;
      const h = localImg.naturalHeight || 1024;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(localImg, 0, 0, w, h);
        cachedNasaBlueMarble = { width: w, height: h, canvas };
        nasaListeners.forEach((cb) => cb("nasa-gibs-bluemarble"));
      }
    };

    const tryLoad = (idx: number) => {
      if (cachedNasaBlueMarble) return;
      if (idx >= LOCAL_AND_NASA_URLS.length) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => {
        if (cachedNasaBlueMarble) return;
        const w = img.naturalWidth || 2048;
        const h = img.naturalHeight || 1024;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        cachedNasaBlueMarble = { width: w, height: h, canvas };
        nasaListeners.forEach((cb) => cb("nasa-gibs-bluemarble"));
      };
      img.onerror = () => {
        tryLoad(idx + 1);
      };
      img.src = LOCAL_AND_NASA_URLS[idx];
    };

    tryLoad(0);
  }

  return () => {
    nasaListeners.delete(onReady);
  };
}

/**
 * Construye una cubierta de nubes procedural de alta resolución (`1024×512`) con turbulencia
 * *domain-warped fBm* (bandas ciclónicas, cúmulos ITCZ y claros subtropicales) para la capa 3D superior.
 */
export function getCloudDeckCanvas(): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  if (cachedCloudsCanvas) return cachedCloudsCanvas;

  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Carga inmediata de textura real de nubes fotográfica si está en public/textures
  const cloudImg = new Image();
  cloudImg.src = "/textures/earth_clouds_1024.png";
  cloudImg.onload = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(cloudImg, 0, 0, width, height);
    if (cachedCloudsTextureRef) {
      cachedCloudsTextureRef.needsUpdate = true;
    }
  };

  const img = ctx.createImageData(width, height);
  const data = img.data;

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const latRad = (0.5 - v) * Math.PI;
    // Zonas de nubosidad natural: ITCZ ecuatorial + bandas frontales templadas (~45°-65°), claros subtropicales
    const eqBand = Math.exp(-Math.pow((latRad - 0.08) / 0.24, 2)) * 0.22;
    const stormBelt = Math.exp(-Math.pow((Math.abs(latRad) - 0.85) / 0.34, 2)) * 0.26;
    const zonalBias = eqBand + stormBelt;

    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      // Domain warping periódico en longitud para remolinos atmosféricos sin costura en ±180°
      const angle = u * Math.PI * 2;
      const sx = Math.cos(angle) * 2.2 + 4.1;
      const sy = Math.sin(angle) * 2.2 + 7.3;
      const sv = v * 5.8;

      const wx = fbm(sx + sv * 0.4, sv + sy * 0.4, 3);
      const wy = fbm(sy + 5.2, sv + sx * 0.35 + 2.9, 3);

      const swirl = fbm(sx * 1.45 + wx * 1.9, sv * 1.65 + wy * 1.9, 5);
      const wisps = fbm(sx * 4.2 + wx * 2.5, sv * 4.8 - wy * 2.1, 3);

      const density = swirl * 0.72 + wisps * 0.28 + zonalBias;
      const alpha = Math.max(0, Math.min(1, (density - 0.56) * 2.55));
      const softened = Math.pow(alpha, 1.15);

      const off = (y * width + x) * 4;
      data[off] = 248;
      data[off + 1] = 251;
      data[off + 2] = 255;
      data[off + 3] = clampByte(softened * 245);
    }
  }

  ctx.putImageData(img, 0, 0);
  cachedCloudsCanvas = canvas;
  return cachedCloudsCanvas;
}
