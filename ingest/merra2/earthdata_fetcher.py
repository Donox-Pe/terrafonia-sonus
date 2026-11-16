"""
Conector oficial NASA GES DISC MERRA-2 (colección M2T1NXSLV v5.12.4) vía earthaccess + xarray.

Requiere:
  1. Cuenta gratuita en NASA Earthdata Login (https://urs.earthdata.nasa.gov/).
  2. Variables EARTHDATA_USERNAME / EARTHDATA_PASSWORD (o EARTHDATA_TOKEN, o archivo ~/.netrc / _netrc).
  3. Dependencias: pip install -r requirements-earthdata.txt

Si no existen dependencias o credenciales, falla explícitamente sin inventar datos NASA.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sys
from typing import Optional

_PLACEHOLDER_SECRETS = {"", "tu_usuario_earthdata", "tu_password_earthdata"}


def load_local_env(extra_paths: Optional[list[Path]] = None) -> list[Path]:
    """
    Carga variables KEY=VALUE desde archivos .env locales (P-NASA/.env o ingest/.env)
    sin requerir python-dotenv ni sobrescribir variables ya exportadas en el entorno.
    """
    ingest_dir = Path(__file__).resolve().parent.parent
    repo_root = ingest_dir.parent
    candidates = extra_paths or [
        Path.cwd() / ".env",
        ingest_dir / ".env",
        repo_root / ".env",
    ]
    loaded: list[Path] = []
    seen: set[Path] = set()
    for env_path in candidates:
        resolved = env_path.resolve()
        if resolved in seen or not resolved.is_file():
            continue
        seen.add(resolved)
        for raw_line in resolved.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip()
            if len(val) >= 2 and ((val[0] == '"' and val[-1] == '"') or (val[0] == "'" and val[-1] == "'")):
                val = val[1:-1].strip()
            if key and val and not os.environ.get(key):
                os.environ[key] = val
        loaded.append(resolved)
    return loaded

from merra2.adapter import (
    MERRA2_COLLECTION_SHORT_NAME,
    MERRA2_COLLECTION_VERSION,
    MERRA2_NASA_SOURCE_TAG,
    extract_merra2_region_from_dataset,
)
from modis.real_fetcher import (
    fetch_firms_active_fires,
    fetch_merra2_cloud_fraction,
    fetch_viirs_ndvi,
)
from signature.builder import PRESETS
from signature.schema import (
    ProvenanceInfo,
    RegionBounds,
    SCHEMA_VERSION,
    SoundSignature,
    VariableReading,
    validate_sound_signature,
)


def _missing_modis_placeholders() -> dict[str, VariableReading]:
    """Variables MODIS quedan explícitamente como missing hasta conectar MOD13/MOD14/MOD06."""
    return {
        "ndvi": VariableReading(
            value=None,
            unit="dimensionless",
            quality="missing",
            source="MODIS · NO INGESTADO EN DESCARGA MERRA-2-ONLY",
        ),
        "fireCount": VariableReading(
            value=None,
            unit="count",
            quality="missing",
            source="MODIS · NO INGESTADO EN DESCARGA MERRA-2-ONLY",
        ),
        "cloudFraction": VariableReading(
            value=None,
            unit="dimensionless",
            quality="missing",
            source="MODIS · NO INGESTADO EN DESCARGA MERRA-2-ONLY",
        ),
    }


def _authenticate_earthdata(earthaccess: object) -> object:
    """Autentica con EARTHDATA_* (desde entorno o .env) o fallback a _netrc/.netrc."""
    load_local_env()

    token = os.environ.get("EARTHDATA_TOKEN", "").strip()
    user = os.environ.get("EARTHDATA_USERNAME", "").strip()
    pwd = os.environ.get("EARTHDATA_PASSWORD", "").strip()

    if user in _PLACEHOLDER_SECRETS:
        os.environ.pop("EARTHDATA_USERNAME", None)
        user = ""
    if pwd in _PLACEHOLDER_SECRETS:
        os.environ.pop("EARTHDATA_PASSWORD", None)
        pwd = ""

    auth = None
    last_err: Optional[Exception] = None
    has_env = bool(token or (user and pwd))
    strategies = ("environment", "netrc") if has_env else ("netrc",)

    for strategy in strategies:
        try:
            candidate = earthaccess.login(strategy=strategy, persist=False)  # type: ignore[attr-defined]
            if getattr(candidate, "authenticated", False):
                auth = candidate
                break
        except Exception as exc:  # noqa: BLE001 - earthaccess lanza LoginStrategyUnavailable/RuntimeError
            last_err = exc

    if not getattr(auth, "authenticated", False):
        repo_env = Path(__file__).resolve().parent.parent.parent / ".env"
        hint = (
            f"Faltan credenciales válidas de NASA Earthdata. Completa EARTHDATA_USERNAME y "
            f"EARTHDATA_PASSWORD en {repo_env} (o configura ~/.netrc / _netrc)."
        )
        if last_err is not None:
            raise RuntimeError(f"{hint} Detalle: {last_err}") from last_err
        raise RuntimeError(hint)
    return auth


def fetch_merra2_signature(
    preset_id: str,
    date_str: str,
    hour_utc: int = 12,
    download_dir: Optional[Path] = None,
    merra2_only: bool = False,
) -> SoundSignature:
    """Descarga y promedia MERRA-2 + satélites complementarios (M2T1NXRAD, VNP13C1, FIRMS) para una región y fecha."""
    try:
        import earthaccess  # type: ignore[import-not-found]
        import xarray as xr  # type: ignore[import-not-found]
    except ImportError as exc:
        raise RuntimeError(
            "Faltan dependencias para NASA Earthdata. Ejecuta: pip install -r requirements-earthdata.txt"
        ) from exc

    preset = PRESETS[preset_id]
    region: RegionBounds = preset["region"]

    _authenticate_earthdata(earthaccess)

    results = earthaccess.search_data(
        short_name=MERRA2_COLLECTION_SHORT_NAME,
        version=MERRA2_COLLECTION_VERSION,
        temporal=(f"{date_str} 00:00:00", f"{date_str} 23:59:59"),
    )
    if not results:
        raise RuntimeError(
            f"NASA CMR no devolvió gránulos {MERRA2_COLLECTION_SHORT_NAME} v{MERRA2_COLLECTION_VERSION} para {date_str}."
        )

    target_dir = download_dir or Path("tmp_merra2")
    target_dir.mkdir(parents=True, exist_ok=True)
    local_files = earthaccess.download([results[0]], str(target_dir))
    if not local_files:
        raise RuntimeError("La descarga de earthaccess no produjo archivos locales NetCDF4.")

    target_file = local_files[0]
    with xr.open_dataset(target_file, engine="netcdf4") as ds:
        merra_vars = extract_merra2_region_from_dataset(
            ds,
            lat_bounds=region.lat,
            lon_bounds=region.lon,
            time_index=hour_utc,
            source_label=MERRA2_NASA_SOURCE_TAG,
        )

    products_used = [f"NASA GES DISC {MERRA2_COLLECTION_SHORT_NAME} v{MERRA2_COLLECTION_VERSION}"]
    if merra2_only:
        sat_vars = _missing_modis_placeholders()
        products_used.append("MODIS/VIIRS [omitido con --merra2-only]")
    else:
        sat_vars = _missing_modis_placeholders()
        try:
            cloud_r, cloud_prod = fetch_merra2_cloud_fraction(
                earthaccess, date_str, region.lat, region.lon, hour_utc, target_dir
            )
            sat_vars["cloudFraction"] = cloud_r
            if cloud_prod:
                products_used.append(cloud_prod)
        except Exception as exc:  # noqa: BLE001
            print(f"[AVISO M2T1NXRAD] No se pudo obtener nubosidad: {exc}", file=sys.stderr)

        try:
            ndvi_r, ndvi_prod = fetch_viirs_ndvi(
                earthaccess, date_str, region.lat, region.lon, target_dir / "viirs"
            )
            sat_vars["ndvi"] = ndvi_r
            if ndvi_prod:
                products_used.append(ndvi_prod)
        except Exception as exc:  # noqa: BLE001
            print(f"[AVISO VNP13C1] No se pudo obtener NDVI VIIRS: {exc}", file=sys.stderr)

        fire_r, fire_prod = fetch_firms_active_fires(date_str, region.lat, region.lon)
        sat_vars["fireCount"] = fire_r
        if fire_prod:
            products_used.append(fire_prod)

    variables = {**merra_vars, **sat_vars}
    label_base = str(preset["label"]).replace("(Simulado)", "(NASA Multimisión)")
    timestamp = f"{date_str}T{hour_utc:02d}:00:00Z"

    sig = SoundSignature(
        schemaVersion=SCHEMA_VERSION,
        id=f"nasa-{preset_id}-{timestamp}",
        presetId=preset_id,
        presetLabel=label_base,
        timestamp=timestamp,
        region=region,
        variables=variables,
        provenance=ProvenanceInfo(
            origin="nasa",
            products=tuple(products_used),
            retrievedAt=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            verified=True,
            notes=(
                f"Promedio espacial NASA real para {region.name} el {date_str} {hour_utc:02d}:00Z. "
                "Cualquier sensor sin cobertura o clave permanece explícitamente como missing (null)."
            ),
        ),
    )

    errs = validate_sound_signature(sig)
    if errs:
        raise RuntimeError(f"SoundSignature NASA inválido: {errs}")
    return sig


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Descarga e ingesta MERRA-2 M2T1NXSLV real hacia data/signatures/."
    )
    parser.add_argument("--preset", default="amazonia", choices=sorted(PRESETS.keys()))
    parser.add_argument("--all", action="store_true", help="Ingiere todos los presets")
    parser.add_argument("--date", default="2024-06-01", help="Fecha UTC YYYY-MM-DD")
    parser.add_argument("--hour", type=int, default=12, help="Hora UTC 0..23")
    parser.add_argument("--merra2-only", action="store_true", help="Solo MERRA-2 M2T1NXSLV (deja MODIS/VIIRS en null)")
    parser.add_argument("--out", type=Path, default=Path("../data/signatures"), help="Carpeta de salida JSON")
    parser.add_argument("--cache-nc", type=Path, default=Path("./tmp_merra2"), help="Caché temporal de NetCDF4")
    args = parser.parse_args()

    ids = list(PRESETS.keys()) if args.all else [args.preset]
    args.out.mkdir(parents=True, exist_ok=True)
    for pid in ids:
        try:
            sig = fetch_merra2_signature(
                pid,
                args.date,
                hour_utc=args.hour,
                download_dir=args.cache_nc,
                merra2_only=args.merra2_only,
            )
        except RuntimeError as exc:
            print(f"[AVISO HONESTIDAD] {exc}", file=sys.stderr)
            sys.exit(2)
        target = args.out / f"{pid}.json"
        target.write_text(json.dumps(sig.to_dict(), indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Escrito NASA MERRA-2 verificado en {target}")


if __name__ == "__main__":
    main()
