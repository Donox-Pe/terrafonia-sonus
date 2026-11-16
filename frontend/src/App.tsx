import { useState } from "react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Flame,
  FlaskConical,
  LayoutDashboard,
  Minimize2,
  Play,
  Sliders,
  Sparkles,
  Square,
  Trees,
  Volume2,
  VolumeX,
} from "lucide-react";
import { SonusLogo3D } from "./logo3d/SonusLogo3D";
import { AudioAnalyzerPanel } from "./ui/AudioAnalyzerPanel";
import { EarthCanvasPanel } from "./ui/EarthCanvasPanel";
import { FluxLinesBg } from "./ui/FluxLinesBg";
import { ProvenanceView } from "./ui/ProvenanceView";
import { SonusAssistantDrawer, type AssistantMessage } from "./ui/SonusAssistantDrawer";
import { useTerraFoniaController } from "./ui/useTerraFoniaController";
import { VisualizerPanel } from "./ui/VisualizerPanel";
import { explainFrequencyBand, interpretSonusQuery, type SonusAgentContext } from "./voice/sonusAgent";
import { useSonusNarrator } from "./voice/sonusNarrator";

type ViewMode = "hud" | "sonus3d" | "science";

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>("hud");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>(() => [
    {
      id: "sonus-welcome",
      role: "sonus",
      text: "Hello, I am the SONUS Copilot. Ask me what you are hearing, click any frequency bar in AUDIO ANALYZER, or ask me to act — like 'Go to the Amazon with fire' or 'Set modulation to 85%'.",
    },
  ]);
  const ctrl = useTerraFoniaController();
  const narrator = useSonusNarrator({
    onVocalActivity: ctrl.setAiVoiceActivity,
  });

  const buildAgentContext = (): SonusAgentContext => ({
    lang: narrator.lang,
    playing: ctrl.playing,
    layers: ctrl.layers,
    modulationAmount: ctrl.modulationAmount,
    sweepSpeed: ctrl.sweepSpeed,
    scaleChoice: ctrl.scaleChoice,
    signature: ctrl.signature,
    targets: ctrl.targets,
    frameFeatures: ctrl.frameFeatures,
  });

  const handleSendAssistantQuery = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;

    const userMsg: AssistantMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "user",
      text: query,
    };

    const response = interpretSonusQuery(query, buildAgentContext());
    for (const action of response.actions) {
      switch (action.type) {
        case "setPreset":
          ctrl.setPresetId(action.presetId);
          break;
        case "setPlaying":
          if (ctrl.playing !== action.playing) {
            void ctrl.togglePlay();
          }
          break;
        case "setLayer":
          if (ctrl.layers[action.layer] !== action.enabled) {
            ctrl.toggleLayer(action.layer);
          }
          break;
        case "setSoloVoice":
          ctrl.setSoloVoice(action.voice);
          break;
        case "setModulation":
          ctrl.setModulationAmount(action.value);
          break;
        case "setSweepSpeed":
          ctrl.setSweepSpeed(action.value);
          break;
        case "setScale":
          ctrl.setScaleChoice(action.scale);
          break;
        case "setLang":
          narrator.setLang(action.lang);
          break;
      }
    }

    const sonusMsg: AssistantMessage = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "sonus",
      text: response.reply,
      badges: response.badges,
    };

    setAssistantMessages((prev) => [...prev, userMsg, sonusMsg]);

    if (voiceReplyEnabled) {
      const langAction = response.actions.find(
        (action): action is Extract<typeof action, { type: "setLang" }> => action.type === "setLang"
      );
      narrator.speakText(response.reply, langAction?.lang ?? narrator.lang);
    }
  };

  const handleSelectAnalyzerBand = (bandLabelHz: string, bandIndex: number) => {
    setAssistantOpen(true);
    const bandLabel = `${bandLabelHz} Hz`;
    const userMsg: AssistantMessage = {
      id: `u-band-${Date.now()}`,
      role: "user",
      text:
        narrator.lang === "en"
          ? `Explain the ${bandLabel} band`
          : `Explica la banda de ${bandLabel}`,
    };
    const explanation = explainFrequencyBand(bandIndex, buildAgentContext());
    const sonusMsg: AssistantMessage = {
      id: `s-band-${Date.now()}`,
      role: "sonus",
      text: explanation,
      badges: [bandLabel],
    };

    setAssistantMessages((prev) => [...prev, userMsg, sonusMsg]);
    if (voiceReplyEnabled) {
      narrator.speakText(explanation, narrator.lang);
    }
  };

  const handleSonusOrbClick = () => {
    if (ctrl.playing) {
      ctrl.triggerLogoPulse();
    }
    if (narrator.speaking) {
      narrator.stop();
    } else {
      narrator.playAll();
    }
  };

  const handleToggleMute = () => {
    ctrl.setVolume(ctrl.volume > 0 ? 0 : 0.72);
  };

  return (
    <div className="stage app-shell">
      <div className="mesh" aria-hidden="true" />
      <FluxLinesBg />
      <div className="cyber-particles" aria-hidden="true" />
      <div className="scanlines" aria-hidden="true" />

      {/* ── Sidebar lateral izquierdo ── */}
      <aside className="app-sidebar glass-panel" aria-label="Navegación principal">
        <div className="sidebar-brand">
          <div className="brand-emblem" aria-hidden="true">
            <svg viewBox="0 0 110 96" className="brand-emblem__svg" role="presentation">
              {/* Esfera azul oficial NASA */}
              <circle cx="55" cy="48" r="40" fill="#0B3D91" />
              {/* Estrellas */}
              <circle cx="46" cy="20" r="1.2" fill="#ffffff" />
              <circle cx="58" cy="17" r="1.5" fill="#ffffff" />
              <circle cx="67" cy="24" r="1.1" fill="#ffffff" />
              <circle cx="34" cy="31" r="1.1" fill="#ffffff" />
              <circle cx="77" cy="33" r="1.2" fill="#ffffff" />
              <circle cx="31" cy="64" r="1.2" fill="#ffffff" />
              <circle cx="38" cy="72" r="1.5" fill="#ffffff" />
              <circle cx="48" cy="76" r="1.0" fill="#ffffff" />
              <circle cx="73" cy="69" r="1.4" fill="#ffffff" />
              <circle cx="80" cy="61" r="1.1" fill="#ffffff" />
              {/* Órbita elíptica blanca */}
              <path
                d="M44 63 C28 45, 29 24, 44 22 C60 20, 82 48, 74 71 C70 81, 58 83, 49 77"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              {/* Vector rojo NASA (ala superior) */}
              <path
                d="M11 61 C36 45, 69 31, 100 10 C82 32, 57 45, 16 64 Z"
                fill="#FC3D21"
              />
              {/* Letras NASA */}
              <text
                x="55"
                y="55"
                textAnchor="middle"
                fill="#ffffff"
                fontFamily="Georgia, 'Times New Roman', serif"
                fontWeight="900"
                fontSize="23"
                letterSpacing="1.2"
              >
                NASA
              </text>
              {/* Ala inferior del vector rojo cruzando */}
              <path
                d="M21 82 C44 61, 68 41, 95 16 C75 40, 51 62, 24 84 Z"
                fill="#FC3D21"
              />
            </svg>
          </div>
          <div className="sidebar-brand__copy">
            <span className="brand-name">TERRAFONÍA</span>
            <span className="sidebar-nasa-pill">NASA · EIC</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Application views">
          <button
            type="button"
            className={`sidebar-nav__btn ${viewMode === "hud" ? "is-active" : ""}`}
            onClick={() => setViewMode("hud")}
          >
            <LayoutDashboard size={16} aria-hidden="true" />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav__btn ${viewMode === "sonus3d" ? "is-active" : ""}`}
            onClick={() => setViewMode("sonus3d")}
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>SONUS 3D Core</span>
          </button>
          <button
            type="button"
            className={`sidebar-nav__btn ${viewMode === "science" ? "is-active" : ""}`}
            onClick={() => setViewMode("science")}
          >
            <FlaskConical size={16} aria-hidden="true" />
            <span>Scientific Inspection</span>
          </button>
        </nav>

        <div className="sidebar-status">
          <div className="sidebar-status__head">
            <span className="dot" aria-hidden="true" />
            <strong>System Active</strong>
          </div>
          <span className="sidebar-status__meta">
            {ctrl.signature.region.name} · {ctrl.date}
          </span>
          <span className="sidebar-status__meta">
            {ctrl.playing ? "Web Audio Engine: LIVE" : "Web Audio Engine: STANDBY"}
          </span>
        </div>
      </aside>

      {/* ── Columna principal: Topbar + Escenario + Dock ── */}
      <div className="app-main">
        <header className="hud-header glass-panel">
          <div className="brand-copy">
            <div className="brand-row">
              <span className="brand-name cyber-glitch-tag">TERRAFONIA</span>
              <span className="brand-sep">/</span>
              <h1 className="instrument-name">The Earth Information Machine</h1>
            </div>
            <span className="brand-sub">NASA Earth Information Center · Telemetry &amp; Holographic Sonification</span>
          </div>

          <div className="header-controls">
          <div className="layer-toggles" role="group" aria-label="EIC visualization layers">
            <button
              type="button"
              className={`layer-pill layer-pill--fire ${ctrl.layers.fire ? "is-on" : ""}`}
              onClick={() => ctrl.toggleLayer("fire")}
              aria-pressed={ctrl.layers.fire}
            >
              <Flame size={13} aria-hidden="true" />
              <span>Fire</span>
              <span className="layer-pill__check" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`layer-pill layer-pill--ndvi ${ctrl.layers.ndvi ? "is-on" : ""}`}
              onClick={() => ctrl.toggleLayer("ndvi")}
              aria-pressed={ctrl.layers.ndvi}
            >
              <Trees size={13} aria-hidden="true" />
              <span>NDVI</span>
              <span className="layer-pill__check" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={`layer-pill layer-pill--clouds ${ctrl.layers.clouds ? "is-on" : ""}`}
              onClick={() => ctrl.toggleLayer("clouds")}
              aria-pressed={ctrl.layers.clouds}
            >
              <Cloud size={13} aria-hidden="true" />
              <span>Clouds</span>
              <span className="layer-pill__check" aria-hidden="true" />
            </button>
          </div>

          <div className="status-badges">
            {ctrl.signature.provenance.origin === "nasa" && ctrl.signature.provenance.verified ? (
              <span
                className="badge badge--nasa"
                title={ctrl.signature.provenance.notes}
              >
                <span className="dot" aria-hidden="true" />
                NASA MERRA-2 VERIFIED
              </span>
            ) : (
              <span
                className="badge badge--sim"
                title="Values come from the local scientific simulator when NASA Earthdata cache is unavailable"
              >
                <span className="dot" aria-hidden="true" />
                SIMULATED DATA
              </span>
            )}
            <button
              type="button"
              className={`badge sonus-assistant-trigger ${assistantOpen ? "is-open" : ""}`}
              onClick={() => setAssistantOpen((prev) => !prev)}
              aria-expanded={assistantOpen}
              title="Open SONUS AI Copilot"
            >
              <Bot size={13} aria-hidden="true" />
              <span>SONUS AI</span>
            </button>

            <a
              href="http://127.0.0.1:4000/"
              target="_blank"
              rel="noreferrer"
              className={`badge badge--transport ${ctrl.transportMode === "backend-live" ? "is-live" : ""
                }`}
              title={`${ctrl.transportDetail} — Click to open REST Backend (:4000)`}
            >
              {ctrl.transportMode === "backend-live" ? "SOCKET.IO · :4000" : "LOCAL SIMULATOR"}
            </a>
          </div>
        </div>
      </header>

      {/* ── Escenario principal ── */}
      <main className="stage-body">
        {ctrl.audioError && (
          <div className="error-banner" role="alert">
            Web Audio API error: {ctrl.audioError}
          </div>
        )}

        {viewMode === "hud" && (
          <div className="hud-grid hud-grid--2col">
            <EarthCanvasPanel
              signature={ctrl.signature}
              layers={ctrl.layers}
              frameFeatures={ctrl.frameFeatures}
              playheadX={ctrl.playheadX}
              playing={ctrl.playing}
              reducedMotion={ctrl.reducedMotion}
              onScrubPlayhead={ctrl.scrubPlayhead}
              onGlobeViewChange={ctrl.updateGlobeView}
            />

            <div className="hud-right-col">
              <VisualizerPanel
                playing={ctrl.playing}
                reducedMotion={ctrl.reducedMotion}
                modulationAmount={ctrl.modulationAmount}
                sweepSpeed={ctrl.sweepSpeed}
                scaleChoice={ctrl.scaleChoice}
                frameFeatures={ctrl.frameFeatures}
                targets={ctrl.targets}
                sampleAnalyser={ctrl.sampleAnalyser}
                onChangeModulation={ctrl.setModulationAmount}
                onChangeSweepSpeed={ctrl.setSweepSpeed}
                onChangeScale={ctrl.setScaleChoice}
              />

              <AudioAnalyzerPanel
                playing={ctrl.playing}
                reducedMotion={ctrl.reducedMotion}
                frameFeatures={ctrl.frameFeatures}
                targets={ctrl.targets}
                sampleAnalyser={ctrl.sampleAnalyser}
                soloVoice={ctrl.soloVoice}
                onSelectSoloVoice={ctrl.setSoloVoice}
                onSelectBand={handleSelectAnalyzerBand}
              />

              <section
                className="glass-panel hud-panel hud-panel--synth"
                aria-label="Synthesis acoustic telemetry"
              >
                <header className="panel-header">
                  <div className="panel-title-group">
                    <Sliders size={15} className="panel-icon panel-icon--magenta" aria-hidden="true" />
                    <h2 className="panel-title">SYNTHESIS PARAMETERS</h2>
                  </div>
                  <span className="micro-metric">SOBEL {Math.round(ctrl.frameFeatures.edgeDensity * 100)}%</span>
                </header>

                <div className="synth-stats synth-stats--cyber">
                  <div className="synth-stat">
                    <span>Fundamental</span>
                    <strong>{ctrl.targets.baseFreqHz.toFixed(1)} Hz</strong>
                  </div>
                  <div className="synth-stat">
                    <span>Scanhead</span>
                    <strong>{Math.round(ctrl.targets.scannerPitchHz)} Hz</strong>
                  </div>
                  <div className="synth-stat">
                    <span>LFO / Mixer</span>
                    <strong>{ctrl.targets.lfoRateHz.toFixed(2)} Hz</strong>
                  </div>
                  <div className="synth-stat">
                    <span>Stereo Pan</span>
                    <strong>
                      {ctrl.targets.stereoPan >= 0 ? "+" : ""}
                      {ctrl.targets.stereoPan.toFixed(2)}
                    </strong>
                  </div>
                  <div className="synth-stat">
                    <span>Cloud Reverb</span>
                    <strong>{Math.round(ctrl.targets.reverbWet * 100)}%</strong>
                  </div>
                  <div className="synth-stat">
                    <span>Missing</span>
                    <strong className={ctrl.targets.missingVariables.length > 0 ? "is-warn" : ""}>
                      {ctrl.targets.missingVariables.length}
                    </strong>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {viewMode === "sonus3d" && (
          <section className="glass-panel sonus-full-stage" aria-label="Immersive SONUS 3D View">
            <div className="sonus-full-hud">
              <div>
                <span className="sonus-full-kicker">INTERACTIVE SONIC IDENTITY</span>
                <h2 className="sonus-full-title">SONUS Spherical Core</h2>
              </div>
              <div className="panel-badges">
                <div className="lang-switch" role="group" aria-label="Narration language">
                  <button
                    type="button"
                    className={`lang-switch__btn ${narrator.lang === "en" ? "is-on" : ""}`}
                    onClick={() => narrator.setLang("en")}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    className={`lang-switch__btn ${narrator.lang === "es" ? "is-on" : ""}`}
                    onClick={() => narrator.setLang("es")}
                  >
                    Español
                  </button>
                </div>
                <button
                  type="button"
                  className="icon-btn icon-btn--labeled"
                  onClick={() => setViewMode("hud")}
                >
                  <Minimize2 size={14} aria-hidden="true" />
                  <span>Back to Dashboard</span>
                </button>
              </div>
            </div>

            <div className="sonus-full-canvas-wrap">
              <SonusLogo3D
                levels={ctrl.levelsRef}
                className="sonus-full-canvas"
                showWordmark={true}
                showParticles={true}
                speaking={narrator.speaking}
                onLogoClick={handleSonusOrbClick}
              />
              {narrator.speaking && (
                <div className="sonus-voice-drawer sonus-voice-drawer--full" role="status" aria-live="polite">
                  <div className="sonus-voice-drawer__head">
                    <span className="sonus-voice-drawer__tag">
                      <span className="dot" aria-hidden="true" />
                      {narrator.chapterIndex + 1}/{narrator.chapters.length} · {narrator.currentChapter.title}
                    </span>
                    <div className="sonus-voice-drawer__nav">
                      <button
                        type="button"
                        className="knob-step-btn"
                        onClick={narrator.prevChapter}
                        aria-label="Previous chapter"
                        title="Previous chapter"
                      >
                        <ChevronLeft size={11} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="knob-step-btn"
                        onClick={narrator.nextChapter}
                        aria-label="Next chapter"
                        title="Next chapter"
                      >
                        <ChevronRight size={11} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <p className="sonus-voice-drawer__text">{narrator.currentChapter.text}</p>
                </div>
              )}
            </div>

            <div className="sonus-full-footer">
              <span>Scale: {ctrl.scaleChoice.toUpperCase()}</span>
              <span>Fundamental: {ctrl.targets.baseFreqHz.toFixed(1)} Hz</span>
              <span>Region: {ctrl.signature.region.name}</span>
              <span>
                {narrator.speaking
                  ? "Click sphere to stop · Drag to rotate"
                  : "Click sphere to start AI Voice briefing · Drag to rotate"}
              </span>
            </div>
          </section>
        )}

        {viewMode === "science" && (
          <ProvenanceView
            signature={ctrl.signature}
            targets={ctrl.targets}
            frameFeatures={ctrl.frameFeatures}
            transportMode={ctrl.transportMode}
            transportDetail={ctrl.transportDetail}
          />
        )}
      </main>

      {/* ── Dock inferior de transporte (Propuesta 01) ── */}
      <footer className="hud-dock glass-panel">
        <button
          type="button"
          className={`play-btn ${ctrl.playing ? "is-playing" : ""}`}
          onClick={() => {
            void ctrl.togglePlay();
          }}
        >
          {ctrl.playing ? <Square size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          <span>{ctrl.playing ? "STOP" : "PLAY"}</span>
        </button>

        <label className="dock-field">
          <span className="dock-field__label">Preset</span>
          <select
            className="hud-select dock-select"
            value={ctrl.presetId}
            onChange={(e) => ctrl.setPresetId(e.target.value)}
            aria-label="Select region or scenario"
          >
            {ctrl.presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="dock-field">
          <span className="dock-field__label">Date</span>
          <input
            type="date"
            className="hud-date"
            value={ctrl.date}
            min="1980-01-01"
            max="2025-12-31"
            onChange={(e) => ctrl.setDate(e.target.value)}
            aria-label="Simulation date"
          />
        </label>

        <div className="dock-volume">
          <button
            type="button"
            className="vol-mute-btn"
            onClick={handleToggleMute}
            aria-label={ctrl.volume > 0 ? "Mute audio" : "Restore volume"}
          >
            {ctrl.volume > 0 ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={ctrl.volume}
            onChange={(e) => ctrl.setVolume(Number(e.target.value))}
            aria-label="Master volume"
          />
          <span className="vol-pct">{Math.round(ctrl.volume * 100)}%</span>
        </div>
      </footer>
      </div>

      <SonusAssistantDrawer
        open={assistantOpen}
        lang={narrator.lang}
        speaking={narrator.speaking}
        voiceReplyEnabled={voiceReplyEnabled}
        messages={assistantMessages}
        onClose={() => setAssistantOpen(false)}
        onToggleVoiceReply={() => {
          setVoiceReplyEnabled((prev) => {
            const next = !prev;
            if (!next) {
              narrator.stop();
            }
            return next;
          });
        }}
        onChangeLang={narrator.setLang}
        onSendQuery={handleSendAssistantQuery}
      />
    </div>
  );
}
