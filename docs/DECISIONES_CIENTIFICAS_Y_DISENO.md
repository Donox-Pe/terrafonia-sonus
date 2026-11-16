# Decisiones Científicas y de Diseño — TerraFonía · SONUS (Earth Jukebox)

Este documento resume las decisiones técnicas, científicas y de experiencia interactiva tomadas durante la construcción desde cero del proyecto en `P-NASA/`.

---

## 1. Principios de Rigor Científico y Trazabilidad

### 1.1 Regla de oro para datos faltantes (`null` vs `0`)
En observación terrestre, `0` representa un fenómeno físico medido (por ejemplo, `0` focos de calor detectados o `NDVI = 0`), mientras que un dato ausente responde a cobertura nubosa densa, vacío orbital o pérdida de telemetría. Convertir un dato ausente en `0` introduce sesgos científicos falsos y deformaciones acústicas.

**Implementación transversal en toda la pila:**
- **`ingest/signature/schema.py`**: `to_variable_reading()` valida explícitamente `None`, `NaN`, `±Inf` y `fill_values`. Cuando detecta ausencia, emite `{ "value": null, "quality": "missing" }`.
- **`backend/src/services/signatureStore.ts`**: preserva los campos `null` y expone el preset demostrativo `missing_dropout` (`qv2m = null`, `ndvi = null`).
- **`frontend/src/audio/mapping.ts`**: `computeSonificationTargets()` recoge las variables ausentes en `missingVariables` y desactiva las voces dependientes en `activeVoices` (ej. `humidityFilter: false`, `vegetationHarmonics: false`) sin sustituir nunca el parámetro faltante por `0`.
- **`frontend/src/ui/EarthCanvasPanel.tsx` y `ProvenanceView.tsx`**: renderizan `— SIN DATO` en color ámbar con etiqueta explícita `missing` y marcas diagonales de pérdida orbital en el mapa NDVI cuando corresponde.

### 1.2 Unidades SI y etiquetado `[VERIFICAR]`
Mientras no existan credenciales de NASA Earthdata configuradas ni verificación contra archivos HDF5/NetCDF reales, todas las salidas declaran:
- `provenance.origin = "simulated"`
- `provenance.verified = false`
- Banners permanentes en la interfaz (`DATOS SIMULADOS`, `FRAME SINTÉTICO EIC (SIMULADO)` o `NASA BLUE MARBLE · TELEMETRÍA SIMULADA` cuando carga la textura pública base sin credenciales).

> **Excepción pública verificada:** La base visual estática `BlueMarble_ShadedRelief_Bathymetry` (`2048×1024`, proyección `EPSG:4326`) obtenida de **NASA GIBS WMS** (`gibs.earthdata.nasa.gov`, acceso público CORS sin llave) se utiliza únicamente como mapa base fotográfico del globo (`EarthGlobe3D.tsx`) cuando hay conexión; si no hay red, la app arranca instantáneamente con la textura procedural local (`earthTexture.ts`). Todas las variables físicas (`t2m`, `qv2m`, `u10m`, `v10m`, `ndvi`, `fireCount`, `cloudFraction`) permanecen etiquetadas como simuladas.

Nombres de variables y productos proyectados para la futura integración real:
- `t2m` (`K`) · `[VERIFICAR] MERRA-2 M2T1NXSLV`
- `qv2m` (`kg kg-1`) · `[VERIFICAR] MERRA-2 M2T1NXSLV`
- `u10m` / `v10m` (`m s-1`) · `[VERIFICAR] MERRA-2 M2T1NXSLV`
- `ndvi` (`dimensionless`) · `[VERIFICAR] MODIS MOD13C2 / MYD13C2`
- `fireCount` (`count`) · `[VERIFICAR] MODIS MCD14ML`
- `cloudFraction` (`dimensionless`) · `[VERIFICAR] MODIS MOD08_D3 / M2T1NXRAD`

---

## 2. Arquitectura Híbrida de Sonificación (Numérica + Visual EIC)

