import type { FrameFeatures } from "../analysis/frameAnalyzer";
import type { MusicalScaleId, SonificationTargets } from "../audio/mapping";
import type { VoiceSolo } from "../audio/sonificationEngine";
import type { LayerToggles, SoundSignature } from "../types/soundSignature";
import type { ScaleChoice } from "../ui/useTerraFoniaController";
import type { NarratorLang } from "./sonusNarrator";

export type AgentAction =
  | { type: "setPreset"; presetId: string; label: string }
  | { type: "setPlaying"; playing: boolean; label: string }
  | { type: "setLayer"; layer: keyof LayerToggles; enabled: boolean; label: string }
  | { type: "setSoloVoice"; voice: VoiceSolo; label: string }
  | { type: "setModulation"; value: number; label: string }
  | { type: "setSweepSpeed"; value: number; label: string }
  | { type: "setScale"; scale: ScaleChoice; label: string }
  | { type: "setLang"; lang: NarratorLang; label: string };

export interface SonusAgentContext {
  lang: NarratorLang;
  playing: boolean;
  signature: SoundSignature;
  targets: SonificationTargets;
  frameFeatures: FrameFeatures;
  layers: LayerToggles;
  modulationAmount: number;
  sweepSpeed: number;
  scaleChoice: ScaleChoice;
}

