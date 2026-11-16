import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Activity, Minus, Plus } from "lucide-react";
import type { FrameFeatures } from "../analysis/frameAnalyzer";
import type { SonificationTargets } from "../audio/mapping";
import type { ScaleChoice } from "./useTerraFoniaController";

export interface VisualizerPanelProps {
  playing: boolean;
  reducedMotion: boolean;
  modulationAmount: number;
  sweepSpeed: number;
  scaleChoice: ScaleChoice;
  frameFeatures: FrameFeatures;
  targets: SonificationTargets;
  sampleAnalyser: (freqOut: Uint8Array, timeOut: Uint8Array) => boolean;
  onChangeModulation: (val: number) => void;
  onChangeSweepSpeed: (val: number) => void;
  onChangeScale: (scale: ScaleChoice) => void;
}

const SWEEP_MIN = 0.02;
const SWEEP_MAX = 0.4;

const SCALE_LABELS: Array<{ id: ScaleChoice; label: string }> = [
  { id: "auto", label: "Auto (EIC Hue)" },
  { id: "dorian", label: "Dorian (Ocean)" },
  { id: "lydian", label: "Lydian (Biotic)" },
  { id: "minor_pent", label: "Minor Pent. (Cryosphere)" },
  { id: "harmonic_minor", label: "Harmonic Minor (Thermal)" },
];

