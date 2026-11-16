/**
 * Contrato de datos SoundSignature (espejo estricto de ingest/signature/schema.py).
 * El backend transporta estos objetos sin reinterpretar variables científicas.
 */

export type QualityFlag = "ok" | "missing" | "suspect";
export type OriginFlag = "nasa" | "simulated";

export interface VariableReading {
  value: number | null;
  unit: string;
  quality: QualityFlag;
  source: string;
}

export interface RegionBounds {
  name: string;
  lat: [number, number];
  lon: [number, number];
}

export interface ProvenanceInfo {
  origin: OriginFlag;
  products: string[];
  retrievedAt: string;
  verified: boolean;
  notes: string;
}

export type VariableName =
  | "t2m"
  | "qv2m"
  | "u10m"
  | "v10m"
  | "ndvi"
  | "fireCount"
  | "cloudFraction";

export interface SoundSignature {
  schemaVersion: "1.0.0";
  id: string;
  presetId: string;
  presetLabel: string;
  timestamp: string;
  region: RegionBounds;
  variables: Record<VariableName, VariableReading>;
  provenance: ProvenanceInfo;
}

export interface PresetSummary {
  id: string;
  label: string;
  regionName: string;
  origin: OriginFlag;
  hasMissingDemo: boolean;
}
