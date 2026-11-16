"""Adaptador científico MODIS (simulado etiquetado hasta verificar productos reales)."""

from __future__ import annotations

from typing import Any, Optional
from signature.schema import VariableReading, to_variable_reading

# [VERIFICAR] Productos oficiales MODIS: MOD13C1/MYD13C1 (NDVI), MOD14A1 (Fire), MOD06_L2 (Cloud).
MODIS_SOURCE_TAG = "SIMULATED · MODIS [VERIFICAR productos MOD13/MOD14/MOD06]"
MODIS_FILL_VALUES = (-3000.0, -9999.0, -32768.0, 255.0)


def extract_modis_variables(raw_sample: dict[str, Any]) -> dict[str, VariableReading]:
    """
    Normaliza lecturas tipo MODIS manteniendo unidades y valores faltantes como None.
    - ndvi: índice de vegetación normalizado [dimensionless] (-1..1)
    - fireCount: conteo de anomalías térmicas activas [count] (>= 0)
    - cloudFraction: fracción de cobertura nubosa [dimensionless] (0..1)
    """
    return {
        "ndvi": to_variable_reading(
            raw_sample.get("ndvi"),
            unit="dimensionless",
            source=f"{MODIS_SOURCE_TAG} · NDVI",
            fill_values=(-9999.0, -3000.0, -32768.0),
            valid_range=(-1.0, 1.0),
        ),
        "fireCount": to_variable_reading(
            raw_sample.get("fireCount"),
            unit="count",
            source=f"{MODIS_SOURCE_TAG} · ActiveFire",
            fill_values=(-9999.0, -32768.0),
            valid_range=(0.0, 100000.0),
        ),
        "cloudFraction": to_variable_reading(
            raw_sample.get("cloudFraction"),
            unit="dimensionless",
            source=f"{MODIS_SOURCE_TAG} · CloudFraction",
            fill_values=(-9999.0, -32768.0, 255.0),
            valid_range=(0.0, 1.0),
        ),
    }


def simulate_modis_raw(
    base_ndvi: Optional[float],
    base_fire: Optional[float],
    base_cloud: Optional[float],
    phase: float = 0.0,
) -> dict[str, Optional[float]]:
    """Variación sintética; si una variable entra como None se mantiene None."""
    import math

    wave = math.sin(phase * 0.5)
    cosw = math.cos(phase * 0.8)
    return {
        "ndvi": None if base_ndvi is None else max(-1.0, min(1.0, base_ndvi + 0.04 * wave)),
        "fireCount": None if base_fire is None else max(0.0, round(base_fire + 3.0 * max(0.0, cosw))),
        "cloudFraction": None if base_cloud is None else max(0.0, min(1.0, base_cloud + 0.12 * wave)),
    }
