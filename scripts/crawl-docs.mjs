// Crawl the official Pharos ecosystem docs into clean, chunked knowledge.
//
// Two fetch strategies:
//  • GitBook sites (docs.pharos.xyz, docs.aquaflux.pro, docs.faroo.xyz,
//    wiki.bitverse.zone): every page has a clean Markdown twin at <url>.md, listed
//    in the sitemap — we fetch those directly (no nav/footer noise).
//  • SPA / marketing sites (pharos.xyz, buildonpharos.com, port.pharos.xyz,
//    docs.zona.finance): fetch HTML, strip script/style/nav/header/footer/aside,
//    extract main text, and follow same-domain internal links (one level).
//
// Output: lib/crawled-docs.json → [{ id, text, source, title, url }]
// Run:  npm run crawl:docs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const GITBOOK_DOMAINS = ["docs.pharos.xyz", "docs.aquaflux.pro", "docs.faroo.xyz", "wiki.bitverse.zone"];
const SPA_SEEDS = [
  "https://www.pharos.xyz/",
  "https://www.pharos.xyz/agent-carnival",
  "https://www.pharos.xyz/blog/pharos-testnet-onboarding-guide",
  "https://www.buildonpharos.com/",
  "https://port.pharos.xyz/ecosystem",
  "https://docs.zona.finance/overview",
];
// docs.pharosnetwork.xyz intentionally omitted — DNS does not resolve (status 000).

const DELAY_MS = 500;
const MAX_PAGES = 160;
const MAX_CHUNK_CHARS = 1200;        // ~300 tokens
const SPA_LINKS_PER_SEED = 6;        // follow a few internal links per SPA seed

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const seedResults = {}; // url → status string, for the report

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

// ── markdown helpers (GitBook) ───────────────────────────────────────────────

