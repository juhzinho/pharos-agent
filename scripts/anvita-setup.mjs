#!/usr/bin/env node
/**
 * Verifica o ambiente local Anvita + ProsPilot.
 *
 *   npm run anvita:setup
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const configPath = path.join(os.homedir(), ".anvitaflow", "config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return null;
  }
}

function runAnvita(args) {
  try {
    if (os.platform() === "win32") {
      const cmd = ["anvitaflow", ...args.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(" ");
      return execFileSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true }).trim();
    }
    return execFileSync("anvitaflow", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (err) {
    return err.stderr?.toString?.() || err.message || "";
  }
}

const cfg = readConfig();
console.log("Anvita local setup\n");

if (!cfg) {
  console.log("❌ ~/.anvitaflow/config.json não encontrado");
  console.log("   anvitaflow auth login");
  process.exit(1);
}

const hasGateway = Boolean(cfg.gatewayAccessToken?.trim());
const agentName = cfg.activeAgent?.name?.trim();
const agentId = cfg.activeAgent?.agentId?.trim();

console.log(`Config:     ${configPath}`);
console.log(`Login:      ${cfg.userInfo?.email || cfg.userInfo?.username || "?"}`);
console.log(`Agente:     ${agentName || "nenhum selecionado"}`);
console.log(`Gateway:    ${hasGateway ? "OK" : "em falta"}`);

if (!agentName || !hasGateway) {
  console.log("\n⚠️  Seleciona um agente Steward (precisa de chave local):");
  console.log("   anvitaflow agent mylist");
  console.log("   anvitaflow agent select agent_AW2NFRCZEWJU --use-backup");
  console.log("   (substitui pelo teu agentId ativo)\n");
}

const status = runAnvita(["status"]);
if (status) {
  console.log("CLI status:");
  console.log(status.split("\n").slice(0, 8).join("\n"));
}

console.log("\nDepois:");
console.log("  npm run dev              → http://localhost:3000/anvita");
console.log("  npm run anvita:ask -- \"What is Faroo?\"");
console.log("  npm run anvita:helper    → userscript para flow.anvita.xyz");

if (agentName && hasGateway) {
  console.log("\n✅ Pronto para npm run anvita:ask");
}
