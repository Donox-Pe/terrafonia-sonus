import { io, type Socket } from "socket.io-client";
import type {
  PresetSummary,
  SoundSignature,
  VariableName,
  VariableReading,
} from "../types/soundSignature";

export type TransportMode = "backend-live" | "local-fallback";

export interface SignatureClientCallbacks {
  onSignature: (sig: SoundSignature) => void;
  onTransportChange: (mode: TransportMode, detail: string) => void;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:4000";

export const LOCAL_PRESETS: PresetSummary[] = [
  {
    id: "amazonia",
    label: "Amazon · Biotic Pulse (Simulated)",
    regionName: "Amazon Basin",
    origin: "simulated",
    hasMissingDemo: false,
  },
  {
    id: "artico",
    label: "Arctic · Cryosphere (Simulated)",
    regionName: "Arctic Ocean / Svalbard",
    origin: "simulated",
    hasMissingDemo: false,
  },
  {
    id: "sahara",
    label: "Sahara · Thermal Convection (Simulated)",
    regionName: "Central Sahara Desert",
    origin: "simulated",
    hasMissingDemo: false,
  },
  {
    id: "pacifico",
    label: "Equatorial Pacific · Trade Winds (Simulated)",
    regionName: "Central Tropical Pacific",
    origin: "simulated",
    hasMissingDemo: false,
  },
  {
    id: "missing_dropout",
    label: "Quality Test · Missing Data (null, Simulated)",
    regionName: "Partial Dropout Orbit",
    origin: "simulated",
    hasMissingDemo: true,
  },
];

const LOCAL_BASE: Record<string, {
  region: SoundSignature["region"];
  label: string;
  vals: Record<VariableName, number | null>;
}> = {
  amazonia: {
    label: "Amazon · Biotic Pulse (Simulated)",
    region: { name: "Amazon Basin", lat: [-12, 2], lon: [-74, -52] },
    vals: { t2m: 301.8, qv2m: 0.0175, u10m: -3.4, v10m: 1.2, ndvi: 0.81, fireCount: 14, cloudFraction: 0.42 },
  },
  artico: {
    label: "Arctic · Cryosphere (Simulated)",
    region: { name: "Arctic Ocean / Svalbard", lat: [70, 84], lon: [-20, 45] },
    vals: { t2m: 259.4, qv2m: 0.0014, u10m: 8.9, v10m: -4.6, ndvi: 0.06, fireCount: 0, cloudFraction: 0.68 },
  },
  sahara: {
    label: "Sahara · Thermal Convection (Simulated)",
    region: { name: "Central Sahara Desert", lat: [16, 29], lon: [-4, 22] },
    vals: { t2m: 310.5, qv2m: 0.0038, u10m: 6.8, v10m: 2.9, ndvi: 0.08, fireCount: 4, cloudFraction: 0.09 },
  },
  pacifico: {
    label: "Equatorial Pacific · Trade Winds (Simulated)",
    region: { name: "Central Tropical Pacific", lat: [-6, 6], lon: [-165, -115] },
    vals: { t2m: 299.9, qv2m: 0.0182, u10m: -9.4, v10m: -1.8, ndvi: 0, fireCount: 0, cloudFraction: 0.54 },
  },
  missing_dropout: {
    label: "Quality Test · Missing Data (null, Simulated)",
    region: { name: "Partial Dropout Orbit", lat: [-30, 30], lon: [-90, 30] },
    vals: { t2m: 292.1, qv2m: null, u10m: 4.1, v10m: -2.0, ndvi: null, fireCount: 7, cloudFraction: 0.91 },
  },
};

const UNITS: Record<VariableName, string> = {
  t2m: "K",
  qv2m: "kg kg-1",
  u10m: "m s-1",
  v10m: "m s-1",
  ndvi: "dimensionless",
  fireCount: "count",
  cloudFraction: "dimensionless",
};

export function createLocalFallbackSignature(
  presetId: string,
  date: string,
  phase: number,
): SoundSignature {
  const seed = LOCAL_BASE[presetId] ?? LOCAL_BASE.amazonia;
  const s = Math.sin(phase);
  const c = Math.cos(phase * 0.7);

  const modulate = (k: VariableName, raw: number | null): VariableReading => {
    if (raw === null || !Number.isFinite(raw)) {
      return {
        value: null,
        unit: UNITS[k],
        quality: "missing",
        source: `LOCAL-SIMULATED · [VERIFICAR ${k.toUpperCase()}]`,
      };
    }
    let v = raw;
    if (k === "t2m") v += 1.8 * s;
    else if (k === "qv2m") v = Math.max(0, v + 0.0012 * c);
    else if (k === "u10m") v += 2.4 * s;
    else if (k === "v10m") v += 1.6 * c;
    else if (k === "ndvi") v = Math.max(-1, Math.min(1, v + 0.04 * Math.sin(phase * 0.5)));
    else if (k === "fireCount") v = v === 0 ? 0 : Math.max(0, Math.round(v + 3 * Math.max(0, c)));
    else if (k === "cloudFraction") v = Math.max(0, Math.min(1, v + 0.12 * Math.sin(phase * 0.5)));

    return {
      value: Number(v.toFixed(6)),
      unit: UNITS[k],
      quality: "ok",
      source: `LOCAL-SIMULATED · [VERIFICAR ${k.toUpperCase()}]`,
    };
  };

  const variables = {} as Record<VariableName, VariableReading>;
  (Object.keys(UNITS) as VariableName[]).forEach((k) => {
    variables[k] = modulate(k, seed.vals[k]);
  });

  return {
    schemaVersion: "1.0.0",
    id: `${presetId}-${date}`,
    presetId,
    presetLabel: seed.label,
    timestamp: `${date}T12:00:00Z`,
    region: seed.region,
    variables,
    provenance: {
      origin: "simulated",
      products: ["MERRA-2 [VERIFICAR]", "MODIS [VERIFICAR]"],
      retrievedAt: new Date().toISOString(),
      verified: false,
      notes: "Respaldo local en navegador (backend offline). Datos simulados; valores faltantes como null.",
    },
  };
}

/**
 * Cliente híbrido REST + Socket.IO con respaldo automático local etiquetado
 * si el servidor Express no está corriendo todavía.
 */
export class SignatureClient {
  private socket: Socket | null = null;
  private localTimer: number | null = null;
  private phase = 0;
  private presetId = "amazonia";
  private date = "2026-11-11";
  private running = false;
  private mode: TransportMode = "local-fallback";
  private readonly cb: SignatureClientCallbacks;

