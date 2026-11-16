import type { Server, Socket } from "socket.io";
import type { SignatureStore } from "../services/signatureStore.js";

interface ClientStreamState {
  presetId: string;
  date: string;
  phase: number;
  running: boolean;
  intervalMs: number;
  timer: ReturnType<typeof setInterval> | null;
}

export function attachSignatureStream(io: Server, store: SignatureStore): void {
  io.on("connection", (socket: Socket) => {
    const state: ClientStreamState = {
      presetId: "amazonia",
      date: "2026-11-11",
      phase: 0,
      running: false,
      intervalMs: 750,
      timer: null,
    };

    const emitCurrent = () => {
      const payload = store.getSignature({
        presetId: state.presetId,
        date: state.date,
        phase: state.phase,
      });
      socket.emit("signature:update", payload);
    };

    const restartTimer = () => {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
      if (!state.running) return;
      state.timer = setInterval(() => {
        state.phase += 0.22;
        emitCurrent();
      }, state.intervalMs);
    };

    // Emite una firma inicial al conectarse.
    emitCurrent();

    socket.on("stream:configure", (cfg: { presetId?: string; date?: string; running?: boolean; intervalMs?: number }) => {
      if (typeof cfg?.presetId === "string") state.presetId = cfg.presetId;
      if (typeof cfg?.date === "string") state.date = cfg.date;
      if (typeof cfg?.running === "boolean") state.running = cfg.running;
      if (typeof cfg?.intervalMs === "number" && cfg.intervalMs >= 200 && cfg.intervalMs <= 5000) {
        state.intervalMs = cfg.intervalMs;
      }
      emitCurrent();
      restartTimer();
    });

    socket.on("stream:step", () => {
      state.phase += 0.35;
      emitCurrent();
    });

    socket.on("disconnect", () => {
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
    });
  });
}
