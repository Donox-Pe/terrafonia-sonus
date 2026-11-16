import { AlertCircle, CheckCircle2, FileCode2, ShieldAlert } from "lucide-react";
import type { FrameFeatures } from "../analysis/frameAnalyzer";
import type { SonificationTargets } from "../audio/mapping";
import type { SoundSignature, VariableName } from "../types/soundSignature";
import type { TransportMode } from "../transport/signatureClient";

export interface ProvenanceViewProps {
  signature: SoundSignature;
  targets: SonificationTargets;
  frameFeatures: FrameFeatures;
  transportMode: TransportMode;
  transportDetail: string;
}

const MAPPING_DESCRIPTIONS: Record<VariableName, { name: string; audioRole: string }> = {
  t2m: {
    name: "Temperature at 2m (t2m)",
    audioRole: "Drone fundamental pitch quantized to musical scale + pad modulation",
  },
  qv2m: {
    name: "Specific Humidity 2m (qv2m)",
    audioRole: "Low-pass filter cutoff frequency and Q resonance",
  },
  u10m: {
    name: "Zonal Wind U 10m (u10m)",
    audioRole: "Stereo panning combined with longitudinal scanhead position",
  },
  v10m: {
    name: "Meridional Wind V 10m (v10m)",
    audioRole: "Wind speed magnitude → LFO rate (0.08–6 Hz)",
  },
  ndvi: {
    name: "Vegetation Index NDVI (ndvi)",
    audioRole: "Harmonic density (biotic fifth and octave) over the tonal core",
  },
  fireCount: {
    name: "Active Fire Hotspots (fireCount)",
    audioRole: "High-band granular impulse probability and spark rate",
  },
  cloudFraction: {
    name: "Cloud Fraction (cloudFraction)",
    audioRole: "Spatial ConvolverNode dry/wet mix (atmospheric reverb)",
  },
};

