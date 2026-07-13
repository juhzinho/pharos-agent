#!/usr/bin/env node
/** Verify Pharos Agent service is reachable. Usage: node scripts/verify-service.mjs [baseUrl] */
const base = process.argv[2] || "https://pharos-agent-pi.vercel.app";
const url = `${base.replace(/\/$/, "")}/api/info`;
try {
  const res = await fetch(url);
  const j = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(j));
  console.log(JSON.stringify({ ok: true, name: j.name, version: j.version, capabilities: j.capabilities }, null, 2));
} catch (e) {
  console.error(JSON.stringify({ ok: false, error: String(e.message || e) }));
  process.exit(1);
}
