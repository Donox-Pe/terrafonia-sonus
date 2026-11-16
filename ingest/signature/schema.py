"""Esquema científico SoundSignature y validación estricta de trazabilidad."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Any, Literal, Optional, Sequence

QualityFlag = Literal["ok", "missing", "suspect"]
OriginFlag = Literal["nasa", "simulated"]

SCHEMA_VERSION = "1.0.0"

REQUIRED_VARIABLES = (
    "t2m",
    "qv2m",
    "u10m",
    "v10m",
    "ndvi",
    "fireCount",
    "cloudFraction",
)


@dataclass(frozen=True)
class VariableReading:
    value: Optional[float]
    unit: str
    quality: QualityFlag
    source: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class RegionBounds:
    name: str
    lat: tuple[float, float]
    lon: tuple[float, float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "lat": [self.lat[0], self.lat[1]],
            "lon": [self.lon[0], self.lon[1]],
        }


@dataclass(frozen=True)
class ProvenanceInfo:
    origin: OriginFlag
    products: tuple[str, ...]
    retrievedAt: str
    verified: bool
    notes: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "origin": self.origin,
            "products": list(self.products),
            "retrievedAt": self.retrievedAt,
            "verified": self.verified,
            "notes": self.notes,
        }


@dataclass(frozen=True)
class SoundSignature:
    schemaVersion: str
    id: str
    presetId: str
    presetLabel: str
    timestamp: str
    region: RegionBounds
    variables: dict[str, VariableReading]
    provenance: ProvenanceInfo

    def to_dict(self) -> dict[str, Any]:
        return {
            "schemaVersion": self.schemaVersion,
            "id": self.id,
            "presetId": self.presetId,
            "presetLabel": self.presetLabel,
            "timestamp": self.timestamp,
            "region": self.region.to_dict(),
            "variables": {k: v.to_dict() for k, v in self.variables.items()},
            "provenance": self.provenance.to_dict(),
        }


def is_missing_numeric(raw_value: Any, fill_values: Sequence[float] = ()) -> bool:
    """Detecta valores faltantes o no finitos. Jamás los transforma en 0."""
    if raw_value is None or isinstance(raw_value, bool):
        return True
    try:
        num = float(raw_value)
    except (TypeError, ValueError):
        return True
    if not math.isfinite(num):
        return True
    for fv in fill_values:
        if math.isclose(num, float(fv), rel_tol=1e-6, abs_tol=1e-9):
            return True
    return False


def to_variable_reading(
    raw_value: Any,
    unit: str,
    source: str,
    fill_values: Sequence[float] = (-9999.0, -32768.0, 1e15),
    valid_range: Optional[tuple[float, float]] = None,
) -> VariableReading:
    """
    Convierte un valor bruto a VariableReading preservando unidad, calidad y fuente.
    - Valor faltante / NaN / Inf / fill_value -> value=None, quality='missing' (NUNCA 0).
    - Valor fuera de rango físico -> quality='suspect'.
    """
    if is_missing_numeric(raw_value, fill_values):
        return VariableReading(value=None, unit=unit, quality="missing", source=source)

    num = float(raw_value)
    quality: QualityFlag = "ok"
    if valid_range is not None:
        lo, hi = valid_range
        if num < lo or num > hi:
            quality = "suspect"

    return VariableReading(value=round(num, 6), unit=unit, quality=quality, source=source)


def validate_sound_signature(sig: SoundSignature) -> list[str]:
    """Valida reglas científicas obligatorias del contrato."""
    errors: list[str] = []

    if sig.schemaVersion != SCHEMA_VERSION:
        errors.append(f"schemaVersion inválida: {sig.schemaVersion}")

    for var_name in REQUIRED_VARIABLES:
        if var_name not in sig.variables:
            errors.append(f"Falta variable obligatoria: {var_name}")
            continue
        reading = sig.variables[var_name]
        if not reading.unit:
            errors.append(f"Variable {var_name} sin unidad física")
        if reading.quality == "missing" and reading.value is not None:
            errors.append(f"Variable {var_name} con quality='missing' debe tener value=None")
        if reading.quality == "ok" and reading.value is None:
            errors.append(f"Variable {var_name} con quality='ok' no puede tener value=None")

    if sig.provenance.origin == "simulated" and sig.provenance.verified:
        errors.append("Un paquete simulado no puede declararse verified=True")

    return errors
