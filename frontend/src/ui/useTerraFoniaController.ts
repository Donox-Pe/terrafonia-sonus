import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { analyzeImageData, type FrameFeatures } from "../analysis/frameAnalyzer";
import {
  computeGlobeViewState,
  renderProjectedGlobeDisk,
} from "../analysis/globeProjection";
import { drawJarvisOverlay, renderSyntheticEarthData } from "../analysis/syntheticEicRenderer";
import {
  bandAverages,
  SILENT_LEVELS,
  smoothLevels,
  type AudioLevels,
} from "../audio/audioLevels";
import {
  computeSonificationTargets,
  type MusicalScaleId,
  type SonificationTargets,
} from "../audio/mapping";
import { SonificationEngine, type VoiceSolo } from "../audio/sonificationEngine";
import {
  createLocalFallbackSignature,
  LOCAL_PRESETS,
  SignatureClient,
  type TransportMode,
} from "../transport/signatureClient";
import type { LayerToggles, PresetSummary, SoundSignature } from "../types/soundSignature";

export type ScaleChoice = MusicalScaleId | "auto";

const INITIAL_PRESET = "amazonia";
const INITIAL_DATE = "2024-06-01";

const EMPTY_FRAME: FrameFeatures = {
  meanLuminance: 0.35,
  spatialVariance: 0.14,
  edgeDensity: 0.18,
  dominantHueDeg: 145,
  hueHistogram: new Array(12).fill(0),
  playhead: {
    normalizedX: 0.25,
    longitudeDeg: -90,
    centroidLatitudeDeg: -4,
    columnEnergy: 0.42,
    hotspotActivity: 0.08,
    canopyActivity: 0.45,
    cloudActivity: 0.22,
    verticalProfile: new Array(16).fill(0.2),
  },
};

