// Vercel serverless function: health probe for every live data source.
//
// Endpoint: /api/health
// Returns: { overall, checked, sources: [{ name, status, code, detail }] }
//   HTTP 200 when all sources ok, 503 when any is degraded.
//
// A daily Vercel cron (see vercel.json) hits this endpoint. If any source is
// degraded AND an ALERT_WEBHOOK env var is set (Slack or Discord incoming
// webhook URL), it POSTs a summary so you find out before users do —
// otherwise a broken scraper would just silently fall back to mock.

export default async function handler(req, res) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers["host"] || process.env.VERCEL_URL || "";
  const base = host ? `${proto}://${host}` : "";

  const checks = [
    { name: "Quotes (Yahoo)",            path: "/api/quotes?ticker=SPY&range=1mo" },
    { name: "VIX (Yahoo)",               path: "/api/quotes?ticker=%5EVIX&range=1mo" },
    { name: "Fed rate (FRED)",           path: "/api/fed-rate" },
    { name: "FedWatch (ZQ futures)",     path: "/api/fedwatch" },
    { name: "Margin debt (Jina/FINRA)",  path: "/api/finra-margin" },
    { name: "Earnings (Yahoo)",          path: "/api/earnings?ticker=NVDA" }
  ];

  const sources = await Promise.all(checks.map(async c => {
    const url = base + c.path;
    try {
      const r = await fetch(url, { headers: { "x-health-probe": "1" } });
      if (r.ok) {
        // Lightweight payload sanity check.
        const j = await r.json().catch(() => null);
        const empty =
          j && ((Array.isArray(j.rows) && j.rows.length === 0) ||
                (Array.isArray(j.history) && j.history.length === 0) ||
                (Array.isArray(j.outcomes) && j.outcomes.length === 0) ||
                (j.latest === undefined && j.rows === undefined &&
                 j.history === undefined && j.upper === undefined &&
                 j.outcomes === undefined));
        // Freshness check for daily price series: a feed that still returns
        // 200 but stopped advancing is as broken as one that errors.
        let stale = "";
        const lastDate = Array.isArray(j?.rows) && j.rows.length
          ? j.rows[j.rows.length - 1].date : null;
        if (lastDate) {
          const ageDays = (Date.now() - new Date(lastDate + "T00:00:00Z").getTime()) / 86400000;
          if (ageDays > 5) stale = `latest quote ${lastDate} (${ageDays.toFixed(0)} days old)`;
        }
        return {
          name: c.name,
          status: empty || stale ? "degraded" : "ok",
          code: r.status,
          detail: empty ? "empty payload" : stale
        };
      }
      const body = await r.text().catch(() => "");
      return { name: c.name, status: "degraded", code: r.status, detail: body.slice(0, 140) };
    } catch (e) {
      return { name: c.name, status: "degraded", code: 0, detail: String(e.message || e) };
    }
  }));

  const degraded = sources.filter(s => s.status === "degraded");
  const overall = degraded.length === 0 ? "ok" : "degraded";

  // Alert on degradation if a webhook is configured. Body carries both
  // Slack ("text") and Discord ("content") keys; each platform ignores
  // the one it doesn't use.
  if (degraded.length > 0 && process.env.ALERT_WEBHOOK) {
    const msg =
      `⚠️ Market Entry Trigger — ${degraded.length} data source(s) degraded:\n` +
      degraded.map(d => `• ${d.name} (HTTP ${d.code})${d.detail ? " — " + d.detail : ""}`).join("\n");
    try {
      await fetch(process.env.ALERT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg, content: msg })
      });
    } catch (_) { /* alerting is best-effort */ }
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(overall === "ok" ? 200 : 503).json({
    overall,
    checked: new Date().toISOString(),
    sources
  });
}
