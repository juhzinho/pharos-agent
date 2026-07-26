// ==UserScript==
// @name         Anvita Flow - Criar Conta + Agente + @prospilot
// @namespace    https://flow.anvita.xyz
// @version      1.1
// @description  Automatiza registro Anvita, cria Steward Agent e chama @prospilot
// @author       ProsPilot
// @match        https://flow.anvita.xyz/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  // ─── CONFIGURAÇÃO ───────────────────────────────────────────────
  // Deixa vazio o que quiseres preencher via prompt na 1ª execução.
  const CONFIG = {
    email: "",
    username: "",
    password: "",
    inviteCode: "",
    agent: {
      nome: "MeuAgentePro",
      nickname: "",
      persona: "The Sage",
      descricao: "Agente web focado em pesquisa e chamadas para @prospilot",
    },
    prospilot: {
      enabled: true,
      comando: "What is Faroo?",
    },
    autoStart: true,
  };

  const PERSONAS = [
    "The Executive",
    "The Sage",
    "The Spark",
    "The Companion",
    "The Guardian",
    "The Hunter",
  ];

  const LS_KEY = "anvita-helper-config-v1";

  // ─── UTIL ─────────────────────────────────────────────────────────
  function log(msg) {
    console.log(`[Anvita Helper] ${msg}`);
  }

  function loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      return {
        ...CONFIG,
        ...saved,
        agent: { ...CONFIG.agent, ...(saved.agent || {}) },
        prospilot: { ...CONFIG.prospilot, ...(saved.prospilot || {}) },
      };
    } catch {
      return { ...CONFIG };
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function setNativeValue(el, value) {
    if (!el) return;
    if (el.isContentEditable) {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }));
      return;
    }
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findInput(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return el;
    }
    return null;
  }

  function clickButton(matchFn) {
    const buttons = [...document.querySelectorAll("button,a,[role='button']")];
    const btn = buttons.find((b) => !b.disabled && matchFn(b));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  function clickByText(...patterns) {
    return clickButton((b) => {
      const t = ((b.textContent || "") + " " + (b.getAttribute("aria-label") || "")).trim().toLowerCase();
      return patterns.some((p) => t.includes(p.toLowerCase()));
    });
  }

  function clickByExactText(...patterns) {
    return clickButton((b) => {
      const t = (b.textContent || "").trim();
      return patterns.some((p) => new RegExp(`^${p}$`, "i").test(t));
    });
  }

  function hasAddAgentButton() {
    return [...document.querySelectorAll("button,a,[role='button']")].some(
      (b) => /^Add Agent$/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );
  }

  function clickTermsCheckbox() {
    const radix = document.querySelector('button[role="checkbox"]');
    if (radix) {
      if (radix.getAttribute("data-state") !== "checked") radix.click();
      return true;
    }
    const cb = document.querySelector('input[type="checkbox"]');
    if (cb && !cb.checked) cb.click();
    return !!cb;
  }

  function fillVisibleInputs(values) {
    const inputs = [...document.querySelectorAll("input:visible")].filter(
      (el) => !["password", "checkbox", "hidden"].includes(el.type)
    );
    values.forEach((v, i) => {
      if (inputs[i] && !inputs[i].value) setNativeValue(inputs[i], v);
    });
  }

  function findInputByLabel(labelRe) {
    const labels = [...document.querySelectorAll("label")];
    for (const label of labels) {
      if (!labelRe.test(label.textContent || "")) continue;
      const forId = label.getAttribute("for");
      if (forId) {
        const el = document.getElementById(forId);
        if (el) return el;
      }
      const nested = label.querySelector("input,textarea");
      if (nested) return nested;
    }
    return null;
  }

  function openGeneralChat() {
    const heading = [...document.querySelectorAll("button,a,div,h3,h4,p,span")].find(
      (el) => /^General chat$/i.test((el.textContent || "").trim()) && el.offsetParent
    );
    if (heading) {
      (heading.closest("button,[role=button],a") || heading).click();
      return true;
    }
    const byDesc = [...document.querySelectorAll("button,a,div,p,span")].find(
      (el) => /interact with the Agent on Anvita Flow/i.test(el.textContent || "") && el.offsetParent
    );
    if (byDesc) {
      (byDesc.closest("button,[role=button],a") || byDesc).click();
      return true;
    }
    return false;
  }

  function findChatInput() {
    openGeneralChat();
    const textareas = [...document.querySelectorAll("textarea")].filter((el) => el.offsetParent);
    if (textareas.length) return textareas[textareas.length - 1];
    const candidates = [
      ...document.querySelectorAll('[contenteditable="true"]'),
      ...document.querySelectorAll('[role="textbox"]'),
    ];
    return (
      candidates.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 80 && r.height > 20 && el.offsetParent !== null;
      }) || null
    );
  }

  function genUsername(email) {
    const base = (email.split("@")[0] || "agent")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 20);
    const suffix = String(Math.floor(Math.random() * 900) + 100);
    return `${base || "agent"}${suffix}`.slice(0, 30);
  }

  function genPassword() {
    const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#";
    let out = "Aa1!";
    for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function detectPhase() {
    const path = location.pathname;
    if (path === "/register" || path.startsWith("/register/")) {
      const username = findInput(['input[name="username"]', 'input[placeholder*="3-30"]']);
      const password = findInput(['input[name="password"]', 'input[type="password"]']);
      if (username || (password && !findInput(['input[name="otp"]', "#otp"]))) {
        return "register-profile";
      }
      return "register-email";
    }
    if (path === "/m/agent-init" || path.startsWith("/m/agent-init/")) {
      if (/Establish Identity|get to know each other/i.test(document.body.innerText)) {
        return "agent-init-name";
      }
      const nameInput = findInput(['input[name="name"]', 'input[placeholder*="name" i]']);
      if (nameInput && !nameInput.value) return "agent-init-name";
    if (/Shape Personality|Core Archetype/i.test(document.body.innerText)) {
      const personaVisible = PERSONAS.some((p) =>
        [...document.querySelectorAll("h3,h4,button,div,span")].some(
          (el) => (el.textContent || "").trim() === p && el.offsetParent !== null
        )
      );
      if (personaVisible) return "agent-init-persona";
    }
    if (/Set Boundaries|Almost there|Generate Soul/i.test(document.body.innerText)) {
      return "agent-init-boundaries";
    }
    return "agent-init-step";
    }
    if (path === "/agent/chat") {
      if (hasAddAgentButton()) return "chat-add-agent";
      if (!findChatInput()) return "chat-setup";
      return "chat";
    }
    if (path === "/login") return "login";
    if (path === "/home") return "home";
    return "unknown";
  }

  async function ensureConfig(cfg) {
    if (!cfg.email) cfg.email = prompt("Email para criar conta Anvita:")?.trim() || "";
    if (!cfg.email) throw new Error("Email obrigatório.");

    if (!cfg.username) cfg.username = genUsername(cfg.email);
    if (!cfg.password) {
      const suggested = genPassword();
      const chosen = prompt(
        "Password (mín. 8 chars). Deixa vazio para gerar automaticamente:",
        suggested
      );
      cfg.password = (chosen || suggested).trim();
    }
    if (!cfg.agent.nickname) cfg.agent.nickname = cfg.agent.nome;
    saveConfig(cfg);
    return cfg;
  }

  // ─── PASSOS ─────────────────────────────────────────────────────
  async function stepRegisterEmail(cfg) {
    log("Registo — email + OTP");
    if (location.pathname !== "/register") {
      location.href = "https://flow.anvita.xyz/register";
      return false;
    }

    const emailEl = findInput(['#email', 'input[name="email"]', 'input[type="email"]']);
    if (emailEl && !emailEl.value) setNativeValue(emailEl, cfg.email);

    const otpEl = findInput(['#otp', 'input[name="otp"]']);
    if (!otpEl?.value) {
      clickByText("send otp");
      const otp = prompt(`Código OTP enviado para ${cfg.email}:\n(coloca o código de 6 dígitos)`);
      if (!otp) throw new Error("OTP cancelado.");
      setNativeValue(otpEl, otp.trim());
      await sleep(400);
    }

    clickByText("continue");
    await sleep(1200);
    return true;
  }

  async function stepRegisterProfile(cfg) {
    log("Registo — username + password");

    const usernameEl = findInput(['input[name="username"]', 'input[placeholder*="3-30"]']);
    const passEl = findInput(['input[name="password"]', 'input[type="password"]']);
    const confirmEl = findInput([
      'input[name="confirmPassword"]',
      'input[placeholder*="confirm" i]',
    ]);

    if (usernameEl && !usernameEl.value) setNativeValue(usernameEl, cfg.username);
    if (passEl && !passEl.value) setNativeValue(passEl, cfg.password);
    if (confirmEl && !confirmEl.value) setNativeValue(confirmEl, cfg.password);

    if (cfg.inviteCode) {
      clickByText("invite code");
      await sleep(500);
      const inviteEl = findInput(['input[name="inviteCode"]', 'input[placeholder*="invite" i]']);
      if (inviteEl) setNativeValue(inviteEl, cfg.inviteCode);
    }

    clickTermsCheckbox();

    if (!clickByText("sign up", "continue", "create account")) {
      clickByText("sign up");
    }
    await sleep(2000);
    return true;
  }

  async function stepAddAgent(cfg) {
    log("Clicar Add Agent e iniciar wizard");
    if (!clickByExactText("Add Agent")) {
      location.href = "https://flow.anvita.xyz/m/agent-init";
      return false;
    }
    await sleep(2000);
    return true;
  }

  async function stepAgentIdentity(cfg) {
    log("Establish Identity");
    await sleep(800);

    const nameEl =
      findInputByLabel(/Agent Name/i) ||
      findInput(['input[name="name"]']) ||
      findInput(['input[placeholder*="name" i]']);
    const nickEl =
      findInputByLabel(/How should I address you/i) ||
      findInput(['input[name="nickname"]']);

    if (nameEl && !nameEl.value) setNativeValue(nameEl, cfg.agent.nome);
    if (nickEl && !nickEl.value) setNativeValue(nickEl, cfg.agent.nickname || cfg.agent.nome);

    if (!nameEl && !nickEl) {
      fillVisibleInputs([cfg.agent.nome, cfg.agent.nickname || cfg.agent.nome]);
    }

    await sleep(500);
    clickByText("continue");
    await sleep(1500);
    return true;
  }

  async function stepAgentInitName(cfg) {
    if (/Establish Identity|get to know each other/i.test(document.body.innerText)) {
      return stepAgentIdentity(cfg);
    }
    log("Criar agente — nome");
    if (!location.pathname.startsWith("/m/agent-init")) {
      location.href = "https://flow.anvita.xyz/m/agent-init";
      return false;
    }

    await sleep(800);
    const nameEl =
      findInput(['input[name="name"]']) ||
      [...document.querySelectorAll("input")].find((el) => {
        const ph = (el.placeholder || "").toLowerCase();
        return ph.includes("name") && el.offsetParent !== null;
      });

    const nickEl =
      findInput(['input[name="nickname"]']) ||
      [...document.querySelectorAll("input")].find((el) => {
        const ph = (el.placeholder || "").toLowerCase();
        return ph.includes("address") || ph.includes("call you") || ph.includes("nickname");
      });

    if (nameEl && !nameEl.value) setNativeValue(nameEl, cfg.agent.nome);
    if (nickEl && !nickEl.value) setNativeValue(nickEl, cfg.agent.nickname || cfg.agent.nome);

    await sleep(400);
    clickByText("continue");
    await sleep(1200);
    return true;
  }

  async function stepAgentInitPersona(cfg) {
    log(`Criar agente — persona: ${cfg.agent.persona}`);
    const persona = PERSONAS.includes(cfg.agent.persona) ? cfg.agent.persona : "The Sage";

    const hit = [...document.querySelectorAll("h3,h4,button,div,span,[role='button']")].find(
      (el) => (el.textContent || "").trim() === persona && el.offsetParent !== null
    );

    if (hit) {
      (hit.closest("button,[role='button'],div") || hit).click();
    } else {
      alert(`Persona "${persona}" não encontrada. Clica manualmente numa das opções.`);
    }

    await sleep(600);
    clickByText("continue");
    await sleep(1200);
    return true;
  }

  async function stepAgentInitBoundaries(cfg) {
    log("Set Boundaries → Generate Soul");
    await sleep(600);
    if (!clickByText("generate soul")) {
      clickButton((b) => /Generate Soul/i.test((b.textContent || "").trim()));
    }
    await sleep(3000);
    if (location.pathname !== "/agent/chat") {
      location.href = "https://flow.anvita.xyz/agent/chat";
      return false;
    }
    return true;
  }

  async function stepAgentInitGeneric() {
    log("A redirecionar para chat…");
    if (location.pathname !== "/agent/chat") {
      location.href = "https://flow.anvita.xyz/agent/chat";
      return false;
    }
    await sleep(1200);
    return true;
  }

  async function runAgentWizard(cfg) {
    for (let i = 0; i < 12; i++) {
      const phase = detectPhase();
      log(`Wizard: ${phase}`);
      if (phase === "chat" && findChatInput()) return true;
      if (phase === "chat-add-agent") {
        await stepAddAgent(cfg);
        continue;
      }
      if (phase === "agent-init-name" || phase === "chat-setup") {
        await stepAgentInitName(cfg);
        continue;
      }
      if (phase === "agent-init-persona") {
        await stepAgentInitPersona(cfg);
        continue;
      }
      if (phase === "agent-init-boundaries") {
        await stepAgentInitBoundaries();
        continue;
      }
      if (phase === "agent-init-step") {
        await stepAgentInitGeneric();
        continue;
      }
      if (location.pathname === "/agent/chat" && !hasAddAgentButton() && !findChatInput()) {
        location.href = "https://flow.anvita.xyz/agent/chat";
        await sleep(1200);
        continue;
      }
      break;
    }
    return !!findChatInput();
  }

  async function stepChat(cfg) {
    if (!cfg.prospilot.enabled) return true;

    if (hasAddAgentButton() || !findChatInput()) {
      const ok = await runAgentWizard(cfg);
      if (!ok) {
        toast("Agente ainda não pronto — completa o wizard ou clica de novo no botão.");
        return false;
      }
    }

    log("Chamar @prospilot");

    const input = findChatInput();
    if (!input) {
      location.href = "https://flow.anvita.xyz/agent/chat";
      return false;
    }

    const msg = `@prospilot ${cfg.prospilot.comando}`.trim();
    input.focus();
    setNativeValue(input, msg);
    await sleep(400);

    if (!clickByText("send", "enviar", "submit")) {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
    }
    return true;
  }

  // ─── ORQUESTRADOR ───────────────────────────────────────────────
  async function runPipeline(manualStart) {
    let cfg = loadConfig();
    try {
      cfg = await ensureConfig(cfg);
    } catch (e) {
      alert(e.message || e);
      return;
    }

    const phase = detectPhase();
    log(`Fase: ${phase}`);

    try {
      switch (phase) {
        case "login":
        case "home":
          location.href = "https://flow.anvita.xyz/register";
          break;
        case "register-email":
          await stepRegisterEmail(cfg);
          break;
        case "register-profile":
          await stepRegisterProfile(cfg);
          break;
        case "agent-init-name":
          await stepAgentInitName(cfg);
          break;
        case "agent-init-persona":
          await stepAgentInitPersona(cfg);
          break;
        case "agent-init-boundaries":
          await stepAgentInitBoundaries();
          break;
        case "agent-init-step":
          await stepAgentInitGeneric();
          break;
        case "chat-add-agent":
        case "chat-setup":
          await runAgentWizard(cfg);
          if (findChatInput()) await stepChat(cfg);
          else toast("Wizard em curso — recarrega ou clica no botão se parar.");
          break;
        case "chat":
          await stepChat(cfg);
          toast("✅ Fluxo completo! Mensagem enviada ao @prospilot.");
          break;
        case "unknown":
          if (manualStart) {
            const go = confirm(
              "Página não reconhecida.\n\n" +
                "1. /register — criar conta\n" +
                "2. /m/agent-init — criar agente\n" +
                "3. /agent/chat — chamar @prospilot\n\n" +
                "Ir para /register?"
            );
            if (go) location.href = "https://flow.anvita.xyz/register";
          }
          break;
        default:
          break;
      }
    } catch (err) {
      console.error(err);
      toast(`Erro: ${err.message || err}`);
    }
  }

  // ─── UI ─────────────────────────────────────────────────────────
  function toast(msg) {
    let el = document.getElementById("anvita-helper-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "anvita-helper-toast";
      el.style.cssText =
        "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:999999;" +
        "background:#111;color:#00ff9d;padding:10px 18px;border-radius:8px;" +
        "font:600 13px system-ui,sans-serif;box-shadow:0 4px 20px rgba(0,0,0,.4);max-width:90vw";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    setTimeout(() => el.remove(), 5000);
  }

  function addButton() {
    if (document.getElementById("anvita-helper-btn")) return;

    const btn = document.createElement("button");
    btn.id = "anvita-helper-btn";
    btn.type = "button";
    btn.textContent = "🚀 Criar conta + Agente";
    btn.title = "Anvita Flow onboarding automático";
    btn.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 99999;
      padding: 12px 18px; background: #00ff9d; color: #000;
      border: none; border-radius: 50px; font-weight: 700;
      cursor: pointer; box-shadow: 0 4px 15px rgba(0,255,157,0.4);
      font-family: system-ui, sans-serif; font-size: 13px;
    `;
    btn.onclick = () => runPipeline(true);
    document.body.appendChild(btn);
  }

  addButton();
  new MutationObserver(addButton).observe(document.body, { childList: true, subtree: true });

  if (CONFIG.autoStart) {
    setTimeout(() => runPipeline(false), 1800);
  }

  log("Carregado — botão flutuante ou autoStart ativo.");
})();
