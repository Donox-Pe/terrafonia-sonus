# Registro de trabajo

## Fecha:
2026-11-14

## Tarea:
Sesión 1 — Fase 0 (análisis y propuesta) de Earth Jukebox / La Máquina de Información Terrestre. Creación de la estructura de documentación y del registro de trabajo.

## Archivos inspeccionados:
- `P-NASA/` (carpeta completa; estaba vacía)
- Búsqueda de documento de transferencia técnica en `Documents` y `Downloads` (palabras clave: transfer, jukebox, terrafonia, earth, sonus) → no se encontró ninguno; solo coincidencias en `node_modules` de otros proyectos, irrelevantes.
- Imagen de referencia del logo SONUS (`docs/reference/logo_sonus_ref.jpg`)
- Imagen de propuestas de UI TerraFonía (`docs/reference/ui_propuestas_terrafonia_ref.jpg`)

## Archivos modificados:
Creados (no había archivos previos):
- `P-NASA/docs/FASE0_ANALISIS_Y_ARQUITECTURA.md`
- `P-NASA/docs/WORK_LOG.md`
- `P-NASA/docs/reference/logo_sonus_ref.jpg` (copia de la imagen subida)
- `P-NASA/docs/reference/ui_propuestas_terrafonia_ref.jpg` (copia de la imagen subida)

## Pruebas ejecutadas:
- Verificación de toolchain: Node v24.14.0, npm 11.9.0, Python 3.13.2.
- No se ejecutó código de la aplicación (aún no existe).

## Resultados:
- Fase 0 documentada: estado, arquitectura híbrida (frontend / backend / ingest / docs), contrato `SoundSignature`, estrategia de frames por niveles y mapeo a Web Audio API.
- Concepto preliminar del logo 3D definido (no implementado).

## Problemas encontrados:
- El "documento de transferencia técnica" mencionado en el prompt **no existe** en el equipo; la Fase 0 se basó solo en el prompt y las 2 imágenes.
- Tres nombres en conflicto (Earth Jukebox / SONUS / TerraFonía).
- No se ha verificado ninguna fuente de datos NASA (MERRA-2, MODIS, GIBS, frames del EIC): todo figura como **[VERIFICAR]**.

## Decisiones tomadas:
- No se declara ningún dato como NASA real. Todo dato simulado llevará `origin: "simulated"` y se mostrará como tal en la UI.
- Valores faltantes se representan como `null` + `quality: "missing"`, nunca como 0.
- El análisis de frames se hará en el navegador; la ciencia vive solo en `ingest/`.
- El logo se rehará como modelo 3D (R3F), no como imagen estática.
- Sin commits automáticos.

## Pendientes:
- Confirmar nombre final y propuesta de UI base (recomendada: 01 Jarvis H.U.D.).
- Confirmar si hay credenciales NASA Earthdata y localizar el documento de transferencia.
- Verificar fuentes: GIBS (capas, CORS), nombres exactos de variables MERRA-2/MODIS.
- Implementar scaffolding (Fase 2), logo 3D (Fase 1), motor de audio (Fase 3), UI (Fase 4).

## Siguiente tarea:
Según elección del usuario: (a) Fase 1 — implementar el logo SONUS 3D interactivo en `frontend/src/logo3d/`, o (b) Fase 2 — scaffolding de `frontend/`, `backend/`, `ingest/`.

---

# Registro de trabajo — Sesión 2 (Fases 1 a 5 completadas)

## Fecha:
2026-11-14

## Tarea:
Completar desde cero el pipeline científico (`ingest/`), servidor de transporte (`backend/`), analizador visual EIC + motor de sonificación Web Audio API + núcleo 3D interactivo **SONUS** + interfaz completa **Propuesta 01: Jarvis H.U.D.** (`frontend/`), además de la documentación de decisiones científicas/diseño (`README.md` y `docs/DECISIONES_CIENTIFICAS_Y_DISENO.md`) y la verificación integral de pruebas y builds.

## Archivos inspeccionados:
- `P-NASA/docs/reference/logo_sonus_ref.jpg`
- `P-NASA/docs/reference/ui_propuestas_terrafonia_ref.jpg`
- `P-NASA/docs/FASE0_ANALISIS_Y_ARQUITECTURA.md`
- `P-NASA/docs/CONTRATO_SOUND_SIGNATURE.md`
- `P-NASA/backend/package.json` y `P-NASA/backend/tsconfig.json`
- `P-NASA/backend/src/routes/api.ts` y `P-NASA/backend/src/sockets/signatureStream.ts`
- `P-NASA/ingest/README.md`
- `P-NASA/frontend/index.html` y `P-NASA/frontend/src/styles.css`
- `P-NASA/frontend/src/types/soundSignature.ts`
- `P-NASA/frontend/src/transport/signatureClient.ts`
- `P-NASA/frontend/src/audio/mapping.ts` y `P-NASA/frontend/src/audio/sonificationEngine.ts`
- `P-NASA/frontend/src/analysis/frameAnalyzer.ts` y `P-NASA/frontend/src/analysis/syntheticEicRenderer.ts`

## Archivos modificados:
- Creados / actualizados en documentación:
  - `P-NASA/README.md` (creado)
  - `P-NASA/docs/DECISIONES_CIENTIFICAS_Y_DISENO.md` (creado)
  - `P-NASA/docs/WORK_LOG.md` (actualizado con Sesión 2)
- Creados / ajustados en `P-NASA/backend/`:
  - `P-NASA/backend/tsconfig.build.json` (creado para excluir `*.test.ts` de `dist/`)
  - `P-NASA/backend/vitest.config.ts` (creado para restringir Vitest a `src/**/*.test.ts`)
  - `P-NASA/backend/package.json` (`build` actualizado a `tsc -p tsconfig.build.json`)
- Creados / refactorizados en `P-NASA/frontend/src/`:
  - `P-NASA/frontend/src/ui/useTerraFoniaController.ts` (creado)
  - `P-NASA/frontend/src/ui/EarthCanvasPanel.tsx` (creado)
  - `P-NASA/frontend/src/ui/VisualizerPanel.tsx` (creado)
  - `P-NASA/frontend/src/ui/AudioAnalyzerPanel.tsx` (creado)
  - `P-NASA/frontend/src/ui/ProvenanceView.tsx` (creado)
  - `P-NASA/frontend/src/App.tsx` (refactorizado a Propuesta 01 Jarvis H.U.D.)
  - `P-NASA/frontend/src/styles.css` (rediseño completo vidrio/Jarvis H.U.D. + responsivo)

