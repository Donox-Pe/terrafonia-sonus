import { useCallback, useEffect, useRef, useState } from "react";

export type NarratorLang = "es" | "en";

export interface SonusChapter {
  id: string;
  shortTitle: string;
  title: string;
  text: string;
}

export const SONUS_CHAPTERS_ES: SonusChapter[] = [
  {
    id: "que-es",
    shortTitle: "1. Qué es",
    title: "¿Qué es SONUS · TerraFonía?",
    text:
      "Hola, soy SONUS. TerraFonía es un observatorio audiovisual que convierte datos reales de satélites de la NASA en música generativa e inspección visual en vivo. " +
      "Integra un globo terrestre interactivo en 3D con capas de incendios FIRMS, vegetación NDVI y nubosidad MODIS, " +
      "junto a un sintetizador Web Audio, un visualizador de onda, un analizador de espectro en hercios y un panel de trazabilidad científica.",
  },
  {
    id: "como-funciona",
    shortTitle: "2. Cómo funciona",
    title: "¿Cómo funciona el motor?",
    text:
      "El haz escáner recorre la superficie del globo analizando luminancia, matiz dominante y bordes del terreno, y los combina con siete variables atmosféricas verificadas de MERRA-2, VIIRS y MODIS. " +
      "La temperatura define la tonalidad base; la humedad ajusta la resonancia del filtro; el viento modula el movimiento estéreo; el índice vegetal NDVI añade armónicos; los focos activos de fuego disparan chispas granulares agudas; y la nubosidad regula la reverberación espacial.",
  },
  {
    id: "proposito",
    shortTitle: "3. Propósito",
    title: "¿Para qué fue creado?",
    text:
      "El proyecto nació para hacer audible y comprensible el estado vivo de la Tierra sin perder rigor científico. " +
      "Cada región —como la Amazonia, el Ártico, el Sahara o el Pacífico— tiene su propia huella acústica. " +
      "Además, si algún dato satelital no existe, el sistema nunca lo disfraza como cero: lo marca como nulo y silencia su capa sonora para preservar la integridad científica.",
  },
  {
    id: "expectativas",
    shortTitle: "4. Expectativas",
    title: "Expectativas y futuro",
    text:
      "Nuestra expectativa es consolidar a SONUS como una herramienta educativa, científica y artística abierta: " +
      "capaz de comparar cambios climáticos entre distintas fechas históricas, detectar anomalías térmicas o pérdida vegetal mediante el oído, " +
      "y conectar la telemetría espacial con una experiencia humana clara, inmersiva y verificable.",
  },
];

export const SONUS_CHAPTERS_EN: SonusChapter[] = [
  {
    id: "que-es",
    shortTitle: "1. What it is",
    title: "What is SONUS · TerraFonía?",
    text:
      "Hello, I am SONUS. TerraFonía is an audiovisual observatory that transforms real NASA satellite telemetry into generative music and live visual inspection. " +
      "It combines an interactive 3D Earth globe with FIRMS active fire layers, VIIRS vegetation index, and MODIS cloud cover, " +
      "alongside a real-time Web Audio synthesizer, waveform visualizer, Hertz spectrum analyzer, and full scientific provenance tracking.",
  },
  {
    id: "como-funciona",
    shortTitle: "2. How it works",
    title: "How does the engine work?",
    text:
      "The laser scan beam sweeps across the globe analyzing luminance, dominant hue, and Sobel terrain edges, pairing them with seven verified atmospheric variables from MERRA-2, VIIRS, and MODIS. " +
      "Temperature sets the fundamental pitch; humidity shapes filter resonance; wind drives LFO modulation and stereo panning; vegetation NDVI adds biotic harmonics; active fires trigger crisp granular sparks; and cloud fraction controls spatial reverb.",
  },
  {
    id: "proposito",
    shortTitle: "3. Purpose",
    title: "Why was it created?",
    text:
      "This project was built to make Earth's living state audible and intuitive without sacrificing scientific rigor. " +
      "Every region —such as the Amazon, Arctic, Sahara, or Pacific— carries its own acoustic signature. " +
      "Whenever a satellite measurement is missing, the system never fakes it as zero: it marks it as null and silences that voice to guarantee scientific integrity.",
  },
  {
    id: "expectativas",
    shortTitle: "4. Expectations",
    title: "Vision and expectations",
    text:
      "Our expectation is to grow SONUS into an open educational, scientific, and artistic platform: " +
      "capable of comparing climate shifts across historical dates, detecting heat anomalies or vegetation loss by ear, " +
      "and bridging space telemetry with an immersive, verifiable human experience.",
  },
];

