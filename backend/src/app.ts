import http from "node:http";
import cors from "cors";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { createApiRouter } from "./routes/api.js";
import { SignatureStore } from "./services/signatureStore.js";
import { attachSignatureStream } from "./sockets/signatureStream.js";

export interface AppInstance {
  app: express.Express;
  server: http.Server;
  io: SocketIOServer;
  store: SignatureStore;
}

export function createApp(options: { cacheDir?: string; corsOrigin?: string | string[] } = {}): AppInstance {
  const store = new SignatureStore(options.cacheDir);
  const app = express();
  const origin = options.corsOrigin ?? ["http://127.0.0.1:5173", "http://localhost:5173"];

  app.use(cors({ origin }));
  app.use(express.json());
  app.get("/", (req, res) => {
    if (req.accepts("html")) {
      res.type("html").send(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Earth Jukebox Backend · TerraFonía</title>
    <style>
      body { font-family: system-ui, sans-serif; background:#070b18; color:#e9e4ff; margin:0; padding:32px; line-height:1.5; }
      .card { max-width:680px; margin:auto; background:rgba(15,23,42,.85); border:1px solid rgba(95,227,255,.28); border-radius:14px; padding:24px; }
      h1 { margin:0 0 8px; color:#5fe3ff; font-size:1.25rem; }
      .badge { display:inline-block; padding:3px 10px; border-radius:999px; font-size:.75rem; background:rgba(245,158,11,.15); color:#fbbf24; border:1px solid rgba(245,158,11,.35); }
      ul { padding-left:18px; }
      a { color:#5fe3ff; text-decoration:none; }
      a:hover { text-decoration:underline; }
      code { color:#c9b6ff; }
    </style>
  </head>
  <body>
    <main class="card">
      <h1>TerraFonía · SONUS — Servidor de Transporte (Backend)</h1>
      <span class="badge">MODO SIMULADO · REST + SOCKET.IO ACTIVO</span>
      <p>Este servicio provee firmas científicas <code>SoundSignature</code> por HTTP REST y WebSocket <code>Socket.IO</code> para el frontend.</p>
      <h2>Endpoints REST disponibles</h2>
      <ul>
        <li><a href="/api/health">/api/health</a> — Estado del servicio</li>
        <li><a href="/api/presets">/api/presets</a> — Lista de escenarios regionales</li>
        <li><a href="/api/provenance">/api/provenance</a> — Metadatos de origen y verificación</li>
        <li><a href="/api/signature?preset=amazonia&amp;date=2026-11-11">/api/signature?preset=amazonia&amp;date=2026-11-11</a> — Firma actual en JSON</li>
      </ul>
      <p>Interfaz visual del instrumento: abrir Vite en <a href="http://127.0.0.1:5173">http://127.0.0.1:5173</a> (o <code>localhost:5173</code>).</p>
    </main>
  </body>
</html>`);
      return;
    }
    res.json({
      service: "earth-jukebox-backend",
      mode: "simulated",
      endpoints: ["/api/health", "/api/presets", "/api/provenance", "/api/signature?preset=amazonia"],
    });
  });
  app.use("/api", createApiRouter(store));

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin },
  });

  attachSignatureStream(io, store);
  return { app, server, io, store };
}
