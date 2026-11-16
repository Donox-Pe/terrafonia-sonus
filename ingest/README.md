# Pipeline científico de ingestión (`ingest/`)

Este módulo concentra exclusivamente la lógica de dominio científico y la generación de contratos `SoundSignature` para **TerraFonía · SONUS**.

## Estado de datos NASA
- **Actualmente no hay credenciales NASA Earthdata configuradas** ni verificación contra archivos HDF5/NetCDF reales de MERRA-2 o MODIS.
- Por rigor científico, todas las salidas generadas sin descarga verificada declaran `provenance.origin = "simulated"` y `provenance.verified = false`.
- Todos los nombres de variables y colecciones NASA figuran marcados con `[VERIFICAR]`.

## Regla de valores faltantes
La función `to_variable_reading` en `signature/schema.py` garantiza que cualquier `None`, `NaN`, `±Inf` o valor de relleno (`fill_values`) produce `value: None` (`null` en JSON) y `quality: "missing"`, **nunca `0`**.

## Pruebas
Desde `P-NASA/ingest/`:
```bash
python -m unittest discover -s tests -v
```

## Generar firmas simuladas hacia `data/`
```bash
python -m signature.builder --all --out ../data/signatures
```