export interface SonusAgentResponse {
  reply: string;
  actions: AgentAction[];
  badges: string[];
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function explainFrequencyBand(bandIndex: number, ctx: SonusAgentContext): string {
  const { targets, signature, lang } = ctx;
  const t2m = signature.variables.t2m.value;
  const ndvi = signature.variables.ndvi.value;
  const fire = signature.variables.fireCount.value;
  const cloud = signature.variables.cloudFraction.value;

  if (lang === "en") {
    if (bandIndex <= 1) {
      return `60–120 Hz (Sub-bass & Climate): Driven by temperature (${t2m !== null ? `${t2m.toFixed(1)} K` : "null"}) mapped to fundamental ${targets.baseFreqHz.toFixed(1)} Hz. Cold regions like the Arctic sound deeper; warmer regions rise in pitch.`;
    }
    if (bandIndex <= 3) {
      return `250–450 Hz (Atmospheric Body & Filter): Shaped by the main low-pass filter (${Math.round(targets.filterCutoffHz)} Hz) and humidity resonance Q (${targets.filterQ.toFixed(2)}).`;
    }
    if (bandIndex <= 5) {
      return `850 Hz–1.5 kHz (Vegetation NDVI & Scan Tone): Biotic fifth/octave harmonics (${ndvi !== null ? `NDVI ${ndvi.toFixed(2)}` : "missing"}) plus the latitude guide tone (${Math.round(targets.scannerPitchHz)} Hz).`;
    }
    if (bandIndex <= 7) {
      return `2.5–4 kHz (Active Fire & Terrain Edges): High granular crackle bursts from active fires (${fire !== null ? `${Math.round(fire)} hotspots` : "missing"}) and Sobel edge air texture (${Math.round(ctx.frameFeatures.edgeDensity * 100)}%).`;
    }
    return `6–9 kHz (Air & Spatial Tail): Upper overtones and atmospheric reverb diffusion (${cloud !== null ? `cloud cover ${Math.round(cloud * 100)}%` : "minimal wet tail"}).`;
  }

  if (bandIndex <= 1) {
    return `60–120 Hz (Graves · Clima): Aquí vive el sub-bajo y tono fundamental (${targets.baseFreqHz.toFixed(1)} Hz) generado por la temperatura (${t2m !== null ? `${t2m.toFixed(1)} K` : "sin dato"}). Zonas frías suenan más graves y zonas cálidas suben de registro.`;
  }
  if (bandIndex <= 3) {
    return `250–450 Hz (Cuerpo tonal y Humedad): Moldeado por el filtro principal en ${Math.round(targets.filterCutoffHz)} Hz y la resonancia Q (${targets.filterQ.toFixed(2)}) controlada por la humedad específica.`;
  }
  if (bandIndex <= 5) {
    return `850 Hz–1.5 kHz (Vegetación NDVI y Haz escáner): Contiene los armónicos bióticos de quinta y octava (${ndvi !== null ? `NDVI ${ndvi.toFixed(2)}` : "sin dato"}) junto con el tono guía del haz láser (${Math.round(targets.scannerPitchHz)} Hz).`;
  }
  if (bandIndex <= 7) {
    return `2.5–4 kHz (Fuego FIRMS y Bordes Sobel): Aquí saltan las chispas granulares cuando hay focos activos de calor (${fire !== null ? `${Math.round(fire)} focos` : "sin dato"}) y la textura de aire por densidad de bordes (${Math.round(ctx.frameFeatures.edgeDensity * 100)}%).`;
  }
  return `6–9 kHz (Aire y Cola Espacial): Armónicos superiores y difusión de reverberación atmosférica (${cloud !== null ? `nubosidad ${Math.round(cloud * 100)}%` : "reverb mínima"}).`;
}

function buildLiveDiagnosis(ctx: SonusAgentContext): string {
  const { signature, targets, frameFeatures, playing, lang } = ctx;
  const v = signature.variables;
  const missing = targets.missingVariables;

  if (lang === "en") {
    const state = playing ? "live audio is playing" : "audio is in standby";
    const fireTxt =
      v.fireCount.value === null
        ? "fire voice muted (missing data)"
        : v.fireCount.value > 0
          ? `${Math.round(v.fireCount.value)} active hotspots triggering 1.8–4.2 kHz crackles`
          : "0 hotspots (fire crackle silent)";
    const ndviTxt =
      v.ndvi.value === null
        ? "NDVI harmonics muted (null)"
        : `NDVI ${v.ndvi.value.toFixed(2)} feeding biotic harmonics`;
    const missingTxt = missing.length > 0 ? ` Missing variables: ${missing.join(", ")}.` : "";
    return `In ${signature.region.name} (${state}), fundamental pitch is ${targets.baseFreqHz.toFixed(1)} Hz from ${v.t2m.value !== null ? `${v.t2m.value.toFixed(1)} K` : "neutral fallback"}, filter cutoff is ${Math.round(targets.filterCutoffHz)} Hz, wind LFO runs at ${targets.lfoRateHz.toFixed(2)} Hz, ${ndviTxt}, and ${fireTxt}. Sobel edge density is ${Math.round(frameFeatures.edgeDensity * 100)}%.${missingTxt}`;
  }

  const state = playing ? "el audio está sonando en vivo" : "el motor está en espera (STANDBY)";
  const fireTxt =
    v.fireCount.value === null
      ? "la voz de fuego está silenciada por dato faltante"
      : v.fireCount.value > 0
        ? `hay ${Math.round(v.fireCount.value)} focos de calor generando chispas entre 1.8 y 4.2 kHz`
        : "hay 0 focos de calor, así que la banda de fuego está en silencio";
  const ndviTxt =
    v.ndvi.value === null
      ? "los armónicos NDVI están apagados (null)"
      : `el NDVI (${v.ndvi.value.toFixed(2)}) aporta armónicos en medios`;
  const missingTxt = missing.length > 0 ? ` Variables faltantes: ${missing.join(", ")}.` : "";

  return `En ${signature.region.name} (${state}), la fundamental está en ${targets.baseFreqHz.toFixed(1)} Hz por la temperatura (${v.t2m.value !== null ? `${v.t2m.value.toFixed(1)} K` : "sin dato"}), el filtro corta en ${Math.round(targets.filterCutoffHz)} Hz, el viento modula a ${targets.lfoRateHz.toFixed(2)} Hz, ${ndviTxt} y ${fireTxt}. Bordes Sobel: ${Math.round(frameFeatures.edgeDensity * 100)}%.${missingTxt}`;
}

export function interpretSonusQuery(rawQuery: string, ctx: SonusAgentContext): SonusAgentResponse {
  const q = normalizeText(rawQuery);
  const actions: AgentAction[] = [];
  const badges: string[] = [];
  const lang = ctx.lang;

  // 1. Cambio de idioma explícito
  if (/\b(english|ingles|speak english|habla en ingles)\b/.test(q)) {
    actions.push({ type: "setLang", lang: "en", label: "Idioma → EN" });
    badges.push("EN");
    return {
      reply: "Switched to English. Ask me about any frequency band, region, or command such as 'take me to the Arctic and play'.",
      actions,
      badges,
    };
  }
  if (/\b(spanish|espanol|habla en espanol)\b/.test(q)) {
    actions.push({ type: "setLang", lang: "es", label: "Idioma → ES" });
    badges.push("ES");
    return {
      reply: "Cambiado a español. Pregúntame por cualquier banda en Hz, región o pídeme acciones como 'llévame al Ártico y reproduce'.",
      actions,
      badges,
    };
  }

  // Detectar si el usuario está haciendo una PREGUNTA / pidiendo ayuda (no dando una orden)
  const hasImperative = /\b(lleva\w*|ve a|ir a|cambia\w*|pon\b|ponme|abre|activa|desactiva|solo\b|only\b|reproduc\w*|dale play|pon play|inicia\b|arranca\b|deten\w*|para\b|pausa\b|silencia\b|sube\b|aumenta\b|baja\b|reduce\b|acelera\b|go to|switch to|load|set|play\b|stop\b|start\b|mute\b|increase|decrease)\b/.test(
    q
  );
  const isQuestion =
    /[?¿]/.test(rawQuery) ||
    /\b(por que|porque|como\b|que es|que significa|que pasa|que estoy|se escucha|suena mas|grave|agudo|barra|distingo|diferencia|explica\w*|ayuda\w*|why\b|how\b|what\b|which\b|explain|meaning)\b/.test(
      q
    );
  const allowActions = hasImperative || !isQuestion;

  // 2. Navegación a regiones (presets) — solo cuando no es una pregunta comparativa/teórica
  const presetRules: Array<{ re: RegExp; id: string; nameEs: string; nameEn: string }> = [
    { re: /\b(amazon|amazonia|selva|brasil)\b/, id: "amazonia", nameEs: "Amazonia", nameEn: "Amazonia" },
    { re: /\b(artico|arctic|polo|hielo|norte)\b/, id: "artico", nameEs: "Ártico", nameEn: "Arctic" },
    { re: /\b(sahara|desierto|africa|arena)\b/, id: "sahara", nameEs: "Sahara", nameEn: "Sahara" },
    { re: /\b(pacifico|pacific|oceano|mar)\b/, id: "pacifico", nameEs: "Pacífico", nameEn: "Pacific" },
    { re: /\b(missing_dropout|dropout|simula.*faltante|preset.*faltante|carga.*faltante)\b/, id: "missing_dropout", nameEs: "Simulación faltante", nameEn: "Missing dropout" },
  ];

  let matchedPreset: (typeof presetRules)[number] | null = null;
  if (allowActions) {
    for (const rule of presetRules) {
      if (rule.re.test(q)) {
        matchedPreset = rule;
        actions.push({
          type: "setPreset",
          presetId: rule.id,
          label: `Preset → ${lang === "en" ? rule.nameEn : rule.nameEs}`,
        });
        badges.push(lang === "en" ? rule.nameEn : rule.nameEs);
        break;
      }
    }
  }

  // 3. Reproducción / pausa (comandos explícitos, nunca palabras como "escucha" o "suena")
  const wantsPlay = /\b(play|reproduc\w*|dale play|pon play|inicia(?: el)? audio|arranca(?: el)? audio|enciende(?: el)? audio|start audio)\b/.test(
    q
  );
  const wantsStop = /\b(stop|deten(?:er)?(?: el)? audio|pausa(?:r)?|silencia(?:r)?|apaga(?:r)?(?: el)? audio|calla|mute)\b/.test(
    q
  );
  if (allowActions) {
    if (wantsPlay && !wantsStop) {
      actions.push({ type: "setPlaying", playing: true, label: "Audio → PLAY" });
      badges.push("PLAY");
    } else if (wantsStop) {
      actions.push({ type: "setPlaying", playing: false, label: "Audio → STOP" });
      badges.push("STOP");
    }
  }

  // 4. Capas visuales / aislamiento individual de voz sonora (Solo)
  if (allowActions) {
    if (/\b(solo fuego|enfoca.*fuego|focus.*fire|aisla.*fuego|only fire)\b/.test(q)) {
      actions.push({ type: "setSoloVoice", voice: "fireGranular", label: "Solo → Fuego" });
      actions.push({ type: "setLayer", layer: "fire", enabled: true, label: "Fuego ON" });
      actions.push({ type: "setLayer", layer: "ndvi", enabled: false, label: "NDVI OFF" });
      actions.push({ type: "setLayer", layer: "clouds", enabled: false, label: "Nubes OFF" });
      badges.push("Solo Fuego");
    } else if (/\b(solo ndvi|solo vegetacion|enfoca.*vegetacion|only ndvi|only vegetation|aisla.*ndvi)\b/.test(q)) {
      actions.push({ type: "setSoloVoice", voice: "vegetationHarmonics", label: "Solo → NDVI" });
      actions.push({ type: "setLayer", layer: "fire", enabled: false, label: "Fuego OFF" });
      actions.push({ type: "setLayer", layer: "ndvi", enabled: true, label: "NDVI ON" });
      actions.push({ type: "setLayer", layer: "clouds", enabled: false, label: "Nubes OFF" });
      badges.push("Solo NDVI");
    } else if (/\b(solo nubes|only clouds|enfoca.*nubes|aisla.*nubes)\b/.test(q)) {
      actions.push({ type: "setSoloVoice", voice: "cloudReverb", label: "Solo → Nubes" });
      actions.push({ type: "setLayer", layer: "fire", enabled: false, label: "Fuego OFF" });
      actions.push({ type: "setLayer", layer: "ndvi", enabled: false, label: "NDVI OFF" });
      actions.push({ type: "setLayer", layer: "clouds", enabled: true, label: "Nubes ON" });
      badges.push("Solo Nubes");
    } else if (/\b(solo clima|solo temperatura|only climate|aisla.*clima)\b/.test(q)) {
      actions.push({ type: "setSoloVoice", voice: "climatePad", label: "Solo → Clima" });
      badges.push("Solo Clima");
    } else if (/\b(solo viento|only wind|aisla.*viento)\b/.test(q)) {
      actions.push({ type: "setSoloVoice", voice: "windLfo", label: "Solo → Viento" });
      badges.push("Solo Viento");
    } else if (/\b(solo humedad|only humidity|aisla.*humedad)\b/.test(q)) {
      actions.push({ type: "setSoloVoice", voice: "humidityFilter", label: "Solo → Humedad" });
      badges.push("Solo Humedad");
    } else if (/\b(todas las capas|todas las voces|escuchar todo|mezcla completa|all layers|all voices|activa todo|enable all)\b/.test(q)) {
      actions.push({ type: "setSoloVoice", voice: "all", label: "Voz → Todas" });
      actions.push({ type: "setLayer", layer: "fire", enabled: true, label: "Fuego ON" });
      actions.push({ type: "setLayer", layer: "ndvi", enabled: true, label: "NDVI ON" });
      actions.push({ type: "setLayer", layer: "clouds", enabled: true, label: "Nubes ON" });
      badges.push("Todas las voces");
    }
  }

  // 5. Ajuste de modulación y barrido
  if (/\b(sube|aumenta|mas|max|increase|boost).*(modulacion|armonicos|modulation)\b/.test(q)) {
    const next = Math.min(1, Number((ctx.modulationAmount + 0.25).toFixed(2)));
    actions.push({ type: "setModulation", value: next, label: `Modulación → ${Math.round(next * 100)}%` });
    badges.push(`Mod ${Math.round(next * 100)}%`);
  } else if (/\b(baja|reduce|menos|decrease|lower).*(modulacion|armonicos|modulation)\b/.test(q)) {
    const next = Math.max(0.1, Number((ctx.modulationAmount - 0.25).toFixed(2)));
    actions.push({ type: "setModulation", value: next, label: `Modulación → ${Math.round(next * 100)}%` });
    badges.push(`Mod ${Math.round(next * 100)}%`);
  }

  if (/\b(rapido|acelera|sube|faster|increase).*(barrido|haz|sweep)\b/.test(q)) {
    const next = Math.min(0.4, Number((ctx.sweepSpeed + 0.08).toFixed(3)));
    actions.push({ type: "setSweepSpeed", value: next, label: `Barrido → ${Math.round(next * 1000)} mHz` });
    badges.push(`${Math.round(next * 1000)} mHz`);
  } else if (/\b(lento|despacio|baja|slower|decrease).*(barrido|haz|sweep)\b/.test(q)) {
    const next = Math.max(0.02, Number((ctx.sweepSpeed - 0.05).toFixed(3)));
    actions.push({ type: "setSweepSpeed", value: next, label: `Barrido → ${Math.round(next * 1000)} mHz` });
    badges.push(`${Math.round(next * 1000)} mHz`);
  }

  // 6. Escala musical
  const scaleMap: Array<{ re: RegExp; scale: ScaleChoice; name: string }> = [
    { re: /\b(dorica|dorian|oceano)\b/, scale: "dorian", name: "Dórico" },
    { re: /\b(lidia|lydian|biotico)\b/, scale: "lydian", name: "Lidio" },
    { re: /\b(pentatonica|pentatonic|criosfera)\b/, scale: "minor_pent", name: "Pent. Menor" },
    { re: /\b(armonica|harmonic|termico)\b/, scale: "harmonic_minor", name: "Menor Arm." },
    { re: /\b(auto|automatica)\b/, scale: "auto", name: "Auto" },
  ];
  for (const s of scaleMap) {
    if (s.re.test(q) && /\b(escala|scale|cambia|pon|set)\b/.test(q)) {
      actions.push({ type: "setScale", scale: s.scale, label: `Escala → ${s.name}` });
      badges.push(s.name);
      break;
    }
  }

  // Si ejecutó acciones de control/navegación, confirmar claramente
  if (actions.length > 0) {
    if (lang === "en") {
      const done = actions.map((a) => a.label).join(", ");
      const extra = matchedPreset
        ? " Watch the Audio Analyzer bands and telemetry update for the new region."
        : "";
      return {
        reply: `Done: ${done}.${extra}`,
        actions,
        badges,
      };
    }
    const done = actions.map((a) => a.label).join(", ");
    const extra = matchedPreset
      ? " Observa cómo cambian las bandas en Hz y la telemetría para esta región."
      : "";
    return {
      reply: `Listo: ${done}.${extra}`,
      actions,
      badges,
    };
  }

  // 7. Consulta específica sobre una frecuencia en Hz / kHz
  const hzMatch = q.match(/(\d+(?:\.\d+)?)\s*(khz|hz)/);
  if (hzMatch) {
    const rawNum = parseFloat(hzMatch[1]);
    const hz = hzMatch[2] === "khz" ? rawNum * 1000 : rawNum;
    const bandIndex =
      hz <= 150 ? 0 : hz <= 500 ? 2 : hz <= 1700 ? 4 : hz <= 4500 ? 6 : 8;
    return {
      reply: explainFrequencyBand(bandIndex, ctx),
      actions,
      badges: [`${Math.round(hz)} Hz`],
    };
  }

  // 8. Pregunta sobre temperatura / grave vs agudo / relación con fuego
  if (/\b(grave|agudo|temperatura|caliente|frio|pitch|tono|deeper|higher|warmer|colder)\b/.test(q)) {
    const t2m = ctx.signature.variables.t2m.value;
    const fire = ctx.signature.variables.fireCount.value;
    if (lang === "en") {
      return {
        reply: `Higher temperature produces a HIGHER (brighter) pitch, while colder regions sound DEEPER (lower). Right now in ${ctx.signature.region.name}, Temp. 2m is ${t2m !== null ? `${t2m.toFixed(1)} K` : "missing"} → fundamental ${ctx.targets.baseFreqHz.toFixed(1)} Hz. Note that FIRMS fires (${fire !== null ? Math.round(fire) : "null"} hotspots) do not directly raise the fundamental note; instead, fires add separate 1.8–4.2 kHz crackle sparks on the right side of the analyzer.`,
        actions,
        badges: [`${ctx.targets.baseFreqHz.toFixed(1)} Hz`, "Temp → Pitch"],
      };
    }
    return {
      reply: `Es al revés de lo que suele pensarse: a MAYOR temperatura, el tono base se escucha MÁS AGUDO, y en zonas frías se escucha MÁS GRAVE. Ahora mismo en ${ctx.signature.region.name}, la Temp. 2m (${t2m !== null ? `${t2m.toFixed(1)} K` : "sin dato"}) fija la fundamental en ${ctx.targets.baseFreqHz.toFixed(1)} Hz. Además, el fuego FIRMS (${fire !== null ? Math.round(fire) : "sin dato"} focos) no cambia directamente esa nota grave/aguda: el fuego suena aparte como chispas agudas entre 1.8 y 4.2 kHz.`,
      actions,
      badges: [`${ctx.targets.baseFreqHz.toFixed(1)} Hz`, "Temp → Tono"],
    };
  }

  // 9. Pregunta sobre por qué las barras de la izquierda (60–250 Hz) siguen arriba
  if (/\b(barra|barras|izquierda|arriba|led|leds|espectro|spectrum|bars|left)\b/.test(q)) {
    const fire = ctx.signature.variables.fireCount.value;
    if (lang === "en") {
      return {
        reply: `The left bars (60–250 Hz) stay high whenever audio is playing because they display the continuous Climate sub-bass (${(ctx.targets.baseFreqHz * 0.5).toFixed(0)} Hz) and atmospheric pad (${ctx.targets.baseFreqHz.toFixed(0)} Hz)—NOT fire. Fire appears on the right-middle bars (1.5k–4k Hz) as short bursts: right now with ${fire !== null ? Math.round(fire) : "missing"} hotspots, compare 4k–9k Hz between Amazonia and the Arctic.`,
        actions,
        badges: ["60–250 Hz = Clima", "1.5k–4k = Fuego"],
      };
    }
    return {
      reply: `Las barras de la izquierda (60–250 Hz) siempre están arriba cuando suena el audio porque muestran la base continua del Clima (sub-bajo a ${(ctx.targets.baseFreqHz * 0.5).toFixed(0)} Hz y pad a ${ctx.targets.baseFreqHz.toFixed(0)} Hz), NO el fuego. El fuego aparece en las barras medio-altas de la derecha (1.5k–4k Hz) en forma de pulsos: con ${fire !== null ? Math.round(fire) : "sin dato"} focos activos, fíjate cómo en el Ártico (0 focos) las barras 4k–9k se apagan mientras 60–450 Hz siguen activas por el clima.`,
      actions,
      badges: ["60–250 Hz = Clima", "1.5k–4k = Fuego"],
    };
  }

  // 10. Pregunta sobre cómo funcionan los controles (barrido, modulación, cabezal, Sobel, escala)
  if (/\b(barrido|modulacion|cabezal|sobel|escala|haz|sweep|modulation|scanner|scale)\b/.test(q) && isQuestion) {
    if (lang === "en") {
      return {
        reply: `Live controls in ${ctx.signature.region.name}: Modulation (${Math.round(ctx.modulationAmount * 100)}%) scales NDVI harmonics and wind LFO depth; Sweep (${Math.round(ctx.sweepSpeed * 1000)} mHz) moves the vertical scan beam across longitudes (panning stereo); Scanner tone (${Math.round(ctx.targets.scannerPitchHz)} Hz) tracks latitude; Sobel (${Math.round(ctx.frameFeatures.edgeDensity * 100)}%) adds filtered air texture along satellite edges.`,
        actions,
        badges: [`Mod ${Math.round(ctx.modulationAmount * 100)}%`, `Sobel ${Math.round(ctx.frameFeatures.edgeDensity * 100)}%`],
      };
    }
    return {
      reply: `Controles activos en ${ctx.signature.region.name}: Modulación (${Math.round(ctx.modulationAmount * 100)}%) intensifica los armónicos NDVI y el LFO del viento; Barrido (${Math.round(ctx.sweepSpeed * 1000)} mHz) desplaza el haz vertical por el globo moviendo el audio izquierda-derecha; el Cabezal (${Math.round(ctx.targets.scannerPitchHz)} Hz) sigue la latitud; y Sobel (${Math.round(ctx.frameFeatures.edgeDensity * 100)}%) añade textura de aire en los bordes del mapa.`,
      actions,
      badges: [`Mod ${Math.round(ctx.modulationAmount * 100)}%`, `Sobel ${Math.round(ctx.frameFeatures.edgeDensity * 100)}%`],
    };
  }

  // 11. Consulta sobre fuego / NDVI / datos faltantes / anomalías
  if (/\b(fuego|fire|calor|incendio)\b/.test(q)) {
    return {
      reply: explainFrequencyBand(6, ctx),
      actions,
      badges: ["2.5–4 kHz"],
    };
  }
  if (/\b(ndvi|vegetacion|selva|planta|armonico)\b/.test(q)) {
    return {
      reply: explainFrequencyBand(4, ctx),
      actions,
      badges: ["850 Hz–1.5 kHz"],
    };
  }
  if (/\b(faltantes?|null|nulos?|missing|anomalias?|errores?|amarillo)\b/.test(q)) {
    const missing = ctx.targets.missingVariables;
    if (lang === "en") {
      return {
        reply:
          missing.length === 0
            ? `No missing variables right now in ${ctx.signature.region.name}. All 7 NASA sensors are reporting valid data, and Sobel edge density is ${Math.round(ctx.frameFeatures.edgeDensity * 100)}%.`
            : `${missing.length} missing variables detected (${missing.join(", ")}). Their audio voices remain silenced rather than faked as zero.`,
        actions,
        badges: missing.length === 0 ? ["OK"] : ["Missing"],
      };
    }
    return {
      reply:
        missing.length === 0
          ? `No hay datos faltantes en ${ctx.signature.region.name}. Las 7 variables NASA reportan valores válidos y la densidad de bordes Sobel es ${Math.round(ctx.frameFeatures.edgeDensity * 100)}%.`
          : `Detecté ${missing.length} variables sin dato (${missing.join(", ")}). Sus voces se mantienen silenciadas para no falsificar un cero.`,
      actions,
      badges: missing.length === 0 ? ["OK"] : [`${missing.length} null`],
    };
  }

  // 12. Diagnóstico general ("¿qué estoy escuchando?", "explica las frecuencias", etc.)
  if (/\b(escuch\w*|frecuencia\w*|banda\w*|suen\w*|sonido\w*|diagnost\w*|que hay|analiz\w*|hear|frequency|band|explain)\b/.test(q)) {
    return {
      reply: buildLiveDiagnosis(ctx),
      actions,
      badges: [ctx.signature.region.name],
    };
  }

  // 13. Respuesta de ayuda contextual inteligente
  if (lang === "en") {
    return {
      reply: `Here is what is happening right now in ${ctx.signature.region.name}: ${buildLiveDiagnosis(ctx)} You can ask me things like "why are the left bars up?", "does heat sound higher or lower?", or give commands like "go to the Arctic and play".`,
      actions,
      badges: ["SONUS AI"],
    };
  }
  return {
    reply: `Esto es lo que ocurre ahora en ${ctx.signature.region.name}: ${buildLiveDiagnosis(ctx)} Puedes preguntarme dudas (ej. "¿por qué la barra izquierda sigue arriba?", "¿más calor suena más grave o agudo?") o darme órdenes (ej. "llévame al Ártico y reproduce", "solo fuego").`,
    actions,
    badges: ["SONUS IA"],
  };
}

export type { MusicalScaleId };
