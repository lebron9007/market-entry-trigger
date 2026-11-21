// Vercel serverless function: next-FOMC-meeting rate probabilities, computed
// with the CME FedWatch methodology from 30-Day Fed Funds futures.
//
// Endpoint: /api/fedwatch
//
// CME FedWatch itself has no free API, but its probabilities are derived
// from public 30-Day Fed Funds futures (ZQ) prices, so we apply the same
// method to the same contracts (quotes via Yahoo Finance):
//
//   * Futures price P for a month implies that month's average effective
//     fed funds rate: r = 100 - P.
//   * For the month M containing the next meeting (decision day d of N days;
//     the new rate applies from day d+1):
//       avg(M) = start * d/N + end * (N-d)/N
//   * If the month before M has no meeting, its contract gives `start` and we
//     solve for `end`; otherwise, if the month after M has no meeting, its
//     contract gives `end` and we solve for `start`. (Last resort: start =
//     latest effective fed funds rate from FRED.)
//   * The expected change (end - start) is split across the two nearest
//     25bp outcomes, e.g. +22.5bp -> 90% one hike, 10% hold.
//
// Meeting dates come from the Fed's own calendar page.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FED_CALENDAR = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm";
const MONTH_CODES = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];
const MONTHS = ["January","February","March","April","May","June","July",
                "August","September","October","November","December"];
const STEP = 0.25;

// ------------------------------------------------------------- calendar
let calendarCache = null; // { at, meetings }

async function fetchMeetings() {
  if (calendarCache && Date.now() - calendarCache.at < 12 * 3600 * 1000) {
    return calendarCache.meetings;
  }
  const r = await fetch(FED_CALENDAR, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Fed calendar HTTP ${r.status}`);
  const html = await r.text();

  // Split into per-year panels: "<h4><a id=..>2026 FOMC Meetings</a></h4>"
  const meetings = [];
  const yearRe = /(\d{4}) FOMC Meetings<\/a><\/h4>/g;
  const marks = [];
  let m;
  while ((m = yearRe.exec(html)) !== null) marks.push({ year: +m[1], at: m.index });
  marks.forEach((mk, i) => {
    const seg = html.slice(mk.at, i + 1 < marks.length ? marks[i + 1].at : undefined);
    const rowRe = /fomc-meeting__month[^>]*>\s*<strong>([^<]+)<\/strong>[\s\S]*?fomc-meeting__date[^>]*>([^<]+)</g;
    let row;
    while ((row = rowRe.exec(seg)) !== null) {
      const monthTxt = row[1].trim();       // "December" or "Apr/May"
      const dateTxt  = row[2].trim();       // "8-9*", "30-1", "22 (notation vote)"
      const dm = dateTxt.match(/^(\d{1,2})\s*-\s*(\d{1,2})\*?$/);
      if (!dm) continue;                    // skip notation votes / unscheduled
      // Decision is announced on the last day of the meeting.
      const lastMonthName = monthTxt.split("/").pop().trim();
      const mi = MONTHS.findIndex(x => x.toLowerCase().startsWith(lastMonthName.toLowerCase().slice(0, 3)));
      if (mi < 0) continue;
      const day = +dm[2];
      meetings.push({
        date: `${mk.year}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        label: `${monthTxt} ${dm[1]}–${dm[2]}, ${mk.year}`,
        sep: dateTxt.includes("*")
      });
    }
  });
  meetings.sort((a, b) => a.date.localeCompare(b.date));
  if (meetings.length < 8) throw new Error("Fed calendar: too few meetings parsed");
  calendarCache = { at: Date.now(), meetings };
  return meetings;
}

// -------------------------------------------------------------- futures
function contractSymbol(year, monthIdx) {
  return `ZQ${MONTH_CODES[monthIdx]}${String(year).slice(2)}.CBT`;
}

