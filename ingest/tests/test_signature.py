"""Pruebas científicas del pipeline de ingestión SoundSignature."""

import json
import math
import os
from pathlib import Path
import tempfile
import unittest

from merra2.adapter import (
    MERRA2_NASA_SOURCE_TAG,
    extract_merra2_region_from_dataset,
    extract_merra2_variables,
)
from merra2.earthdata_fetcher import _missing_modis_placeholders, load_local_env
from modis.adapter import extract_modis_variables
from signature.builder import PRESETS, build_simulated_signature
from signature.schema import SoundSignature, to_variable_reading, validate_sound_signature


class TestMissingValueDiscipline(unittest.TestCase):
    def test_missing_values_never_become_zero(self) -> None:
        raw_cases = [None, float("nan"), float("inf"), float("-inf"), -9999.0, 1e15, "bad", True]
        for raw in raw_cases:
            reading = to_variable_reading(raw, unit="K", source="SIMULATED · TEST")
            self.assertIsNone(reading.value, f"Valor {raw!r} no debe convertirse en 0")
            self.assertEqual(reading.quality, "missing")
            self.assertEqual(reading.unit, "K")

    def test_valid_zero_stays_zero(self) -> None:
        reading = to_variable_reading(0.0, unit="count", source="SIMULATED · TEST", valid_range=(0.0, 100.0))
        self.assertEqual(reading.value, 0.0)
        self.assertEqual(reading.quality, "ok")

    def test_out_of_range_marks_suspect_without_mutating_to_zero(self) -> None:
        reading = to_variable_reading(500.0, unit="K", source="SIMULATED · TEST", valid_range=(170.0, 340.0))
        self.assertEqual(reading.value, 500.0)
        self.assertEqual(reading.quality, "suspect")


class TestAdaptersAndBuilder(unittest.TestCase):
    def test_merra2_preserves_missing_fields(self) -> None:
        vars_map = extract_merra2_variables({"t2m": 288.5, "qv2m": None, "u10m": 1e15, "v10m": float("nan")})
        self.assertEqual(vars_map["t2m"].quality, "ok")
        self.assertEqual(vars_map["t2m"].unit, "K")
        for key in ("qv2m", "u10m", "v10m"):
            self.assertIsNone(vars_map[key].value)
            self.assertEqual(vars_map[key].quality, "missing")

    def test_modis_preserves_fill_values(self) -> None:
        vars_map = extract_modis_variables({"ndvi": -3000.0, "fireCount": 0, "cloudFraction": 255})
        self.assertIsNone(vars_map["ndvi"].value)
        self.assertEqual(vars_map["ndvi"].quality, "missing")
        self.assertEqual(vars_map["fireCount"].value, 0.0)
        self.assertEqual(vars_map["fireCount"].quality, "ok")
        self.assertIsNone(vars_map["cloudFraction"].value)
        self.assertEqual(vars_map["cloudFraction"].quality, "missing")

    def test_all_presets_build_valid_simulated_signatures(self) -> None:
        for pid in PRESETS:
            sig = build_simulated_signature(pid, phase=0.7)
            self.assertEqual(validate_sound_signature(sig), [])
            self.assertEqual(sig.provenance.origin, "simulated")
            self.assertFalse(sig.provenance.verified)
            serialized = json.dumps(sig.to_dict())
            self.assertNotIn("NaN", serialized)

    def test_missing_dropout_preset_exports_json_null(self) -> None:
        sig = build_simulated_signature("missing_dropout")
        d = sig.to_dict()
        self.assertIsNone(d["variables"]["qv2m"]["value"])
        self.assertEqual(d["variables"]["qv2m"]["quality"], "missing")
        self.assertIsNone(d["variables"]["ndvi"]["value"])
        self.assertEqual(d["variables"]["ndvi"]["quality"], "missing")

    def test_rejects_simulated_claiming_verified(self) -> None:
        sig = build_simulated_signature("amazonia")
        bad = SoundSignature(
            schemaVersion=sig.schemaVersion,
            id=sig.id,
            presetId=sig.presetId,
            presetLabel=sig.presetLabel,
            timestamp=sig.timestamp,
            region=sig.region,
            variables=sig.variables,
            provenance=type(sig.provenance)(
                origin="simulated",
                products=sig.provenance.products,
                retrievedAt=sig.provenance.retrievedAt,
                verified=True,
                notes=sig.provenance.notes,
            ),
        )
        errs = validate_sound_signature(bad)
        self.assertTrue(any("verified=True" in e for e in errs))


class _FakeScalar:
    def __init__(self, value: float) -> None:
        self._value = value

    def item(self) -> float:
        return self._value


class _FakeArray:
    def __init__(self, value: float) -> None:
        self._value = value

    def mean(self, skipna: bool = True) -> _FakeScalar:
        return _FakeScalar(self._value)


class _FakeDataset:
    dims = ("time", "lat", "lon")

    def __init__(self, mapping: dict[str, _FakeArray]) -> None:
        self._mapping = mapping

    def sel(self, lat=None, lon=None):
        return self

    def isel(self, time=0):
        return self

    def __contains__(self, key: str) -> bool:
        return key in self._mapping

    def __getitem__(self, key: str):
        if key == "time":
            return list(range(24))
        return self._mapping[key]


class TestMerra2RealDatasetExtraction(unittest.TestCase):
    def test_dataset_region_uses_nasa_source_and_preserves_nan(self) -> None:
        ds = _FakeDataset(
            {
                "T2M": _FakeArray(298.4),
                "QV2M": _FakeArray(float("nan")),
                "U10M": _FakeArray(-4.2),
                # V10M ausente a propósito
            }
        )
        out = extract_merra2_region_from_dataset(ds, (-12.0, 2.0), (-74.0, -52.0))
        self.assertEqual(out["t2m"].value, 298.4)
        self.assertEqual(out["t2m"].quality, "ok")
        self.assertIn("M2T1NXSLV", out["t2m"].source)
        self.assertIn(MERRA2_NASA_SOURCE_TAG, out["t2m"].source)

        self.assertIsNone(out["qv2m"].value)
        self.assertEqual(out["qv2m"].quality, "missing")
        self.assertIsNone(out["v10m"].value)
        self.assertEqual(out["v10m"].quality, "missing")

    def test_modis_placeholders_are_honestly_missing(self) -> None:
        placeholders = _missing_modis_placeholders()
        for key in ("ndvi", "fireCount", "cloudFraction"):
            self.assertIsNone(placeholders[key].value)
            self.assertEqual(placeholders[key].quality, "missing")

    def test_load_local_env_parses_values_without_overwriting(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            env_file = Path(tmpdir) / ".env"
            env_file.write_text(
                '# comentario\nTEST_ED_USER="alice"\nTEST_ED_EMPTY=\n',
                encoding="utf-8",
            )
            os.environ.pop("TEST_ED_USER", None)
            os.environ.pop("TEST_ED_EMPTY", None)
            load_local_env([env_file])
            self.assertEqual(os.environ.get("TEST_ED_USER"), "alice")
            self.assertNotIn("TEST_ED_EMPTY", os.environ)
            os.environ.pop("TEST_ED_USER", None)


if __name__ == "__main__":
    unittest.main()