interface RotaryKnobProps {
  label: string;
  valueLabel: string;
  value: number; // normalizado 0..1
  defaultNorm: number;
  accent: string;
  onChange: (nextNorm: number) => void;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function RotaryKnob({
  label,
  valueLabel,
  value,
  defaultNorm,
  accent,
  onChange,
}: RotaryKnobProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startVal: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const norm = clamp01(value);

  const normRef = useRef(norm);
  const onChangeRef = useRef(onChange);
  normRef.current = norm;
  onChangeRef.current = onChange;

  // Rueda del ratón sin scroll accidental de página
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.deltaY < 0 ? 0.035 : -0.035;
      onChangeRef.current(clamp01(normRef.current + step));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Arco desde -135° hasta +135°
  const angleDeg = -135 + norm * 270;
  const r = 19;
  const circ = 2 * Math.PI * r;
  const arcLen = circ * 0.75; // 270 grados
  const dashOffset = arcLen * (1 - norm);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startVal: norm };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    // Arrastre cómodo en cualquier dirección: arriba/derecha sube, abajo/izquierda baja
    const delta =
      (dragRef.current.startY - e.clientY + (e.clientX - dragRef.current.startX)) / 92;
    onChange(clamp01(dragRef.current.startVal + delta));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`hud-knob ${dragging ? "is-dragging" : ""}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(norm * 100)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={() => onChange(defaultNorm)}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") {
          e.preventDefault();
          onChange(clamp01(norm + 0.05));
        }
        if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
          e.preventDefault();
          onChange(clamp01(norm - 0.05));
        }
      }}
      title="Arrastra en cualquier dirección, usa la rueda del ratón, +/- o doble clic para restablecer"
    >
      <svg className="hud-knob__svg" viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <radialGradient id={`knobBody-${label}`} cx="38%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="55%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#050914" />
          </radialGradient>
        </defs>
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="rgba(5, 10, 24, 0.92)"
          stroke="rgba(148, 163, 184, 0.22)"
          strokeWidth="3.2"
          strokeDasharray={`${arcLen} ${circ}`}
          transform="rotate(135 24 24)"
          strokeLinecap="round"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke={accent}
          strokeWidth="3.5"
          strokeDasharray={`${arcLen} ${circ}`}
          strokeDashoffset={dashOffset}
          transform="rotate(135 24 24)"
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
        />
        <circle
          cx="24"
          cy="24"
          r="12.5"
          fill={`url(#knobBody-${label})`}
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth="0.9"
        />
        <circle cx="24" cy="24" r="9.4" fill="none" stroke="rgba(95, 227, 255, 0.14)" strokeWidth="0.6" />
        <g transform={`rotate(${angleDeg} 24 24)`}>
          <line x1="24" y1="22.5" x2="24" y2="13" stroke={accent} strokeWidth="2.3" strokeLinecap="round" />
          <circle cx="24" cy="13.5" r="1.5" fill="#f8fafc" />
        </g>
      </svg>
      <div className="hud-knob__meta">
        <span>{label}</span>
        <div className="hud-knob__step-row">
          <button
            type="button"
            className="knob-step-btn"
            aria-label={`Reducir ${label}`}
            onClick={() => onChange(clamp01(norm - 0.05))}
          >
            <Minus size={10} aria-hidden="true" />
          </button>
          <strong>{valueLabel}</strong>
          <button
            type="button"
            className="knob-step-btn"
            aria-label={`Aumentar ${label}`}
            onClick={() => onChange(clamp01(norm + 0.05))}
          >
            <Plus size={10} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function VisualizerPanel({
  playing,
  reducedMotion,
  modulationAmount,
  sweepSpeed,
  scaleChoice,
  frameFeatures,
  targets,
  sampleAnalyser,
  onChangeModulation,
  onChangeSweepSpeed,
  onChangeScale,
}: VisualizerPanelProps) {
  const scopeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedBinsRef = useRef<number[]>(new Array(32).fill(0.12));
  const peakWaveGainRef = useRef<number>(4);
  const frameRef = useRef<FrameFeatures>(frameFeatures);
  const playingRef = useRef<boolean>(playing);
  const modRef = useRef<number>(modulationAmount);
  const sweepRef = useRef<number>(sweepSpeed);
  const targetsRef = useRef<SonificationTargets>(targets);

  frameRef.current = frameFeatures;
  playingRef.current = playing;
  modRef.current = modulationAmount;
  sweepRef.current = sweepSpeed;
  targetsRef.current = targets;

  useEffect(() => {
    const freqBuf = new Uint8Array(512);
    const timeBuf = new Uint8Array(512);
    let rafId = 0;

    const draw = () => {
      const canvas = scopeCanvasRef.current;
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

            const hasAudio = playingRef.current && sampleAnalyser(freqBuf, timeBuf);
            const splitY = Math.round(h * 0.5);
            const prof = frameRef.current.playhead.verticalProfile;
            const mod = modRef.current;
            const curTargets = targetsRef.current;

            // Cuadrícula táctica
            ctx.strokeStyle = "rgba(95, 227, 255, 0.08)";
            ctx.lineWidth = 1;
            for (let gx = 1; gx < 8; gx++) {
              const x = (w * gx) / 8;
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, h);
              ctx.stroke();
            }
            for (let gy = 1; gy < 4; gy++) {
              const y = (h * gy) / 4;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(w, y);
              ctx.stroke();
            }

            // 1. Mitad superior: Cortina Aurora Espectral (Audio real o vista previa de perfil + modulación)
            const ptsCount = 32;
            const sm = smoothedBinsRef.current;
            const specPoints: Array<{ x: number; y: number }> = [];

            for (let i = 0; i < ptsCount; i++) {
              let val = 0.08;
              if (hasAudio) {
                const idx = Math.min(freqBuf.length - 1, Math.floor((i / ptsCount) * 140));
                val = Math.pow(freqBuf[idx] / 255, 0.76);
              } else {
                const p = prof[i % prof.length] ?? 0.24;
                const staticPeak = (0.06 + mod * 0.18) * Math.sin(i * 0.62) + (0.04 + mod * 0.1) * Math.cos(i * 0.35);
                val = Math.max(0.08, Math.min(0.86, 0.16 + p * (0.34 + mod * 0.42) + staticPeak));
              }
              sm[i] = sm[i] + (val - sm[i]) * (hasAudio ? 0.34 : 0.25);
              const x = (i / (ptsCount - 1)) * w;
              const y = splitY - 4 - sm[i] * (splitY - 10);
              specPoints.push({ x, y });

              const beamCol = ctx.createLinearGradient(x, y, x, splitY);
              beamCol.addColorStop(0, hasAudio ? "rgba(255, 53, 211, 0.58)" : "rgba(139, 61, 255, 0.28)");
              beamCol.addColorStop(0.55, "rgba(139, 61, 255, 0.18)");
              beamCol.addColorStop(1, "rgba(0, 217, 255, 0.0)");
              ctx.fillStyle = beamCol;
              ctx.fillRect(x - 1.5, y, 3, splitY - y);
            }

            const auroraGrad = ctx.createLinearGradient(0, 4, 0, splitY);
            auroraGrad.addColorStop(0, hasAudio ? "rgba(255, 53, 211, 0.68)" : "rgba(139, 61, 255, 0.35)");
            auroraGrad.addColorStop(0.5, "rgba(139, 61, 255, 0.26)");
            auroraGrad.addColorStop(1, "rgba(10, 16, 32, 0.02)");

            ctx.beginPath();
            ctx.moveTo(0, splitY);
            specPoints.forEach((pt, idx) => {
              if (idx === 0) {
                ctx.lineTo(pt.x, pt.y);
              } else {
                const prev = specPoints[idx - 1];
                const mx = (prev.x + pt.x) * 0.5;
                const my = (prev.y + pt.y) * 0.5;
                ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
              }
            });
            ctx.lineTo(w, specPoints[specPoints.length - 1].y);
            ctx.lineTo(w, splitY);
            ctx.closePath();
            ctx.fillStyle = auroraGrad;
            ctx.fill();

            ctx.beginPath();
            specPoints.forEach((pt, idx) => {
              if (idx === 0) ctx.moveTo(pt.x, pt.y);
              else {
                const prev = specPoints[idx - 1];
                const mx = (prev.x + pt.x) * 0.5;
                const my = (prev.y + pt.y) * 0.5;
                ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
              }
            });
            ctx.shadowColor = hasAudio ? "rgba(255, 53, 211, 0.85)" : "rgba(139, 61, 255, 0.45)";
            ctx.shadowBlur = 10;
            ctx.strokeStyle = hasAudio ? "#FF35D3" : "#8B3DFF";
            ctx.lineWidth = 1.65;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Línea divisoria entre Aurora y Osciloscopio
            ctx.strokeStyle = "rgba(95, 227, 255, 0.28)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, splitY + 0.5);
            ctx.lineTo(w, splitY + 0.5);
            ctx.stroke();

            // 2. Mitad inferior: Osciloscopio eléctrico en tiempo real (o vista previa paramétrica)
            const waveMid = splitY + (h - splitY) * 0.52;
            const waveAmp = (h - splitY) * 0.42;
            const wPts = 80;

            let maxAbs = 0.05;
            if (hasAudio) {
              for (let i = 0; i < timeBuf.length; i += 2) {
                const a = Math.abs((timeBuf[i] - 128) / 128);
                if (a > maxAbs) maxAbs = a;
              }
            }
            const targetGain = hasAudio ? Math.min(8, Math.max(1.5, 0.78 / maxAbs)) : 1.0;
            peakWaveGainRef.current += (targetGain - peakWaveGainRef.current) * 0.14;

            const freqCycles = Math.max(1.4, Math.min(5.5, curTargets.baseFreqHz / 95));
            const wavePts: Array<{ x: number; y: number }> = [];
            for (let i = 0; i < wPts; i++) {
              const x = (i / (wPts - 1)) * w;
              let norm = 0;
              if (hasAudio) {
                const idx = Math.floor((i / wPts) * timeBuf.length);
                norm = Math.max(-1, Math.min(1, ((timeBuf[idx] - 128) / 128) * peakWaveGainRef.current));
              } else {
                const tNorm = i / (wPts - 1);
                const carrier = Math.sin(tNorm * Math.PI * 2 * freqCycles);
                const overtone = Math.sin(tNorm * Math.PI * 4 * freqCycles) * (0.14 + mod * 0.38);
                norm = Math.max(-0.9, Math.min(0.9, (carrier + overtone) * (0.26 + mod * 0.44)));
              }
              wavePts.push({ x, y: waveMid + norm * waveAmp });
            }

            const waveFill = ctx.createLinearGradient(0, splitY, 0, h);
            waveFill.addColorStop(0, "rgba(56, 189, 248, 0.2)");
            waveFill.addColorStop(1, "rgba(56, 189, 248, 0.02)");

            ctx.beginPath();
            ctx.moveTo(0, waveMid);
            wavePts.forEach((pt) => ctx.lineTo(pt.x, pt.y));
            ctx.lineTo(w, waveMid);
            ctx.closePath();
            ctx.fillStyle = waveFill;
            ctx.fill();

            ctx.beginPath();
            wavePts.forEach((pt, idx) => {
              if (idx === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
            ctx.strokeStyle = "rgba(95, 227, 255, 0.3)";
            ctx.lineWidth = 4;
            ctx.stroke();

            ctx.beginPath();
            wavePts.forEach((pt, idx) => {
              if (idx === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
            ctx.strokeStyle = hasAudio ? "#7cf0ff" : "rgba(125, 211, 252, 0.72)";
            ctx.lineWidth = 1.65;
            ctx.stroke();

            ctx.restore();
          }
        }
      }
      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [reducedMotion, sampleAnalyser]);

  const sweepNorm = clamp01((sweepSpeed - SWEEP_MIN) / (SWEEP_MAX - SWEEP_MIN));
  const sweepPeriodSec = (1 / Math.max(0.01, sweepSpeed)).toFixed(1);

  return (
    <section className="glass-panel hud-panel hud-panel--viz" aria-label="Signal visualizer">
      <header className="panel-header">
        <div className="panel-title-group">
          <Activity size={15} className="panel-icon" aria-hidden="true" />
          <h2 className="panel-title">VISUALIZER</h2>
        </div>
        <div className="viz-pills">
          <span className={`live-pill ${playing ? "is-on" : ""}`}>
            <span className="live-pill__dot" aria-hidden="true" />
            {playing ? "LIVE" : "STANDBY"}
          </span>
          <span className="micro-metric">
            LUM {Math.round(frameFeatures.meanLuminance * 100)}%
          </span>
          <span className="micro-metric">
            FILTER {Math.round(targets.filterCutoffHz)} Hz
          </span>
        </div>
      </header>

      <div className="viz-scope-box">
        <canvas ref={scopeCanvasRef} className="viz-scope-canvas" />
      </div>

      <div className="viz-knobs-row">
        <RotaryKnob
          label="Modulation"
          valueLabel={`${Math.round(modulationAmount * 100)}%`}
          value={modulationAmount}
          defaultNorm={0.68}
          accent="#5fe3ff"
          onChange={onChangeModulation}
        />
        <RotaryKnob
          label="Sweep"
          valueLabel={`${Math.round(sweepSpeed * 1000)} mHz`}
          value={sweepNorm}
          defaultNorm={(0.075 - SWEEP_MIN) / (SWEEP_MAX - SWEEP_MIN)}
          accent="#a855f7"
          onChange={(n) => onChangeSweepSpeed(Number((SWEEP_MIN + n * (SWEEP_MAX - SWEEP_MIN)).toFixed(3)))}
        />
        <label className="scale-field">
          <span className="scale-field__label">Scale ({Math.round(targets.baseFreqHz)} Hz)</span>
          <select
            className="hud-select"
            value={scaleChoice}
            onChange={(e) => onChangeScale(e.target.value as ScaleChoice)}
          >
            {SCALE_LABELS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="viz-faders-grid">
        <label className="viz-mod-fader">
          <div className="viz-mod-fader__head">
            <span>Modulation</span>
            <strong>{Math.round(modulationAmount * 100)}%</strong>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={modulationAmount}
            onChange={(e) => onChangeModulation(Number(e.target.value))}
            aria-label="Harmonic modulation and LFO"
          />
        </label>

        <label className="viz-mod-fader">
          <div className="viz-mod-fader__head">
            <span>Sweep · {sweepPeriodSec}s</span>
            <strong>{Math.round(sweepSpeed * 1000)} mHz</strong>
          </div>
          <input
            type="range"
            min={SWEEP_MIN}
            max={SWEEP_MAX}
            step={0.005}
            value={sweepSpeed}
            onChange={(e) => onChangeSweepSpeed(Number(e.target.value))}
            aria-label="Globe scan sweep speed"
          />
        </label>
      </div>
    </section>
  );
}