function cleanMarkdown(md) {
  return md
    .replace(/^>\s*For the complete documentation index[\s\S]*?\.md\)\.?\s*$/im, "")
    .replace(/#+\s*Agent Instructions[\s\S]*$/i, "")
    .replace(/#+\s*Suggested Follow-up Questions[\s\S]*$/i, "")
    .replace(/^#+\s*(Page Not Found)[\s\S]*$/im, "")
    .replace(/\r/g, "")
    .trim();
}

function titleFromMd(md, url) {
  const h1 = md.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  const slug = url.replace(/\.md$/, "").split("/").filter(Boolean).pop() || "Docs";
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Split into ~300-token chunks on blank lines. Keeps Markdown tables intact:
// a table (lines starting with '|') is never split mid-table, so contract
// addresses on the canonical-contracts page survive as one block.
function chunkMarkdown(md, title) {
  const blocks = [];
  const lines = md.split("\n");
  let buf = [], inTable = false;
  for (const line of lines) {
    const isTableRow = /^\s*\|/.test(line);
    if (isTableRow && !inTable) { if (buf.join("\n").trim()) blocks.push(buf.join("\n")); buf = []; inTable = true; }
    if (!isTableRow && inTable && line.trim() === "") { blocks.push(buf.join("\n")); buf = []; inTable = false; continue; }
    buf.push(line);
  }
  if (buf.join("\n").trim()) blocks.push(buf.join("\n"));

  const paras = blocks.flatMap((b) => (/^\s*\|/.test(b.trim()) ? [b.trim()] : b.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)));
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    const isTable = /^\s*\|/.test(p);
    if (cur && (isTable || cur.length + p.length + 2 > MAX_CHUNK_CHARS)) { chunks.push(cur); cur = p; }
    else cur = cur ? `${cur}\n\n${p}` : p;
    if (isTable) { chunks.push(cur); cur = ""; } // tables get their own chunk
  }
  if (cur) chunks.push(cur);
  return chunks
    .map((c) => c.trim())
    .filter((c) => c.replace(/[#>*\-\s|]/g, "").length >= 40)
    .map((c) => (c.startsWith("#") || /^\s*\|/.test(c) ? `# ${title}\n\n${c}`.replace(/^# .+\n\n(# )/, "$1") : `# ${title}\n\n${c}`));
}

// ── HTML helpers (SPA) ───────────────────────────────────────────────────────

function htmlTitle(html) {
  return (html.match(/<title>([^<]+)<\/title>/i)?.[1] || "").replace(/\s*[|–·-].*$/, "").trim();
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameDomainLinks(html, origin) {
  const out = new Set();
  for (const m of html.matchAll(/href="([^"]+)"/gi)) {
    let href = m[1];
    if (href.startsWith("/")) href = origin + href;
    if (!href.startsWith(origin)) continue;
    if (/\.(png|jpe?g|svg|ico|css|js|woff2?|ttf|pdf|zip)(\?|$)/i.test(href)) continue;
    if (href.includes("/_next") || href.includes("#")) continue;
    out.add(href.split("#")[0]);
  }
  return [...out];
}

function chunkFlatText(text, title, url, idPrefix) {
  const out = [];
  for (let k = 0, j = 0; k < text.length; k += MAX_CHUNK_CHARS, j++) {
    const slice = text.slice(k, k + MAX_CHUNK_CHARS).trim();
    if (slice.length >= 120) out.push({ id: `${idPrefix}-${j}`, text: `${title}\n\n${slice}`, source: title || url, title: title || url, url });
  }
  return out;
}

// ── sitemap (GitBook) ────────────────────────────────────────────────────────

async function getSitemapUrls(domain) {
  const root = `https://${domain}/sitemap.xml`;
  const xml = await fetchText(root);
  if (!xml) return [];
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  // sitemap index → fetch sub-sitemaps
  if (/<sitemapindex/i.test(xml)) {
    const urls = [];
    for (const sub of locs) {
      const subXml = await fetchText(sub);
      if (subXml) urls.push(...[...subXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim()));
      await sleep(200);
    }
    return urls;
  }
  return locs;
}

// ── crawl ────────────────────────────────────────────────────────────────────

const out = [];
let pageCount = 0;

async function crawlGitBook() {
  for (const domain of GITBOOK_DOMAINS) {
    if (pageCount >= MAX_PAGES) break;
    let urls = await getSitemapUrls(domain);
    urls = [...new Set(urls)].filter((u) => u && !/\.(xml|png|jpg|svg)$/i.test(u));
    console.log(`\n[GitBook] ${domain}: ${urls.length} pages in sitemap`);
    let ok = 0, fail = 0;
    for (const url of urls) {
      if (pageCount >= MAX_PAGES) break;
      const mdUrl = url.endsWith("/") ? null : `${url}.md`;
      const md = mdUrl ? await fetchText(mdUrl) : null;
      await sleep(DELAY_MS);
      if (!md) { fail++; continue; }
      const clean = cleanMarkdown(md);
      if (clean.length < 80) { fail++; continue; }
      const title = titleFromMd(clean, url);
      const pageChunks = chunkMarkdown(clean, title);
      pageChunks.forEach((text, j) => out.push({ id: `${domain}-${ok}-${j}`, text, source: title, title, url }));
      ok++; pageCount++;
    }
    console.log(`[GitBook] ${domain}: ${ok} ok, ${fail} skipped → running total ${out.length} chunks`);
    seedResults[`https://${domain}/`] = `OK (GitBook, ${ok} pages)`;
  }
}

async function crawlSpaSeed(seed) {
  const origin = new URL(seed).origin;
  const queue = [seed];
  const visited = new Set();
  let added = 0, followed = 0;
  while (queue.length && pageCount < MAX_PAGES) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    const html = await fetchText(url);
    await sleep(DELAY_MS);
    if (!html) { if (url === seed) seedResults[seed] = "FAIL (no response)"; continue; }
    const text = htmlToText(html);
    const title = htmlTitle(html) || origin;
    if (text.length >= 300) {
      const before = out.length;
      out.push(...chunkFlatText(text, title, url, `spa-${pageCount}`));
      if (out.length > before) { added += out.length - before; pageCount++; }
    } else if (url === seed) {
      seedResults[seed] = "PARTIAL (SPA shell — little server-rendered text)";
    }
    // follow a few internal links from the seed page only
    if (url === seed && followed < SPA_LINKS_PER_SEED) {
      for (const link of sameDomainLinks(html, origin)) {
        if (followed >= SPA_LINKS_PER_SEED) break;
        if (!visited.has(link)) { queue.push(link); followed++; }
      }
    }
  }
  if (!seedResults[seed]) seedResults[seed] = added > 0 ? `OK (HTML, ${added} chunks +${followed} links)` : "PARTIAL (no extractable text)";
}

await crawlGitBook();
for (const seed of SPA_SEEDS) {
  if (pageCount >= MAX_PAGES) { seedResults[seed] = "SKIPPED (page cap reached)"; continue; }
  await crawlSpaSeed(seed);
}
seedResults["https://docs.pharosnetwork.xyz/"] = "FAIL (DNS does not resolve)";

const outPath = path.join(ROOT, "lib", "crawled-docs.json");
writeFileSync(outPath, JSON.stringify(out, null, 0));

console.log("\n──────── SEED RESULTS ────────");
for (const [u, s] of Object.entries(seedResults)) console.log(`  ${s.startsWith("OK") ? "✓" : s.startsWith("PARTIAL") ? "~" : "✗"} ${u} → ${s}`);
console.log(`\nPages crawled: ${pageCount} · Chunks: ${out.length} → lib/crawled-docs.json`);
