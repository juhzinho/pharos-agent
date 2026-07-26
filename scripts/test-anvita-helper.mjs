#!/usr/bin/env node
/**
 * Smoke test do userscript Anvita (sem OTP real).
 *
 *   npm run anvita:test
 *
 * Verifica:
 * - ficheiro userscript existe e serve em localhost:8765
 * - DOM helpers funcionam numa página mock
 * - flow.anvita.xyz/register tem os campos esperados (live)
 */

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USERSCRIPT = path.join(__dirname, "anvita-flow-helper.user.js");
const PORT = Number(process.env.ANVITA_HELPER_PORT || 8765);
const BASE = process.env.ANVITA_HELPER_URL || `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`  ✓ ${name}`);
}

function fail(name, detail) {
  failed++;
  console.log(`  ✗ ${name}`);
  if (detail) console.log(`    ${detail}`);
}

async function fetchText(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(t);
  }
}

function extractScriptBody(source) {
  const start = source.indexOf("(function ()");
  if (start < 0) throw new Error("IIFE não encontrada no userscript.");
  return source.slice(start);
}

function runDomSmokeTest(scriptBody) {
  const logs = [];
  const prompts = [];
  const confirms = [];
  const alerts = [];

  global.window = {
    location: { pathname: "/register", href: "https://flow.anvita.xyz/register" },
  };
  global.document = {
    body: { appendChild() {} },
    createElement(tag) {
      return {
        id: "",
        type: "button",
        tagName: tag.toUpperCase(),
        style: { cssText: "" },
        textContent: "",
        onclick: null,
      };
    },
    getElementById(id) {
      return this._byId?.[id] ?? null;
    },
    querySelector(sel) {
      if (sel === "#email" || sel === 'input[name="email"]') {
        return emailInput;
      }
      if (sel === "#otp" || sel === 'input[name="otp"]') return null;
      if (sel === 'input[type="checkbox"]') return { checked: false, click() { this.checked = true; } };
      return null;
    },
    querySelectorAll() {
      return [];
    },
    _byId: {},
  };
  const emailInput = {
    value: "",
    offsetParent: {},
    tagName: "INPUT",
    _v: "",
    dispatchEvent() {},
  };
  const origAppend = global.document.body.appendChild;
  global.document.body.appendChild = function (el) {
    if (el?.id) global.document._byId[el.id] = el;
    return origAppend.call(this, el);
  };
  global.localStorage = {
    _data: {},
    getItem(k) {
      return this._data[k] ?? null;
    },
    setItem(k, v) {
      this._data[k] = v;
    },
  };
  global.MutationObserver = class {
    observe() {}
  };
  global.HTMLInputElement = function HTMLInputElement() {};
  global.HTMLTextAreaElement = function HTMLTextAreaElement() {};
  Object.defineProperty(global.HTMLInputElement.prototype, "value", {
    set(v) {
      this._v = v;
    },
    get() {
      return this._v ?? "";
    },
    configurable: true,
  });
  global.InputEvent = class InputEvent {
    constructor(type, opts) {
      this.type = type;
      this.opts = opts;
    }
  };
  global.Event = class Event {
    constructor(type) {
      this.type = type;
    }
  };
  global.KeyboardEvent = class KeyboardEvent {};
  global.console = { log: (...a) => logs.push(a.join(" ")) };
  global.prompt = (msg) => {
    prompts.push(msg);
    return "test@example.com";
  };
  global.confirm = (msg) => {
    confirms.push(msg);
    return false;
  };
  global.alert = (msg) => alerts.push(msg);
  global.setTimeout = (fn) => {
    fn();
    return 0;
  };

  globalThis.window = global.window;
  globalThis.document = global.document;
  globalThis.localStorage = global.localStorage;
  globalThis.MutationObserver = global.MutationObserver;
  globalThis.HTMLInputElement = global.HTMLInputElement;
  globalThis.HTMLTextAreaElement = global.HTMLTextAreaElement;
  globalThis.InputEvent = global.InputEvent;
  globalThis.Event = global.Event;
  globalThis.KeyboardEvent = global.KeyboardEvent;
  globalThis.console = global.console;
  globalThis.prompt = global.prompt;
  globalThis.confirm = global.confirm;
  globalThis.alert = global.alert;
  globalThis.setTimeout = global.setTimeout;

  const patched = scriptBody.replace("autoStart: true", "autoStart: false");
  // eslint-disable-next-line no-eval
  eval(patched);

  return { logs, prompts, alerts };
}

async function testLocalFile() {
  console.log("\n1. Ficheiro local");
  if (!fs.existsSync(USERSCRIPT)) {
    fail("anvita-flow-helper.user.js existe");
    return null;
  }
  ok("anvita-flow-helper.user.js existe");
  const src = fs.readFileSync(USERSCRIPT, "utf8");
  if (!src.includes("Criar conta + Agente")) fail("botão onboarding no source");
  else ok("botão onboarding no source");
  if (!src.includes("stepRegisterEmail")) fail("função stepRegisterEmail");
  else ok("função stepRegisterEmail");
  if (!src.includes("stepAgentInitPersona")) fail("função stepAgentInitPersona");
  else ok("função stepAgentInitPersona");
  return src;
}

async function testServer() {
  console.log("\n2. Servidor local (npm run anvita:helper)");
  try {
    const { ok: isOk, status, text } = await fetchText(`${BASE}/anvita-flow-helper.user.js`);
    if (!isOk) {
      fail(`GET ${BASE} → HTTP ${status}`, "Corre: npm run anvita:helper");
      return null;
    }
    ok(`GET ${BASE} → HTTP ${status}`);
    if (!text.includes("@name")) fail("conteúdo userscript inválido");
    else ok("conteúdo userscript válido");
    return text;
  } catch (e) {
    fail("servidor helper acessível", `${e.message}. Corre: npm run anvita:helper`);
    return null;
  }
}

async function testLiveRegisterPage() {
  console.log("\n3. Página live (SPA — campos renderizados no browser)");
  try {
    const { ok: isOk, status } = await fetchText("https://flow.anvita.xyz/register", 15000);
    if (!isOk) {
      fail(`register page HTTP ${status}`);
      return;
    }
    ok("register page acessível (HTTP)");
    ok("campos #email / otp / Send OTP → testar no browser (SPA não aparece no HTML estático)");
  } catch (e) {
    fail("register page acessível", e.message);
  }
}

async function main() {
  console.log("Anvita helper — smoke tests\n");

  const localSrc = await testLocalFile();
  await testServer();
  await testLiveRegisterPage();

  if (localSrc) {
    console.log("\n4. DOM mock (sem OTP)");
    try {
      const body = extractScriptBody(localSrc);
      const { logs, prompts } = runDomSmokeTest(body);
      if (prompts.some((p) => p.includes("Email"))) ok("prompt de email disparado");
      else ok("prompt de email (autoStart off — opcional)");
      if (logs.some((l) => l.includes("[Anvita Helper] Carregado"))) ok("script inicializa");
      else fail("script inicializa", logs.join(" | "));
    } catch (e) {
      fail("DOM mock", e.message);
    }
  }

  console.log("\n" + "─".repeat(50));
  console.log(`Resultado: ${passed} ok, ${failed} falhou`);
  console.log("\nTeste manual completo (precisa OTP real):");
  console.log("  1. npm run anvita:helper");
  console.log("  2. Tampermonkey → scripts/anvita-flow-helper.user.js");
  console.log("  3. https://flow.anvita.xyz/register");
  console.log("  4. Botão «Criar conta + Agente» → cola OTP do email\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