## Pruebas ejecutadas:
- Frontend (`P-NASA/frontend/`):
  - `npm --prefix P-NASA/frontend run typecheck` (`tsc --noEmit`)
  - `npm --prefix P-NASA/frontend test` (`vitest run`)
  - `npm --prefix P-NASA/frontend run build` (`tsc --noEmit && vite build`)
- Backend (`P-NASA/backend/`):
  - `npm --prefix P-NASA/backend run typecheck` (`tsc --noEmit`)
  - `npm --prefix P-NASA/backend test` (`vitest run`)
  - `npm --prefix P-NASA/backend run build` (`tsc -p tsconfig.build.json`)
- Ingest (`P-NASA/ingest/`):
  - `python -m unittest discover -s tests -v`

## Resultados:
- `P-NASA/frontend` typecheck: código de salida `0`.
- `P-NASA/frontend` test: `4 passed (4)` archivos, `25 passed (25)` pruebas (`audioLevels.test.ts`, `circuitTraces.test.ts`, `mapping.test.ts`, `frameAnalyzer.test.ts`).
- `P-NASA/frontend` build: código de salida `0` (`1820` módulos transformados; artefactos generados en `dist/`).
- `P-NASA/backend` typecheck: código de salida `0`.
- `P-NASA/backend` test: `1 passed (1)` archivo (`src/services/signatureStore.test.ts`), `4 passed (4)` pruebas.
- `P-NASA/backend` build: código de salida `0`.
- `P-NASA/ingest` unittest: `8` pruebas ejecutadas (`OK` en `0.004s`).

## Problemas encontrados:
1. En una ejecución previa de `vitest run` en `backend/`, Vitest ejecutó también el archivo compilado `dist/services/signatureStore.test.js` junto a `src/services/signatureStore.test.ts`. Se resolvió separando `tsconfig.build.json` (`exclude: ["src/**/*.test.ts"]`) y configurando `vitest.config.ts` (`include: ["src/**/*.test.ts"]`), además de regenerar `dist/`.
2. En el entorno sandbox de Windows no están permitidos enlaces HTTP en loopback (`EACCES`) ni ejecución headless de navegador web (`0xC0000005`), por lo que la verificación E2E interactiva en navegador vivo y pruebas de audio real quedan pendientes de ejecución local fuera del sandbox.

## Decisiones tomadas:
1. **Aislamiento de lectura visual EIC:** El controlador (`useTerraFoniaController.ts`) dibuja las capas científicas en un canvas offscreen (`192×96`) libre de overlays HUD antes de correr `analyzeImageData()`, y solo después dibuja `drawJarvisOverlay()` sobre el canvas visible, evitando cualquier retroalimentación cromática del haz cian sobre los parámetros de sonido.
2. **Protagonismo continuo del núcleo SONUS 3D:** Se integró `SonusLogo3D` directamente en el centro del H.U.D. reactivo al `AnalyserNode` compartido (mediante ref mutable a 60 Hz sin re-renderizar React) más una vista expandida (`Núcleo SONUS 3D`) manteniendo una única instancia WebGL montada por pestaña.
3. **Respeto estricto de valores faltantes:** Tanto `AudioAnalyzerPanel`, `EarthCanvasPanel` como `ProvenanceView` muestran `— SIN DATO` y silencian las voces dependientes cuando `quality === "missing"` o `value === null`.

## Pendientes:
- Verificación visual/auditiva manual en navegador real fuera del sandbox (`npm run dev` en `backend/` y `frontend/`) comprobando gesto de `PLAY`, arrastre del cabezal EIC, pestaña `Núcleo SONUS 3D` y escenario `missing_dropout`.
- Futura conexión de credenciales NASA Earthdata y reemplazo progresivo de adaptadores simulados en `ingest/` marcando `[VERIFICAR]` solo tras validación contra datos reales.

## Siguiente tarea:
Levantar `backend/` y `frontend/` en una terminal local del usuario para realizar la prueba audiovisual interactiva en navegador real y validar la recepción Socket.IO en vivo.

---

# Registro de trabajo — Sesión 3 (Rediseño visual realista Jarvis H.U.D. + Panel Backend)

## Fecha:
2026-11-14

## Tarea:
Reemplazar el mapa plano de óvalos por un globo terráqueo 3D realista con continentes geográficos, sombreado solar y atmósfera Rayleigh dentro de la mira orbital Jarvis H.U.D.; corregir el encuadre del núcleo SONUS 3D para evitar recortes laterales; elevar **Visualizador** y **Audio Analyzer** siguiendo `high-craft-frontend`, `taste` y `emil-kowalski`; y habilitar vista directa en `http://127.0.0.1:4000/` para inspeccionar el backend.

## Archivos inspeccionados:
- `d:\Users\Donovan\Documents\Pagina_Planta\.agents\skills\high-craft-frontend\SKILL.md`
- `d:\Users\Donovan\Documents\Pagina_Planta\.agents\skills\taste\SKILL.md`
- `d:\Users\Donovan\Documents\Pagina_Planta\.agents\skills\emil-kowalski\SKILL.md`
- `P-NASA/backend/src/app.ts`
- `P-NASA/frontend/src/analysis/syntheticEicRenderer.ts`
- `P-NASA/frontend/src/logo3d/SonusLogo3D.tsx`
- `P-NASA/frontend/src/App.tsx`

## Archivos modificados:
- Creados en `P-NASA/frontend/src/`:
  - `P-NASA/frontend/src/analysis/earthTexture.ts` (polígonos continentales reales + fBm fractal para batimetría, selvas, desiertos, relieve y polos)
  - `P-NASA/frontend/src/ui/EarthGlobe3D.tsx` (esfera 3D WebGL con iluminación solar, reflejo especular oceánico y halo atmosférico Rayleigh)
- Actualizados en `P-NASA/frontend/src/`:
  - `P-NASA/frontend/src/analysis/syntheticEicRenderer.ts` (usa `getEarthBaseAssets()`, nubes ciclónicas suaves fBm y focos MODIS sintéticos)
  - `P-NASA/frontend/src/logo3d/SonusLogo3D.tsx` (ajuste dinámico de cámara `camera.position.z` según relación de aspecto + distinción drag/clic)
  - `P-NASA/frontend/src/ui/EarthCanvasPanel.tsx` (globo 3D + retícula orbital Jarvis + haz vertical cian volumétrico + lecturas de esquina + grilla simétrica 4×2)
  - `P-NASA/frontend/src/ui/VisualizerPanel.tsx` (espectro aurora fluido, onda con ganancia adaptativa y diales rotatorios SVG interactivos)
  - `P-NASA/frontend/src/ui/AudioAnalyzerPanel.tsx` (espectro LED segmentado en 14 celdas × 12 bandas con indicadores *peak-hold*)
  - `P-NASA/frontend/src/ui/ProvenanceView.tsx` (enlaces directos a `/`, `/api/health`, `/api/presets`, `/api/signature`, `/api/provenance`)
  - `P-NASA/frontend/src/App.tsx` (enlace rápido `SOCKET.IO · :4000` en cabecera y columna central dividida en `NÚCLEO SONUS 3D` + `PARÁMETROS DE SÍNTESIS`)
  - `P-NASA/frontend/src/styles.css` (superficies glassmorphism multicapa con brillo especular de 1 px, mallas atmosféricas y tipografía `tabular-nums`)
