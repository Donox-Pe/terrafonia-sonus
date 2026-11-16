import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? "127.0.0.1";

const { server, store } = createApp();

server.listen(PORT, HOST, () => {
  const prov = store.getProvenanceSummary();
  console.log(`[TerraFonía Backend] http://${HOST}:${PORT}`);
  console.log(`[Provenance] mode=${prov.mode} verified=${prov.verifiedNasaDataAvailable}`);
});
