"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import PageShell from "@/components/PageShell";
import {
  loadVisitorUser,
  rotateVisitorUser,
  type VisitorUser,
} from "@/lib/anvita-visitor";

interface AgentRow {
  agentCaDid: string;
  agentName?: string;
  capability?: string;
  online?: boolean;
}

interface AnvitaCallMeta {
  id: string;
  protocol: string;
  method: string;
  transport: string;
  gatewayUrl: string;
  callerDid: string;
  callerName?: string;
  targetDid: string;
  targetName?: string;
  verifiableCredential: boolean;
  durationMs: number;
  state: string;
}

interface ChatMessage {
  kind: "user" | "service" | "system";
  text: string;
  call?: AnvitaCallMeta;
  visitorName?: string;
}

type CallPhase = "idle" | "gateway" | "vc" | "stream" | "completed";

const EXAMPLE_PROMPTS = [
  "What is Faroo?",
  "Explain RealFi on Pharos",
  "What is Anvita Flow?",
];

const CALL_STEPS: { id: CallPhase; label: string }[] = [
  { id: "gateway", label: "Gateway auth" },
  { id: "vc", label: "X-A2A-VC" },
  { id: "stream", label: "message/stream" },
  { id: "completed", label: "Task completed" },
];

function shortDid(did: string): string {
  const ca = did.replace("did:anvita:", "");
  return ca.length > 12 ? `${ca.slice(0, 6)}…${ca.slice(-4)}` : ca;
}

function formatChipId(id: string): string {
  if (id.startsWith("session:")) return id.replace("session:", "user · ");
  return shortDid(id);
}

function AgentChip({
  label,
  name,
  did,
  role,
  accent,
}: {
  label: string;
  name: string;
  did: string;
  role: string;
  accent: string;
}) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl p-3"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${accent}33`,
      }}
    >
      <p className="text-[10px] uppercase tracking-[0.12em] mb-1" style={{ color: `${accent}99` }}>
        {label}
      </p>
      <p className="text-sm font-semibold text-white truncate">{name}</p>
      <p className="text-[10px] mt-1 font-mono truncate" style={{ color: "rgba(148,163,184,0.55)" }}>
        {formatChipId(did)}
      </p>
      <p className="text-[10px] mt-0.5" style={{ color: "rgba(148,163,184,0.45)" }}>
        {role}
      </p>
    </div>
  );
}

function welcomeMessage(v: VisitorUser): ChatMessage {
  return {
    kind: "system",
    text:
      `${v.displayName} entrou no marketplace Anvita e chamou o ProsPilot (Service Agent). ` +
      "Escreve uma pergunta — como um user novo no flow.anvita.xyz.",
  };
}

