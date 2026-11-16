"""Generador de SoundSignature combinando adaptadores MERRA-2 + MODIS (modo simulado etiquetado)."""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any

from merra2.adapter import extract_merra2_variables, simulate_merra2_raw
from modis.adapter import extract_modis_variables, simulate_modis_raw
from signature.schema import (
    ProvenanceInfo,
    RegionBounds,
    SCHEMA_VERSION,
    SoundSignature,
    validate_sound_signature,
)

PRESETS: dict[str, dict[str, Any]] = {
    "amazonia": {
        "label": "Amazonia · Pulso Biótico (Simulado)",
        "region": RegionBounds("Cuenca Amazónica", (-12.0, 2.0), (-74.0, -52.0)),
        "t2m": 301.8,
        "qv2m": 0.0175,
        "u10m": -3.4,
        "v10m": 1.2,
        "ndvi": 0.81,
        "fireCount": 14.0,
        "cloudFraction": 0.42,
    },
    "artico": {
        "label": "Ártico · Criósfera (Simulado)",
        "region": RegionBounds("Océano Ártico / Svalbard", (70.0, 84.0), (-20.0, 45.0)),
        "t2m": 259.4,
        "qv2m": 0.0014,
        "u10m": 8.9,
        "v10m": -4.6,
        "ndvi": 0.06,
        "fireCount": 0.0,
        "cloudFraction": 0.68,
    },
    "sahara": {
        "label": "Sahara · Convección Térmica (Simulado)",
        "region": RegionBounds("Desierto del Sahara Central", (16.0, 29.0), (-4.0, 22.0)),
        "t2m": 310.5,
        "qv2m": 0.0038,
        "u10m": 6.8,
        "v10m": 2.9,
        "ndvi": 0.08,
        "fireCount": 4.0,
        "cloudFraction": 0.09,
    },
    "pacifico": {
        "label": "Pacífico Ecuatorial · Alisios (Simulado)",
        "region": RegionBounds("Pacífico Tropical Central", (-6.0, 6.0), (-165.0, -115.0)),
        "t2m": 299.9,
        "qv2m": 0.0182,
        "u10m": -9.4,
        "v10m": -1.8,
        "ndvi": 0.0,
        "fireCount": 0.0,
        "cloudFraction": 0.54,
    },
    "missing_dropout": {
        "label": "Prueba Calidad · Dato Faltante (null, Simulado)",
        "region": RegionBounds("Órbita con pérdida parcial de cobertura", (-30.0, 30.0), (-90.0, 30.0)),
        "t2m": 292.1,
        "qv2m": None,
        "u10m": 4.1,
        "v10m": -2.0,
        "ndvi": None,
        "fireCount": 7.0,
        "cloudFraction": 0.91,
    },
}


def build_simulated_signature(
    preset_id: str = "amazonia",
    timestamp: str = "2026-11-11T12:00:00Z",
    phase: float = 0.0,
) -> SoundSignature:
    if preset_id not in PRESETS:
        raise ValueError(f"Preset desconocido: {preset_id}")
    cfg = PRESETS[preset_id]

    raw_m = simulate_merra2_raw(cfg["t2m"], cfg["qv2m"], cfg["u10m"], cfg["v10m"], phase=phase)
    raw_d = simulate_modis_raw(cfg["ndvi"], cfg["fireCount"], cfg["cloudFraction"], phase=phase)

    variables = {}
    variables.update(extract_merra2_variables(raw_m))
    variables.update(extract_modis_variables(raw_d))

    now_iso = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    sig = SoundSignature(
        schemaVersion=SCHEMA_VERSION,
        id=f"{preset_id}-{timestamp}",
        presetId=preset_id,
        presetLabel=cfg["label"],
        timestamp=timestamp,
        region=cfg["region"],
        variables=variables,
        provenance=ProvenanceInfo(
            origin="simulated",
            products=(
                "MERRA-2 [VERIFICAR colección M2T1NXSLV]",
                "MODIS [VERIFICAR productos MOD13/MOD14/MOD06]",
            ),
            retrievedAt=now_iso,
            verified=False,
            notes="Datos simulados generados en ingest/ Python. No sustituyen productos reales NASA Earthdata.",
        ),
    )

    errs = validate_sound_signature(sig)
    if errs:
        raise RuntimeError(f"SoundSignature inválido: {errs}")
    return sig


def main() -> None:
    parser = argparse.ArgumentParser(description="Genera contratos SoundSignature simulados.")
    parser.add_argument("--preset", default="amazonia", choices=sorted(PRESETS.keys()))
    parser.add_argument("--all", action="store_true", help="Exporta todos los presets a JSON")
    parser.add_argument("--out", type=Path, default=None, help="Carpeta destino (ej. ../data/signatures)")
    args = parser.parse_args()

    ids = list(PRESETS.keys()) if args.all else [args.preset]
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
        for pid in ids:
            sig = build_simulated_signature(pid)
            target = args.out / f"{pid}.json"
            target.write_text(json.dumps(sig.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"Escrito {target}")
    else:
        payload = [build_simulated_signature(pid).to_dict() for pid in ids]
        print(json.dumps(payload if args.all else payload[0], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