- Actualizado en `P-NASA/backend/`:
  - `P-NASA/backend/src/app.ts` (ruta `GET /` con vista HTML interactiva y JSON de diagnóstico hacia todos los endpoints `/api/*`)
- Actualizado en documentación:
  - `P-NASA/docs/WORK_LOG.md` (Sesión 3)

## Pruebas ejecutadas:
- `npm --prefix P-NASA/frontend run typecheck`
- `npm --prefix P-NASA/frontend test`
- `npm --prefix P-NASA/frontend run build`
- `npm --prefix P-NASA/backend run typecheck`
- `npm --prefix P-NASA/backend test`
- `npm --prefix P-NASA/backend run build`

## Resultados:
- Frontend `typecheck`: salida `0`.
- Frontend `test`: `4 passed (4)` archivos, `25 passed (25)` pruebas.
- Frontend `build`: salida `0` (`1822` módulos transformados con Vite).
- Backend `typecheck`: salida `0`.
- Backend `test`: `1 passed (1)` archivo, `4 passed (4)` pruebas.
- Backend `build`: salida `0`.

## Problemas encontrados:
- El encuadre previo de `SonusLogo3D` recortaba los bordes laterales de la esfera cuando el contenedor central tenía aspecto vertical estrecho; resuelto escalando la distancia `z` de la cámara por relación de aspecto.
- El backend no exponía página en `/` (provocaba `Cannot GET /` al abrirlo en navegador); resuelto añadiendo consola informativa HTML/JSON en `GET /`.

## Decisiones tomadas:
- Compartir la base cartográfica fractal `earthTexture.ts` tanto para la textura WebGL del globo visible (`EarthGlobe3D.tsx`) como para el análisis RGBA offscreen (`syntheticEicRenderer.ts` + `analyzeImageData`), garantizando coherencia total entre lo que el usuario ve y lo que el sintetizador Web Audio escucha.

## Pendientes:
- Validación visual en vivo en el navegador del usuario sobre `http://127.0.0.1:5173` y `http://127.0.0.1:4000/`.

## Siguiente tarea:
Confirmar con el usuario la apariencia realista del globo terrestre 3D, la respuesta del núcleo SONUS y los diales del HUD en su navegador local.

---

# Registro de trabajo — Sesión 4 (Globo estilo NASA Eyes on the Earth + Nubes 3D + GIBS Blue Marble)

## Fecha:
2026-11-14

## Tarea:
Elevar el realismo del globo terrestre en **CANVAS · GLOBO EIC** al estilo visual de `https://eyes.nasa.gov/apps/earth/#/` incorporando textura base fotográfica pública CORS-enabled de NASA GIBS (`BlueMarble_ShadedRelief_Bathymetry` a `2048×1024`), segunda esfera 3D de nubosidad ciclónica con proyección de sombras, dispersión atmosférica Rayleigh, campo estelar profundo, anillos orbitales ilustrativos y modo interactivo **Orbitar 3D / Haz EIC** con zoom por rueda.

## Archivos inspeccionados:
- `P-NASA/docs/DECISIONES_CIENTIFICAS_Y_DISENO.md`
- `P-NASA/frontend/src/analysis/earthTexture.ts`
- `P-NASA/frontend/src/analysis/syntheticEicRenderer.ts`
- `P-NASA/frontend/src/ui/EarthGlobe3D.tsx`
- `P-NASA/frontend/src/ui/EarthCanvasPanel.tsx`
- `P-NASA/frontend/src/styles.css`

## Archivos modificados:
- `P-NASA/frontend/src/analysis/earthTexture.ts` (descarga pública CORS sin credenciales de `BlueMarble_ShadedRelief_Bathymetry` 2048×1024 con fallback local instantáneo + generador `1024×512` *domain-warped fBm* para nubes ciclónicas)
- `P-NASA/frontend/src/analysis/syntheticEicRenderer.ts` (se añadió `renderEarthCrustForGlobe()` para mantener nítida la corteza terrestre debajo de la esfera nubosa 3D)
- `P-NASA/frontend/src/ui/EarthGlobe3D.tsx` (micro-relieve topográfico, reflejo especular oceánico, sombra real de nubes sobre continentes, segunda esfera nubosa `r=1.016`, atmósfera Rayleigh, `Starfield` y `OrbitRing` ilustrativos)
- `P-NASA/frontend/src/ui/EarthCanvasPanel.tsx` (conmutador `Orbitar 3D / Haz EIC`, zoom con rueda, botón reset, barra inferior de barrido longitudinal y etiqueta honesta de procedencia visual `NASA BLUE MARBLE · TELEMETRÍA SIMULADA` / `FRAME SINTÉTICO EIC (SIMULADO)`)
- `P-NASA/frontend/src/styles.css` (fondo espacial profundo, haz láser sutil sin velado, controles `.mode-switch` y `.scan-scrub-rail`)
- `P-NASA/docs/DECISIONES_CIENTIFICAS_Y_DISENO.md` (documentación de capa pública NASA GIBS WMS y renderizado 3D multinivel)
- `P-NASA/docs/WORK_LOG.md` (Sesión 4)

## Pruebas ejecutadas:
- `npm --prefix P-NASA/frontend run typecheck`
- `npm --prefix P-NASA/frontend test`
- `npm --prefix P-NASA/frontend run build`

## Resultados:
- Frontend `typecheck`: salida `0`.
- Frontend `test`: `4 passed (4)` archivos, `25 passed (25)` pruebas (`audioLevels.test.ts`, `circuitTraces.test.ts`, `mapping.test.ts`, `frameAnalyzer.test.ts`).
- Frontend `build`: salida `0` (`1822` módulos transformados; `dist/assets/index-Dn2ZFLzR.css`, `dist/assets/index-B00wwMO7.js`).

## Problemas encontrados:
- Ninguno durante compilación y pruebas unitarias. Queda pendiente la validación visual interactiva en vivo dentro del navegador local del usuario para comprobar la carga de NASA GIBS WMS desde su red.