export default function AnvitaHubClient() {
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [selectedDid, setSelectedDid] = useState("");
  const [defaultDid, setDefaultDid] = useState("");
  const [connected, setConnected] = useState(false);
  const [gatewayReady, setGatewayReady] = useState<boolean | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [visitor, setVisitor] = useState<VisitorUser | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [callLog, setCallLog] = useState<Array<AnvitaCallMeta & { visitorLabel?: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [error, setError] = useState("");
  const [contextId, setContextId] = useState<string | undefined>();
  const bottomRef = useRef<HTMLDivElement>(null);
  const bootedRef = useRef(false);
  const prevMsgCountRef = useRef(0);

  const targetAgent = agents.find((a) => a.agentCaDid === selectedDid);
  const targetName = targetAgent?.agentName || "ProsPilot";
  const targetDid = selectedDid || defaultDid;

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    const v = loadVisitorUser();
    setVisitor(v);
    setMessages([welcomeMessage(v)]);

    void (async () => {
      try {
        const sessionRes = await fetch("/api/anvita/session");
        const j = await sessionRes.json();
        const hasLocal = j.source === "local-config" || (j.localConfig && j.connected);
        if (j.tokenExpired) {
          setTokenExpired(true);
          setConnected(false);
          setGatewayReady(false);
          if (j.tokenError) setError(j.tokenError);
        } else if (j.connected || hasLocal) {
          setTokenExpired(false);
          setConnected(true);
          setGatewayReady(true);
          if (!j.connected && j.localConfig) {
            try {
              await fetch("/api/anvita/session/refresh", { method: "POST" });
            } catch {
              /* cookie sync opcional */
            }
          }
        } else if (j.localConfig) {
          const res = await fetch("/api/anvita/session/refresh", { method: "POST" });
          const data = await res.json();
          if (res.ok) {
            setConnected(true);
            setGatewayReady(true);
          } else {
            setGatewayReady(false);
            if (data.error) setError(data.error);
          }
        } else {
          setGatewayReady(false);
        }
      } catch {
        setGatewayReady(false);
      }

      try {
        const agentsRes = await fetch("/api/anvita/agents");
        const j = await agentsRes.json();
        const list: AgentRow[] = j.agents ?? [];
        setAgents(list);
        setDefaultDid(j.defaultDid ?? "");
        setSelectedDid(list[0]?.agentCaDid ?? j.defaultDid ?? "");
        if (typeof j.gatewayConnected === "boolean" && j.gatewayConnected) {
          setConnected(true);
          setGatewayReady(true);
        }
      } catch (e) {
        setError(String((e as Error)?.message ?? e));
      }
    })();
  }, []);

  useEffect(() => {
    if (messages.length <= prevMsgCountRef.current) return;
    prevMsgCountRef.current = messages.length;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!loading) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [loading]);

  useEffect(() => {
    if (!loading) return;
    setCallPhase("gateway");
    const t1 = window.setTimeout(() => setCallPhase("vc"), 400);
    const t2 = window.setTimeout(() => setCallPhase("stream"), 900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [loading]);

  async function syncFromLocalConfig() {
    setSavingSession(true);
    setError("");
    try {
      const res = await fetch("/api/anvita/session/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setConnected(true);
      setGatewayReady(true);
      setTokenExpired(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingSession(false);
    }
  }

  function startNewUserSession() {
    const next = rotateVisitorUser();
    setVisitor(next);
    setContextId(undefined);
    setError("");
    setCallLog([]);
    setMessages([welcomeMessage(next)]);
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading || !connected || !visitor) return;

    setError("");
    setLoading(true);
    setCallPhase("gateway");
    setMessages((prev) => [...prev, { kind: "user", text: trimmed, visitorName: visitor.displayName }]);
    setInput("");

    try {
      const res = await fetch("/api/anvita/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          targetDid,
          targetName,
          contextId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.contextId) setContextId(data.contextId);
      setCallPhase("completed");
      if (data.call) {
        setCallLog((prev) =>
          [{ ...data.call, visitorLabel: visitor.displayName }, ...prev].slice(0, 8)
        );
      }
      setMessages((prev) => [
        ...prev,
        { kind: "service", text: data.text || "(empty)", call: data.call },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setCallPhase("idle");
      if (msg.includes("expirou") || msg.includes("expirado") || msg.includes("401")) {
        setConnected(false);
        setGatewayReady(false);
        setTokenExpired(true);
      }
      setMessages((prev) => [...prev, { kind: "system", text: `Falha A2A: ${msg}` }]);
    } finally {
      setLoading(false);
      window.setTimeout(() => setCallPhase("idle"), 1200);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function phaseDone(id: CallPhase): boolean {
    const order: CallPhase[] = ["gateway", "vc", "stream", "completed"];
    const cur = callPhase === "idle" ? -1 : order.indexOf(callPhase);
    return cur >= order.indexOf(id);
  }

  if (!visitor) {
    return (
      <PageShell
        eyebrow="Anvita Flow · Marketplace"
        title="Chamar ProsPilot"
        subtitle="A carregar…"
        wide
      >
        <div className="rounded-2xl p-8 text-center text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
          A preparar simulação do marketplace…
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Anvita Flow · Marketplace"
      title="Chamar ProsPilot"
      subtitle="Simula utilizadores novos no marketplace a descobrir e chamar o teu Service Agent — como no site Anvita."
      wide
    >
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-80 shrink-0 space-y-4">
          {(gatewayReady === false || tokenExpired) && !connected && (
            <div
              className="rounded-2xl p-4"
              style={{
                background: tokenExpired ? "rgba(248,113,113,0.06)" : "rgba(245,158,11,0.06)",
                border: tokenExpired
                  ? "1px solid rgba(248,113,113,0.3)"
                  : "1px solid rgba(245,158,11,0.3)",
              }}
            >
              <p
                className="text-xs mb-3 leading-relaxed"
                style={{ color: tokenExpired ? "rgba(252,165,165,0.95)" : "rgba(251,191,36,0.9)" }}
              >
                {tokenExpired
                  ? "Gateway token expirado. Faz login no Anvita Flow no PC (atualiza ~/.anvitaflow/config.json) e sincroniza."
                  : "Gateway em falta. Lê automaticamente o config.json do PC."}
              </p>
              <button
                type="button"
                disabled={savingSession}
                onClick={() => void syncFromLocalConfig()}
                className="w-full py-2.5 rounded-xl font-semibold text-xs text-black disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #00d4ff, #38bdf8)" }}
              >
                {savingSession ? "A sincronizar…" : tokenExpired ? "Sincronizar token" : "Ligar Gateway"}
              </button>
            </div>
          )}

          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(168,85,247,0.2)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: "rgba(168,85,247,0.55)" }}>
              Utilizador (sessão)
            </p>
            <p className="text-sm font-semibold text-white">{visitor.displayName}</p>
            <p className="text-[10px] mt-1 font-mono" style={{ color: "rgba(148,163,184,0.5)" }}>
              session · {visitor.id}
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={startNewUserSession}
              className="w-full mt-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
              style={{
                background: "rgba(168,85,247,0.12)",
                border: "1px solid rgba(168,85,247,0.25)",
                color: "rgba(216,180,254,0.9)",
              }}
            >
              + Simular novo user
            </button>
            <p className="text-[10px] mt-2 leading-relaxed" style={{ color: "rgba(148,163,184,0.45)" }}>
              Cada clique = outro visitante no marketplace a chamar o ProsPilot.
            </p>
          </div>

          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(0,212,255,0.12)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: "rgba(0,212,255,0.5)" }}>
              Service Agent
            </p>
            <select
              value={selectedDid}
              onChange={(e) => {
                setSelectedDid(e.target.value);
                setContextId(undefined);
              }}
              disabled={loading}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none disabled:opacity-60"
              style={{
                background: "rgba(4,10,24,0.95)",
                border: "1px solid rgba(0,212,255,0.18)",
              }}
            >
              {agents.map((a) => (
                <option key={a.agentCaDid} value={a.agentCaDid}>
                  {a.agentName || shortDid(a.agentCaDid)}
                  {a.online === false ? " (offline)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold mb-3" style={{ color: "rgba(148,163,184,0.5)" }}>
              Call log
            </p>
            {callLog.length === 0 ? (
              <p className="text-xs" style={{ color: "rgba(148,163,184,0.45)" }}>
                Nenhuma chamada ao ProsPilot ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {callLog.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg px-3 py-2 text-[10px] font-mono"
                    style={{
                      background: "rgba(0,212,255,0.04)",
                      border: "1px solid rgba(0,212,255,0.08)",
                      color: "rgba(148,163,184,0.75)",
                    }}
                  >
                    <div>{c.visitorLabel ?? "User"} · {c.durationMs}ms · {c.state}</div>
                    <div className="truncate mt-0.5">user → {shortDid(c.targetDid)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {EXAMPLE_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading || !connected}
                onClick={() => void sendMessage(q)}
                className="text-left text-xs px-3 py-2 rounded-xl disabled:opacity-50"
                style={{
                  background: "rgba(0,212,255,0.05)",
                  border: "1px solid rgba(0,212,255,0.1)",
                  color: "rgba(148,163,184,0.8)",
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </aside>

        <section
          className="flex-1 flex flex-col min-h-[580px] rounded-2xl overflow-hidden"
          style={{
            background: "rgba(4,10,24,0.6)",
            border: "1px solid rgba(0,212,255,0.14)",
            boxShadow: "0 8px 40px rgba(0,0,0,0.35)",
          }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(0,212,255,0.1)" }}>
            <div className="flex items-center gap-3">
              <AgentChip
                label="Utilizador"
                name={visitor.displayName}
                did={`session:${visitor.id}`}
                role="Marketplace · novo visitante"
                accent="#a855f7"
              />
              <div className="shrink-0 flex flex-col items-center px-1">
                <span className="text-lg" style={{ color: "rgba(0,212,255,0.6)" }}>
                  →
                </span>
                <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(148,163,184,0.4)" }}>
                  Anvita
                </span>
              </div>
              <AgentChip
                label="Service Agent"
                name={targetName}
                did={targetDid}
                role="ProsPilot · FREE · online"
                accent="#34d399"
              />
            </div>

            {(loading || callPhase !== "idle") && (
              <div className="flex flex-wrap gap-2 mt-4">
                {CALL_STEPS.map((step) => {
                  const done = phaseDone(step.id);
                  const active = callPhase === step.id;
                  return (
                    <span
                      key={step.id}
                      className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                      style={{
                        background: done ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? "rgba(0,212,255,0.4)" : done ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)"}`,
                        color: done ? "rgba(52,211,153,0.9)" : "rgba(148,163,184,0.6)",
                      }}
                    >
                      {done ? "✓ " : active ? "● " : ""}
                      {step.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 max-h-[50vh]">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.kind === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[88%]">
                  <p
                    className="text-[10px] uppercase tracking-[0.1em] mb-1 px-1"
                    style={{
                      color:
                        m.kind === "user"
                          ? "rgba(168,85,247,0.75)"
                          : m.kind === "service"
                            ? "rgba(52,211,153,0.65)"
                            : "rgba(148,163,184,0.45)",
                      textAlign: m.kind === "user" ? "right" : "left",
                    }}
                  >
                    {m.kind === "user"
                      ? `${m.visitorName ?? visitor.displayName} · user`
                      : m.kind === "service"
                        ? `${targetName} · ProsPilot`
                        : "Anvita Flow"}
                  </p>
                  <div
                    className="px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                    style={
                      m.kind === "user"
                        ? {
                            background: "linear-gradient(135deg, rgba(168,85,247,0.14), rgba(168,85,247,0.05))",
                            border: "1px solid rgba(168,85,247,0.22)",
                            color: "#f3e8ff",
                          }
                        : m.kind === "service"
                          ? {
                              background: "rgba(52,211,153,0.08)",
                              border: "1px solid rgba(52,211,153,0.18)",
                              color: "rgba(226,232,240,0.92)",
                            }
                          : {
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid rgba(255,255,255,0.06)",
                              color: "rgba(148,163,184,0.75)",
                            }
                    }
                  >
                    {m.text}
                  </div>
                  {m.call && (
                    <p className="text-[10px] mt-1.5 px-1" style={{ color: "rgba(148,163,184,0.4)" }}>
                      ProsPilot respondeu em {Math.round(m.call.durationMs / 1000)}s
                    </p>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="px-4 py-3 rounded-2xl text-sm flex items-center gap-2"
                  style={{
                    background: "rgba(52,211,153,0.06)",
                    border: "1px solid rgba(52,211,153,0.15)",
                    color: "rgba(148,163,184,0.8)",
                  }}
                >
                  <span className="inline-block w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  ProsPilot a responder…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <p className="px-5 pb-2 text-xs" style={{ color: "rgba(248,113,113,0.9)" }}>
              {error}
            </p>
          )}

          <form
            onSubmit={onSubmit}
            className="p-4 border-t flex gap-3"
            style={{ borderColor: "rgba(0,212,255,0.1)" }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                connected
                  ? `${visitor.displayName}: pergunta ao ProsPilot…`
                  : "Liga o Gateway primeiro…"
              }
              disabled={loading || !connected}
              className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none disabled:opacity-60"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            />
            <button
              type="submit"
              disabled={loading || !connected || !input.trim()}
              className="px-5 py-3 rounded-xl font-semibold text-sm text-black disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #00d4ff, #38bdf8)",
                boxShadow: "0 4px 14px rgba(0,212,255,0.25)",
              }}
            >
              Enviar
            </button>
          </form>
        </section>
      </div>
    </PageShell>
  );
}
