import { useEffect, useRef, useState, useCallback } from "react";
import type { MutableRefObject } from "react";
import { DemoDrone } from "./demoDrone";
import { bandAverages, idleLevels, smoothLevels, SILENT_LEVELS } from "./audioLevels";
import type { AudioLevels } from "./audioLevels";

export interface AudioLevelsDriver {
  /** Referencia mutable: el logo la lee en cada frame, sin re-render de React. */
  levels: MutableRefObject<AudioLevels>;
  soundOn: boolean;
  toggleSound: () => Promise<void>;
}

/**
 * Mantiene `levels` actualizado a ~60 Hz:
 *  - sonido de prueba activo → bandas reales del AnalyserNode
 *  - sin sonido → "respiración" de reposo
 */
export function useAudioLevels(): AudioLevelsDriver {
  const levels = useRef<AudioLevels>({ ...SILENT_LEVELS });
  const drone = useRef<DemoDrone | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  if (drone.current === null) drone.current = new DemoDrone();

  useEffect(() => {
    let raf = 0;
    let freq: Uint8Array<ArrayBuffer> | null = null;
    const t0 = performance.now();

    const tick = () => {
      const d = drone.current!;
      let next: AudioLevels;
      if (d.running && d.analyser) {
        if (!freq || freq.length !== d.analyser.frequencyBinCount) {
          freq = new Uint8Array(d.analyser.frequencyBinCount);
        }
        d.analyser.getByteFrequencyData(freq);
        next = bandAverages(freq, d.sampleRate, d.analyser.fftSize);
      } else {
        next = idleLevels((performance.now() - t0) / 1000);
      }
      levels.current = smoothLevels(levels.current, next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      void drone.current?.stop();
    };
  }, []);

  const toggleSound = useCallback(async () => {
    const d = drone.current!;
    if (d.running) {
      await d.stop();
      setSoundOn(false);
    } else {
      await d.start();
      setSoundOn(true);
    }
  }, []);

  return { levels, soundOn, toggleSound };
}