export const SONUS_CHAPTERS = SONUS_CHAPTERS_ES;

export function getSonusChapters(lang: NarratorLang): SonusChapter[] {
  return lang === "en" ? SONUS_CHAPTERS_EN : SONUS_CHAPTERS_ES;
}

export interface VoiceInfoLike {
  name: string;
  lang: string;
  localService?: boolean;
}

const MALE_HINTS_ES = [
  "jorge",
  "raul",
  "raúl",
  "alvaro",
  "álvaro",
  "alonso",
  "pablo",
  "rodrigo",
  "tomas",
  "tomás",
  "sebastian",
  "sebastián",
  "carlos",
  "andres",
  "andrés",
  "diego",
  "juan",
  "manuel",
  "enrique",
  "male",
  "hombre",
];

const MALE_HINTS_EN = [
  "andrew",
  "brian",
  "guy",
  "davis",
  "christopher",
  "eric",
  "ryan",
  "roger",
  "steffan",
  "george",
  "daniel",
  "david",
  "mark",
  "matthew",
  "alex",
  "fred",
  "male",
  "man",
];

const FEMALE_HINTS = [
  "dalia",
  "sabina",
  "helena",
  "elvira",
  "paloma",
  "salome",
  "salomé",
  "monica",
  "mónica",
  "paulina",
  "laura",
  "jenny",
  "aria",
  "zira",
  "samantha",
  "victoria",
  "karen",
  "susan",
  "catherine",
  "female",
  "mujer",
];

/**
 * Selecciona la mejor voz masculina disponible en el idioma pedido ("es" o "en").
 * Prioriza voces neurales/naturales de hombre y penaliza voces femeninas conocidas.
 */
export function pickBestVoice<T extends VoiceInfoLike>(voices: T[], lang: NarratorLang = "es"): T | null {
  if (!voices || voices.length === 0) return null;
  const prefix = lang === "en" ? "en" : "es";
  const matching = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (matching.length === 0) return null;

  const maleHints = lang === "en" ? MALE_HINTS_EN : MALE_HINTS_ES;

  const score = (v: T): number => {
    const name = v.name.toLowerCase();
    const vLang = v.lang.toLowerCase();
    let s = 0;

    if (maleHints.some((h) => name.includes(h))) s += 120;
    if (FEMALE_HINTS.some((h) => name.includes(h))) s -= 90;

    if (name.includes("natural") || name.includes("neural") || name.includes("online")) s += 45;
    if (name.includes("google")) s += 20;

    if (lang === "es") {
      if (vLang.includes("es-mx") || vLang.includes("es-419") || vLang.includes("es-us")) s += 16;
      else if (vLang.includes("es-es")) s += 12;
      else s += 6;
    } else {
      if (vLang.includes("en-us") || vLang.includes("en-gb")) s += 16;
      else s += 6;
    }
    return s;
  };

  let best = matching[0];
  let bestScore = score(best);
  for (let i = 1; i < matching.length; i++) {
    const cur = score(matching[i]);
    if (cur > bestScore) {
      best = matching[i];
      bestScore = cur;
    }
  }
  return best;
}

/** Compatibilidad directa para búsquedas en español. */
export function pickBestSpanishVoice<T extends VoiceInfoLike>(voices: T[]): T | null {
  return pickBestVoice(voices, "es");
}

export interface UseSonusNarratorOptions {
  onVocalActivity?: (speaking: boolean, energy: number) => void;
}

export interface SonusNarratorState {
  speaking: boolean;
  lang: NarratorLang;
  chapterIndex: number;
  chapters: SonusChapter[];
  currentChapter: SonusChapter;
  voiceLabel: string;
  ttsSupported: boolean;
  setLang: (lang: NarratorLang) => void;
  playAll: () => void;
  playChapter: (index: number) => void;
  nextChapter: () => void;
  prevChapter: () => void;
  speakText: (text: string, targetLang?: NarratorLang) => void;
  stop: () => void;
}

