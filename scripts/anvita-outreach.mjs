#!/usr/bin/env node
/**
 * Anvita outreach helper (manual — não envia pedidos automaticamente).
 *
 * A CLI oficial (anvitaflow friend) só tem list + transfer.
 * Pedido de amizade no site não tem comando público documentado.
 *
 * Uso:
 *   node scripts/anvita-outreach.mjs aplgp47632119 outro_user
 *   node scripts/anvita-outreach.mjs --file users.txt
 *
 * Depois de a pessoa aceitar (com "Grant Authorization"):
 *   anvitaflow a2a policy patch <userId> --mode friend --capability "ProsPilot Pharos Q&A" --price 0
 */

import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";

const PROSPILOT_DID =
  process.env.PROSPILOT_DID?.trim() ||
  "did:anvita:0xed562ba8051f3203f637e57fbbbed0c6b41c1401";
const PROSPILOT_NAME = process.env.PROSPILOT_NAME?.trim() || "ProsPilot";
const FLOW_BASE = process.env.ANVITA_FLOW_URL?.replace(/\/$/, "") || "https://flow.anvita.xyz";

function anvitaCmd() {
  if (process.env.ANVITAFLOW_CMD?.trim()) return process.env.ANVITAFLOW_CMD.trim();
  if (os.platform() === "win32") {
    try {
      execSync("where anvitaflow", { stdio: "ignore" });
      return "anvitaflow";
    } catch {
      return "anvitaflow.cmd";
    }
  }
  return "anvitaflow";
}

function runAnvita(args) {
  const bin = anvitaCmd();
  try {
    let out;
    if (os.platform() === "win32") {
      const cmd = [bin, ...args.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(" ");
      out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: true });
    } else {
      out = execFileSync(bin, args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    }
    return out.trim();
  } catch (err) {
    const msg = err.stderr?.toString?.() || err.message || String(err);
    throw new Error(msg.trim());
  }
}

function searchUser(keyword) {
  const raw = runAnvita(["auth", "search-user", keyword, "--json"]);
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end < 0) return [];
  return JSON.parse(raw.slice(start, end + 1));
}

function friendMessage(nickname) {
  return [
    `Olá! Sou dev do ${PROSPILOT_NAME} — copilot DeFi para o ecossistema Pharos (grátis).`,
    "",
    "Depois de aceitares o pedido de amizade, podes chamar o agente no marketplace Anvita:",
    `DID: ${PROSPILOT_DID}`,
    "",
    "Experimenta: «What is Faroo?» ou «Explain RealFi on Pharos».",
    "",
    "Obrigado!",
  ].join("\n");
}

function printUserBrief(user, keyword) {
  const profileUrl = `${FLOW_BASE}/profile/${encodeURIComponent(user.username)}`;
  console.log("\n" + "─".repeat(60));
  console.log(`Pesquisa: ${keyword}`);
  console.log(`User:     ${user.nickname || user.username} (@${user.username})`);
  console.log(`userId:   ${user.userId}`);
  console.log(`Perfil:   ${profileUrl}`);
  console.log("\n[Reasons For Application — cola no modal do site]");
  console.log(friendMessage(user.nickname || user.username));
  console.log("\n[Passos manuais]");
  console.log("1. Abre o perfil → Send a friend request");
  console.log('2. Ativa «Grant Authorization» (permite ver/chamar o teu agent)');
  console.log("3. Cola a mensagem acima → Send Request");
  console.log("\n[Depois de aceitar — abrir ProsPilot a este amigo]");
  console.log(
    `anvitaflow a2a policy patch ${user.userId} --mode friend --capability "ProsPilot Pharos Q&A; DeFi guidance" --price 0`
  );
}

function parseArgs(argv) {
  const users = [];
  let file;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--file" && argv[i + 1]) {
      file = argv[++i];
    } else if (!argv[i].startsWith("-")) {
      users.push(argv[i]);
    }
  }
  if (file) {
    const lines = fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
    users.push(...lines);
  }
  return users;
}

async function main() {
  const keywords = parseArgs(process.argv);
  if (keywords.length === 0) {
    console.log(`Uso:
  node scripts/anvita-outreach.mjs <username_ou_keyword> [...]
  node scripts/anvita-outreach.mjs --file users.txt

users.txt — um username/keyword por linha (# = comentário)

Nota: isto NÃO envia pedidos sozinho. A Anvita não expõe «friend request send» na CLI.`);
    process.exit(1);
  }

  console.log(`${PROSPILOT_NAME} outreach · DID ${PROSPILOT_DID}`);

  for (const keyword of keywords) {
    let results;
    try {
      results = searchUser(keyword);
    } catch (e) {
      console.error(`\nErro ao pesquisar «${keyword}»: ${e.message}`);
      continue;
    }
    if (results.length === 0) {
      console.log(`\nNenhum user encontrado para «${keyword}»`);
      continue;
    }
    const exact =
      results.find((u) => u.username === keyword) ||
      results.find((u) => u.nickname === keyword) ||
      results[0];
    printUserBrief(exact, keyword);
  }

  console.log("\n" + "─".repeat(60));
  console.log("Política default para TODOS os amigos novos (opcional, uma vez):");
  console.log(
    'anvitaflow a2a policy default-policy --capability "ProsPilot Pharos Q&A; DeFi guidance" --price 0'
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
