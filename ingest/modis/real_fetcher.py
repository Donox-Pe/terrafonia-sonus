"""
Conectores oficiales NASA para nubosidad (MERRA-2 M2T1NXRAD CLDTOT),
vegetación (VIIRS VNP13C1 NDVI HDF5) y focos de calor (NASA FIRMS MODIS_SP).

Nunca inventa valores: si un sensor no tiene cobertura (p. ej. océano en NDVI)
o falta FIRMS_MAP_KEY, devuelve explícitamente quality="missing" con value=None.
"""

from __future__ import annotations

import csv
from datetime import datetime, timedelta
import io
import os
from pathlib import Path
from typing import Any, Optional

import numpy as np

from signature.schema import VariableReading, to_variable_reading


def fetch_merra2_cloud_fraction(
    earthaccess: Any,
    date_str: str,
    lat_bounds: tuple[float, float],
    lon_bounds: tuple[float, float],
    hour_utc: int,
    download_dir: Path,
) -> tuple[VariableReading, Optional[str]]:
    """Descarga M2T1NXRAD (CLDTOT) de NASA GES DISC y promedia la fracción nubosa [0..1]."""
    import xarray as xr  # type: ignore[import-not-found]

    results = earthaccess.search_data(
        short_name="M2T1NXRAD",
        version="5.12.4",
        temporal=(f"{date_str} 00:00:00", f"{date_str} 23:59:59"),
    )
    if not results:
        return (
            VariableReading(
                value=None,
                unit="dimensionless",
                quality="missing",
                source="NASA MERRA-2 M2T1NXRAD · SIN GRÁNULO PARA LA FECHA",
            ),
            None,
        )

    download_dir.mkdir(parents=True, exist_ok=True)
    local_files = earthaccess.download([results[0]], str(download_dir))
    if not local_files:
        return (
            VariableReading(
                value=None,
                unit="dimensionless",
                quality="missing",
                source="NASA MERRA-2 M2T1NXRAD · FALLO DE DESCARGA",
            ),
            None,
        )

    with xr.open_dataset(local_files[0], engine="netcdf4") as ds:
        if "CLDTOT" not in ds.data_vars:
            return (
                VariableReading(
                    value=None,
                    unit="dimensionless",
                    quality="missing",
                    source="NASA MERRA-2 M2T1NXRAD · VARIABLE CLDTOT AUSENTE",
                ),
                None,
            )
        subset = ds
        if "time" in ds.dims and ds.sizes["time"] > 0:
            t_idx = max(0, min(int(hour_utc), int(ds.sizes["time"]) - 1))
            subset = subset.isel(time=t_idx)
        lat_slice = slice(min(lat_bounds), max(lat_bounds))
        lon_slice = slice(min(lon_bounds), max(lon_bounds))
        sub = subset["CLDTOT"].sel(lat=lat_slice, lon=lon_slice)
        arr = np.asarray(sub.values, dtype=float)
        arr = arr[np.isfinite(arr) & (arr >= 0.0) & (arr <= 1.0)]
        val = float(np.mean(arr)) if arr.size > 0 else None

    reading = to_variable_reading(
        round(val, 4) if val is not None else None,
        unit="dimensionless",
        source="NASA GES DISC · MERRA-2 M2T1NXRAD v5.12.4 · CLDTOT",
        valid_range=(0.0, 1.0),
    )
    return reading, "NASA GES DISC M2T1NXRAD v5.12.4 (CLDTOT)"


def _find_nc_variable(group: Any, target_upper: str) -> Any:
    """Busca recursivamente una variable por nombre aproximado en grupos HDF5/NetCDF4."""
    for name, var in group.variables.items():
        if target_upper in name.upper():
            return var
    for g_obj in group.groups.values():
        found = _find_nc_variable(g_obj, target_upper)
        if found is not None:
            return found
    return None