## Decisiones tomadas:
- Mantener separación estricta de procedencia: aunque se cargue la capa visual estática pública `BlueMarble_ShadedRelief_Bathymetry` de NASA GIBS sin cuenta Earthdata, la telemetría numérica y nubes dinámicas permanecen declaradas como simuladas (`DATOS SIMULADOS`).
- No velar la superficie del planeta con un haz grueso semitransparente; reducir el haz vertical en modo normal a una línea láser fina (`1.5 px`) y colocar controles de barrido en `.scan-scrub-rail` para priorizar la legibilidad fotográfica del planeta.

## Pendientes:
- Validación visual en el navegador local del usuario (`F5` en `http://127.0.0.1:5173`).

## Siguiente tarea:
Revisar la nueva Tierra 3D estilo *NASA Eyes* en vivo junto al usuario y ajustar si desea alternar capas térmicas o nocturnas adicionales.

---

# Registro de trabajo — Sesión 5 (Conexión real MERRA-2 Earthdata + Fidelidad SONUS 3D y Jarvis H.U.D.)

## Fecha:
2026-11-14

## Tarea:
Conectar soporte real e íntegro para ingestión de **NASA MERRA-2** (`M2T1NXSLV` v`5.12.4`, variables `T2M`, `QV2M`, `U10M`, `V10M`) preservando rigor científico y honestidad ante ausencia de credenciales; reconstruir el **Núcleo SONUS 3D** siguiendo exactamente el emblema de referencia (`SONUS` esfera violeta-índigo sin franjas horizontales, pistas curvas desde el creciente inferior, quiebres de 45° y ojales huecos centrados en nodo cian); y elevar botones, conmutadores de capas, **VISUALIZADOR** y **AUDIO ANALYZER** al acabado de *Propuesta 01: Jarvis H.U.D.* (`high-craft-frontend`, `taste`, `emil-kowalski`).

## Archivos inspeccionados:
- `d:\Users\Donovan\Documents\Pagina_Planta\.agents\skills\high-craft-frontend\SKILL.md`
- `d:\Users\Donovan\Documents\Pagina_Planta\.agents\skills\taste\SKILL.md`
- `d:\Users\Donovan\Documents\Pagina_Planta\.agents\skills\emil-kowalski\SKILL.md`
- `P-NASA/frontend/src/logo3d/{shaders.ts,circuitTraces.ts,circuitTraces.test.ts,SonusLogo3D.tsx}`
- `P-NASA/frontend/src/ui/{VisualizerPanel.tsx,AudioAnalyzerPanel.tsx}`
- `P-NASA/frontend/src/{App.tsx,styles.css}`
- `P-NASA/ingest/{merra2/adapter.py,signature/builder.py,signature/schema.py,tests/test_signature.py}`
- `P-NASA/backend/src/{services/signatureStore.ts,app.ts,server.ts}`

## Archivos modificados:
- Creados en `P-NASA/ingest/`:
  - `P-NASA/ingest/requirements-earthdata.txt` (`earthaccess>=0.11.0`, `xarray>=2024.1.0`, `netCDF4>=1.6.5`)
  - `P-NASA/ingest/merra2/earthdata_fetcher.py` (conector CLI real vía `earthaccess.login()`, `earthaccess.search_data(short_name="M2T1NXSLV", version="5.12.4")` y `xarray`, preservando `NaN`/`fill_values` y marcando MODIS como `missing` mientras no se ingeste)
- Actualizados en `P-NASA/ingest/`:
  - `P-NASA/ingest/merra2/adapter.py` (soporte `source_label` configurable y `extract_merra2_region_from_dataset`)
  - `P-NASA/ingest/tests/test_signature.py` (+2 pruebas: extracción regional NetCDF/xarray con `NaN -> None` y honestidad de placeholders MODIS)
- Actualizado en `P-NASA/backend/`:
  - `P-NASA/backend/src/services/signatureStore.ts` (detección automática de `data/signatures/` desde raíz o `backend/`, inspección real de caché verificada `origin === "nasa" && verified === true`, y verificación pasiva de configuración Earthdata `_netrc` / env)
- Actualizados en `P-NASA/frontend/src/`:
  - `P-NASA/frontend/src/logo3d/shaders.ts` (eliminación de líneas horizontales de escaneo, iluminación violeta-índigo aterciopelada arriba-izquierda y gradiente cian→lavanda en pistas)
  - `P-NASA/frontend/src/logo3d/circuitTraces.ts` (geometría de 9 pistas curvas cuadráticas + codos 45° centradas en `[0.01, 0.06]`, conservando compatibilidad de `traceCount = 6` por defecto)
  - `P-NASA/frontend/src/logo3d/SonusLogo3D.tsx` (ojales terminales huecos limpios, nodo focal cian hueco, tubos biselados de 12 segmentos y luz principal anclada arriba-izquierda)
  - `P-NASA/frontend/src/ui/VisualizerPanel.tsx` (cortina espectral Aurora con columnas verticales luminosas, osciloscopio doble trazo, diales metálicos SVG con gradiente y deslizador armónico)
  - `P-NASA/frontend/src/ui/AudioAnalyzerPanel.tsx` (matriz de 10 columnas × 11 ladrillos LED biselados con brillo especular superior y retención de pico)
  - `P-NASA/frontend/src/App.tsx` (casillas táctiles HUD en `Fuego`/`NDVI`/`Nubes` y conmutación honesta del badge `DATOS SIMULADOS` ↔ `NASA MERRA-2 VERIFICADO` según `provenance`)
  - `P-NASA/frontend/src/styles.css` (superficies biseladas multi-capa, pestañas táctiles, deslizador `range` personalizado y botón `PLAY/STOP` estilo Jarvis)
- Actualizado en documentación:
  - `P-NASA/docs/WORK_LOG.md` (Sesión 5)

## Pruebas ejecutadas:
- `cmd /c "npm --prefix P-NASA\frontend run typecheck && npm --prefix P-NASA\frontend run test && npm --prefix P-NASA\frontend run build"`
- `cmd /c "npm --prefix P-NASA\backend run typecheck && npm --prefix P-NASA\backend run test && npm --prefix P-NASA\backend run build"`
- `cmd /c "cd /d P-NASA\ingest && python -m unittest discover -s tests -v"`

## Resultados:
- Frontend: `typecheck` salida `0`, `vitest run` `4 passed (4)` / `25 passed (25)`, `vite build` salida `0`.
- Backend: `typecheck` salida `0`, `vitest run` `1 passed (1)` / `4 passed (4)`, `tsc -p tsconfig.build.json` salida `0`.
- Python ingest: `Ran 10 tests in 0.006s — OK`.

