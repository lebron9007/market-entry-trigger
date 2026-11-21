#!/usr/bin/env node
// Daily snapshot of the live 5-condition score -> data/score_log.json.
//
// Run by .github/workflows/daily-score.yml after the US market close. It
// fetches the same /api/* endpoints the dashboard uses and scores them with
// the dashboard's own rules (core.js), so the log always matches what the
// page showed that day.
//
// When the score changes from the previous logged day it raises an alert:
//   * a GitHub issue in this repo (GITHUB_TOKEN + GITHUB_REPOSITORY, both
//     provided automatically inside GitHub Actions) — GitHub emails the
//     repo owner about new issues by default;
//   * a POST to ALERT_WEBHOOK (Slack/Discord incoming webhook), if that
//     repo secret is set.
//
// Usage: node scripts/snapshot.mjs [--dry-run]
//   --dry-run  print the snapshot; don't write the log or send alerts.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.SITE_URL || "https://market-entry-trigger.vercel.app").replace(/\/$/, "");
const LOG_PATH = path.join(ROOT, "data", "score_log.json");
const DRY_RUN = process.argv.includes("--dry-run");

// Load the shared rules (core.js is a plain script that sets globalThis.MET).
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "core.js"), "utf8"), sandbox, { filename: "core.js" });
const MET = sandbox.MET;

