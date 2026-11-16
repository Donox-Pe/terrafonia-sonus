# Fase 0 — Análisis y propuesta de arquitectura

Proyecto: **Earth Jukebox / La Máquina de Información Terrestre**
Fecha: 2026-11-14 · Estado: **propuesta, pendiente de validación del usuario**

> Convención de este documento: lo marcado con **[VERIFICAR]** es una hipótesis técnica que NO se ha comprobado todavía contra la fuente oficial. Nada de lo marcado así debe presentarse como dato NASA real.

---

## 1. Estado actual del proyecto

| Elemento | Situación verificada |
|---|---|
| Carpeta `P-NASA` | Existe, estaba **vacía** al iniciar la sesión. |
| Documento de transferencia técnica | **No encontrado.** Se buscó en `Documents` y `Downloads` y no hay ningún archivo con ese contenido. Todo lo que dependa de él queda como supuesto. |
| Código previo (frontend/backend/Python) | Inexistente en `P-NASA`. Se parte de cero. |
| Material de referencia recibido | 2 imágenes, guardadas en [`docs/reference/`](./reference/). |

### Material de referencia analizado

**Logo "SONUS · DESDE 2026"** ([logo_sonus_ref.jpg](./reference/logo_sonus_ref.jpg))
- Esfera violeta con degradado radial (centro claro `~#7b4fe0`, borde oscuro `~#2a1060`).
- Sobre la esfera, **pistas de circuito impreso** (líneas con nodos circulares terminales) que convergen hacia un nodo central cian: lectura natural como "datos que fluyen hacia un punto".
- Tipografía: sans geométrica, angular, estilo tecnológico, en lavanda/cian claro; subtítulo "DESDE 2026" con tracking muy abierto, violeta.
- Fondo negro, atmósfera sci-fi sobria.

**Propuestas de UI "TerraFonía"** ([ui_propuestas_terrafonia_ref.jpg](./reference/ui_propuestas_terrafonia_ref.jpg))
- 01 *Jarvis H.U.D.* (azul/cian), 02 *Cyberpunk Lab* (magenta/verde neón), 03 *Holo-Matrix* (verde/amarillo).
- Elementos comunes: globo terráqueo dividido por una **línea de escaneo vertical** (mitad día/mitad datos), conmutadores de capas (Fuego · NDVI · Nubes), visualizador de espectro, perillas de modulación, analizador de audio por bandas, barra inferior con PLAY / preset / fecha / volumen.

### Inconsistencia de nombres (requiere decisión)
Aparecen tres nombres: **Earth Jukebox**, **SONUS** (logo) y **TerraFonía** (UI). Se propone: *SONUS* como marca/logo, *TerraFonía* como nombre del instrumento, *Earth Jukebox* como nombre técnico del repositorio. Pendiente de confirmar.

---

## 2. Arquitectura recomendada (híbrida)

```
P-NASA/
├─ frontend/            React + Vite + TypeScript
│  └─ src/
│     ├─ audio/         Motor Web Audio (sin React): engine, voices, mapping
│     ├─ analysis/      Análisis de frames (canvas → características)
│     ├─ logo3d/        Logo SONUS 3D (React Three Fiber)
│     ├─ transport/     Cliente REST + Socket.IO
│     └─ ui/            Componentes, layout, tema
├─ backend/             Node + Express + Socket.IO
│  └─ src/
│     ├─ routes/        REST: /api/signature, /api/health, /api/provenance
│     ├─ sockets/       Emisión de SoundSignature en tiempo real
│     └─ services/      Lectura de firmas pre-procesadas + simulador etiquetado
├─ ingest/              Python (pipeline científico)
│  ├─ merra2/           Descarga y reducción de variables MERRA-2
│  ├─ modis/            Descarga y reducción de variables MODIS
│  └─ signature/        Generación de SoundSignature + metadatos de trazabilidad
├─ docs/                Fase 0, decisiones, WORK_LOG.md, referencias
└─ data/                (git-ignored) caché local de productos descargados
```

**Separación de responsabilidades (obligatoria):**
1. **Lógica científica** → solo en `ingest/`. Produce valores con unidad, calidad y procedencia.
2. **Transporte** → `backend/`. No interpreta ciencia, solo sirve/emite firmas.
3. **Presentación y audio** → `frontend/`. No conoce de dónde salió el dato, solo consume `SoundSignature`.

### Contrato central: `SoundSignature` (esquema propuesto)

```jsonc
{
  "timestamp": "2026-11-11T12:00:00Z",
  "region": { "lat": [..], "lon": [..] },
  "variables": {
    "t2m": { "value": 288.4, "unit": "K", "quality": "ok", "source": "MERRA-2 [VERIFICAR producto/variable]" }
    // valores faltantes: value = null + quality = "missing"  (NUNCA 0)
  },
  "provenance": { "origin": "nasa|simulated", "product": "...", "retrievedAt": "...", "verified": false }
}
```
Regla: `origin: "simulated"` se muestra visiblemente en la UI como "DATOS SIMULADOS".

---

## 3. Cómo se obtendrán los "frames" del Earth Information Center

No se ha verificado que el EIC (earth.gov) exponga una API de frames. Por eso la estrategia es por niveles, y cada nivel declara su origen:

| Nivel | Fuente del frame | Estado |
|---|---|---|
| A (preferido) | Teselas de imágenes NASA vía **GIBS/Worldview** (servicio público WMTS de imágenes satelitales) dibujadas en `<canvas>` | **[VERIFICAR]** disponibilidad, capas exactas, fechas y CORS para leer píxeles |
| B | Capturas/animaciones públicas del EIC descargadas manualmente a `data/` | **[VERIFICAR]** licencia/uso |
| C (fallback) | **Generador sintético** de frames (globo procedural) | Siempre disponible; etiquetado como simulado |

El análisis de frames ocurre **en el navegador** (rápido, sin ancho de banda extra): `getImageData` sobre un canvas reducido (p. ej. 256×128) a ~10–15 Hz.

---

## 4. Mapeo a parámetros de Web Audio API

### 4.1 Datos numéricos → sonido (capa "ambiente / armonía")

| Variable (producto) | Mapeo propuesto | Nodo Web Audio |
|---|---|---|
| Temperatura 2 m (MERRA-2) **[VERIFICAR nombre]** | Registro/tonalidad: frío→grave, cálido→agudo (escala de cuantización a modo menor/mayor) | `OscillatorNode.frequency` |
| Humedad específica (MERRA-2) **[VERIFICAR]** | Brillo/resonancia | `BiquadFilterNode` Q / cutoff |
| Viento 10 m u,v (MERRA-2) **[VERIFICAR]** | Velocidad → tasa de LFO; dirección → paneo | `OscillatorNode`(LFO)→gain, `StereoPannerNode` |
| NDVI (MODIS) **[VERIFICAR]** | Densidad armónica ("vida"): más NDVI → más parciales | gain de osciladores aditivos |
| Fuego activo (MODIS) **[VERIFICAR]** | Eventos percusivos/granulares crepitantes | `AudioBufferSourceNode` + envolventes |
| Cobertura de nubes (MODIS) **[VERIFICAR]** | Reverb / difusión | `ConvolverNode` mix |

### 4.2 Frame visual → sonido (capa "reactiva en tiempo real")

| Característica del frame | Cálculo | Parámetro sonoro |
|---|---|---|
| Luminancia media | promedio de L | cutoff global del filtro paso-bajo |
| Histograma de matiz dominante | matiz modal | modo/escala musical |
| Densidad de bordes | gradiente tipo Sobel | densidad de textura granular / ruido |
| Varianza espacial | desv. estándar | profundidad de modulación |
| **Barrido de playhead** (la línea vertical del mockup) | columna activa recorre longitud | paneo = longitud; pitch = latitud de píxeles activos |

La línea de escaneo del diseño de UI pasa a ser **el cabezal de lectura real**: lo que se oye es lo que cruza esa línea.

### 4.3 Buenas prácticas de rendimiento
- Un solo `AudioContext`, creado tras gesto del usuario (política de autoplay).
- Parámetros con `setTargetAtTime` (sin saltos/clicks); nunca asignar `.value` en caliente.
- Análisis de frames en `requestAnimationFrame` limitado; opcional OffscreenCanvas + Worker.
- `AnalyserNode` único compartido para visualizador, analizador de bandas y logo 3D.

---

## 5. Logo 3D interactivo (Fase 1) — concepto preliminar

- **Tecnología:** React Three Fiber + Three.js (carga diferida para no penalizar el arranque); fallback a CSS 3D si no hay WebGL.
- **Modelo:** esfera con shader de degradado violeta (reinterpretando el logo, **no** usando el PNG), con **pistas de circuito generadas como geometría tubular** (curvas `CatmullRomCurve3` sobre la superficie) y nodos emisivos en los extremos; nodo central cian como foco.
- **Interacción:** rotación suave constante, inclinación hacia el mouse (hover), parallax de luz.
- **Conexión con el sonido:** el `AnalyserNode` modula la emisión de los nodos (pulsan con los graves), la intensidad de las pistas (agudos) y la velocidad de rotación (energía total). Partículas orbitales que reaccionan al paneo.
- **Texto "SONUS / DESDE 2026":** malla 3D de texto (o sprite SDF) con la misma paleta lavanda/cian.

---

## 6. Decisiones pendientes del usuario

1. ¿Existe el documento de transferencia técnica? Si sí, ¿dónde está? (No se encontró.)
2. ¿Nombre final: SONUS / TerraFonía / Earth Jukebox y su jerarquía?
3. ¿Qué propuesta de UI se toma como base: 01 Jarvis, 02 Cyberpunk, 03 Holo-Matrix? (Se recomienda **01** como base y paleta del logo —violeta/cian— para unificar con SONUS.)
4. ¿Hay credenciales de NASA Earthdata (necesarias para descargar MERRA-2 real) o se arranca con datos simulados etiquetados?
5. ¿Empezar por **logo 3D** o por **arquitectura técnica**?

---

## 7. Riesgos

- **Acceso a datos reales:** MERRA-2 requiere cuenta Earthdata **[VERIFICAR]**; sin ella, solo datos simulados.
- **CORS en teselas** al leer píxeles del canvas **[VERIFICAR]**.
- **Peso de Three.js:** mitigado con lazy-loading.
- **Autoplay de audio:** requiere un gesto inicial (botón PLAY).