async function fetchFuture(year, monthIdx) {
  const symbol = contractSymbol(year, monthIdx);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`${symbol} HTTP ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  const ts = res?.timestamp || [];
  const closes = res?.indicators?.quote?.[0]?.close || [];
  for (let i = ts.length - 1; i >= 0; i--) {
    if (Number.isFinite(closes[i])) {
      const price = +closes[i].toFixed(4);
      return {
        symbol,
        price,
        rate: +(100 - price).toFixed(4),
        date: new Date(ts[i] * 1000).toISOString().slice(0, 10)
      };
    }
  }
  throw new Error(`${symbol}: no price`);
}

// ----------------------------------------------------------------- FRED
async function fredLatest(seriesId) {
  const since = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const r = await fetch(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${since}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketEntryTrigger/1.0)" }
  });
  if (!r.ok) throw new Error(`FRED ${seriesId} HTTP ${r.status}`);
  const rows = (await r.text()).trim().split("\n").slice(1)
    .map(l => l.split(",")).filter(([, v]) => v && !isNaN(parseFloat(v)));
  if (!rows.length) throw new Error(`FRED ${seriesId} empty`);
  const [date, v] = rows[rows.length - 1];
  return { date, value: parseFloat(v) };
}

// --------------------------------------------------------------- helpers
const ym = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const shift = (y, m, n) => { const i = y * 12 + m + n; return [Math.floor(i / 12), i % 12]; };
const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function outcomesFromChange(changePct, lower, upper) {
  // Split the expected change across the two nearest 25bp steps.
  const n = changePct / STEP;
  const k = Math.floor(n + 1e-9);
  const frac = Math.max(0, Math.min(1, n - k));
  const out = [];
  const add = (steps, prob) => {
    if (prob < 0.005) return;
    out.push({
      steps,
      changeBp: steps * 25,
      lower: +(lower + steps * STEP).toFixed(2),
      upper: +(upper + steps * STEP).toFixed(2),
      prob: +prob.toFixed(4)
    });
  };
  add(k, 1 - frac);
  add(k + 1, frac);
  return out.sort((a, b) => b.prob - a.prob);
}

// --------------------------------------------------------------- handler
export default async function handler(req, res) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [meetings, effr, tgtU, tgtL] = await Promise.all([
      fetchMeetings(),
      fredLatest("EFFR").catch(() => null),
      fredLatest("DFEDTARU"),
      fredLatest("DFEDTARL")
    ]);

    // Next meeting whose decision hasn't happened yet.
    const next = meetings.find(mt => mt.date >= today);
    if (!next) throw new Error("No upcoming FOMC meeting on the Fed calendar");
    const [Y, Mo, D] = next.date.split("-").map(Number);
    const M = Mo - 1;
    const N = daysIn(Y, M);
    const meetingMonths = new Set(meetings.map(mt => mt.date.slice(0, 7)));
    const [py, pm] = shift(Y, M, -1);
    const [ny, nm] = shift(Y, M, +1);
    const prevClean = !meetingMonths.has(ym(py, pm));
    const nextClean = !meetingMonths.has(ym(ny, nm));

    const cur = await fetchFuture(Y, M);
    let method, start, end, ref;
    // Prefer the observed side that keeps the solve stable: a late-month
    // meeting leaves few post-meeting days, so derive from the next month.
    // A decision on the month's last day leaves no post-meeting days in M,
    // so the only usable observation of the new rate is the next contract.
    const preferNext = (nextClean && (D / N >= 0.5 || !prevClean)) || D >= N;
    if (preferNext) {
      ref = await fetchFuture(ny, nm);
      method = "next-month";
      end = ref.rate;
      // With D = N the meeting month is entirely pre-decision: avg(M) = start.
      start = D >= N ? cur.rate : (cur.rate - end * (N - D) / N) * N / D;
    } else if (prevClean) {
      ref = await fetchFuture(py, pm);
      method = "prior-month";
      start = ref.rate;
      end = (cur.rate - start * D / N) * N / (N - D);
    } else {
      if (!effr) throw new Error("No clean adjacent month and EFFR unavailable");
      method = "effr";
      ref = { symbol: "EFFR", rate: effr.value, date: effr.date };
      start = effr.value;
      end = (cur.rate - start * D / N) * N / (N - D);
    }

    const change = end - start;
    const outcomes = outcomesFromChange(change, tgtL.value, tgtU.value);
    const sum = pred => +outcomes.filter(pred).reduce((a, o) => a + o.prob, 0).toFixed(4);
    const pHike = sum(o => o.steps > 0);
    const pCut  = sum(o => o.steps < 0);
    const pHold = sum(o => o.steps === 0);

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({
      asOf: cur.date,
      nextMeeting: next,
      currentRange: { lower: tgtL.value, upper: tgtU.value, date: tgtU.date },
      effr,
      method,
      contracts: { meetingMonth: cur, reference: ref },
      impliedStart: +start.toFixed(4),
      impliedEnd: +end.toFixed(4),
      expectedChangeBp: +(change * 100).toFixed(1),
      outcomes,
      pHike, pHold, pCut,
      mostLikely: outcomes[0],
      upcoming: meetings.filter(mt => mt.date >= today).slice(0, 4)
    });
  } catch (err) {
    return res.status(502).json({ error: String(err.message || err) });
  }
}
