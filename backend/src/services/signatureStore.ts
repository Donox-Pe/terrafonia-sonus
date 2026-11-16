import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  PresetSummary,
  RegionBounds,
  SoundSignature,
  VariableName,
  VariableReading,
} from "../types/soundSignature.js";

interface SimulatedPresetSeed {
  id: string;
  label: string;
  region: RegionBounds;
  base: Record<VariableName, number | null>;
}

const SIMULATED_SEEDS: Record<string, SimulatedPresetSeed> = {
  amazonia: {
    id: "amazonia",
    label: "Amazonia · Pulso Biótico (Simulado)",
    region: { name: "Cuenca Amazónica", lat: [-12, 2], lon: [-74, -52] },
    base: {
      t2m: 301.8,
      qv2m: 0.0175,
      u10m: -3.4,
      v10m: 1.2,
      ndvi: 0.81,
      fireCount: 14,
      cloudFraction: 0.42,
    },
  },
  artico: {
    id: "artico",
    label: "Ártico · Criósfera (Simulado)",
    region: { name: "Océano Ártico / Svalbard", lat: [70, 84], lon: [-20, 45] },
    base: {
      t2m: 259.4,
      qv2m: 0.0014,
      u10m: 8.9,
      v10m: -4.6,
      ndvi: 0.06,
      fireCount: 0,
      cloudFraction: 0.68,
    },
  },
  sahara: {
    id: "sahara",
    label: "Sahara · Convección Térmica (Simulado)",
    region: { name: "Desierto del Sahara Central", lat: [16, 29], lon: [-4, 22] },
    base: {
      t2m: 310.5,
      qv2m: 0.0038,
      u10m: 6.8,
      v10m: 2.9,
      ndvi: 0.08,
      fireCount: 4,
      cloudFraction: 0.09,
    },
  },
  pacifico: {
    id: "pacifico",
    label: "Pacífico Ecuatorial · Alisios (Simulado)",
    region: { name: "Pacífico Tropical Central", lat: [-6, 6], lon: [-165, -115] },
    base: {
      t2m: 299.9,
      qv2m: 0.0182,
      u10m: -9.4,
      v10m: -1.8,
      ndvi: 0,
      fireCount: 0,
      cloudFraction: 0.54,
    },
  },
  missing_dropout: {
    id: "missing_dropout",
    label: "Prueba Calidad · Dato Faltante (null, Simulado)",
    region: { name: "Órbita con pérdida parcial", lat: [-30, 30], lon: [-90, 30] },
    base: {
      t2m: 292.1,
      qv2m: null,
      u10m: 4.1,
      v10m: -2.0,
      ndvi: null,
      fireCount: 7,
      cloudFraction: 0.91,
    },
  },
};

const VARIABLE_META: Record<VariableName, { unit: string; source: string }> = {
  t2m: { unit: "K", source: "SIMULATED · MERRA-2 [VERIFICAR T2M]" },
  qv2m: { unit: "kg kg-1", source: "SIMULATED · MERRA-2 [VERIFICAR QV2M]" },
  u10m: { unit: "m s-1", source: "SIMULATED · MERRA-2 [VERIFICAR U10M]" },
  v10m: { unit: "m s-1", source: "SIMULATED · MERRA-2 [VERIFICAR V10M]" },
  ndvi: { unit: "dimensionless", source: "SIMULATED · MODIS [VERIFICAR NDVI]" },
  fireCount: { unit: "count", source: "SIMULATED · MODIS [VERIFICAR ActiveFire]" },
  cloudFraction: { unit: "dimensionless", source: "SIMULATED · MODIS [VERIFICAR CloudFraction]" },
};

function makeReading(name: VariableName, raw: number | null): VariableReading {
  const meta = VARIABLE_META[name];
  // Regla científica: null / no finito jamás se convierte en 0.
  if (raw === null || !Number.isFinite(raw)) {
    return { value: null, unit: meta.unit, quality: "missing", source: meta.source };
  }
  return {
    value: Number(raw.toFixed(6)),
    unit: meta.unit,
    quality: "ok",
    source: meta.source,
  };
}

function modulateSeedValue(name: VariableName, base: number | null, phase: number): number | null {
  if (base === null || !Number.isFinite(base)) return null;
  const s = Math.sin(phase);
  const c = Math.cos(phase * 0.7);
  switch (name) {
    case "t2m":
      return base + 1.8 * s;
    case "qv2m":
      return Math.max(0, base + 0.0012 * c);
    case "u10m":
      return base + 2.4 * s;
    case "v10m":
      return base + 1.6 * c;
    case "ndvi":
      return Math.max(-1, Math.min(1, base + 0.04 * Math.sin(phase * 0.5)));
    case "fireCount":
      return base === 0 ? 0 : Math.max(0, Math.round(base + 3 * Math.max(0, c)));
    case "cloudFraction":
      return Math.max(0, Math.min(1, base + 0.12 * Math.sin(phase * 0.5)));
  }
}

function resolveDefaultCacheDir(): string {
  const fromBackend = path.resolve(process.cwd(), "..", "data", "signatures");
  const fromRoot = path.resolve(process.cwd(), "data", "signatures");
  return fs.existsSync(fromRoot) && !fs.existsSync(fromBackend) ? fromRoot : fromBackend;
}

function parseEnvCredentialsConfigured(envFile: string): boolean {
  try {
    if (!fs.existsSync(envFile)) return false;
    const raw = fs.readFileSync(envFile, "utf-8");
    const kv: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const idx = trimmed.indexOf("=");
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1).trim();
      }
      if (k && v && v !== "tu_usuario_earthdata" && v !== "tu_password_earthdata") {
        kv[k] = v;
      }
    }
    return Boolean(kv.EARTHDATA_TOKEN || (kv.EARTHDATA_USERNAME && kv.EARTHDATA_PASSWORD));
  } catch {
    return false;
  }
}