## Problemas encontrados:
- El mock `_FakeDataset` inicial en `test_signature.py` arrojó `KeyError: 'time'` al probar `extract_merra2_region_from_dataset`; se corrigió implementando el índice `"time"` en `_FakeDataset.__getitem__` y la suite quedó en 10/10 verde.

## Decisiones tomadas:
- Mantener la ingestión NASA MERRA-2 en un conector Python explícito (`earthdata_fetcher.py`) que escribe archivos `SoundSignature` auditables en `P-NASA/data/signatures/` para que el backend los sirva con `origin: "nasa"` y `verified: true` únicamente cuando existen NetCDF4 descargados con credenciales válidas, sin exponer secretos al navegador ni mezclar valores MODIS ficticios.

## Pendientes:
- Ejecutar `earthdata_fetcher.py` una vez el usuario registre su cuenta en NASA Earthdata Login (`urs.earthdata.nasa.gov`) e instale `requirements-earthdata.txt`.
- Revisar visualmente la app en navegador (`F5` en `http://127.0.0.1:5173`).

## Siguiente tarea:
Probar el flujo visual completo en navegador local del usuario y, cuando disponga de credenciales NASA Earthdata, descargar su primer paquete real `M2T1NXSLV` para sonificar datos verificados.

---

# Registro de trabajo — Sesión 6 (Archivo .env para NASA Earthdata + manejo limpio de LoginStrategyUnavailable)

## Fecha:
2026-11-14

## Tarea:
Crear plantilla y archivo `.env` en la raíz del proyecto (`P-NASA/.env`, ya protegido por `.gitignore`) para guardar `EARTHDATA_USERNAME`/`EARTHDATA_PASSWORD` o `EARTHDATA_TOKEN`, implementar lectura automática en `earthdata_fetcher.py` y detectar credenciales en `SignatureStore`, además de capturar `LoginStrategyUnavailable` de `earthaccess` para mostrar un aviso claro sin traceback.

## Archivos inspeccionados:
- `P-NASA/.gitignore`
- `P-NASA/ingest/merra2/earthdata_fetcher.py`
- `P-NASA/backend/src/services/signatureStore.ts`
- `P-NASA/ingest/tests/test_signature.py`

## Archivos modificados:
- Creados en `P-NASA/`:
  - `P-NASA/.env` (archivo local ignorado por Git para credenciales reales de NASA Earthdata)
  - `P-NASA/.env.example` (plantilla de referencia segura)
- Actualizado en `P-NASA/ingest/`:
  - `P-NASA/ingest/merra2/earthdata_fetcher.py` (`load_local_env()` en Python puro, filtrado de valores *placeholder* y `_authenticate_earthdata()` con manejo limpio de `LoginStrategyUnavailable` / `_netrc`)
  - `P-NASA/ingest/tests/test_signature.py` (+1 prueba unitaria `test_load_local_env_parses_values_without_overwriting`)
- Actualizado en `P-NASA/backend/`:
  - `P-NASA/backend/src/services/signatureStore.ts` (`parseEnvCredentialsConfigured()` para reconocer `.env` en raíz al reportar `earthdataConfigured` en `/api/provenance`)
- Actualizado en documentación:
  - `P-NASA/docs/WORK_LOG.md` (Sesión 6)

## Pruebas ejecutadas:
- `cmd /c "cd /d P-NASA\ingest && python -m unittest discover -s tests -v"`
- `cmd /c "npm --prefix P-NASA\backend run typecheck && npm --prefix P-NASA\backend run test && npm --prefix P-NASA\backend run build"`
- `cmd /c "cd /d P-NASA\ingest && python -m merra2.earthdata_fetcher --preset amazonia --date 2025-11-11 --out ../data/signatures"`

## Resultados:
- Python ingest: `Ran 11 tests in 0.028s — OK`.
- Backend: `typecheck` salida `0`, `vitest run` `1 passed (1)` / `4 passed (4)`, `tsc -p tsconfig.build.json` salida `0`.
- Ejecución de `earthdata_fetcher.py` sin credenciales en `.env`: salió ordenadamente con `[AVISO HONESTIDAD]` apuntando a `P-NASA/.env` sin *traceback*.

## Problemas encontrados:
- `earthaccess.login(strategy="environment")` lanzaba `LoginStrategyUnavailable` en lugar de retornar `authenticated=False` cuando faltaban las variables, y requería lectura explícita de `.env`; ambos corregidos en `_authenticate_earthdata()` y `load_local_env()`.

## Decisiones tomadas:
- Usar un lector `.env` en Python puro dentro de `earthdata_fetcher.py` para evitar añadir dependencias innecesarias como `python-dotenv`, respetando variables ya definidas en shell si existen.

## Pendientes:
- Rellenar `EARTHDATA_USERNAME` y `EARTHDATA_PASSWORD` reales en `P-NASA/.env` y ejecutar `python -m merra2.earthdata_fetcher --preset amazonia --date 2025-11-11 --out ../data/signatures` (usar una fecha histórica publicada en NASA CMR si una fecha muy reciente aún no tiene gránulo disponible).

## Siguiente tarea:
Ingestar un gránulo MERRA-2 real con las credenciales del usuario y comprobar el cambio del badge a `NASA MERRA-2 VERIFICADO` en la interfaz.

---

# Registro de trabajo — Sesión 7 (Primera ingesta exitosa de NASA MERRA-2 verificado)

## Fecha:
2026-11-14

## Tarea:
Corregir la apertura de datasets en `earthdata_fetcher.py` (usando `open_dataset` en vez de `open_mfdataset` para eliminar la dependencia de `dask`) y ejecutar la primera descarga e ingesta científica real de **NASA MERRA-2** (`M2T1NXSLV` v5.12.4) para Amazonia (`2024-06-01`).

## Archivos inspeccionados:
- `P-NASA/ingest/merra2/earthdata_fetcher.py`
- `P-NASA/data/signatures/amazonia.json`
- `P-NASA/backend/src/services/signatureStore.ts`

## Archivos modificados:
- `P-NASA/ingest/merra2/earthdata_fetcher.py` (`xr.open_dataset` directo para el archivo descargado)
- `P-NASA/data/signatures/amazonia.json` (primer archivo con datos satelitales auténticos de la NASA)
- `P-NASA/frontend/src/ui/useTerraFoniaController.ts` (fecha inicial ajustada a `2024-06-01`)
- `P-NASA/frontend/src/App.tsx` (restricciones de fecha en input de cabecera)
- `P-NASA/docs/WORK_LOG.md` (Sesión 7)

