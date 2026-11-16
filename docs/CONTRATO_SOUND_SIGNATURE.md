# Contrato de datos `SoundSignature`

Versión: `1.0.0`  
Proyecto: **TerraFonía · SONUS** (`Earth Jukebox`)

Este contrato une las tres capas del sistema manteniendo estricta separación de responsabilidades:

1. **`ingest/` (Python)**: produce objetos `SoundSignature` con unidades, calidad y procedencia verificada.
2. **`backend/` (Node + Express + Socket.IO)**: transporta el `SoundSignature` por REST y WebSocket sin alterar ni inventar interpretación científica.
3. **`frontend/` (React + Web Audio)**: consume `SoundSignature` + características del frame visual para sintetizar sonido y mostrar trazabilidad en la UI.

---

## Principios científicos no negociables

1. **Valores faltantes jamás se convierten en cero (`0`).**  
   Si una lectura de satélite/modelo es `None`, `NaN`, `±Inf` o un `fill_value` del producto, debe emitirse como:
   ```json
   {
     "value": null,
     "unit": "K",
     "quality": "missing",
     "source": "SIMULATED · MERRA-2 [VERIFICAR variable exacta]"
   }
   ```
2. **Trazabilidad obligatoria en cada paquete.**  
   Ningún dato simulado puede declararse como `"origin": "nasa"` ni `"verified": true`.
3. **Separación de estimaciones por frame visual.**  
   El análisis de píxeles del canvas en el frontend genera proxies visuales (luminancia, bordes, actividad térmica visual), nunca sustituye variables numéricas satelitales certificadas.

---

## Esquema JSON

```json
{
  "schemaVersion": "1.0.0",
  "id": "amazonia-2026-11-11T12:00:00Z",
  "presetId": "amazonia",
  "presetLabel": "Amazonia · Pulso Biótico (Simulado)",
  "timestamp": "2026-11-11T12:00:00Z",
  "region": {
    "name": "Cuenca Amazónica",
    "lat": [-12.0, 2.0],
    "lon": [-74.0, -52.0]
  },
  "variables": {
    "t2m":           { "value": 301.8,   "unit": "K",             "quality": "ok",      "source": "SIMULATED · MERRA-2 T2M [VERIFICAR producto/variable]" },
    "qv2m":          { "value": 0.0175,  "unit": "kg kg-1",       "quality": "ok",      "source": "SIMULATED · MERRA-2 QV2M [VERIFICAR producto/variable]" },
    "u10m":          { "value": -3.4,    "unit": "m s-1",         "quality": "ok",      "source": "SIMULATED · MERRA-2 U10M [VERIFICAR producto/variable]" },
    "v10m":          { "value": 1.2,     "unit": "m s-1",         "quality": "ok",      "source": "SIMULATED · MERRA-2 V10M [VERIFICAR producto/variable]" },
    "ndvi":          { "value": 0.78,    "unit": "dimensionless", "quality": "ok",      "source": "SIMULATED · MODIS NDVI [VERIFICAR producto/variable]" },
    "fireCount":     { "value": 14,      "unit": "count",         "quality": "ok",      "source": "SIMULATED · MODIS Active Fire [VERIFICAR producto/variable]" },
    "cloudFraction": { "value": 0.42,    "unit": "dimensionless", "quality": "ok",      "source": "SIMULATED · MODIS Cloud Fraction [VERIFICAR producto/variable]" }
  },
  "provenance": {
    "origin": "simulated",
    "products": [
      "MERRA-2 [VERIFICAR colección/versión]",
      "MODIS [VERIFICAR producto MOD13/MOD14/MOD06]"
    ],
    "retrievedAt": "2026-11-14T20:30:00Z",
    "verified": false,
    "notes": "Datos sintéticos generados localmente porque no hay credenciales NASA Earthdata ni verificación oficial de productos."
  }
}
```
