import { Router } from "express";
import type { SignatureStore } from "../services/signatureStore.js";

export function createApiRouter(store: SignatureStore): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "earth-jukebox-backend",
      mode: "simulated",
      timestamp: new Date().toISOString(),
    });
  });

  router.get("/provenance", (_req, res) => {
    res.json(store.getProvenanceSummary());
  });

  router.get("/presets", (_req, res) => {
    res.json({ presets: store.listPresets() });
  });

  router.get("/signature", (req, res) => {
    const presetId = typeof req.query.preset === "string" ? req.query.preset : "amazonia";
    const date = typeof req.query.date === "string" ? req.query.date : "2026-11-11";
    const phase = typeof req.query.phase === "string" ? Number(req.query.phase) : 0;

    const sig = store.getSignature({ presetId, date, phase });
    res.json(sig);
  });

  return router;
}
