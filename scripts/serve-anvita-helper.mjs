#!/usr/bin/env node
/**
 * Serve o userscript localmente para instalar no Tampermonkey/Violentmonkey.
 *
 *   npm run anvita:helper
 *
 * Tampermonkey → Create new script → Settings → @downloadURL
 *   http://localhost:8765/anvita-flow-helper.user.js
 *
 * Ou copia o ficheiro scripts/anvita-flow-helper.user.js manualmente.
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(__dirname, "anvita-flow-helper.user.js");
const PORT = Number(process.env.ANVITA_HELPER_PORT || 8765);

const server = http.createServer((_req, res) => {
  try {
    const body = fs.readFileSync(FILE, "utf8");
    res.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end(String(err?.message || err));
  }
});

server.listen(PORT, () => {
  console.log(`Anvita helper userscript: http://localhost:${PORT}/anvita-flow-helper.user.js`);
  console.log("Tampermonkey → flow.anvita.xyz → botão «Criar conta + Agente»");
  console.log("Fluxo: /register → OTP → /m/agent-init → /agent/chat → @prospilot");
  console.log("Ctrl+C para parar.");
});