export function useSonusNarrator(options?: UseSonusNarratorOptions): SonusNarratorState {
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = useState(false);
  const [lang, setLangState] = useState<NarratorLang>("en");
  const [chapterIndex, setChapterIndex] = useState(0);
  const [voiceLabel, setVoiceLabel] = useState<string>(
    ttsSupported ? "AI Voice (Male · EN)" : "Guided reading mode",
  );

  const onVocalRef = useRef(options?.onVocalActivity);
  onVocalRef.current = options?.onVocalActivity;

  const sessionTokenRef = useRef(0);
  const pulseBumpRef = useRef(0);
  const fallbackTimerRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const langRef = useRef<NarratorLang>(lang);
  speakingRef.current = speaking;
  langRef.current = lang;

  const clearTimers = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    sessionTokenRef.current += 1;
    clearTimers();
    if (ttsSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignorar error si el navegador bloqueó cancel */
      }
    }
    setSpeaking(false);
    onVocalRef.current?.(false, 0);
  }, [clearTimers, ttsSupported]);

  // Pulso orgánico de energía vocal mientras habla para animar el núcleo SONUS 3D
  useEffect(() => {
    if (!speaking) {
      onVocalRef.current?.(false, 0);
      return;
    }
    let alive = true;
    const loop = (now: number) => {
      if (!alive || !speakingRef.current) return;
      const t = now * 0.001;
      const cadence =
        0.38 +
        0.24 * Math.sin(t * 7.2) +
        0.16 * Math.sin(t * 13.5 + 0.8) +
        pulseBumpRef.current * 0.35;
      pulseBumpRef.current *= 0.86;
      const clamped = Math.max(0.18, Math.min(1, cadence));
      onVocalRef.current?.(true, clamped);
      rafRef.current = window.requestAnimationFrame(loop);
    };
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      alive = false;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [speaking]);

  const speakSequenceFrom = useCallback(
    (index: number, continuous: boolean, targetLang: NarratorLang = langRef.current) => {
      const list = getSonusChapters(targetLang);
      const clampedIdx = Math.max(0, Math.min(list.length - 1, index));
      const token = ++sessionTokenRef.current;
      clearTimers();
      setChapterIndex(clampedIdx);
      setSpeaking(true);

      const chapter = list[clampedIdx];

      if (!ttsSupported) {
        setVoiceLabel(targetLang === "en" ? "Guided reading (EN)" : "Modo lectura guiada (ES)");
        if (continuous && clampedIdx + 1 < list.length) {
          fallbackTimerRef.current = window.setTimeout(() => {
            if (sessionTokenRef.current === token) {
              speakSequenceFrom(clampedIdx + 1, true, targetLang);
            }
          }, 11000);
        } else {
          fallbackTimerRef.current = window.setTimeout(() => {
            if (sessionTokenRef.current === token) {
              setSpeaking(false);
              onVocalRef.current?.(false, 0);
            }
          }, 11000);
        }
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(chapter.text);
        const voices = window.speechSynthesis.getVoices();
        const chosen = pickBestVoice(voices, targetLang);
        if (chosen) {
          utter.voice = chosen;
          utter.lang = chosen.lang;
          const cleanName = chosen.name.replace(/Microsoft |Google /gi, "").slice(0, 24);
          setVoiceLabel(`${targetLang === "en" ? "AI Voice" : "Voz IA"} · ${cleanName}`);
        } else {
          utter.lang = targetLang === "en" ? "en-US" : "es-MX";
          setVoiceLabel(targetLang === "en" ? "AI Voice · Male EN" : "Voz IA · Hombre ES");
        }
        utter.rate = 0.98;
        utter.pitch = 0.86;
        utter.volume = 1;

        utter.onboundary = () => {
          pulseBumpRef.current = 1;
        };
        utter.onend = () => {
          if (sessionTokenRef.current !== token) return;
          if (continuous && clampedIdx + 1 < list.length) {
            speakSequenceFrom(clampedIdx + 1, true, targetLang);
          } else {
            setSpeaking(false);
            onVocalRef.current?.(false, 0);
          }
        };
        utter.onerror = () => {
          if (sessionTokenRef.current !== token) return;
          setVoiceLabel(targetLang === "en" ? "Guided reading (EN)" : "Modo lectura guiada (ES)");
          fallbackTimerRef.current = window.setTimeout(() => {
            if (sessionTokenRef.current === token) {
              setSpeaking(false);
              onVocalRef.current?.(false, 0);
            }
          }, 8000);
        };

        window.speechSynthesis.speak(utter);
      } catch {
        setVoiceLabel(targetLang === "en" ? "Guided reading (EN)" : "Modo lectura guiada (ES)");
      }
    },
    [clearTimers, ttsSupported],
  );

  // Cargar voces disponibles cuando el navegador termina de enumerarlas
  useEffect(() => {
    if (!ttsSupported) return;
    const syncVoiceName = () => {
      const chosen = pickBestVoice(window.speechSynthesis.getVoices(), langRef.current);
      if (chosen) {
        const cleanName = chosen.name.replace(/Microsoft |Google /gi, "").slice(0, 24);
        setVoiceLabel(`${langRef.current === "en" ? "AI Voice" : "Voz IA"} · ${cleanName}`);
      } else {
        setVoiceLabel(langRef.current === "en" ? "AI Voice · Male EN" : "Voz IA · Hombre ES");
      }
    };
    syncVoiceName();
    window.speechSynthesis.addEventListener?.("voiceschanged", syncVoiceName);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", syncVoiceName);
    };
  }, [lang, ttsSupported]);

  useEffect(() => () => stop(), [stop]);

  const setLang = useCallback(
    (nextLang: NarratorLang) => {
      langRef.current = nextLang;
      setLangState(nextLang);
      if (speakingRef.current) {
        speakSequenceFrom(chapterIndex, true, nextLang);
      }
    },
    [chapterIndex, speakSequenceFrom],
  );

  const playAll = useCallback(() => {
    speakSequenceFrom(0, true, langRef.current);
  }, [speakSequenceFrom]);

  const playChapter = useCallback(
    (index: number) => {
      speakSequenceFrom(index, true, langRef.current);
    },
    [speakSequenceFrom],
  );

  const nextChapter = useCallback(() => {
    const list = getSonusChapters(langRef.current);
    const next = (chapterIndex + 1) % list.length;
    speakSequenceFrom(next, speakingRef.current, langRef.current);
  }, [chapterIndex, speakSequenceFrom]);

  const prevChapter = useCallback(() => {
    const list = getSonusChapters(langRef.current);
    const prev = (chapterIndex - 1 + list.length) % list.length;
    speakSequenceFrom(prev, speakingRef.current, langRef.current);
  }, [chapterIndex, speakSequenceFrom]);

  const speakText = useCallback(
    (text: string, targetLang: NarratorLang = langRef.current) => {
      const clean = text.trim();
      if (!clean) return;
      const token = ++sessionTokenRef.current;
      clearTimers();
      setSpeaking(true);

      if (!ttsSupported) {
        fallbackTimerRef.current = window.setTimeout(() => {
          if (sessionTokenRef.current === token) {
            setSpeaking(false);
            onVocalRef.current?.(false, 0);
          }
        }, 7000);
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(clean);
        const voices = window.speechSynthesis.getVoices();
        const chosen = pickBestVoice(voices, targetLang);
        if (chosen) {
          utter.voice = chosen;
          utter.lang = chosen.lang;
        } else {
          utter.lang = targetLang === "en" ? "en-US" : "es-MX";
        }
        utter.rate = 0.99;
        utter.pitch = 0.86;
        utter.volume = 1;
        utter.onboundary = () => {
          pulseBumpRef.current = 1;
        };
        utter.onend = () => {
          if (sessionTokenRef.current !== token) return;
          setSpeaking(false);
          onVocalRef.current?.(false, 0);
        };
        utter.onerror = () => {
          if (sessionTokenRef.current !== token) return;
          setSpeaking(false);
          onVocalRef.current?.(false, 0);
        };
        window.speechSynthesis.speak(utter);
      } catch {
        setSpeaking(false);
        onVocalRef.current?.(false, 0);
      }
    },
    [clearTimers, ttsSupported],
  );

  const chapters = getSonusChapters(lang);

  return {
    speaking,
    lang,
    chapterIndex,
    chapters,
    currentChapter: chapters[chapterIndex] ?? chapters[0],
    voiceLabel,
    ttsSupported,
    setLang,
    playAll,
    playChapter,
    nextChapter,
    prevChapter,
    speakText,
    stop,
  };
}