  constructor(cb: SignatureClientCallbacks) {
    this.cb = cb;
  }

  connect(): void {
    this.startLocalFallback("Conectando con backend...");
    try {
      const sock = io(BACKEND_URL, {
        transports: ["websocket", "polling"],
        reconnectionAttempts: 3,
        timeout: 2500,
      });
      this.socket = sock;

      sock.on("connect", () => {
        this.mode = "backend-live";
        this.stopLocalTimer();
        this.cb.onTransportChange("backend-live", `Socket.IO activo (${BACKEND_URL})`);
        sock.emit("stream:configure", {
          presetId: this.presetId,
          date: this.date,
          running: this.running,
          intervalMs: 750,
        });
      });

      sock.on("signature:update", (sig: SoundSignature) => {
        this.cb.onSignature(sig);
      });

      sock.on("connect_error", () => {
        if (this.mode !== "local-fallback") {
          this.mode = "local-fallback";
        }
        this.startLocalFallback("Backend offline · modo simulador local");
      });

      sock.on("disconnect", () => {
        this.mode = "local-fallback";
        this.startLocalFallback("Desconectado del backend · modo simulador local");
      });
    } catch {
      this.startLocalFallback("Sin socket · modo simulador local");
    }
  }

  configure(opts: { presetId?: string; date?: string; running?: boolean }): void {
    if (opts.presetId) this.presetId = opts.presetId;
    if (opts.date) this.date = opts.date;
    if (typeof opts.running === "boolean") this.running = opts.running;

    if (this.socket?.connected) {
      this.socket.emit("stream:configure", {
        presetId: this.presetId,
        date: this.date,
        running: this.running,
        intervalMs: 750,
      });
    } else {
      this.cb.onSignature(createLocalFallbackSignature(this.presetId, this.date, this.phase));
      this.restartLocalTimer();
    }
  }

  private startLocalFallback(reason: string): void {
    this.cb.onTransportChange("local-fallback", reason);
    this.cb.onSignature(createLocalFallbackSignature(this.presetId, this.date, this.phase));
    this.restartLocalTimer();
  }

  private restartLocalTimer(): void {
    this.stopLocalTimer();
    if (!this.running || this.mode === "backend-live") return;
    this.localTimer = window.setInterval(() => {
      this.phase += 0.22;
      this.cb.onSignature(createLocalFallbackSignature(this.presetId, this.date, this.phase));
    }, 750);
  }

  private stopLocalTimer(): void {
    if (this.localTimer !== null) {
      window.clearInterval(this.localTimer);
      this.localTimer = null;
    }
  }

  dispose(): void {
    this.stopLocalTimer();
    this.socket?.disconnect();
    this.socket = null;
  }
}
