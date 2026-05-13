// Vercel serverless function: returns FINRA's Debit Balances in Customers'
// Securities Margin Accounts as JSON in $ billions.
//
// Endpoint: /api/finra-margin
// Response: { unitsLabel: "$B", asOf: "YYYY-MM", history: [{ month, value }, ...] }
//
// FINRA's site is behind Cloudflare's bot protection — direct server-side
// fetch returns the "Just a moment…" challenge page (HTTP 403). We route
// through r.jina.ai, a free Reader proxy designed for LLM/scraper content
// extraction. It solves the Cloudflare challenge and returns the page as
// clean markdown like:
//
//   Mar-26 | 1,220,922 | 221,860 | 205,600
//
// which is trivial to regex.

const FINRA_URL =
  "https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics";
const JINA_READER = `https://r.jina.ai/${FINRA_URL}`;

// GitHub coordinates for the auto-update write-back. The repo is hardcoded
// since this function only ever runs for this project's deployment.
const GH_OWNER = "lebron9007";
const GH_REPO  = "market-entry-trigger";
const GH_PATH  = "data/finra_margin.json";
const GH_BRANCH = "main";

const MONTH_ABBR = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

// Best-effort write-back: persist the freshly scraped history to
// data/finra_margin.json in the repo so it stays accurate even if both
// FINRA and Jina later fail. Requires GITHUB_TOKEN env var (fine-grained
// PAT with Contents: read+write on this repo). Silently skipped when the
// token isn't set, when there are no changes, or when the GitHub API
// errors — never breaks the user's read.
async function tryWriteBack(history, asOf) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { skipped: "no GITHUB_TOKEN env var" };

  const ghHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "market-entry-trigger-bot/1.0"
  };
  const apiUrl =
    `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_PATH}` +
    `?ref=${GH_BRANCH}`;

  // Read current file from the repo.
  const getResp = await fetch(apiUrl, { headers: ghHeaders });
  if (!getResp.ok) {
    return { error: `GitHub GET HTTP ${getResp.status}` };
  }
  const current = await getResp.json();
  let currentJson = {};
  try {
    currentJson = JSON.parse(
      Buffer.from(current.content, "base64").toString("utf-8")
    );
  } catch (_) { /* corrupted JSON in repo — overwrite it */ }

  // No-op if the history we just scraped matches what's already committed.
  const sameLength = (currentJson.history?.length || 0) === history.length;
  const sameLast =
    currentJson.history?.[currentJson.history.length - 1]?.month === asOf;
  if (sameLength && sameLast) return { skipped: "no changes" };

  // Build the new file content. Preserve the manual-edit comment so the
  // file stays self-documenting when a human inspects it.
  const newJson = {
    _comment:
      "Auto-updated by /api/finra-margin (FINRA via r.jina.ai). Manual edits " +
      "are welcome and serve as fallback if the proxy fails — they'll be " +
      "overwritten the next time the proxy successfully scrapes fresh data. " +
      "Source: https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics",
    unitsLabel: "$B",
    asOf,
    history
  };
  const newContent = Buffer.from(
    JSON.stringify(newJson, null, 2) + "\n",
    "utf-8"
  ).toString("base64");

  const putResp = await fetch(apiUrl.split("?")[0], {
    method: "PUT",
    headers: { ...ghHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      branch: GH_BRANCH,
      message: `chore(data): auto-update FINRA margin through ${asOf}`,
      content: newContent,
      sha: current.sha,
      committer: {
        name: "Market Entry Trigger Bot",
        email: "bot@market-entry-trigger.vercel.app"
      }
    })
  });
  if (!putResp.ok) {
    const body = await putResp.text().catch(() => "");
    return { error: `GitHub PUT HTTP ${putResp.status}`, snippet: body.slice(0, 200) };
  }
  return { committed: true, asOf };
}

export default async function handler(req, res) {
  try {
    const r = await fetch(JINA_READER, {
      headers: {
        "User-Agent":
          "MarketEntryTrigger/1.0 (+https://market-entry-trigger.vercel.app)",
        Accept: "text/plain, text/markdown"
      }
    });
    if (!r.ok) {
      let snippet = "";
      try {
        const body = await r.text();
        snippet = body.slice(0, 200).replace(/\s+/g, " ");
      } catch (_) {}
      return res
        .status(502)
        .json({ error: `Jina reader HTTP ${r.status}`, snippet });
    }
    const text = await r.text();

    // Match data rows: "<Mon>-<YY> | <comma-separated number>"
    // First numeric column on each row IS the Debit Balances figure (millions).
    const rowRegex = /\b([A-Za-z]{3})-(\d{2})\s*\|\s*([\d,]+)/g;
    const seen = new Set();
    const history = [];
    let m;
    while ((m = rowRegex.exec(text)) !== null) {
      const mm = MONTH_ABBR[m[1].toLowerCase()];
      if (!mm) continue;
      const yr = (parseInt(m[2]) > 70 ? "19" : "20") + m[2];
      const month = `${yr}-${mm}`;
      if (seen.has(month)) continue;
      const valueMillions = parseFloat(m[3].replace(/,/g, ""));
      if (isNaN(valueMillions) || valueMillions <= 0) continue;
      seen.add(month);
      history.push({ month, value: +(valueMillions / 1000).toFixed(1) });
    }

    if (history.length === 0) {
      return res
        .status(502)
        .json({ error: "No data rows parsed from Jina-proxied FINRA content" });
    }

    // Sort chronologically (oldest → newest).
    history.sort((a, b) => a.month.localeCompare(b.month));
    const asOf = history[history.length - 1].month;

    // Defensive write-back: persist to data/finra_margin.json so the static
    // file stays fresh as a fallback for when this proxy is unavailable.
    // Catch any error — we always want the read response to succeed.
    let sync;
    try { sync = await tryWriteBack(history, asOf); }
    catch (e) { sync = { error: String(e.message || e) }; }

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=86400, stale-while-revalidate=604800"
    );
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ unitsLabel: "$B", asOf, history, sync });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