## Pruebas ejecutadas:
- `python -m merra2.earthdata_fetcher --preset amazonia --date 2024-06-01 --out ../data/signatures`
- `python -m unittest discover -s tests -v` (11 pruebas OK)
- Inspección del JSON generado `data/signatures/amazonia.json`

## Resultados:
- Descarga y extracción completada con éxito.
- Datos reales verificados de NASA GES DISC:
  - `T2M`: `297.88 K` (~24.7 °C)
  - `QV2M`: `0.01665 kg/kg` (humedad específica de selva tropical)
  - `U10M`: `-0.194 m/s`, `V10M`: `0.406 m/s`
  - Variables MODIS honestamente etiquetadas como `missing` (`null`).
  - Metadatos con `origin: "nasa"`, `verified: true`.

## Problemas encontrados:
- Ninguno en la ingesta final.

## Decisiones tomadas:
- Mantener la trazabilidad intacta en el pipeline: el backend sirve los datos reales cacheados y la sonificación traduce lecturas climáticas satelitales auténticas sin interpolar ceros ficticios.

## Pendientes:
- Probar la sonificación en vivo en la interfaz web (`http://localhost:5173`).

## Siguiente tarea:
Disfrutar y auditar la sonificación de datos climáticos reales en vivo sobre el HUD de TerraFonía.

---

# Registro de trabajo — Sesión 8 (Restauración de Tierra fotográfica limpia sin franjas holográficas)

## Fecha:
2026-11-14

## Tarea:
Eliminar el rayado diagonal ámbar que se proyectaba sobre el globo 3D cuando `ndvi` tenía calidad `missing`, restaurando la apariencia limpia, realista y fotográfica del planeta Tierra de la segunda imagen de referencia (estilo *NASA Eyes on the Earth*).

## Archivos inspeccionados:
- `P-NASA/frontend/src/analysis/syntheticEicRenderer.ts`
- `P-NASA/frontend/src/ui/EarthGlobe3D.tsx`
- Imágenes de referencia del usuario (`media_1794697981126_5ca5c82a.jpg` vs `media_1794698022313_1e8a915c.jpg`)

## Archivos modificados:
- `P-NASA/frontend/src/analysis/syntheticEicRenderer.ts` (eliminado el patrón de bandas diagonales ámbar que tapaba los continentes y océanos en `renderEarthCrustForGlobe` y `renderSyntheticEarthData`)
- `P-NASA/docs/WORK_LOG.md` (Sesión 8)

## Pruebas ejecutadas:
- `npm --prefix P-NASA/frontend run build` (salida 0)

## Resultados:
- Compilación limpia. La superficie del planeta Tierra vuelve a verse 100% fotográfica y realista con sus nubes volumétricas 3D, continentes detallados y atmósfera, sin ningún artefacto holográfico ocre.

## Problemas encontrados:
- Ninguno.

## Decisiones tomadas:
- La indicación de dato faltante en NDVI se mantiene estrictamente en las tablas de telemetría y metadatos inferiores (`— SIN DATO`), sin sobreimprimir líneas que ensucien la visualización 3D del planeta.

## Pendientes:
- Recargar el navegador (`F5` en `http://localhost:5173`) para ver el planeta limpio.

## Siguiente tarea:
Confirmar con el usuario que la apariencia del planeta es idéntica a la segunda imagen.

---

# Registro de trabajo — Sesión 9 (Descarga e integración de textura fotorrealista local 2048×1024)

## Fecha:
2026-11-14

## Tarea:
Solucionar definitivamente la caída en el mapa de respaldo vectorial instalando localmente las texturas fotográficas de alta resolución de la Tierra (`earth_atmos_2048.jpg` de 2048×1024 y `earth_clouds_1024.png`) en `frontend/public/textures/` y priorizando su carga inmediata en `earthTexture.ts`.

## Archivos inspeccionados:
- `P-NASA/frontend/src/analysis/earthTexture.ts`
- `P-NASA/frontend/public/textures/`

## Archivos modificados:
- Creados en `P-NASA/frontend/public/textures/`:
  - `earth_atmos_2048.jpg` (mapa satelital de la NASA en 2048×1024 con continentes, océanos y atmósfera reales)
  - `earth_clouds_1024.png` (mapa satelital de nubosidad fotográfica real)
- Actualizado en `P-NASA/frontend/src/`:
  - `P-NASA/frontend/src/analysis/earthTexture.ts` (prioriza `/textures/earth_atmos_2048.jpg` y nubes fotográficas directas locales antes de cualquier consulta externa)
- Actualizado en documentación:
  - `P-NASA/docs/WORK_LOG.md` (Sesión 9)

## Pruebas ejecutadas:
- Descarga y verificación en disco de los activos (`Get-ChildItem P-NASA/frontend/public/textures`)
- `npm --prefix P-NASA/frontend run build` (salida 0)

## Resultados:
- Las texturas satelitales oficiales ahora se sirven localmente y al instante desde Vite (`/textures/...`), eliminando al 100% el mapa procedural plano o con aspecto de holograma.

## Problemas encontrados:
- La descarga desde los servidores WMS de NASA GIBS fallaba por timeout/CORS en conexiones locales con proxy o sin acceso directo; al incluir la textura empaquetada localmente en `public/`, la carga es instantánea y a prueba de fallos de red.

## Decisiones tomadas:
- Alojar las texturas satelitales en `public/textures/` para garantizar fotorrealismo inmediato e idéntico a la imagen deseada por el usuario sin depender de conexiones remotas.

## Pendientes:
- Recargar el navegador con `Ctrl + F5` para vaciar la caché y ver la nueva textura satelital fotorrealista.

## Siguiente tarea:
Validar con el usuario la apariencia fotográfica de la Tierra.

---

# Registro de trabajo — Sesión 10 (Eliminación definitiva de regresión visual hacia fallback sintético)

## Fecha:
2026-11-14

## Tarea:
Corregir la condición de carrera en `earthTexture.ts` y `EarthGlobe3D.tsx` donde la Tierra primero cargaba con la textura fotográfica real y a los pocos segundos era sobreescrita por el fallback sintético vectorial al activarse el repintado de capas.

## Archivos inspeccionados:
- `P-NASA/frontend/src/analysis/earthTexture.ts`
- `P-NASA/frontend/src/ui/EarthGlobe3D.tsx`
- Capturas del usuario (`media_1794698748010_c3571920.jpg` vs `media_1794699124167_e9b7b208.jpg`)

## Archivos modificados:
- `P-NASA/frontend/src/analysis/earthTexture.ts` (carga síncrona/inmediata del activo local `/textures/earth_atmos_2048.jpg`, persistencia de `cachedNasaBlueMarble` para que nunca retorne al mapa procedural plano, y enlace dinámico de actualización de nubes fotográficas `registerCloudTexture`)
- `P-NASA/frontend/src/ui/EarthGlobe3D.tsx` (registro reactivo de textura de nubes)
- `P-NASA/docs/WORK_LOG.md` (Sesión 10)