def fetch_viirs_ndvi(
    earthaccess: Any,
    date_str: str,
    lat_bounds: tuple[float, float],
    lon_bounds: tuple[float, float],
    download_dir: Path,
) -> tuple[VariableReading, Optional[str]]:
    """Descarga VIIRS VNP13C1 (CMG 0.05° 16 días, HDF5) y promedia NDVI en el bounding box."""
    import netCDF4 as nc  # type: ignore[import-not-found]

    target_dt = datetime.strptime(date_str, "%Y-%m-%d")
    start_dt = (target_dt - timedelta(days=15)).strftime("%Y-%m-%d")
    end_dt = (target_dt + timedelta(days=15)).strftime("%Y-%m-%d")

    results = earthaccess.search_data(
        short_name="VNP13C1",
        temporal=(f"{start_dt} 00:00:00", f"{end_dt} 23:59:59"),
        count=1,
    )
    if not results:
        return (
            VariableReading(
                value=None,
                unit="dimensionless",
                quality="missing",
                source="NASA LP DAAC · VIIRS VNP13C1 · SIN GRÁNULO EN VENTANA ±15D",
            ),
            None,
        )

    download_dir.mkdir(parents=True, exist_ok=True)
    local_files = earthaccess.download([results[0]], str(download_dir))
    if not local_files:
        return (
            VariableReading(
                value=None,
                unit="dimensionless",
                quality="missing",
                source="NASA LP DAAC · VIIRS VNP13C1 · FALLO DE DESCARGA",
            ),
            None,
        )

    ds = nc.Dataset(str(local_files[0]), "r")
    try:
        ndvi_var = _find_nc_variable(ds, "NDVI")
        if ndvi_var is None or len(ndvi_var.shape) < 2:
            return (
                VariableReading(
                    value=None,
                    unit="dimensionless",
                    quality="missing",
                    source="NASA LP DAAC · VIIRS VNP13C1 · VARIABLE NDVI NO ENCONTRADA",
                ),
                None,
            )

        rows, cols = ndvi_var.shape[-2], ndvi_var.shape[-1]
        # Malla CMG global: latitud +90 -> -90, longitud -180 -> +180
        lat_min, lat_max = min(lat_bounds), max(lat_bounds)
        lon_min, lon_max = min(lon_bounds), max(lon_bounds)

        r0 = max(0, min(rows - 1, int(((90.0 - lat_max) / 180.0) * rows)))
        r1 = max(r0 + 1, min(rows, int(((90.0 - lat_min) / 180.0) * rows)))
        c0 = max(0, min(cols - 1, int(((lon_min + 180.0) / 360.0) * cols)))
        c1 = max(c0 + 1, min(cols, int(((lon_max + 180.0) / 360.0) * cols)))

        ndvi_var.set_auto_maskandscale(False)
        raw_slice = np.asarray(ndvi_var[r0:r1, c0:c1], dtype=float)

        fill_attr = getattr(ndvi_var, "_FillValue", -15000)
        fill_vals = set(np.asarray(fill_attr).flatten().tolist()) if fill_attr is not None else {-15000}

        scale_attr = getattr(ndvi_var, "scale_factor", 0.0001)
        scale = float(np.asarray(scale_attr).flatten()[0]) if scale_attr is not None else 0.0001

        offset_attr = getattr(ndvi_var, "add_offset", 0.0)
        offset = float(np.asarray(offset_attr).flatten()[0]) if offset_attr is not None else 0.0

        # Si el producto usa escala inversa (10000 en lugar de 0.0001)
        if abs(scale) > 1.0:
            scale = 1.0 / scale

        valid_mask = np.isfinite(raw_slice) & (~np.isin(raw_slice, list(fill_vals))) & (raw_slice > -10000)
        scaled = raw_slice[valid_mask] * scale + offset
        scaled = scaled[(scaled >= -1.0) & (scaled <= 1.0)]

        if scaled.size == 0:
            return (
                VariableReading(
                    value=None,
                    unit="dimensionless",
                    quality="missing",
                    source="NASA LP DAAC · VIIRS VNP13C1 · SIN COBERTURA TERRESTRE (OCÉANO/HIELO)",
                ),
                "NASA LP DAAC VIIRS VNP13C1 (sin píxeles terrestres)",
            )

        mean_ndvi = float(np.mean(scaled))
        return (
            to_variable_reading(
                round(mean_ndvi, 4),
                unit="dimensionless",
                source="NASA LP DAAC · VIIRS VNP13C1 · NDVI",
                valid_range=(-1.0, 1.0),
            ),
            "NASA LP DAAC VIIRS VNP13C1 (NDVI 0.05°)",
        )
    finally:
        ds.close()


def fetch_firms_active_fires(
    date_str: str,
    lat_bounds: tuple[float, float],
    lon_bounds: tuple[float, float],
) -> tuple[VariableReading, Optional[str]]:
    """Consulta focos activos de calor reales vía NASA FIRMS API (MODIS_SP)."""
    import requests  # type: ignore[import-not-found]

    map_key = os.environ.get("FIRMS_MAP_KEY", "").strip()
    if not map_key or map_key in {"tu_firms_map_key", "YOUR_MAP_KEY"}:
        return (
            VariableReading(
                value=None,
                unit="count",
                quality="missing",
                source="NASA FIRMS · AGREGA FIRMS_MAP_KEY EN .env",
            ),
            None,
        )

    west, east = min(lon_bounds), max(lon_bounds)
    south, north = min(lat_bounds), max(lat_bounds)
    area = f"{west},{south},{east},{north}"
    url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{map_key}/MODIS_SP/{area}/1/{date_str}"

    try:
        resp = requests.get(url, timeout=25)
        resp.raise_for_status()
        text = resp.text.strip()
        if not text or text.lower().startswith("invalid"):
            return (
                VariableReading(
                    value=None,
                    unit="count",
                    quality="missing",
                    source=f"NASA FIRMS · RESPUESTA NO VÁLIDA ({text[:40]})",
                ),
                None,
            )
        rows = list(csv.reader(io.StringIO(text)))
        count = max(0, len(rows) - 1) if rows else 0
        return (
            to_variable_reading(
                float(count),
                unit="count",
                source="NASA FIRMS · MODIS_SP Active Fire",
                valid_range=(0.0, 100000.0),
            ),
            "NASA FIRMS MODIS_SP (Active Fire)",
        )
    except Exception as exc:  # noqa: BLE001
        return (
            VariableReading(
                value=None,
                unit="count",
                quality="missing",
                source=f"NASA FIRMS · ERROR DE CONSULTA ({type(exc).__name__})",
            ),
            None,
        )