async function getJSON(p, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + p, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error(`${p} HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 5000 * (i + 1)));
    }
  }
  throw lastErr;
}

// ------------------------------------------------------------ fetchers
async function fetchVIX() {
  const j = await getJSON("/api/quotes?ticker=%5EVIX&range=1mo");
  const last = (j.rows || []).at(-1);
  if (!last) throw new Error("no VIX rows");
  return { value: +last.close.toFixed(2), asOf: last.date, source: "live" };
}

async function fetchFed() {
  try {
    const fw = await getJSON("/api/fedwatch");
    return {
      currentUpper: fw.currentRange.upper,
      currentLow: fw.currentRange.lower,
      projections: {},
      fedwatch: fw,
      asOf: fw.asOf,
      source: "live"
    };
  } catch (e) {
    // Same fallback as the dashboard: the dot-plot rule.
    const j = await getJSON("/api/fed-rate");
    return {
      currentUpper: j.upper.at(-1).value,
      currentLow: j.lower.at(-1).value,
      projections: j.projections || {},
      fedwatch: null,
      asOf: j.upper.at(-1).date,
      source: "live"
    };
  }
}

async function fetchMargin() {
  const j = await getJSON("/api/finra-margin");
  const h = j.history || [];
  if (h.length < 2) throw new Error("margin history too short");
  return {
    asOf: h.at(-1).month, unitsLabel: j.unitsLabel || "$B", history: h,
    latest: h.at(-1).value, prior: h.at(-2).value, source: "live"
  };
}

async function fetchSectors() {
  const tickers = ["SPY", ...Object.keys(MET.SECTOR_ETFS)];
  const settled = await Promise.allSettled(tickers.map(t =>
    getJSON(`/api/quotes?ticker=${encodeURIComponent(t)}&range=1y`)));
  const r3m = {};
  let asOf = null;
  settled.forEach((s, i) => {
    if (s.status !== "fulfilled") return;
    const rows = s.value.rows || [];
    const m3 = MET._compute3M(rows.map(r => r.close));
    if (m3 != null) r3m[tickers[i]] = m3;
    if (tickers[i] === "SPY") asOf = rows.at(-1)?.date || null;
  });
  if (r3m.SPY == null) throw new Error("SPY 3M return missing");
  const allRanked = Object.keys(MET.SECTOR_ETFS)
    .filter(t => r3m[t] != null)
    .map(t => ({
      ticker: t, name: MET.SECTOR_ETFS[t],
      absReturn3M: r3m[t], relStrength3M: r3m[t] - r3m.SPY,
      growth: MET.GROWTH_SECTORS.has(t)
    }))
    .sort((a, b) => b.relStrength3M - a.relStrength3M);
  return { ...MET.summarizeSectors(allRanked, r3m.SPY), asOf, source: "live" };
}

async function fetchEarnings(sectorTicker) {
  const tickers = MET.SECTOR_CONSTITUENTS[sectorTicker] || [];
  if (!tickers.length) throw new Error(`no constituents for ${sectorTicker}`);
  const settled = await Promise.allSettled(tickers.map(t =>
    getJSON(`/api/earnings?ticker=${encodeURIComponent(t)}`, 2)));
  return {
    ...MET.summarizeEarnings(sectorTicker, tickers,
      settled.map(s => (s.status === "fulfilled" ? s.value : null))),
    source: "live"
  };
}

// ---------------------------------------------------------------- main
const KEYS = ["vix", "fed", "margin", "sector", "earnings"];
const LABELS = { vix: "VIX", fed: "Next FOMC", margin: "Margin debt", sector: "Leading sector", earnings: "Earnings" };

async function snapshot() {
  const [vix, fed, margin, sector] = await Promise.allSettled([fetchVIX(), fetchFed(), fetchMargin(), fetchSectors()]);
  const earnings = sector.status === "fulfilled"
    ? await fetchEarnings(sector.value.topTicker).then(v => ({ status: "fulfilled", value: v }), e => ({ status: "rejected", reason: e }))
    : { status: "rejected", reason: new Error("no leading sector") };

  const evals = { vix: MET.evalVIX, fed: MET.evalFed, margin: MET.evalMargin, sector: MET.evalLeading, earnings: MET.evalEarnings };
  const inputs = { vix, fed, margin, sector, earnings };
  const conditions = {};
  for (const k of KEYS) {
    const s = inputs[k];
    if (s.status !== "fulfilled") {
      conditions[k] = { status: "na", error: String(s.reason?.message || s.reason) };
      continue;
    }
    const r = evals[k](s.value);
    conditions[k] = {
      status: r.status, pass: r.pass, value: r.value,
      gauge: r.gauge ? r.gauge.text : null, asOf: r.asOf || null
    };
    if (k === "sector") conditions[k].leader = s.value.topTicker;
  }
  const score = KEYS.filter(k => conditions[k].pass).length;
  const partial = KEYS.some(k => conditions[k].status === "na");
  // Date the entry by the last trading day (VIX quote date), so a weekend or
  // manual re-run updates that day instead of adding a non-trading day.
  const date = vix.status === "fulfilled" ? vix.value.asOf : new Date().toISOString().slice(0, 10);
  return { date, score, partial, conditions };
}

function loadLog() {
  try { return JSON.parse(fs.readFileSync(LOG_PATH, "utf8")); }
  catch { return { entries: [] }; }
}

function alertText(prev, cur) {
  const mark = c => (c.status === "na" ? "–" : c.pass ? "✅" : "❌");
  const lines = KEYS.map(k => {
    const c = cur.conditions[k], p = prev.conditions?.[k];
    const flipped = p && p.pass !== c.pass ? " ← changed" : "";
    return `| ${LABELS[k]} | ${mark(c)} | ${c.value ?? "–"} | ${c.gauge ?? c.error ?? ""}${flipped} |`;
  });
  return [
    `Live score moved from **${prev.score}/5** (${prev.date}) to **${cur.score}/5** (${cur.date}).`,
    "",
    "| Condition | Met | Value | Distance to trigger |",
    "|---|---|---|---|",
    ...lines,
    "",
    `Dashboard: ${BASE}/`,
    "",
    "_Opened automatically by the daily score snapshot (.github/workflows/daily-score.yml)._"
  ].join("\n");
}

async function sendAlerts(prev, cur) {
  const title = `Score ${cur.score > prev.score ? "up" : "down"}: ${prev.score}/5 → ${cur.score}/5 (${cur.date})` +
                (cur.score === 5 ? " — ALL FIVE CONDITIONS MET" : "");
  const body = alertText(prev, cur);
  const { GITHUB_TOKEN, GITHUB_REPOSITORY, ALERT_WEBHOOK } = process.env;
  if (!(GITHUB_TOKEN && GITHUB_REPOSITORY) && !ALERT_WEBHOOK) {
    console.log(`No alert channel configured; would have sent:\n# ${title}\n${body}`);
    return;
  }
  if (GITHUB_TOKEN && GITHUB_REPOSITORY) {
    const r = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/issues`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ title, body })
    });
    console.log(r.ok ? "Opened GitHub issue alert." : `GitHub issue failed: HTTP ${r.status}`);
  }
  if (ALERT_WEBHOOK) {
    const text = `${title}\n${BASE}/`;
    const r = await fetch(ALERT_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text })
    }).catch(e => ({ ok: false, status: e.message }));
    console.log(r.ok ? "Sent webhook alert." : `Webhook failed: ${r.status}`);
  }
}

const cur = await snapshot();
console.log(`${cur.date}: ${cur.score}/5${cur.partial ? " (partial — some sources unavailable)" : ""}`);
for (const k of KEYS) {
  const c = cur.conditions[k];
  console.log(`  ${LABELS[k].padEnd(15)} ${c.status.padEnd(6)} ${String(c.value ?? "").padEnd(12)} ${c.gauge ?? c.error ?? ""}`);
}

if (!DRY_RUN) {
  const log = loadLog();
  const entries = (log.entries || []).filter(e => e.date !== cur.date);
  const prev = [...entries].reverse().find(e => !e.partial);
  entries.push(cur);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  fs.writeFileSync(LOG_PATH, JSON.stringify({
    _comment: "Daily live score, written by scripts/snapshot.mjs via .github/workflows/daily-score.yml " +
              "(weekdays after the US close). Uses the dashboard's own rules (core.js). " +
              "partial = at least one source was unavailable that day (not used for alerts).",
    entries
  }, null, 2) + "\n");
  console.log(`Logged ${entries.length} day(s) to data/score_log.json.`);

  // Alert only on a real change between two complete days — and only when
  // alerts are switched on (ALERTS_ENABLED=true in the workflow).
  const changed = prev && !cur.partial && prev.score !== cur.score;
  if (changed && process.env.ALERTS_ENABLED === "true") await sendAlerts(prev, cur);
  else if (changed) console.log(`Score changed ${prev.score} → ${cur.score}; alerts are off (ALERTS_ENABLED != true).`);
}