function hasEarthdataCredentialsConfigured(): boolean {
  if (process.env.EARTHDATA_TOKEN || (process.env.EARTHDATA_USERNAME && process.env.EARTHDATA_PASSWORD)) {
    return true;
  }
  const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
  ];
  if (envCandidates.some(parseEnvCredentialsConfigured)) {
    return true;
  }
  const home = os.homedir();
  for (const name of [".netrc", "_netrc"]) {
    const file = path.join(home, name);
    try {
      if (fs.existsSync(file) && fs.readFileSync(file, "utf-8").includes("urs.earthdata.nasa.gov")) {
        return true;
      }
    } catch {
      // Ignora permisos locales sin propagar fallo.
    }
  }
  return false;
}

export class SignatureStore {
  private readonly cacheDir: string;

  constructor(cacheDir = resolveDefaultCacheDir()) {
    this.cacheDir = cacheDir;
  }

  private readCachedSignature(presetId: string): SoundSignature | null {
    const candidate = path.join(this.cacheDir, `${presetId}.json`);
    if (!fs.existsSync(candidate)) return null;
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8")) as SoundSignature;
      if (parsed && parsed.schemaVersion === "1.0.0" && parsed.variables) {
        return parsed;
      }
    } catch {
      return null;
    }
    return null;
  }

  listPresets(): PresetSummary[] {
    return Object.values(SIMULATED_SEEDS).map((seed) => {
      const cached = this.readCachedSignature(seed.id);
      const isNasa = cached?.provenance?.origin === "nasa" && cached?.provenance?.verified === true;
      return {
        id: seed.id,
        label: isNasa ? cached.presetLabel : seed.label,
        regionName: seed.region.name,
        origin: isNasa ? "nasa" : "simulated",
        hasMissingDemo: isNasa
          ? Object.values(cached.variables).some((v) => v.value === null)
          : Object.values(seed.base).some((v) => v === null),
      };
    });
  }

  getProvenanceSummary() {
    const cachedFiles = this.listCachedFiles();
    const verifiedNasaFiles = cachedFiles.filter((file) => {
      const parsed = this.readCachedSignature(file.replace(/\.json$/i, ""));
      return parsed?.provenance?.origin === "nasa" && parsed?.provenance?.verified === true;
    });
    const verifiedNasaDataAvailable = verifiedNasaFiles.length > 0;
    const earthdataConfigured = hasEarthdataCredentialsConfigured();
    return {
      mode: verifiedNasaDataAvailable ? ("hybrid" as const) : ("simulated" as const),
      verifiedNasaDataAvailable,
      earthdataConfigured,
      cacheDirectory: this.cacheDir,
      cachedFilesFound: cachedFiles,
      verifiedNasaFiles,
      notice: verifiedNasaDataAvailable
        ? `Caché local contiene ${verifiedNasaFiles.length} paquete(s) verificados NASA MERRA-2 (M2T1NXSLV). Presets sin caché siguen siendo simulados.`
        : "Todos los paquetes actuales son SIMULADOS. No hay paquetes NASA verificados en caché local (ejecuta ingest/merra2/earthdata_fetcher.py tras configurar Earthdata).",
    };
  }

  private listCachedFiles(): string[] {
    if (!fs.existsSync(this.cacheDir)) return [];
    return fs.readdirSync(this.cacheDir).filter((f) => f.endsWith(".json"));
  }

  /**
   * Obtiene un SoundSignature por preset, fecha y fase temporal.
   * Si existe un archivo NASA verificado o pregenerado por ingest/ en data/signatures/ cuando phase===0
   * lo lee respetando su metadata; de lo contrario genera el paquete simulado etiquetado.
   */
  getSignature(options: { presetId?: string; date?: string; phase?: number } = {}): SoundSignature {
    const presetId = options.presetId && SIMULATED_SEEDS[options.presetId] ? options.presetId : "amazonia";
    const phase = Number.isFinite(options.phase) ? Number(options.phase) : 0;
    const timestamp = options.date ? `${options.date}T12:00:00Z` : "2026-11-11T12:00:00Z";

    const cached = this.readCachedSignature(presetId);
    if (cached && (phase === 0 || (cached.provenance.origin === "nasa" && cached.provenance.verified))) {
      return cached.provenance.origin === "nasa" ? cached : { ...cached, timestamp };
    }

    const seed = SIMULATED_SEEDS[presetId];
    const variables = {} as Record<VariableName, VariableReading>;
    for (const key of Object.keys(VARIABLE_META) as VariableName[]) {
      const val = modulateSeedValue(key, seed.base[key], phase);
      variables[key] = makeReading(key, val);
    }

    return {
      schemaVersion: "1.0.0",
      id: `${seed.id}-${timestamp}`,
      presetId: seed.id,
      presetLabel: seed.label,
      timestamp,
      region: seed.region,
      variables,
      provenance: {
        origin: "simulated",
        products: [
          "MERRA-2 [VERIFICAR colección M2T1NXSLV]",
          "MODIS [VERIFICAR productos MOD13/MOD14/MOD06]",
        ],
        retrievedAt: new Date().toISOString(),
        verified: false,
        notes:
          "Datos sintéticos generados localmente (sin credenciales NASA Earthdata). Valores faltantes preservados como null.",
      },
    };
  }
}
