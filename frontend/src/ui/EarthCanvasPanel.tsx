import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { AlertTriangle, Compass, Globe2, Orbit, Radio, RotateCcw, ScanLine } from "lucide-react";
import type { EarthVisualOrigin } from "../analysis/earthTexture";
import type { FrameFeatures } from "../analysis/frameAnalyzer";
import { computeGlobeViewState } from "../analysis/globeProjection";
import type {
  LayerToggles,
  SoundSignature,
  VariableName,
  VariableReading,
} from "../types/soundSignature";
import { EarthGlobe3D } from "./EarthGlobe3D";

export interface EarthCanvasPanelProps {
  signature: SoundSignature;
  layers: LayerToggles;
  frameFeatures: FrameFeatures;
  playheadX: number;
  playing: boolean;
  reducedMotion: boolean;
  onScrubPlayhead: (normX: number) => void;
  onGlobeViewChange?: (view: { yaw: number; pitch: number; zoomFactor: number; aspect: number }) => void;
}

const VARIABLE_META: Array<{
  key: VariableName;
  label: string;
  product: string;
  format: (v: number) => string;
}> = [
  { key: "t2m", label: "Temp. 2m", product: "MERRA-2", format: (v) => `${v.toFixed(1)} K` },
  {
    key: "qv2m",
    label: "Spec. Humidity",
    product: "MERRA-2",
    format: (v) => `${(v * 1000).toFixed(2)} g/kg`,
  },
  { key: "u10m", label: "Wind U", product: "MERRA-2", format: (v) => `${v.toFixed(1)} m/s` },
  { key: "v10m", label: "Wind V", product: "MERRA-2", format: (v) => `${v.toFixed(1)} m/s` },
  { key: "ndvi", label: "NDVI", product: "MODIS", format: (v) => v.toFixed(2) },
  { key: "fireCount", label: "Fire Hotspots", product: "MODIS", format: (v) => `${Math.round(v)}` },
  { key: "cloudFraction", label: "Cloud Cover", product: "MODIS", format: (v) => `${Math.round(v * 100)}%` },
];

function formatCoord(val: number, pos: string, neg: string): string {
  const abs = Math.abs(val).toFixed(1);
  return `${abs}°${val >= 0 ? pos : neg}`;
}

