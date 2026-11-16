"""Adaptador científico MERRA-2 (modo simulado etiquetado e ingestión real GES DISC M2T1NXSLV)."""

from __future__ import annotations

import math
from typing import Any, Optional
from signature.schema import VariableReading, to_variable_reading

# Colección oficial NASA GES DISC MERRA-2: M2T1NXSLV v5.12.4 (1-hourly, Time-Averaged, Single-Level).
MERRA2_COLLECTION_SHORT_NAME = "M2T1NXSLV"
MERRA2_COLLECTION_VERSION = "5.12.4"
MERRA2_SOURCE_TAG = "SIMULATED · MERRA-2 [VERIFICAR producto M2T1NXSLV]"
MERRA2_NASA_SOURCE_TAG = f"NASA GES DISC · MERRA-2 {MERRA2_COLLECTION_SHORT_NAME} v{MERRA2_COLLECTION_VERSION}"
MERRA2_FILL_VALUES = (1e15, 9.9999999e14, -9999.0)


def extract_merra2_variables(
    raw_sample: dict[str, Any],
    source_label: str = MERRA2_SOURCE_TAG,
) -> dict[str, VariableReading]:
    """
    Normaliza lecturas MERRA-2 manteniendo unidades SI y valores faltantes como None.
    - t2m: temperatura a 2 m [K] (rango físico aproximado 170..340 K)
    - qv2m: humedad específica a 2 m [kg kg-1] (0..0.05)
    - u10m, v10m: viento a 10 m [m s-1] (-85..85)
    """
    return {
        "t2m": to_variable_reading(
            raw_sample.get("t2m"),
            unit="K",
            source=f"{source_label} · T2M",
            fill_values=MERRA2_FILL_VALUES,
            valid_range=(170.0, 340.0),
        ),
        "qv2m": to_variable_reading(
            raw_sample.get("qv2m"),
            unit="kg kg-1",
            source=f"{source_label} · QV2M",
            fill_values=MERRA2_FILL_VALUES,
            valid_range=(0.0, 0.05),
        ),
        "u10m": to_variable_reading(
            raw_sample.get("u10m"),
            unit="m s-1",
            source=f"{source_label} · U10M",
            fill_values=MERRA2_FILL_VALUES,
            valid_range=(-85.0, 85.0),
        ),
        "v10m": to_variable_reading(
            raw_sample.get("v10m"),
            unit="m s-1",
            source=f"{source_label} · V10M",
            fill_values=MERRA2_FILL_VALUES,
            valid_range=(-85.0, 85.0),
        ),
    }


def extract_merra2_region_from_dataset(
    dataset: Any,
    lat_bounds: tuple[float, float],
    lon_bounds: tuple[float, float],
    time_index: int = 12,
    source_label: str = MERRA2_NASA_SOURCE_TAG,
) -> dict[str, VariableReading]:
    """
    Extrae promedios regionales de un Dataset NetCDF4/xarray de MERRA-2 M2T1NXSLV.
    No convierte NaN ni valores de relleno en cero: preserva quality='missing'.
    """
    lat_min, lat_max = sorted(lat_bounds)
    lon_min, lon_max = sorted(lon_bounds)

    sliced = dataset.sel(lat=slice(lat_min, lat_max), lon=slice(lon_min, lon_max))
    if "time" in getattr(sliced, "dims", ()):
        safe_idx = max(0, min(time_index, len(sliced["time"]) - 1))
        sliced = sliced.isel(time=safe_idx)

    raw_sample: dict[str, Optional[float]] = {}
    for nc_var, key in (("T2M", "t2m"), ("QV2M", "qv2m"), ("U10M", "u10m"), ("V10M", "v10m")):
        if nc_var not in sliced:
            raw_sample[key] = None
            continue
        mean_val = float(sliced[nc_var].mean(skipna=True).item())
        raw_sample[key] = None if not math.isfinite(mean_val) else mean_val

    return extract_merra2_variables(raw_sample, source_label=source_label)


def simulate_merra2_raw(
    base_t2m: Optional[float],
    base_qv2m: Optional[float],
    base_u10m: Optional[float],
    base_v10m: Optional[float],
    phase: float = 0.0,
) -> dict[str, Optional[float]]:
    """Oscilación diurna/sinóptica sintética; preserva None sin convertirlo en 0."""
    import math

    wave = math.sin(phase)
    cosw = math.cos(phase * 0.7)
    return {
        "t2m": None if base_t2m is None else base_t2m + 1.8 * wave,
        "qv2m": None if base_qv2m is None else max(0.0, base_qv2m + 0.0012 * cosw),
        "u10m": None if base_u10m is None else base_u10m + 2.4 * wave,
        "v10m": None if base_v10m is None else base_v10m + 1.6 * cosw,
    }