export interface TerraFoniaControllerState {
  presets: PresetSummary[];
  presetId: string;
  date: string;
  layers: LayerToggles;
  playing: boolean;
  volume: number;
  modulationAmount: number;
  sweepSpeed: number;
  scaleChoice: ScaleChoice;
  soloVoice: VoiceSolo;
  playheadX: number;
  signature: SoundSignature;
  transportMode: TransportMode;
  transportDetail: string;
  frameFeatures: FrameFeatures;
  targets: SonificationTargets;
  audioError: string | null;
  reducedMotion: boolean;
  levelsRef: MutableRefObject<AudioLevels>;
  eicCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  togglePlay: () => Promise<void>;
  setPresetId: (id: string) => void;
  setDate: (date: string) => void;
  toggleLayer: (layer: keyof LayerToggles) => void;
  setVolume: (vol: number) => void;
  setModulationAmount: (val: number) => void;
  setSweepSpeed: (val: number) => void;
  setScaleChoice: (scale: ScaleChoice) => void;
  setSoloVoice: (voice: VoiceSolo) => void;
  scrubPlayhead: (normX: number) => void;
  updateGlobeView: (view: { yaw: number; pitch: number; zoomFactor: number; aspect: number }) => void;
  triggerLogoPulse: () => void;
  setAiVoiceActivity: (speaking: boolean, energy: number) => void;
  sampleAnalyser: (freqOut: Uint8Array, timeOut: Uint8Array) => boolean;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://127.0.0.1:4000";

export function useTerraFoniaController(): TerraFoniaControllerState {
  const [presets, setPresets] = useState<PresetSummary[]>(LOCAL_PRESETS);
  const [presetId, setPresetIdState] = useState<string>(INITIAL_PRESET);
  const [date, setDateState] = useState<string>(INITIAL_DATE);
  const [layers, setLayers] = useState<LayerToggles>({ fire: true, ndvi: true, clouds: true });
  const [playing, setPlaying] = useState<boolean>(false);
  const [volume, setVolumeState] = useState<number>(0.72);
  const [modulationAmount, setModulationAmount] = useState<number>(0.68);
  const [sweepSpeed, setSweepSpeed] = useState<number>(0.075);
  const [scaleChoice, setScaleChoice] = useState<ScaleChoice>("auto");
  const [soloVoice, setSoloVoiceState] = useState<VoiceSolo>("all");
  const soloVoiceRef = useRef<VoiceSolo>("all");
  const [playheadX, setPlayheadX] = useState<number>(0.25);

  const initialSig = createLocalFallbackSignature(INITIAL_PRESET, INITIAL_DATE, 0);
  const [signature, setSignature] = useState<SoundSignature>(initialSig);
  const [transportMode, setTransportMode] = useState<TransportMode>("local-fallback");
  const [transportDetail, setTransportDetail] = useState<string>("Modo simulador local inicializado");
  const [frameFeatures, setFrameFeatures] = useState<FrameFeatures>(EMPTY_FRAME);
  const [targets, setTargets] = useState<SonificationTargets>(() =>
    computeSonificationTargets(initialSig, EMPTY_FRAME, 0.68),
  );
  const [audioError, setAudioError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState<boolean>(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  // Refs mutables para el bucle de 60 Hz sin re-renderizar todo React en cada cuadro.
  const levelsRef = useRef<AudioLevels>({ ...SILENT_LEVELS });
  const eicCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<SonificationEngine | null>(null);
  const clientRef = useRef<SignatureClient | null>(null);
  const freqBufRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const signatureRef = useRef<SoundSignature>(initialSig);
  const layersRef = useRef<LayerToggles>(layers);
  const playingRef = useRef<boolean>(false);
  const modulationRef = useRef<number>(modulationAmount);
  const sweepSpeedRef = useRef<number>(sweepSpeed);
  const scaleChoiceRef = useRef<ScaleChoice>(scaleChoice);
  const playheadRef = useRef<number>(playheadX);
  const frameFeaturesRef = useRef<FrameFeatures>(frameFeatures);
  const targetsRef = useRef<SonificationTargets>(targets);
  const reducedMotionRef = useRef<boolean>(reducedMotion);
  const volumeRef = useRef<number>(volume);
  const animTimeRef = useRef<number>(0);
  const aiVoiceRef = useRef<{ speaking: boolean; energy: number }>({ speaking: false, energy: 0 });
  const prevAiSpeakingRef = useRef<boolean>(false);
  const globeViewRef = useRef<{ yaw: number; pitch: number; zoomFactor: number; aspect: number }>({
    yaw: 0,
    pitch: 0,
    zoomFactor: 1,
    aspect: 1,
  });
  const equirectCanvasRef = useRef<HTMLCanvasElement | null>(null);

  signatureRef.current = signature;
  layersRef.current = layers;
  playingRef.current = playing;
  modulationRef.current = modulationAmount;
  sweepSpeedRef.current = sweepSpeed;
  scaleChoiceRef.current = scaleChoice;
  frameFeaturesRef.current = frameFeatures;
  reducedMotionRef.current = reducedMotion;
  volumeRef.current = volume;

  // Aplicar inmediatamente cambios en modulación o escala sin esperar al siguiente cuadro
  useEffect(() => {
    const forced = scaleChoice === "auto" ? undefined : scaleChoice;
    const nextTargets = computeSonificationTargets(
      signatureRef.current,
      frameFeaturesRef.current,
      modulationAmount,
      forced,
    );
    targetsRef.current = nextTargets;
    setTargets(nextTargets);
    if (playingRef.current && engineRef.current?.running) {
      engineRef.current.applyTargets(nextTargets);
    }
  }, [modulationAmount, scaleChoice]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Conexión Socket.IO / fallback local + lectura de presets si el backend responde.
  useEffect(() => {
    const client = new SignatureClient({
      onSignature: (sig) => {
        signatureRef.current = sig;
        setSignature(sig);
      },
      onTransportChange: (mode, detail) => {
        setTransportMode(mode);
        setTransportDetail(detail);
      },
    });
    clientRef.current = client;
    client.connect();

    const ac = new AbortController();
    fetch(`${BACKEND_URL}/api/presets`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { presets?: PresetSummary[] } | null) => {
        if (json?.presets && Array.isArray(json.presets) && json.presets.length > 0) {
          setPresets(json.presets);
        }
      })
      .catch(() => {
        /* Fallback silencioso: el usuario ya cuenta con LOCAL_PRESETS. */
      });

    return () => {
      ac.abort();
      client.dispose();
      clientRef.current = null;
    };
  }, []);

  // Limpieza del motor Web Audio al desmontar.
  useEffect(() => {
    const engine = new SonificationEngine();
    engineRef.current = engine;
    return () => {
      void engine.stop();
      engineRef.current = null;
    };
  }, []);

  // Bucle principal de visualización EIC + análisis de frame (~12 Hz) + niveles 3D (60 Hz).
  useEffect(() => {
    const offscreen = document.createElement("canvas");
    offscreen.width = 128;
    offscreen.height = 128;
    analysisCanvasRef.current = offscreen;

    const eqCanvas = document.createElement("canvas");
    eqCanvas.width = 256;
    eqCanvas.height = 128;
    equirectCanvasRef.current = eqCanvas;

    let rafId = 0;
    let lastTs = performance.now();
    let lastAnalysisTs = 0;
    let lastUiSyncTs = 0;
    let currentCentroidLat = 0;

    const tick = (now: number) => {
      const dtSec = Math.min(0.1, Math.max(0.001, (now - lastTs) / 1000));
      lastTs = now;
      const isAudible = playingRef.current && volumeRef.current > 0;

      // 1. Avance del cabezal y del tiempo visual únicamente cuando está sonando.
      if (isAudible) {
        animTimeRef.current += dtSec;
        let nextX = playheadRef.current + sweepSpeedRef.current * dtSec;
        if (nextX > 1) nextX -= 1;
        playheadRef.current = nextX;
      }
      const visualTimeSec = reducedMotionRef.current ? 0 : animTimeRef.current;

      // 2. Renderizado proyectado del globo 3D visible (~12 Hz) -> analyzeImageData (sin overlay).
      if (now - lastAnalysisTs >= 82) {
        lastAnalysisTs = now;
        const aCtx = offscreen.getContext("2d", { willReadFrequently: true });
        const eqCtx = eqCanvas.getContext("2d", { willReadFrequently: true });
        if (aCtx && eqCtx) {
          renderSyntheticEarthData(
            eqCtx,
            eqCanvas.width,
            eqCanvas.height,
            signatureRef.current,
            layersRef.current,
            visualTimeSec,
          );
          const eqImg = eqCtx.getImageData(0, 0, eqCanvas.width, eqCanvas.height);
          const diskImg = aCtx.createImageData(offscreen.width, offscreen.height);
          const gv = globeViewRef.current;
          const view = computeGlobeViewState(
            signatureRef.current,
            { yaw: gv.yaw, pitch: gv.pitch },
            gv.zoomFactor,
            gv.aspect,
            visualTimeSec,
            isAudible,
            reducedMotionRef.current,
          );
          const geo = renderProjectedGlobeDisk(
            eqImg.data,
            eqCanvas.width,
            eqCanvas.height,
            diskImg.data,
            offscreen.width,
            offscreen.height,
            view,
            playheadRef.current,
          );
          aCtx.putImageData(diskImg, 0, 0);

          const features = analyzeImageData(
            diskImg.data,
            offscreen.width,
            offscreen.height,
            playheadRef.current,
          );
          features.playhead.longitudeDeg = geo.longitudeDeg;
          features.playhead.centroidLatitudeDeg = geo.latitudeDeg;
          features.playhead.beamViewportX = geo.beamViewportX;
          features.playhead.reticleViewportY = geo.reticleViewportY;
          currentCentroidLat = geo.latitudeDeg;

          const forced = scaleChoiceRef.current === "auto" ? undefined : scaleChoiceRef.current;
          const nextTargets = computeSonificationTargets(
            signatureRef.current,
            features,
            modulationRef.current,
            forced,
          );
          targetsRef.current = nextTargets;

          if (playingRef.current && engineRef.current?.running) {
            engineRef.current.applyTargets(nextTargets);
          }

          if (now - lastUiSyncTs >= 110) {
            lastUiSyncTs = now;
            setFrameFeatures(features);
            setTargets(nextTargets);
            setPlayheadX(playheadRef.current);
          }
        }
      }

      // 3. Renderizado visual del canvas visible EIC + retícula Jarvis (DESPUÉS del análisis).
      const visCanvas = eicCanvasRef.current;
      if (visCanvas) {
        const rect = visCanvas.getBoundingClientRect();
        if (rect.width > 8 && rect.height > 8) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const targetW = Math.round(rect.width * dpr);
          const targetH = Math.round(rect.height * dpr);
          if (visCanvas.width !== targetW || visCanvas.height !== targetH) {
            visCanvas.width = targetW;
            visCanvas.height = targetH;
          }
          const vCtx = visCanvas.getContext("2d");
          if (vCtx) {
            vCtx.save();
            vCtx.scale(dpr, dpr);
            renderSyntheticEarthData(
              vCtx,
              rect.width,
              rect.height,
              signatureRef.current,
              layersRef.current,
              visualTimeSec,
            );
            drawJarvisOverlay(
              vCtx,
              rect.width,
              rect.height,
              playheadRef.current,
              currentCentroidLat,
            );
            vCtx.restore();
          }
        }
      }

      // 4. Actualización de bandas de energía para el logo 3D SONUS (60 Hz sin re-render React).
      const engine = engineRef.current;
      const aiVoice = aiVoiceRef.current;
      if (aiVoice.speaking) {
        const e = aiVoice.energy;
        levelsRef.current = smoothLevels(
          levelsRef.current,
          {
            bass: Math.min(1, e * 0.55),
            mid: Math.min(1, e * 0.95),
            treble: Math.min(1, e * 0.65),
            energy: e,
          },
          0.42,
          0.16,
        );
      } else if (playingRef.current && engine?.running && engine.analyser) {
        const bins = engine.analyser.frequencyBinCount;
        if (!freqBufRef.current || freqBufRef.current.length !== bins) {
          freqBufRef.current = new Uint8Array(bins);
        }
        engine.analyser.getByteFrequencyData(freqBufRef.current);
        const raw = bandAverages(freqBufRef.current, engine.sampleRate, engine.analyser.fftSize);
        levelsRef.current = smoothLevels(levelsRef.current, raw, 0.34, 0.12);
      } else {
        levelsRef.current = smoothLevels(levelsRef.current, SILENT_LEVELS, 0.14, 0.1);
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(rafId);
      analysisCanvasRef.current = null;
    };
  }, []);

  const togglePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    setAudioError(null);
    if (playingRef.current) {
      await engine.stop();
      setPlaying(false);
      clientRef.current?.configure({ running: false });
      return;
    }
    try {
      await engine.start();
      engine.setSoloVoice(soloVoiceRef.current);
      engine.setVolume(volume);
      engine.applyTargets(targetsRef.current);
      setPlaying(true);
      clientRef.current?.configure({ running: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo iniciar Web Audio API";
      setAudioError(msg);
      setPlaying(false);
    }
  }, [volume]);

  const setPresetId = useCallback((id: string) => {
    setPresetIdState(id);
    clientRef.current?.configure({ presetId: id });
  }, []);

  const setDate = useCallback((nextDate: string) => {
    setDateState(nextDate);
    clientRef.current?.configure({ date: nextDate });
  }, []);

  const toggleLayer = useCallback((layer: keyof LayerToggles) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  }, []);

  const setSoloVoice = useCallback((voice: VoiceSolo) => {
    soloVoiceRef.current = voice;
    setSoloVoiceState(voice);
    if (engineRef.current) {
      engineRef.current.setSoloVoice(voice);
      if (playingRef.current && engineRef.current.running) {
        engineRef.current.applyTargets(targetsRef.current);
      }
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    const factor = aiVoiceRef.current.speaking ? 0.22 : 1;
    engineRef.current?.setVolume(clamped * factor);
  }, []);

  const setAiVoiceActivity = useCallback((speakingNow: boolean, energy: number) => {
    aiVoiceRef.current = { speaking: speakingNow, energy };
    if (prevAiSpeakingRef.current !== speakingNow) {
      prevAiSpeakingRef.current = speakingNow;
      if (engineRef.current?.running) {
        engineRef.current.setVolume(volumeRef.current * (speakingNow ? 0.22 : 1));
      }
    }
  }, []);

  const updateGlobeView = useCallback(
    (view: { yaw: number; pitch: number; zoomFactor: number; aspect: number }) => {
      globeViewRef.current = view;
    },
    [],
  );

  const scrubPlayhead = useCallback((normX: number) => {
    const clamped = Math.max(0, Math.min(1, normX));
    playheadRef.current = clamped;
    setPlayheadX(clamped);

    const offscreen = analysisCanvasRef.current;
    const eqCanvas = equirectCanvasRef.current;
    if (!offscreen) return;
    const aCtx = offscreen.getContext("2d", { willReadFrequently: true });
    if (!aCtx) return;

    const img = aCtx.getImageData(0, 0, offscreen.width, offscreen.height);
    const features = analyzeImageData(img.data, offscreen.width, offscreen.height, clamped);

    if (eqCanvas) {
      const eqCtx = eqCanvas.getContext("2d", { willReadFrequently: true });
      if (eqCtx) {
        const eqImg = eqCtx.getImageData(0, 0, eqCanvas.width, eqCanvas.height);
        const gv = globeViewRef.current;
        const view = computeGlobeViewState(
          signatureRef.current,
          { yaw: gv.yaw, pitch: gv.pitch },
          gv.zoomFactor,
          gv.aspect,
          performance.now() / 1000,
          playingRef.current,
          reducedMotionRef.current,
        );
        const geo = renderProjectedGlobeDisk(
          eqImg.data,
          eqCanvas.width,
          eqCanvas.height,
          img.data,
          offscreen.width,
          offscreen.height,
          view,
          clamped,
        );
        features.playhead.longitudeDeg = geo.longitudeDeg;
        features.playhead.centroidLatitudeDeg = geo.latitudeDeg;
        features.playhead.beamViewportX = geo.beamViewportX;
        features.playhead.reticleViewportY = geo.reticleViewportY;
      }
    }

    const forced = scaleChoiceRef.current === "auto" ? undefined : scaleChoiceRef.current;
    const nextTargets = computeSonificationTargets(
      signatureRef.current,
      features,
      modulationRef.current,
      forced,
    );
    targetsRef.current = nextTargets;
    setFrameFeatures(features);
    setTargets(nextTargets);
    if (playingRef.current && engineRef.current?.running) {
      engineRef.current.applyTargets(nextTargets);
    }
  }, []);

  const triggerLogoPulse = useCallback(() => {
    if (playingRef.current && engineRef.current?.running) {
      engineRef.current.triggerPulseChime(targetsRef.current.baseFreqHz * 2);
    }
  }, []);

  const sampleAnalyser = useCallback((freqOut: Uint8Array, timeOut: Uint8Array): boolean => {
    const analyser = engineRef.current?.analyser;
    if (!playingRef.current || !analyser) return false;
    analyser.getByteFrequencyData(freqOut as Uint8Array<ArrayBuffer>);
    analyser.getByteTimeDomainData(timeOut as Uint8Array<ArrayBuffer>);
    return true;
  }, []);

  return {
    presets,
    presetId,
    date,
    layers,
    playing,
    volume,
    modulationAmount,
    sweepSpeed,
    scaleChoice,
    soloVoice,
    playheadX,
    signature,
    transportMode,
    transportDetail,
    frameFeatures,
    targets,
    audioError,
    reducedMotion,
    levelsRef,
    eicCanvasRef,
    togglePlay,
    setPresetId,
    setDate,
    toggleLayer,
    setVolume,
    setModulationAmount,
    setSweepSpeed,
    setScaleChoice,
    setSoloVoice,
    scrubPlayhead,
    updateGlobeView,
    triggerLogoPulse,
    setAiVoiceActivity,
    sampleAnalyser,
  };
}
