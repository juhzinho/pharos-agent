// AI Trainer — one command that keeps the agent's knowledge fresh.
//
// What it does, in order:
//  1. Custom sources: crawls every URL listed in data/training-sources.json
//     (user-editable — just add links and re-run) into lib/crawled-docs.json.
//  2. News/tweets archive: converts the accumulated data/news.json and
//     data/tweets.json archives into knowledge chunks, so the agent "learns"
//     everything Pharos ever posted, not just what fits in the live feed.
//  3. Official docs re-crawl (skippable with --quick): re-runs crawl-docs.mjs
//     and crawl-extra.mjs to pick up new/changed pages on docs.pharos.xyz,
//     docs.faroo.xyz, docs.aquaflux.pro, port.pharos.xyz, GitHub, etc.
//  4. Re-embeds everything: runs build-knowledge.mjs so the RAG vector index
//     (lib/knowledge-vectors.json) reflects the new content.
//
// Run:
//   npm run train          → full training (crawl everything + re-embed)
//   npm run train:quick    → only custom sources + news archive + re-embed
//
// Schedule it (Windows Task Scheduler) to run e.g. daily:
//   schtasks /create /tn "PharosAgentTrainer" /tr "cmd /c cd /d C:\path\to\pharos-agent && npm run train" /sc daily /st 06:00

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CRAWLED = path.join(ROOT, "lib", "crawled-docs.json");
const SOURCES = path.join(ROOT, "data", "training-sources.json");
const QUICK = process.argv.includes("--quick");

const MAX_CHUNK_CHARS = 1200;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── helpers ──────────────────────────────────────────────────────────────────

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
const htmlTitle = (html) => (html.match(/<title>([^<]+)<\/title>/i)?.[1] || "").replace(/\s*[|·–-].*$/, "").trim();

function chunkText(text, title, url, idPrefix) {
  const chunks = [];
  for (let k = 0; k < text.length; k += MAX_CHUNK_CHARS) chunks.push(text.slice(k, k + MAX_CHUNK_CHARS).trim());
  return chunks
    .filter((c) => c.replace(/[#>*\-\s|]/g, "").length >= 40)
    .map((c, j) => ({ id: `${idPrefix}-${j}`, text: `# ${title}\n\n${c}`, source: title, title, url }));
}

async function fetchPage(url) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(18000) });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function loadCrawled() {
  try { return JSON.parse(readFileSync(CRAWLED, "utf8")); } catch { return []; }
}

// Idempotent append: chunks whose id starts with the prefix are replaced, so
// re-running the trainer updates instead of duplicating.
function replacePrefix(all, prefix, fresh) {
  const kept = all.filter((c) => !String(c.id || "").startsWith(prefix));
  return [...kept, ...fresh];
}

// ── 1. custom training sources ───────────────────────────────────────────────

async function crawlCustomSources(all) {
  if (!existsSync(SOURCES)) {
    console.log(`No ${path.relative(ROOT, SOURCES)} — create it with a JSON array of URLs to feed the agent.`);
    return all;
  }
  let urls;
  try {
    urls = JSON.parse(readFileSync(SOURCES, "utf8"));
  } catch {
    console.warn("data/training-sources.json is not valid JSON — skipping custom sources.");
    return all;
  }
  if (!Array.isArray(urls) || urls.length === 0) return all;

  const fresh = [];
  for (const [i, url] of urls.entries()) {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) continue;
    const html = await fetchPage(url);
    if (!html) { console.warn(`  ✗ ${url} (fetch failed)`); continue; }
    const title = htmlTitle(html) || new URL(url).hostname;
    const text = htmlToText(html);
    const chunks = chunkText(text, title, url, `custom-${i}`);
    fresh.push(...chunks);
    console.log(`  ✓ ${url} → ${chunks.length} chunks ("${title}")`);
    await sleep(400);
  }
  console.log(`Custom sources: ${fresh.length} chunks total.`);
  return replacePrefix(all, "custom-", fresh);
}

// ── 2. news + tweets archive → knowledge ─────────────────────────────────────

function archiveToChunks(all) {
  const fresh = [];
  try {
    const news = JSON.parse(readFileSync(path.join(ROOT, "data", "news-archive.json"), "utf8"));
    for (const [i, n] of news.entries()) {
      const t = [n.title, n.description ?? n.summary ?? ""].filter(Boolean).join(" — ");
      if (t.length < 30) continue;
      fresh.push({ id: `newsarch-${i}`, text: `# Pharos News (${n.date ?? ""})\n\n${t}`, source: "Pharos News Archive", url: n.url });
    }
    console.log(`News archive: ${news.length} items.`);
  } catch { console.log("News archive: none yet (data/news-archive.json)."); }
  try {
    const tweets = JSON.parse(readFileSync(path.join(ROOT, "data", "tweets-archive.json"), "utf8"));
    for (const [i, tw] of tweets.entries()) {
      const t = tw.text ?? tw.content ?? "";
      if (t.length < 30) continue;
      const when = (tw.createdAt ?? tw.date ?? "").slice(0, 10);
      fresh.push({ id: `tweetarch-${i}`, text: `# @pharos_network tweet (${when})\n\n${t}`, source: "Pharos Twitter Archive", url: tw.url });
    }
    console.log(`Tweets archive: ${tweets.length} items.`);
  } catch { console.log("Tweets archive: none yet (data/tweets-archive.json)."); }
  let out = replacePrefix(all, "newsarch-", []);
  out = replacePrefix(out, "tweetarch-", []);
  return [...out, ...fresh];
}

// ── 3+4. official crawls + re-embed ──────────────────────────────────────────

function run(cmd, args) {
  console.log(`\n▶ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: true });
  if (r.status !== 0) console.warn(`  (exited with code ${r.status} — continuing)`);
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log(`Pharos Agent Trainer — ${QUICK ? "quick" : "full"} mode\n`);

if (!QUICK) {
  run("node", ["scripts/crawl-docs.mjs"]);
  run("node", ["scripts/crawl-extra.mjs"]);
}

let all = loadCrawled();
const before = all.length;
all = await crawlCustomSources(all);
all = archiveToChunks(all);
writeFileSync(CRAWLED, JSON.stringify(all), "utf8");
console.log(`\nlib/crawled-docs.json: ${before} → ${all.length} chunks.`);

run("node", ["--experimental-strip-types", "scripts/build-knowledge.mjs"]);

console.log("\n✅ Training complete — the agent's RAG index is up to date.");
console.log("   Deploy/restart the app so the new lib/knowledge-vectors.json is served.");
