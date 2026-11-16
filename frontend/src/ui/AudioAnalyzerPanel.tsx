import { useEffect, useRef, type MouseEvent } from "react";
import { BarChart3 } from "lucide-react";
import type { FrameFeatures } from "../analysis/frameAnalyzer";
import type { SonificationTargets } from "../audio/mapping";
import type { VoiceSolo } from "../audio/sonificationEngine";
import type { VariableName } from "../types/soundSignature";

export interface AudioAnalyzerPanelProps {
  playing: boolean;
  reducedMotion: boolean;
  frameFeatures: FrameFeatures;
  targets: SonificationTargets;
  sampleAnalyser: (freqOut: Uint8Array, timeOut: Uint8Array) => boolean;
  sampleRate?: number;
  soloVoice?: VoiceSolo;
  onSelectSoloVoice?: (voice: VoiceSolo) => void;
  onSelectBand?: (bandLabelHz: string, bandIndex: number) => void;
}

const BAND_COUNT = 10;
// Bordes logarítmicos en Hz para cubrir graves (Clima), medios (NDVI/Escáner) y agudos (Fuego/Aire)
const BAND_EDGES_HZ = [45, 95, 180, 340, 620, 1100, 1900, 3100, 5000, 7600, 11500];
const BAND_LABELS = ["60", "120", "250", "450", "850", "1.5k", "2.5k", "4k", "6k", "9k"];

const BAND_COLORS = [
  "#6E2CF2",
  "#8B3DFF",
  "#A63AF9",
  "#C837F5",
  "#E635E4",
  "#FF35D3",
  "#D855FF",
  "#7B88FF",
  "#28B8FF",
  "#00D9FF",
];

const VOICE_ROWS: Array<{
  key: keyof SonificationTargets["activeVoices"];
  label: string;
  vars: VariableName[];
  bandHint: string;
}> = [
  { key: "climatePad", label: "Climate", vars: ["t2m"], bandHint: "60–250 Hz · base pitch from temperature" },
  { key: "humidityFilter", label: "Humidity", vars: ["qv2m"], bandHint: "Filter cutoff & Q resonance" },
  { key: "windLfo", label: "Wind", vars: ["u10m", "v10m"], bandHint: "LFO modulation & stereo panning" },
  { key: "vegetationHarmonics", label: "NDVI", vars: ["ndvi"], bandHint: "300–1.5 kHz · biotic harmonics" },
  { key: "fireGranular", label: "Fire", vars: ["fireCount"], bandHint: "1.8–4.2 kHz · granular sparks if hotspots > 0" },
  { key: "cloudReverb", label: "Clouds", vars: ["cloudFraction"], bandHint: "Atmospheric spatial reverb" },
];

