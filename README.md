# TerraFonia · SONUS (`The Earth Information Machine`)
### NASA Space Apps Challenge 2026 Submission

[![NASA Space Apps](https://img.shields.io/badge/NASA_Space_Apps-2026-0B3D91?style=for-the-badge&logo=nasa&logoColor=white)](https://www.spaceappschallenge.org/2026/)
[![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Interactive-00F0FF?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL_3D-FF007F?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> **An interactive Earth sonification observatory.** TerraFonia translates NASA geospatial telemetry, atmospheric dynamics, and Earth Information Center (EIC) satellite streams into dynamic physical soundscapes using the Web Audio API, centered around **SONUS**, a real-time crystalline 3D audio-reactive core.

---

## 🌐 Live Interactive Demo

- **Direct Web Access:** [https://donox-pe.github.io/terrafonia-sonus/](https://donox-pe.github.io/terrafonia-sonus/)
- **Zero Installation Required:** Evaluators can click the link in any modern desktop web browser (Chrome, Edge, Safari, Firefox) to experience real-time 3D Earth rendering, audio synthesis, and voice guidance instantly.

---

## 🔭 Key Features & Capabilities

1. **Deterministic Scientific Sonification:**
   - **MERRA-2 2-Meter Air Temperature ($T_{2m}$):** Modulates fundamental carrier frequency ($f_0 \in [110\text{ Hz}, 440\text{ Hz}]$).
   - **Atmospheric Specific Humidity ($q_{v2m}$):** Dynamically adjusts FM harmonic modulation index and timbral brightness.
   - **Eastward & Northward Wind Vectors ($u_{10m}, v_{10m}$):** Drives pink noise wind turbulence and stereo spatial panning ($L/R$).
   - **MODIS / VIIRS Active Fire Radiative Power (FRP):** Triggers stochastic percussive crackles and harmonic tension.
   - **Cloud Fraction:** Controls low-pass filter resonant frequency ($f_c \in [300\text{ Hz}, 8000\text{ Hz}]$).

2. **Crystalline 3D Core (SONUS):**
   - High-fidelity Three.js procedural sphere with custom GLSL refraction shaders, internal circuit traces, and audio-reactive orbital particle emissions.

3. **Dual-Column Cyber HUD Interface:**
   - High-contrast, accessibility-compliant telemetry panel, real-time WebGL Earth canvas, spectral FFT audio visualizer, and provenance drawer.

4. **Interactive AI Copilot (SONUS Narrator):**
   - Built-in multi-lingual voice copilot using the Web Speech API that explains scientific telemetry and explains anomalies in real time.

5. **NASA Earth Science Datasets Integrated:**
   - **NASA MERRA-2** (GMAO / GES DISC): Reanalysis for atmospheric dynamics and climate telemetry.
   - **NASA MODIS / VIIRS** (FIRMS): Global active thermal anomalies and fire counts.
   - **NASA Earth Information Center (EIC):** Spatial colorimetric palettes and planetary context.

---

## 🏗️ Project Architecture

```text
terrafonia-sonus/
├── frontend/               # React + Vite + TypeScript + Three.js + Web Audio API
│   └── src/
│       ├── audio/          # Deterministic Web Audio sonification engine (FM synthesis, filters)
│       ├── logo3d/         # 3D SONUS Crystalline Core with custom GLSL shaders
│       ├── transport/      # Hybrid transport client (Socket.IO + client-side scientific fallback)
│       ├── ui/             # High-craft cyber HUD (Earth canvas, FFT analyzer, telemetry sliders)
│       └── voice/          # Web Speech API real-time scientific audio narrator
├── backend/                # Node.js + Express + Socket.IO telemetry streaming server
├── ingest/                 # Python scientific ingestion pipeline for MERRA-2 and MODIS HDF5/NetCDF4
└── .github/workflows/      # Automated GitHub Pages CI/CD pipeline
```

---

## 🚀 Running Locally

If you prefer to inspect and run the source code locally on your machine:

### Prerequisites
- **Node.js** `>= 20.x`
- **npm** `>= 10.x`
- **Python** `>= 3.11` *(optional, for offline NetCDF4/HDF5 scientific ingestion)*

### Quick Start (Frontend Web App)
```bash
# 1. Clone the repository
git clone https://github.com/Donox-Pe/terrafonia-sonus.git
cd terrafonia-sonus/frontend

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The application runs immediately in **Standalone Scientific Mode** with full audio synthesis, 3D graphics, and real-time planetary modulation.

### Optional: Starting the Streaming Backend
```bash
cd ../backend
npm install
npm run dev
```
The streaming server starts on `http://127.0.0.1:4000` with WebSocket support for live satellite telemetry feeds.

---

## 🧪 Scientific Verification & Testing

Every layer of TerraFonia includes automated test suites ensuring zero regressions in audio physics and scientific data formatting:

```bash
# Verify Frontend & Web Audio Mappings
cd frontend
npm run typecheck
npm test

# Verify Backend Streaming Contract
cd ../backend
npm run typecheck
npm test

# Verify Scientific Python Ingest Schemas
cd ../ingest
python -m unittest discover -s tests -v
```

---

## 👥 NASA Space Apps Challenge 2026 Team

Developed with passion for scientific accessibility, open science, and sonification for the **NASA Space Apps Challenge 2026**.
