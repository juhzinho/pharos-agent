// Crawl the official Pharos documentation into clean, chunked knowledge.
//
// Primary source: docs.pharos.xyz (GitBook) — every page has a clean Markdown
// version at <url>.md, listed in the sitemap. We fetch those directly (no HTML
// stripping needed) and split into ~300-token chunks.
// Secondary (best-effort): buildonpharos.com — a Next.js SPA; we extract visible
// text from the rendered HTML where possible and skip pages that yield little.
//
// Output: lib/crawled-docs.json → [{ id, text, source, title, url }]
//
// Run:  node scripts/crawl-docs.mjs   (or npm run crawl:docs)

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DOCS_ORIGIN = "https://docs.pharos.xyz";
const SITEMAP = `${DOCS_ORIGIN}/sitemap-pages.xml`;
const DELAY_MS = 500;
const MAX_PAGES = 150;
const MAX_CHUNK_CHARS = 1200; // ~300 tokens

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, timeoutMs = 15000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: c.signal, headers: { "User-Agent": "PharosAgentDocsCrawler/1.0", Accept: "text/markdown,text/html,*/*" } });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

// ── chunking ────────────────────────────────────────────────────────────────

function cleanMarkdown(md) {
  return md
    // GitBook boilerplate line that prefixes every .md page
    .replace(/^>\s*For the complete documentation index[\s\S]*?\.md\)\.?\s*$/im, "")
    // GitBook "Agent Instructions / Querying This Documentation" trailer
    .replace(/#+\s*Agent Instructions[\s\S]*$/i, "")
    .replace(/#+\s*Suggested Follow-up Questions[\s\S]*$/i, "")
    .replace(/\r/g, "")
    .trim();
}

function titleFromMd(md, url) {
  const h1 = md.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const slug = url.replace(DOCS_ORIGIN, "").replace(/\.md$/, "").split("/").filter(Boolean).pop() || "Pharos Docs";
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Split markdown into ~300-token chunks on blank lines, keeping the page title
// as a prefix so each chunk carries context for retrieval.
function chunkMarkdown(md, title) {
  const paras = md.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p && p.length > 2);
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > MAX_CHUNK_CHARS) {
      chunks.push(cur);
      cur = p;
    } else {
      cur = cur ? `${cur}\n\n${p}` : p;
    }
  }
  if (cur) chunks.push(cur);
  // Drop tiny/low-value chunks; prefix with the title for context.
  return chunks
    .filter((c) => c.replace(/[#>*\-\s]/g, "").length >= 40)
    .map((c) => (c.startsWith("#") ? c : `# ${title}\n\n${c}`));
}

// ── buildonpharos (best-effort HTML text) ────────────────────────────────────

function htmlToText(html) {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return body;
}

// ── main ─────────────────────────────────────────────────────────────────────

async function crawlDocs() {
  const out = [];
  const sitemap = await fetchText(SITEMAP);
  if (!sitemap) {
    console.warn("Could not fetch docs sitemap — skipping docs.pharos.xyz");
    return out;
  }
  let urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  // The bare origin has no .md; route it to the readme.
  urls = urls.map((u) => (u === DOCS_ORIGIN || u === `${DOCS_ORIGIN}/` ? `${DOCS_ORIGIN}/introduction/readme` : u));
  urls = [...new Set(urls)].slice(0, MAX_PAGES);

  console.log(`docs.pharos.xyz: ${urls.length} pages in sitemap`);
  let ok = 0, fail = 0;
  for (const [i, url] of urls.entries()) {
    const md = await fetchText(`${url}.md`);
    await sleep(DELAY_MS);
    if (!md) { fail++; console.log(`  [${i + 1}/${urls.length}] FAIL ${url}`); continue; }
    const clean = cleanMarkdown(md);
    if (clean.length < 80) { fail++; console.log(`  [${i + 1}/${urls.length}] empty ${url}`); continue; }
    const title = titleFromMd(clean, url);
    const pageChunks = chunkMarkdown(clean, title);
    pageChunks.forEach((text, j) => {
      out.push({ id: `doc-${ok}-${j}`, text, source: title, title, url });
    });
    ok++;
    console.log(`  [${i + 1}/${urls.length}] OK ${title} (${pageChunks.length} chunks)`);
  }
  console.log(`docs.pharos.xyz: ${ok} ok, ${fail} failed → ${out.length} chunks`);
  return out;
}

async function crawlBuildOnPharos() {
  const out = [];
  const origin = "https://www.buildonpharos.com";
  const home = await fetchText(origin);
  if (!home) { console.warn("buildonpharos.com unreachable — skipping"); return out; }
  // Collect internal links from the homepage HTML.
  const paths = new Set(["/"]);
  for (const m of home.matchAll(/href="(\/[a-z0-9/-]*)"/gi)) {
    const p = m[1];
    if (!/\.(png|jpg|svg|ico|css|js|woff2?|ttf)$/i.test(p) && !p.startsWith("/_next")) paths.add(p);
  }
  const list = [...paths].slice(0, 20);
  console.log(`buildonpharos.com: trying ${list.length} pages`);
  let ok = 0;
  for (const p of list) {
    const html = await fetchText(origin + p);
    await sleep(DELAY_MS);
    if (!html) continue;
    const text = htmlToText(html);
    if (text.length < 300) continue; // SPA shell with no real content
    const title = (html.match(/<title>([^<]+)<\/title>/i)?.[1] || `Build on Pharos ${p}`).replace(/\s*[|–-].*$/, "").trim();
    // chunk the flat text
    for (let k = 0, j = 0; k < text.length; k += MAX_CHUNK_CHARS, j++) {
      const slice = text.slice(k, k + MAX_CHUNK_CHARS).trim();
      if (slice.length >= 120) out.push({ id: `bop-${ok}-${j}`, text: slice, source: "buildonpharos.com", title, url: origin + p });
    }
    ok++;
    console.log(`  OK ${p} (${title})`);
  }
  console.log(`buildonpharos.com: ${ok} pages → ${out.length} chunks`);
  return out;
}

const docs = await crawlDocs();
const bop = await crawlBuildOnPharos();
const all = [...docs, ...bop];

const outPath = path.join(ROOT, "lib", "crawled-docs.json");
writeFileSync(outPath, JSON.stringify(all, null, 0));
console.log(`\nWrote ${all.length} crawled chunks → lib/crawled-docs.json`);