export function AudioAnalyzerPanel({
  playing,
  reducedMotion,
  targets,
  sampleAnalyser,
  sampleRate = 48000,
  soloVoice = "all",
  onSelectSoloVoice,
  onSelectBand,
}: AudioAnalyzerPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedRef = useRef<number[]>(new Array(BAND_COUNT).fill(0));
  const peakRef = useRef<number[]>(new Array(BAND_COUNT).fill(0));
  const playingRef = useRef<boolean>(playing);
  const sampleRateRef = useRef<number>(sampleRate);

  playingRef.current = playing;
  sampleRateRef.current = sampleRate;

  useEffect(() => {
    const freqBuf = new Uint8Array(512);
    const timeBuf = new Uint8Array(512);
    let rafId = 0;

    const tick = () => {
      const canvas = canvasRef.current;
      const hasAudio = playingRef.current && sampleAnalyser(freqBuf, timeBuf);
      const sr = sampleRateRef.current > 0 ? sampleRateRef.current : 48000;
      const binHz = sr / 1024;

      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 12 && rect.height > 12) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const w = rect.width;
          const h = rect.height;
          const cw = Math.round(w * dpr);
          const ch = Math.round(h * dpr);
          if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
          }

          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, w, h);

            const cols = BAND_COUNT;
            const segments = 11;
            const padX = 10;
            const padBottom = 15;
            const padTop = 7;
            const usableW = w - padX * 2;
            const colStep = usableW / cols;
            const barW = Math.max(8, colStep * 0.72);
            const colH = h - padBottom - padTop;
            const segGap = 3;
            const segH = Math.max(3, (colH - segGap * (segments - 1)) / segments);

            // Rieles horizontales sutiles tipo matriz Jarvis
            ctx.strokeStyle = "rgba(95, 227, 255, 0.06)";
            ctx.lineWidth = 1;
            for (let r = 0; r <= 4; r++) {
              const ry = padTop + (colH * r) / 4;
              ctx.beginPath();
              ctx.moveTo(padX, ry);
              ctx.lineTo(w - padX, ry);
              ctx.stroke();
            }

            for (let i = 0; i < cols; i++) {
              let targetLevel = 0;
              if (hasAudio) {
                const loHz = BAND_EDGES_HZ[i] ?? 45;
                const hiHz = BAND_EDGES_HZ[i + 1] ?? 11500;
                const start = Math.max(0, Math.floor(loHz / binHz));
                const end = Math.min(freqBuf.length, Math.max(start + 1, Math.ceil(hiHz / binHz)));
                let sum = 0;
                let maxVal = 0;
                for (let b = start; b < end; b++) {
                  const v = freqBuf[b];
                  sum += v;
                  if (v > maxVal) maxVal = v;
                }
                const meanNorm = sum / ((end - start) * 255);
                const maxNorm = maxVal / 255;
                const gainTilt = 1.05 + i * 0.055;
                targetLevel = Math.min(1, (meanNorm * 0.42 + maxNorm * 0.58) * gainTilt);
              }

              const prev = smoothedRef.current[i] ?? 0;
              const smoothRate = hasAudio ? (reducedMotion ? 0.25 : 0.38) : 0.22;
              const level = prev + (targetLevel - prev) * smoothRate;
              smoothedRef.current[i] = level < 0.004 && !hasAudio ? 0 : level;

              if (hasAudio && level >= (peakRef.current[i] ?? 0)) {
                peakRef.current[i] = level;
              } else {
                const decay = hasAudio ? 0.008 : 0.025;
                peakRef.current[i] = Math.max(level, (peakRef.current[i] ?? 0) - decay);
              }

              const activeCount = hasAudio || level > 0.02 ? Math.round(level * segments) : 0;
              const peakSeg = Math.min(
                segments - 1,
                Math.max(0, Math.round(peakRef.current[i] * segments) - 1),
              );
              const x = padX + i * colStep + (colStep - barW) * 0.5;
              const color = BAND_COLORS[i % BAND_COLORS.length];

              for (let s = 0; s < segments; s++) {
                const y = padTop + colH - (s + 1) * segH - s * segGap;
                const lit = s < activeCount;
                const isPeak = hasAudio && s === peakSeg && peakRef.current[i] > 0.06;

                ctx.beginPath();
                ctx.roundRect(x, y, barW, segH, 2.5);

                if (lit) {
                  ctx.shadowColor = color;
                  ctx.shadowBlur = s === activeCount - 1 ? 8 : 4;
                  ctx.fillStyle = color;
                  ctx.globalAlpha = 0.65 + 0.35 * (s / Math.max(1, segments - 1));
                  ctx.fill();
                  ctx.shadowBlur = 0;

                  // Brillo especular superior de 1px dentro de cada ladrillo LED
                  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
                  ctx.globalAlpha = 1;
                  ctx.fillRect(x + 1.5, y + 0.6, Math.max(2, barW - 3), 1);
                } else if (isPeak) {
                  ctx.fillStyle = "#f8fafc";
                  ctx.globalAlpha = 0.85;
                  ctx.fill();
                } else {
                  ctx.fillStyle = "rgba(15, 26, 52, 0.85)";
                  ctx.globalAlpha = 1;
                  ctx.fill();
                  ctx.strokeStyle = "rgba(148, 163, 184, 0.1)";
                  ctx.lineWidth = 0.6;
                  ctx.stroke();
                }
              }

              ctx.globalAlpha = 0.72;
              ctx.fillStyle = "#94a3b8";
              ctx.font = "600 8.5px 'JetBrains Mono', ui-monospace, monospace";
              ctx.textAlign = "center";
              ctx.fillText(BAND_LABELS[i] ?? String(i + 1), x + barW * 0.5, h - 3);
            }

            if (!hasAudio && levelFloor(smoothedRef.current) < 0.03) {
              ctx.globalAlpha = 0.86;
              ctx.fillStyle = "rgba(148, 163, 184, 0.78)";
              ctx.font = "600 10px 'JetBrains Mono', ui-monospace, monospace";
              ctx.textAlign = "center";
              ctx.fillText("STANDBY · PRESS PLAY TO MEASURE LIVE SPECTRUM (Hz)", w * 0.5, padTop + colH * 0.48);
            }

            ctx.restore();
          }
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [reducedMotion, sampleAnalyser]);

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!onSelectBand) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const padX = 10;
    const usableW = Math.max(1, rect.width - padX * 2);
    const relX = Math.max(0, Math.min(usableW - 1, e.clientX - rect.left - padX));
    const idx = Math.min(BAND_COUNT - 1, Math.max(0, Math.floor((relX / usableW) * BAND_COUNT)));
    const label = BAND_LABELS[idx] ?? "60";
    onSelectBand(label, idx);
  };

  return (
    <section
      className="glass-panel hud-panel hud-panel--analyzer"
      aria-label="Audio analyzer and active voices"
    >
      <header className="panel-header">
        <div className="panel-title-group">
          <BarChart3 size={15} className="panel-icon" aria-hidden="true" />
          <h2 className="panel-title">AUDIO ANALYZER</h2>
        </div>
        <span className={`live-pill ${playing ? "is-on" : ""}`}>
          <span className="live-pill__dot" aria-hidden="true" />
          {playing ? "LIVE" : "STANDBY"}
        </span>
      </header>

      <div
        className={`analyzer-led-box ${onSelectBand ? "is-interactive" : ""}`}
        aria-label="10-band segmented Hz spectrum"
        title={onSelectBand ? "Click a frequency band (Hz) so SONUS explains what is sounding there" : undefined}
      >
        <canvas ref={canvasRef} className="analyzer-led-canvas" onClick={handleCanvasClick} />
      </div>

      <div className="voice-matrix-wrap">
        <span className="voice-matrix__hint">
          {soloVoice !== "all"
            ? "SOLO mode active · Click the voice again to hear all layers"
            : playing
              ? "Click a layer to isolate and hear its individual sound"
              : "NASA sound layers · Click one to isolate and press PLAY"}
        </span>
        <div className="voice-matrix" aria-label="Synthesis voice isolation and status">
          {soloVoice !== "all" && onSelectSoloVoice && (
            <button
              type="button"
              className="voice-chip voice-chip--btn is-all-reset"
              onClick={() => onSelectSoloVoice("all")}
              title="Hear all mixed layers"
            >
              <span>All</span>
            </button>
          )}
          {VOICE_ROWS.map((row) => {
            const active = targets.activeVoices[row.key];
            const isMissing = row.vars.some((v) => targets.missingVariables.includes(v));
            const isSolo = soloVoice === row.key;
            const isDimmedBySolo = soloVoice !== "all" && !isSolo;
            const statusClass = isSolo
              ? "is-solo"
              : isDimmedBySolo
                ? "is-muted"
                : isMissing
                  ? "is-missing"
                  : !active
                    ? "is-zero"
                    : playing
                      ? "is-live"
                      : "is-ready";
            const statusText = isSolo
              ? "isolated in SOLO mode (click to clear)"
              : isMissing
                ? "missing data (null) — muted"
                : !active
                  ? "silent (0 hotspots / inactive)"
                  : playing
                    ? "playing live (click to isolate SOLO)"
                    : "valid data ready (click to isolate SOLO)";

            return (
              <button
                key={row.key}
                type="button"
                className={`voice-chip voice-chip--btn ${statusClass}`}
                onClick={() => onSelectSoloVoice?.(isSolo ? "all" : row.key)}
                title={`${row.label} (${row.bandHint}): ${statusText}`}
                aria-pressed={isSolo}
              >
                <span className="voice-chip__dot" aria-hidden="true" />
                <span>{row.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function levelFloor(values: number[]): number {
  let max = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > max) max = values[i];
  }
  return max;
}