export function EarthCanvasPanel({
  signature,
  layers,
  frameFeatures,
  playheadX,
  playing,
  reducedMotion,
  onScrubPlayhead,
  onGlobeViewChange,
}: EarthCanvasPanelProps) {
  const [dragMode, setDragMode] = useState<"orbit" | "scan">("orbit");
  const [rotationOffset, setRotationOffset] = useState<{ yaw: number; pitch: number }>({
    yaw: 0,
    pitch: 0,
  });
  const [zoomFactor, setZoomFactor] = useState<number>(1);
  const [stageAspect, setStageAspect] = useState<number>(1);
  const [visualOrigin, setVisualOrigin] = useState<EarthVisualOrigin>("synthetic-local");

  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateAspect = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setStageAspect(el.clientWidth / el.clientHeight);
      }
    };
    updateAspect();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(updateAspect);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setRotationOffset({ yaw: 0, pitch: 0 });
    setZoomFactor(1);
  }, [signature.presetId]);

  useEffect(() => {
    onGlobeViewChange?.({
      yaw: rotationOffset.yaw,
      pitch: rotationOffset.pitch,
      zoomFactor,
      aspect: stageAspect,
    });
  }, [onGlobeViewChange, rotationOffset.yaw, rotationOffset.pitch, zoomFactor, stageAspect]);

  const diskRadiusX = computeGlobeViewState(
    signature,
    rotationOffset,
    zoomFactor,
    stageAspect,
    0,
    playing,
    reducedMotion,
  ).diskRadiusX;

  const clientXToDiskNorm = (clientX: number, rect: DOMRect) => {
    const viewportNormX = (clientX - rect.left) / rect.width;
    const diskLeft = 0.5 - diskRadiusX;
    const diskWidth = Math.max(0.1, diskRadiusX * 2);
    return Math.max(0, Math.min(1, (viewportNormX - diskLeft) / diskWidth));
  };

  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
  }>({ active: false, startX: 0, startY: 0, startYaw: 0, startPitch: 0 });

  const railDragRef = useRef<boolean>(false);

  const handleViewportPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startYaw: rotationOffset.yaw,
      startPitch: rotationOffset.pitch,
    };
    if (dragMode === "scan") {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0) onScrubPlayhead(clientXToDiskNorm(e.clientX, rect));
    }
  };

  const handleViewportPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const st = dragStateRef.current;
    if (!st.active) return;

    if (dragMode === "orbit") {
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      setRotationOffset({
        yaw: st.startYaw + dx * 0.0075,
        pitch: Math.max(-1.15, Math.min(1.15, st.startPitch + dy * 0.0065)),
      });
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width > 0) onScrubPlayhead(clientXToDiskNorm(e.clientX, rect));
    }
  };

  const handleViewportPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.08 : -0.08;
    setZoomFactor((z) => Math.max(0.62, Math.min(1.4, Number((z + delta).toFixed(2)))));
  };

  const updateRail = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width > 0) onScrubPlayhead((e.clientX - rect.left) / rect.width);
  };

  const renderReadingValue = (reading: VariableReading, formatter: (v: number) => string) => {
    if (reading.quality === "missing" || reading.value === null || !Number.isFinite(reading.value)) {
      return (
        <span className="telemetry-missing" title="Missing data: never coerced to 0">
          <AlertTriangle size={12} aria-hidden="true" />
          — NO DATA
        </span>
      );
    }
    return <span className="telemetry-value">{formatter(reading.value)}</span>;
  };

  const lon = frameFeatures.playhead.longitudeDeg;
  const lat = frameFeatures.playhead.centroidLatitudeDeg;
  const reticleTopPct = Math.max(
    8,
    Math.min(
      92,
      (frameFeatures.playhead.reticleViewportY ?? (90 - lat) / 180) * 100,
    ),
  );
  const beamLeftPct = Math.max(
    2,
    Math.min(98, (frameFeatures.playhead.beamViewportX ?? playheadX) * 100),
  );
  const missingCount = Object.values(signature.variables).filter(
    (v) => v.quality === "missing" || v.value === null,
  ).length;

  const isRotated = Math.abs(rotationOffset.yaw) > 0.02 || Math.abs(rotationOffset.pitch) > 0.02 || Math.abs(zoomFactor - 1) > 0.02;

  return (
    <section className="glass-panel hud-panel hud-panel--canvas" aria-label="EIC Space Viewport">
      <header className="panel-header">
        <div className="panel-title-group">
          <Globe2 size={15} className="panel-icon" aria-hidden="true" />
          <h2 className="panel-title">CANVAS · EIC GLOBE</h2>
        </div>

        <div className="panel-badges">
          <div className="mode-switch" role="group" aria-label="Globe interaction mode">
            <button
              type="button"
              className={`mode-switch__btn ${dragMode === "orbit" ? "is-on" : ""}`}
              onClick={() => setDragMode("orbit")}
              title="Drag to rotate the 3D globe and scroll to zoom"
            >
              <Orbit size={11} aria-hidden="true" />
              <span>Orbit 3D</span>
            </button>
            <button
              type="button"
              className={`mode-switch__btn ${dragMode === "scan" ? "is-on" : ""}`}
              onClick={() => setDragMode("scan")}
              title="Drag to move the cyan sonification scan beam"
            >
              <ScanLine size={11} aria-hidden="true" />
              <span>EIC Beam</span>
            </button>
          </div>

          {isRotated && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                setRotationOffset({ yaw: 0, pitch: 0 });
                setZoomFactor(1);
              }}
              title="Center view on active region"
              aria-label="Reset globe orientation"
            >
              <RotateCcw size={12} aria-hidden="true" />
            </button>
          )}

          <span
            className={`pill ${signature.provenance.origin === "nasa" ? "pill--gibs" : "pill--synthetic"}`}
            title={
              signature.provenance.origin === "nasa"
                ? "NASA Blue Marble satellite imagery with verified multi-mission telemetry (MERRA-2 + VIIRS + FIRMS)"
                : visualOrigin === "nasa-gibs-bluemarble"
                  ? "Public NASA GIBS Blue Marble WMS base; synthetic regional telemetry"
                  : "Locally generated synthetic frame and texture"
            }
          >
            <Radio size={11} aria-hidden="true" />
            {signature.provenance.origin === "nasa"
              ? "NASA BLUE MARBLE · VERIFIED TELEMETRY"
              : visualOrigin === "nasa-gibs-bluemarble"
                ? "NASA BLUE MARBLE · SIMULATED TELEMETRY"
                : "SYNTHETIC EIC FRAME (SIMULATED)"}
          </span>
        </div>
      </header>

      <div
        ref={viewportRef}
        className={`eic-viewport eic-viewport--globe ${dragMode === "orbit" ? "is-orbit-cursor" : ""}`}
        tabIndex={0}
        aria-label={
          dragMode === "orbit"
            ? "Interactive 3D Earth globe: drag to rotate, wheel to zoom"
            : "Longitudinal EIC scanner: drag to move beam"
        }
        onPointerDown={handleViewportPointerDown}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerUp}
        onPointerCancel={handleViewportPointerUp}
        onWheel={handleWheel}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") onScrubPlayhead(playheadX - 0.025);
          if (e.key === "ArrowRight") onScrubPlayhead(playheadX + 0.025);
        }}
      >
        {/* Globo 3D estilo NASA Eyes: superficie real Blue Marble + nubes volumétricas + estrellas + órbitas */}
        <EarthGlobe3D
          signature={signature}
          layers={layers}
          playing={playing}
          reducedMotion={reducedMotion}
          rotationOffset={rotationOffset}
          zoomFactor={zoomFactor}
          onVisualOriginChange={setVisualOrigin}
          className="eic-globe-canvas"
        />

        {/* Anillos holográficos y órbitas luminosas (no tapan el relieve ni océanos del planeta) */}
        <svg
          className={`jarvis-reticle ${playing ? "is-active" : ""}`}
          viewBox="0 0 400 400"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="holoRingCyanMagenta" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00D9FF" stopOpacity="0.55" />
              <stop offset="50%" stopColor="#8B3DFF" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#FF35D3" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          <ellipse
            cx="200"
            cy="200"
            rx="192"
            ry="74"
            fill="none"
            stroke="url(#holoRingCyanMagenta)"
            strokeWidth="1.15"
            strokeDasharray="6 10"
            transform="rotate(-18 200 200)"
          />
          <ellipse
            cx="200"
            cy="200"
            rx="188"
            ry="64"
            fill="none"
            stroke="rgba(255, 53, 211, 0.28)"
            strokeWidth="0.95"
            transform="rotate(22 200 200)"
          />
          <circle
            cx="200"
            cy="200"
            r="186"
            fill="none"
            stroke="rgba(0, 217, 255, 0.34)"
            strokeWidth="1.1"
          />
          <circle
            cx="200"
            cy="200"
            r="178"
            fill="none"
            stroke="rgba(139, 61, 255, 0.28)"
            strokeWidth="0.95"
            strokeDasharray="3 8"
          />
          <line x1="200" y1="8" x2="200" y2="20" stroke="#00D9FF" strokeWidth="1.4" />
          <line x1="200" y1="380" x2="200" y2="392" stroke="#FF35D3" strokeWidth="1.4" />
          <line x1="8" y1="200" x2="20" y2="200" stroke="#00D9FF" strokeWidth="1.4" />
          <line x1="380" y1="200" x2="392" y2="200" stroke="#FF35D3" strokeWidth="1.4" />
        </svg>

        {/* Pedestal emisor holográfico inferior (decorativo) */}
        <div className="holo-pedestal" aria-hidden="true">
          <div className="holo-pedestal__ring holo-pedestal__ring--outer" />
          <div className="holo-pedestal__ring holo-pedestal__ring--inner" />
          <div className="holo-pedestal__beam" />
        </div>

        {/* Haz láser vertical fino Jarvis para sonificación sin velar la textura del planeta */}
        <div
          className={`jarvis-scan-beam ${playing ? "is-playing" : ""}`}
          style={{ left: `${beamLeftPct}%` }}
          aria-hidden="true"
        >
          <div className="jarvis-scan-beam__core" />
          <div className="jarvis-scan-target" style={{ top: `${reticleTopPct}%` }} />
        </div>

        {/* Telemetría orbital en las esquinas */}
        <div className="radar-corner radar-corner--tl" aria-hidden="true">
          <span>ACTIVE SECTOR</span>
          <strong>{signature.region.name}</strong>
        </div>
        <div className="radar-corner radar-corner--tr" aria-hidden="true">
          <span>SCAN BEAM</span>
          <strong>
            {formatCoord(lon, "E", "W")} · {formatCoord(lat, "N", "S")}
          </strong>
        </div>
        <div className="radar-corner radar-corner--bl" aria-hidden="true">
          <span>HUE / EDGES</span>
          <strong>
            {Math.round(frameFeatures.dominantHueDeg)}° ·{" "}
            {Math.round(frameFeatures.edgeDensity * 100)}%
          </strong>
        </div>
        <div className="radar-corner radar-corner--br" aria-hidden="true">
          <span>ZOOM / COLUMN</span>
          <strong>
            {(1 / zoomFactor).toFixed(1)}× · {Math.round(frameFeatures.playhead.columnEnergy * 100)}%
          </strong>
        </div>

        {/* Barra inferior interactiva para barrer el haz longitudinal en cualquier modo */}
        <div
          className="scan-scrub-rail"
          role="slider"
          aria-label="Longitudinal sonification beam position"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(playheadX * 100)}
          onPointerDown={(e) => {
            e.stopPropagation();
            railDragRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateRail(e);
          }}
          onPointerMove={(e) => {
            if (!railDragRef.current) return;
            e.stopPropagation();
            updateRail(e);
          }}
          onPointerUp={(e) => {
            if (!railDragRef.current) return;
            e.stopPropagation();
            railDragRef.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          title="Drag this bar to move the cyan scan beam (-180° to +180°)"
        >
          <span className="scan-scrub-rail__label">
            {dragMode === "orbit"
              ? "Drag globe to orbit · Scroll to zoom"
              : "Drag globe to move beam · Scroll to zoom"}
          </span>
          <div className="scan-scrub-rail__track">
            <div className="scan-scrub-rail__fill" style={{ width: `${playheadX * 100}%` }} />
            <div className="scan-scrub-rail__thumb" style={{ left: `${playheadX * 100}%` }} />
          </div>
          <span className="scan-scrub-rail__pct">{Math.round(playheadX * 100)}%</span>
        </div>
      </div>

      {/* Grilla simétrica 4×2 */}
      <div className="telemetry-grid" aria-label="Scientific variable telemetry">
        {VARIABLE_META.map((item) => {
          const reading = signature.variables[item.key];
          const isMissing = reading.quality === "missing" || reading.value === null;
          return (
            <div key={item.key} className={`telemetry-card ${isMissing ? "is-missing" : ""}`}>
              <div className="telemetry-card__top">
                <span className="telemetry-card__label">{item.label}</span>
                <span className="telemetry-card__product">{item.product}</span>
              </div>
              <div className="telemetry-card__val">
                {renderReadingValue(reading, item.format)}
              </div>
              <div className="telemetry-card__meta">
                <span>{reading.unit}</span>
                <span className={`quality-tag quality-tag--${reading.quality}`}>
                  {reading.quality}
                </span>
              </div>
            </div>
          );
        })}

        <div className={`telemetry-card telemetry-card--summary ${missingCount > 0 ? "is-missing" : ""}`}>
          <div className="telemetry-card__top">
            <span className="telemetry-card__label">Integrity</span>
            <Compass size={11} className="telemetry-card__product" aria-hidden="true" />
          </div>
          <div className="telemetry-card__val">
            <span className={missingCount > 0 ? "telemetry-missing" : "telemetry-value"}>
              {missingCount === 0 ? "7 / 7 OK" : `${missingCount} null`}
            </span>
          </div>
          <div className="telemetry-card__meta">
            <span>{signature.provenance.origin}</span>
            <span className={`quality-tag ${missingCount > 0 ? "quality-tag--missing" : "quality-tag--ok"}`}>
              {missingCount > 0 ? "partial" : "complete"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
