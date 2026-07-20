#!/usr/bin/env node
/**
 * Chama o ProsPilot via API local (next dev).
 *
 *   npm run dev          # noutro terminal
 *   npm run anvita:ask -- "What is Faroo?"
 */

const BASE = process.env.ANVITA_LOCAL_URL?.replace(/\/$/, "") || "http://localhost:3000";
const message = process.argv.slice(2).join(" ").trim() || "What is Faroo?";

async function main() {
  const sessionRes = await fetch(`${BASE}/api/anvita/session`);
  const session = await sessionRes.json().catch(() => ({}));

  if (!session.connected) {
    console.error("Gateway não ligado.");
    if (session.tokenError) console.error("Erro:", session.tokenError);
    console.error("\nPassos:");
    console.error("  1. anvitaflow auth login   (no PC)");
    console.error("  2. npm run dev");
    console.error("  3. Abre http://localhost:3000/anvita → «Ligar Gateway»");
    process.exit(1);
  }

  console.log(`Pergunta: ${message}`);
  console.log(`Caller:   ${session.callerName || session.callerDid || "?"}\n`);

  const res = await fetch(`${BASE}/api/anvita/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Erro:", data.error || `HTTP ${res.status}`);
    process.exit(1);
  }

  console.log("─".repeat(60));
  console.log(data.text || "(sem texto)");
  console.log("─".repeat(60));
  if (data.call) {
    console.log(`A2A: ${data.call.method} · ${Math.round(data.call.durationMs / 1000)}s · ${data.call.state}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  console.error(`\nServidor local a correr em ${BASE}? (npm run dev)`);
  process.exit(1);
});
