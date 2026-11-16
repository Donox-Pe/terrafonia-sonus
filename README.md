# TerraFonía · SONUS (`Earth Jukebox`)

> **Instrumento interactivo de sonificación terrestre.** Traduce parámetros geoespaciales sintéticos y visualizaciones tipo Earth Information Center (EIC) en sonido dinámico mediante Web Audio API, integrado alrededor de un núcleo 3D interactivo **SONUS**.

> [!IMPORTANT]
> **Estado actual de datos:** Actualmente no existen credenciales NASA Earthdata ni archivos reales descargados de MERRA-2/MODIS. Toda la telemetría generada declara `origin: "simulated"`, `verified: false` y etiqueta explícitamente las visualizaciones como `DATOS SIMULADOS` y `FRAME SINTÉTICO EIC (SIMULADO)`.

---

## Estructura del proyecto

```text
P-NASA/
├── ingest/                 # Pipeline científico en Python (adaptadores, esquema SoundSignature, tests)
├── backend/                # Servidor Node.js + Express + Socket.IO (transporte REST/streaming sin lógica sonora)
├── frontend/               # App web React + Vite + TypeScript + Three.js/R3F + Web Audio API
│   └── src/
│       ├── analysis/       # Analizador visual RGBA (Sobel, matiz HSV, cabezal) + renderizador sintético EIC
│       ├── audio/          # Motor Web Audio API, mapeo científico puro y cálculo de bandas 3D
│       ├── logo3d/         # Logo 3D interactivo SONUS (geometría esférica de circuitos + shaders GLSL)
│       ├── transport/      # Cliente Socket.IO con respaldo automático al simulador local
│       ├── types/          # Contrato SoundSignature compartido
│       └── ui/             # Interfaz Propuesta 01: Jarvis H.U.D.
└── docs/                   # Arquitectura Fase 0, contrato SoundSignature, decisiones científicas y WORK_LOG.md
```

---

## Requisitos previos

- **Node.js** `>= 20` y `npm`
- **Python** `>= 3.11` (solo biblioteca estándar para `ingest/`)

---

## Ejecución local

### 1. Generar firmas de ejemplo (opcional, Python)
Desde `P-NASA/ingest/`:
```bash
python -m signature.builder --all --out ../data/signatures
```

### 2. Iniciar el servidor de transporte (`backend/`, puerto `4000`)
Desde `P-NASA/backend/`:
```bash
npm install
npm run dev
```
Endpoints disponibles en `http://127.0.0.1:4000`:
- `GET /api/health`
- `GET /api/provenance`
- `GET /api/presets`
- `GET /api/signature?preset=amazonia&date=2026-11-11&phase=0`
- Evento WebSocket Socket.IO: `stream:configure`, `stream:step` → `signature:update`

### 3. Iniciar la aplicación web (`frontend/`, puerto Vite por defecto `5173`)
Desde `P-NASA/frontend/`:
```bash
npm install
npm run dev
```
Si el backend está detenido, el cliente cambia automáticamente al modo **Simulador Local** (`SignatureClient`) manteniendo todo el instrumento funcional para exploración y audio en el navegador.

---

## Pruebas y verificación

- **Pipeline científico (`P-NASA/ingest/`):**
  ```bash
  python -m unittest discover -s tests -v
  ```
- **Backend (`P-NASA/backend/`):**
  ```bash
  npm run typecheck
  npm test
  npm run build
  ```
- **Frontend (`P-NASA/frontend/`):**
  ```bash
  npm run typecheck
  npm test
  npm run build
  ```