### 2.1 Evitar retroalimentación visual en el análisis EIC y renderizado 3D del planeta
El visor **CANVAS · GLOBO EIC** renderiza un globo terráqueo 3D en Three.js/WebGL (`EarthGlobe3D.tsx`) con superficie terrestre (`renderEarthCrustForGlobe`), cubierta nubosa ciclónica en una segunda esfera superior (`r = 1.016`) con proyección de sombras sobre continentes/océanos, halo atmosférico Rayleigh, campo estelar, anillos orbitales ilustrativos y un haz láser vertical cian en HTML/SVG.

**Solución para análisis limpio sin retroalimentación (`useTerraFoniaController.ts`):**
1. Un canvas offscreen dedicado (`192 × 96`) renderiza exclusivamente `renderSyntheticEarthData(...)` a ~12 Hz (solo capas físicas activas, sin retículas HUD ni haz láser).
2. `analyzeImageData(...)` calcula luminancia media, densidad de bordes Sobel, varianza espacial, matiz dominante HSV y lectura de la columna longitudinal del cabezal sin contaminación visual.
3. De forma paralela e independiente, el visor 3D muestra el planeta fotográfico interactivo (`Orbitar 3D` + zoom con rueda, o `Haz EIC`) y la barra inferior permite barrer longitudes en cualquier momento.

### 2.2 Motor Web Audio API modular (`sonificationEngine.ts`)
- Un único `AudioContext` iniciado por gesto explícito del usuario (`PLAY`).
- Transiciones suaves con `AudioParam.setTargetAtTime()` (constantes de tiempo `60–120 ms`) para evitar clics digitales al arrastrar el cabezal o cambiar de preset/escala.
- 6 capas sonoras independientes conectadas a un `AnalyserNode` compartido (`fftSize = 2048`):
  1. **Dron climático** (`t2m` → altura fundamental cuantizada a escala musical + pad filtrado).
  2. **Armónicos bióticos** (`ndvi` + verdor en columna del cabezal → quinta y octava armónica).
  3. **Cabezal escáner** (latitud centroide del haz → oscilador sinusoidal agudo panoramizado según longitud).
  4. **LFO atmosférico + viento** (`u10m`, `v10m` + varianza visual → velocidad LFO sobre filtro paso-bajo).
  5. **Textura por bordes Sobel** (filtro paso-banda sobre ruido rosado).
  6. **Impulsos granulares térmicos y reverb nubosa** (`fireCount` → bursts granulares; `cloudFraction` → `ConvolverNode` con respuesta al impulso sintética).

---

## 3. Diseño e Identidad 3D (SONUS + Propuesta 01: Jarvis H.U.D.)

### 3.1 Reconstrucción 3D interactiva del logo SONUS (`logo3d/`)
A partir del análisis del moodboard de **SONUS (`DESDE 2026`)**, el logotipo no se incrusta como imagen estática sino como un instrumento tridimensional vivo con Three.js y React Three Fiber:
- **Esfera shader personalizada (`shaders.ts`)**: gradiente violeta oscuro → magenta eléctrico iluminado en cuadrante superior izquierdo + fresnel cian que pulsa con las bandas `bass`, `mid`, `treble` y `energy` leídas en tiempo real desde `AnalyserNode`.
- **Red de trazos de circuito (`circuitTraces.ts`)**: nodos anillados y rutas con codos a 45° generados matemáticamente en coordenadas esféricas y extruidos como tubos/anillos iluminados sobre la superficie.
- **Halo y campo de partículas orbitales**: halo externo con desvanecimiento suave (`BackSide`) + partículas reactivas a la energía sonora.
- **Interacción directa**: arrastre con inercia, oscilación sutil en reposo (respetando `prefers-reduced-motion`) y pulsos armónicos + onda expansiva al hacer clic.

### 3.2 Interfaz Jarvis H.U.D.
- Basada en la referencia seleccionada (**Propuesta 01: Jarvis H.U.D.**) armonizada con la paleta violeta/cian de SONUS sobre pizarra profunda y paneles translúcidos con resaltado especular superior de `1px`.
- Uso estricto de `tabular-nums` en coordenadas, frecuencias, unidades SI y barras del analizador.
- Degradación elegante mediante `SignatureClient`: se conecta por Socket.IO al backend Node cuando está activo y cambia automáticamente al simulador local determinista cuando se ejecuta el frontend de forma aislada.