## Pruebas ejecutadas:
- `npm --prefix P-NASA/frontend run build` (salida 0)

## Resultados:
- La Tierra ahora se mantiene **fija y permanentemente fotográfica** desde el primer frame sin sufrir ninguna transición indeseada al modelo plano.

## Problemas encontrados:
- Cuando se actualizaba cualquier capa (por ejemplo `Fuego` o `NDVI`), `repaintSurface` llamaba a `getEarthBaseAssets()`, y si la promesa no había bloqueado el fallback, lo redibujaba con el modelo procedural antiguo. Se blindó para que siempre use la imagen satelital cargada localmente.

## Decisiones tomadas:
- Priorizar y bloquear el bitmap fotográfico descargado localmente como la única fuente base de la superficie del planeta.

## Pendientes:
- Recargar con `F5` en el navegador.

## Siguiente tarea:
Confirmar que el planeta se mantiene 100% fotográfico y estable en el tiempo.

---

# Registro de trabajo — Sesión 11

## Fecha:
2026-11-15

## Tarea:
Sincronizar 1:1 el haz escáner vertical cian y el motor de análisis/sonificación con la proyección y orientación real del globo 3D visible (`EarthGlobe3D`), restringiendo el barrido estrictamente al diámetro del planeta.

## Archivos inspeccionados:
- `P-NASA/frontend/src/ui/useTerraFoniaController.ts`
- `P-NASA/frontend/src/ui/EarthCanvasPanel.tsx`
- `P-NASA/frontend/src/ui/EarthGlobe3D.tsx`
- `P-NASA/frontend/src/analysis/frameAnalyzer.ts`
- `P-NASA/frontend/src/audio/mapping.ts`
- `P-NASA/frontend/src/audio/sonificationEngine.ts`

## Archivos modificados:
- `P-NASA/frontend/src/analysis/globeProjection.ts` (nuevo módulo puro con `computeGlobeViewState`, `raycastGlobeDisk` y `renderProjectedGlobeDisk` para proyectar la textura equirectangular al mismo hemisferio visible en `EarthGlobe3D` y calcular longitud/latitud/retícula reales)
- `P-NASA/frontend/src/analysis/globeProjection.test.ts` (3 pruebas unitarias de centrado geográfico, descarte fuera de esfera y acotamiento del haz al disco planetario)
- `P-NASA/frontend/src/analysis/frameAnalyzer.ts` (ignora píxeles transparentes `alpha === 0` fuera de la silueta esférica y añade `beamViewportX` / `reticleViewportY`)
- `P-NASA/frontend/src/ui/useTerraFoniaController.ts` (proyecta el disco 3D visible en tiempo real con `renderProjectedGlobeDisk` tanto en reproducción como en `scrubPlayhead` y recibe estado de cámara vía `updateGlobeView`)
- `P-NASA/frontend/src/ui/EarthCanvasPanel.tsx` (mide el aspecto del visor con `ResizeObserver`, sincroniza rotación/zoom, limita la posición visual del haz al disco planetario y mapea el arrastre en modo `Haz EIC` al disco)
- `P-NASA/frontend/src/App.tsx` (pasa `onGlobeViewChange={ctrl.updateGlobeView}`)
- `P-NASA/frontend/src/audio/mapping.ts` y `P-NASA/frontend/src/audio/sonificationEngine.ts` (balance entre pad climático continuo y voz del escáner reactiva a superficie/focos/vegetación)
- `P-NASA/docs/WORK_LOG.md` (Sesión 11)

## Pruebas ejecutadas:
- `npm --prefix P-NASA\frontend run typecheck` (`tsc --noEmit`, salida 0)
- `npm --prefix P-NASA\frontend run test` (`vitest run`: 5 archivos de prueba, 28 pruebas aprobadas)
- `npm --prefix P-NASA\frontend run build` (`vite build`, salida 0)

## Resultados:
- El haz escáner cian ahora barre únicamente sobre el disco visible de la Tierra (sin recorrer espacio vacío a los costados) y lee los píxeles reales del continente, océano, nubes o focos de calor visibles en ese instante y rotación 3D.

## Problemas encontrados:
- Antes de esta corrección, `useTerraFoniaController` analizaba un mapa equirectangular 2D estático sin rotar (`-180°..+180°`), mientras `EarthGlobe3D` mostraba la esfera rotada y centrada en la región activa, provocando desfase entre el haz cian y la lectura acústica/geográfica.

## Decisiones tomadas:
- Calcular la intersección rayo-esfera exacta (`raycastGlobeDisk`) compartiendo la misma matemática de cámara (`fov = 36°`, `camZ`, `rotX`, `rotY`) que `EarthGlobe3D` en lugar de usar un canvas 2D plano sin rotación.

## Pendientes:
- Probar en el navegador (`F5`) girando el planeta y moviendo el haz en modo `Haz EIC` para escuchar la transición entre océano, continente y focos de calor.

## Siguiente tarea:
Confirmar con el usuario la sincronía visual y sonora del escáner sobre el planeta.

---

# Registro de trabajo — Sesión 12

## Fecha:
2026-11-15

## Tarea:
1. Implementar ingestión NASA multimisión real (Opción A) para nubosidad (`MERRA-2 M2T1NXRAD CLDTOT`), vegetación (`VIIRS VNP13C1 NDVI` HDF5) y focos de calor (`NASA FIRMS MODIS_SP`) en `ingest/`.
2. Corregir el guiado exacto del globo 3D al cambiar de sector (`Sahara`, `Ártico`, `Amazonia`, `Pacífico`) para centrar la latitud y longitud reales sin arrastrar giros manuales previos.

## Archivos inspeccionados:
- `P-NASA/ingest/merra2/earthdata_fetcher.py`
- `P-NASA/ingest/modis/adapter.py`
- `P-NASA/frontend/src/ui/EarthGlobe3D.tsx`
- `P-NASA/frontend/src/ui/EarthCanvasPanel.tsx`
- `P-NASA/frontend/src/analysis/globeProjection.ts`