export function ProvenanceView({
  signature,
  targets,
  frameFeatures,
  transportMode,
  transportDetail,
}: ProvenanceViewProps) {
  const varEntries = Object.entries(signature.variables) as Array<
    [VariableName, SoundSignature["variables"][VariableName]]
  >;

  return (
    <div className="provenance-layout" aria-label="Scientific inspection and provenance">
      <section className="glass-panel hud-panel">
        <header className="panel-header">
          <div className="panel-title-group">
            <ShieldAlert size={15} className="panel-icon panel-icon--amber" aria-hidden="true" />
            <h2 className="panel-title">DATA TRACEABILITY &amp; PROVENANCE</h2>
          </div>
          <span className="pill pill--synthetic">
            {signature.provenance.verified ? "VERIFIED" : "UNVERIFIED · SIMULATED"}
          </span>
        </header>

        <div className="provenance-grid">
          <div className="prov-kv">
            <span className="prov-kv__k">Active origin</span>
            <strong className="prov-kv__v">{signature.provenance.origin}</strong>
          </div>
          <div className="prov-kv">
            <span className="prov-kv__k">Transport</span>
            <strong className="prov-kv__v">
              {transportMode === "backend-live" ? "Socket.IO Backend" : "Local Simulator"}
            </strong>
            <small>{transportDetail}</small>
          </div>
          <div className="prov-kv">
            <span className="prov-kv__k">ISO Timestamp</span>
            <strong className="prov-kv__v">{signature.timestamp}</strong>
          </div>
          <div className="prov-kv">
            <span className="prov-kv__k">Regional coverage</span>
            <strong className="prov-kv__v">
              {signature.region.name} ({signature.region.lat[0]}°..{signature.region.lat[1]}°,{" "}
              {signature.region.lon[0]}°..{signature.region.lon[1]}°)
            </strong>
          </div>
        </div>

        <p className="prov-note">{signature.provenance.notes}</p>

        <div className="backend-links-bar" aria-label="Direct backend inspection">
          <span>Live Backend Endpoints:</span>
          <a href="http://127.0.0.1:4000/" target="_blank" rel="noreferrer">
            Backend Dashboard (:4000)
          </a>
          <a href="http://127.0.0.1:4000/api/health" target="_blank" rel="noreferrer">
            /api/health
          </a>
          <a href="http://127.0.0.1:4000/api/presets" target="_blank" rel="noreferrer">
            /api/presets
          </a>
          <a
            href={`http://127.0.0.1:4000/api/signature?preset=${encodeURIComponent(signature.presetId)}`}
            target="_blank"
            rel="noreferrer"
          >
            /api/signature
          </a>
          <a href="http://127.0.0.1:4000/api/provenance" target="_blank" rel="noreferrer">
            /api/provenance
          </a>
        </div>

        <div className="table-wrap">
          <table className="science-table">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Value</th>
                <th>Unit</th>
                <th>Quality</th>
                <th>Declared Source</th>
                <th>Web Audio Mapping</th>
              </tr>
            </thead>
            <tbody>
              {varEntries.map(([key, reading]) => {
                const isMissing = reading.quality === "missing" || reading.value === null;
                return (
                  <tr key={key} className={isMissing ? "is-missing-row" : ""}>
                    <td>{MAPPING_DESCRIPTIONS[key].name}</td>
                    <td className="mono">
                      {isMissing ? (
                        <span className="telemetry-missing">null (NO DATA)</span>
                      ) : (
                        reading.value
                      )}
                    </td>
                    <td className="mono">{reading.unit}</td>
                    <td>
                      <span className={`quality-tag quality-tag--${reading.quality}`}>
                        {isMissing ? (
                          <AlertCircle size={11} aria-hidden="true" />
                        ) : (
                          <CheckCircle2 size={11} aria-hidden="true" />
                        )}
                        {reading.quality}
                      </span>
                    </td>
                    <td className="mono">{reading.source}</td>
                    <td>{MAPPING_DESCRIPTIONS[key].audioRole}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="glass-panel hud-panel">
        <header className="panel-header">
          <div className="panel-title-group">
            <FileCode2 size={15} className="panel-icon" aria-hidden="true" />
            <h2 className="panel-title">ENGINE OUTPUT · DUAL TELEMETRY (EIC + SYNTHESIS)</h2>
          </div>
        </header>

        <div className="dual-readout-grid">
          <div className="json-card">
            <h3>EIC Visual Frame Features</h3>
            <pre className="json-pre">
              {JSON.stringify(
                {
                  meanLuminance: Number(frameFeatures.meanLuminance.toFixed(3)),
                  spatialVariance: Number(frameFeatures.spatialVariance.toFixed(3)),
                  edgeDensitySobel: Number(frameFeatures.edgeDensity.toFixed(3)),
                  dominantHueDeg: Math.round(frameFeatures.dominantHueDeg),
                  playheadLonDeg: Number(frameFeatures.playhead.longitudeDeg.toFixed(1)),
                  centroidLatDeg: Number(frameFeatures.playhead.centroidLatitudeDeg.toFixed(1)),
                  hotspotActivity: Number(frameFeatures.playhead.hotspotActivity.toFixed(3)),
                  canopyActivity: Number(frameFeatures.playhead.canopyActivity.toFixed(3)),
                  cloudActivity: Number(frameFeatures.playhead.cloudActivity.toFixed(3)),
                },
                null,
                2,
              )}
            </pre>
          </div>

          <div className="json-card">
            <h3>Computed Web Audio API Targets</h3>
            <pre className="json-pre">
              {JSON.stringify(
                {
                  baseFreqHz: Number(targets.baseFreqHz.toFixed(2)),
                  filterCutoffHz: Math.round(targets.filterCutoffHz),
                  filterQ: Number(targets.filterQ.toFixed(2)),
                  lfoRateHz: Number(targets.lfoRateHz.toFixed(2)),
                  stereoPan: Number(targets.stereoPan.toFixed(2)),
                  overtoneDensity: Number(targets.overtoneDensity.toFixed(2)),
                  noiseTextureGain: Number(targets.noiseTextureGain.toFixed(3)),
                  fireProbability: Number(targets.fireProbability.toFixed(2)),
                  reverbWet: Number(targets.reverbWet.toFixed(2)),
                  scannerPitchHz: Math.round(targets.scannerPitchHz),
                  missingVariables: targets.missingVariables,
                  activeVoices: targets.activeVoices,
                },
                null,
                2,
              )}
            </pre>
          </div>
        </div>

        <div className="verify-callout">
          <strong>[VERIFY] NASA Earthdata Integration:</strong> Real adapters in{" "}
          <code>ingest/merra2/</code> (GES DISC) and <code>ingest/modis/</code> (LAADS/LP DAAC),
          along with Earth Information Center and NASA GIBS imagery, connect directly to this{" "}
          <code>SoundSignature v1.0.0</code> contract, setting <code>origin: "nasa"</code> and{" "}
          <code>verified: true</code> only after verifying live access.
        </div>
      </section>
    </div>
  );
}