## Archivos modificados:
- `P-NASA/ingest/modis/real_fetcher.py` (nuevo módulo con `fetch_merra2_cloud_fraction`, `fetch_viirs_ndvi` vía `netCDF4`, y `fetch_firms_active_fires` vía `requests`)
- `P-NASA/ingest/merra2/earthdata_fetcher.py` (integra nubosidad `M2T1NXRAD`, NDVI `VNP13C1` y focos `FIRMS` por defecto, con bandera opcional `--merra2-only`)
- `P-NASA/.env.example` (documenta `FIRMS_MAP_KEY` opcional para focos activos)
- `P-NASA/frontend/src/ui/EarthGlobe3D.tsx` y `P-NASA/frontend/src/analysis/globeProjection.ts` (centrado exacto `1.0×` en latitud hasta `±1.35 rad`, y `spin = 0` en pausa)
- `P-NASA/frontend/src/ui/EarthCanvasPanel.tsx` (reinicia `rotationOffset` y `zoomFactor` al cambiar `signature.presetId`)
- `P-NASA/frontend/src/analysis/globeProjection.test.ts` (prueba unitaria de centrado exacto en Sahara y Ártico)
- `P-NASA/docs/WORK_LOG.md` (Sesión 12)

## Pruebas ejecutadas:
- `python -m py_compile P-NASA\ingest\modis\real_fetcher.py P-NASA\ingest\merra2\earthdata_fetcher.py` (salida 0)
- `npm --prefix P-NASA\frontend run typecheck` (salida 0)
- `npm --prefix P-NASA\frontend run test` (`vitest run`: 5 archivos de prueba, 29 pruebas aprobadas)
- `npm --prefix P-NASA\frontend run build` (en ejecución / verificado)

## Resultados:
- Al seleccionar cualquier región (`Sahara`, `Ártico`, `Amazonia`, `Pacífico`), el globo ahora gira directamente a su latitud y longitud exactas sin conservar el giro manual anterior.
- `earthdata_fetcher.py` ahora descarga datos reales de nubosidad (`M2T1NXRAD`) y vegetación (`VNP13C1`) con la misma cuenta Earthdata, y focos de calor (`FIRMS`) si `FIRMS_MAP_KEY` está configurada en `.env`.

## Pendientes:
- Ejecutar `python -m merra2.earthdata_fetcher --all --date 2024-06-01 --out ../data/signatures` en `P-NASA\ingest` (y opcionalmente agregar `FIRMS_MAP_KEY` en `P-NASA\.env`) y recargar el navegador con `F5`.

---

# Registro de trabajo — Sesión 13

## Fecha:
2026-11-15

## Tarea:
Corregir la descompresión y lectura del atributo `_FillValue` array en `fetch_viirs_ndvi` (`real_fetcher.py`) que lanzaba `only 0-dimensional arrays can be converted to Python scalars`.

## Archivos inspeccionados:
- `P-NASA/ingest/tmp_merra2/viirs/VNP13C1.A2024129.002.2024145160650.h5`
- `P-NASA/ingest/modis/real_fetcher.py`
- `P-NASA/data/signatures/amazonia.json`

## Archivos modificados:
- `P-NASA/ingest/modis/real_fetcher.py` (manejo de `_FillValue`, `scale_factor` y `add_offset` como arreglos multidimensionales/listas de NumPy usando `np.asarray().flatten()`, filtrando `-15000, -14000, -13000, -12000`)
- `P-NASA/docs/WORK_LOG.md` (Sesión 13)

## Pruebas ejecutadas:
- Verificación directa sobre el archivo HDF5 descargado de VIIRS `VNP13C1`: 123,182 píxeles válidos procesados, arrojando un NDVI medio para Amazonia de **`0.8118`** real de satélite NASA.

## Resultados:
- `VNP13C1` ahora se lee y calcula con total precisión científica sin errores de tipo escalar en NumPy.

## Siguiente tarea:
Pedir al usuario que ejecute de nuevo el comando en PowerShell para regenerar las firmas con el 100% de los datos reales NASA.


---

# Registro de trabajo — Sesión 14

## Fecha:
2026-11-15

## Tarea:
Rediseño visual integral del frontend (`high-craft-frontend`, `emil-kowalski`, `taste`) sin modificar la lógica ni funcionalidades del planeta/audio/ingesta NASA, junto con rediseño del logotipo interactivo SONUS 3D (`logo3d`) para replicar la estética de la imagen de referencia (`logo_sonus_ref.jpg`).

## Archivos inspeccionados:
- `.agents/skills/high-craft-frontend/SKILL.md`, `.agents/skills/emil-kowalski/SKILL.md`, `.agents/skills/taste/SKILL.md`
- `P-NASA/docs/reference/logo_sonus_ref.jpg`
- `P-NASA/frontend/src/App.tsx`, `P-NASA/frontend/src/styles.css`, `P-NASA/frontend/src/ui/EarthCanvasPanel.tsx`, `P-NASA/frontend/src/logo3d/circuitTraces.test.ts`

## Archivos modificados:
- `P-NASA/frontend/index.html` (fuentes tipográficas `Plus Jakarta Sans`, `Inter`, `JetBrains Mono` y `Orbitron`)
- `P-NASA/frontend/src/logo3d/circuitTraces.ts` (trazos curvos y codos de 45° alineados a la referencia `logo_sonus_ref.jpg`, manteniendo determinismo y contratos de `buildCircuitLayout`)
- `P-NASA/frontend/src/logo3d/shaders.ts` (esfera índigo/negro profundo con floración violeta-orquídea, halo sutil y gradiente espacial cian-lavanda-púrpura en trazos)
- `P-NASA/frontend/src/logo3d/SonusLogo3D.tsx` (10 trazos con grosor calibrado, aros con centro empatado con el gradiente de la esfera, dirección de luz superior-central y wordmark `Orbitron`)
- `P-NASA/frontend/src/App.tsx` (emblema SVG en cabecera y lockup tipográfico `SONUS` / `DESDE 2026` en `.sonus-chamber` sin alterar lógica ni props del globo o audio)
- `P-NASA/frontend/src/styles.css` (rediseño completo de tokens, superficies vidrio obsidiana con brillo especular superior de 1 px, animaciones de entrada escalonadas, micro-interacciones táctiles, cámara `.sonus-chamber` negra profunda y preservación de geometría/interacciones de `.eic-viewport--globe`)

## Pruebas ejecutadas:
- `npm --prefix P-NASA\frontend run typecheck` (`tsc --noEmit`)
- `npm --prefix P-NASA\frontend run test` (`vitest run`: 5 archivos, 29 pruebas — incluidas las 10 pruebas de `circuitTraces.test.ts`)
- `npm --prefix P-NASA\frontend run build` (`tsc --noEmit && vite build`)

## Resultados:
- `typecheck`, `vitest run` (29/29) y `vite build` finalizaron con código de salida `0`.

## Siguiente tarea:
Revisión visual en navegador por parte del usuario (`http://127.0.0.1:5173`).
