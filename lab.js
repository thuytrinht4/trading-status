"use strict";
// The lab page: the PC lab's M5 gold strategies (data/lab/, written by C:\MTLab\research\r8\chart_export_lab.py) drawn as the
// hourly chart draws the Mac's. Self-contained: it shares styles.css and the lightweight-charts build with index.html only.
(function () {
  const LWC = window.LightweightCharts;
  const SCOL = { LAB_V1_T0: "#c6ff00", LAB_V1_S6: "#a78bfa", LAB_V1_ADX22: "#ffd54f", LAB_V1_S6_ADX22: "#ff80ab", LAB_PDB_HALF_B: "#ff9800", LAB_ARB_HALF_B: "#00bcd4", LAB_REGIME60: "#1e90ff", LAB_GOLD_EA: "#8bc34a", LAB_BTC_WK_L: "#f7931a", LAB_REGIME_C: "#40c4ff", LAB_BTC_WE_BIG: "#ffab40", LAB_REGIME_C_BEAR_SKIP: "#00e676", LAB_REGIME_C_BEAR_SELL: "#ea80fc" };
  const SHORT = { LAB_V1_T0: "v1 T0", LAB_V1_S6: "v1 S6", LAB_V1_ADX22: "v1 ADX", LAB_V1_S6_ADX22: "S6+ADX", LAB_PDB_HALF_B: "PDB", LAB_ARB_HALF_B: "ARB", LAB_REGIME60: "REGIME", LAB_GOLD_EA: "gold EA", LAB_BTC_WK_L: "BTC wk", LAB_REGIME_C: "REGIME C", LAB_BTC_WE_BIG: "BTC wk-end", LAB_REGIME_C_BEAR_SKIP: "ATLAS set", LAB_REGIME_C_BEAR_SELL: "C bear-sell" };
  SCOL.LIVE_GOLD = "#ff4081"; SHORT.LIVE_GOLD = "LIVE";   // your real gold trades (WeekSetup\lab_nightly.py), beside the lab's
  const offChart = (sid) => !!D.strat[sid].symbol;      // a leg on another symbol (BTC): tables and panes only
  const C = { buy: "#1e90ff", sell: "#ff3b30", win: "#00c853", loss: "#ff1744", eod: "#9e9e9e", sl: "#ff3b30", tp: "#00c853", grey: "#7a7a7a", text: "#ffffff" };
  const TFS = ["M15", "H1", "H4", "D1"];
  const BARS_SHOWN = { M15: 300, H1: 230, H4: 130, D1: 120 };
  const state = { tf: "H1", sid: "LAB_V1_T0", period: "all", risk: 1.0, account: 10000, sel: null };
  let D = null, view = null;
  let chart, candles, markersApi, overlay, regBand, regAsia, regDay, dayHist, mixLine;
  // news: the gold leg's risk multiplier on NFP / CPI / FOMC days (gold_news_m5.py: x0.5 lifts the E8 pass chance, x1.5-2 cuts it)
  const mix = { gold: "LAB_V1_S6", gr: 0.75, br: 0.5, we: "LAB_BTC_WE_BIG", wr: 0.5, news: 0.5, cap: true };
  const PRESETS = [
    ["today: gold EA 0.75 + BTC 0.5", { gold: "LAB_GOLD_EA", gr: 0.75, br: 0.5, we: "none", wr: 0, news: 1 }],
    ["S6 0.75 + BTC 0.5", { gold: "LAB_V1_S6", gr: 0.75, br: 0.5, we: "none", wr: 0, news: 1 }],
    ["S6 + BTC + news x0.5", { gold: "LAB_V1_S6", gr: 0.75, br: 0.5, we: "none", wr: 0, news: 0.5 }],
    ["BEST: S6 + BTC + news x0.5 + weekend 0.5", { gold: "LAB_V1_S6", gr: 0.75, br: 0.5, we: "LAB_BTC_WE_BIG", wr: 0.5, news: 0.5 }],
    ["REGIME C 0.75 + BTC + news x0.5 + weekend", { gold: "LAB_REGIME_C", gr: 0.75, br: 0.5, we: "LAB_BTC_WE_BIG", wr: 0.5, news: 0.5 }],
    ["S6 alone 1 %", { gold: "LAB_V1_S6", gr: 1.0, br: 0, we: "none", wr: 0, news: 1 }],
    ["ATLAS set (28 Oct): REGIME C + bear skip, 1.1 % gold only, news x0 (untick the E8 cap: Atlas has none)", { gold: "LAB_REGIME_C_BEAR_SKIP", gr: 1.1, br: 0, we: "none", wr: 0, news: 0 }],
    ["REGIME C + bear sell-only, 1.1 % gold only, news x0", { gold: "LAB_REGIME_C_BEAR_SELL", gr: 1.1, br: 0, we: "none", wr: 0, news: 0 }],
  ];
  const cumLines = {}; let priceLines = [];
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fR = (r) => (r >= 0 ? "+" : "") + r.toFixed(2) + "R";
  const fUsd = (v) => (v < 0 ? "-$" : "$") + Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
  const fPx = (p) => (p === null || p === undefined ? "—" : Number(p).toFixed(2));
  const usd = (r) => r * state.risk / 100 * state.account;
  const fPct = (r) => (r * state.risk >= 0 ? "+" : "") + (r * state.risk).toFixed(2) + " %";
  const fMoney = (r) => `${fUsd(usd(r))} (${fPct(r)})`;
  const cls = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  const pc1 = (x) => (100 * x).toFixed(1) + " %";
  function fmtTime(t, withTime = true) {
    const d = new Date(t * 1000); const p = (x) => String(x).padStart(2, "0");
    const day = `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
    return withTime ? `${day} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : day;
  }
  function barIndex(times, t) {
    let lo = 0, hi = times.length - 1, ans = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (times[mid] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }
  const exitGroup = (code) => (code.startsWith("TGT") ? "target" : code.startsWith("STP") ? "stop" : "eod");
  const periodOf = (id) => D.meta.periods.find((p) => p[0] === id);
  const inPeriod = (d, p) => p[2] === null || (d >= p[2] && d <= p[3]);

  // ---------- data ----------
  async function getJSON(p) {
    // the status website's Lab tab hands over the whole set, decrypted, as window.LAB_BUNDLE {file name: content}
    if (window.LAB_BUNDLE) { const k = p.replace(/^data\/lab\//, ""); if (k in window.LAB_BUNDLE) return window.LAB_BUNDLE[k]; throw new Error(`${p}: not in the bundle`); }
    const r = await fetch(p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json();
  }
  async function load() {
    const meta = await getJSON("data/lab/meta.json");
    const [days, signal, signalC, events, instant, ...rest] = await Promise.all([getJSON("data/lab/days.json"), getJSON("data/lab/signal.json"), getJSON("data/lab/signal_c.json").catch(() => null), getJSON("data/lab/events.json").catch(() => ({})), getJSON("data/lab/instant.json").catch(() => null),
      ...TFS.map((tf) => getJSON(`data/lab/bars_${tf}.json`)), ...meta.sids.map((sid) => getJSON(`data/lab/trades_${sid}.json`))]);
    D = { meta, days, signal, signalC, events, instant, bars: {}, strat: {}, trade: {}, skip: {}, dayOff: new Map() };
    TFS.forEach((tf, i) => { D.bars[tf] = rest[i]; });
    meta.sids.forEach((sid, i) => {
      const s = rest[TFS.length + i]; D.strat[sid] = s;
      D.trade[sid] = new Map(s.trades.map((t, k) => [t.d, k])); D.skip[sid] = new Map(s.skips.map((q) => [q.d, q]));
    });
    D.bars.D1.t.forEach((t, i) => D.dayOff.set(fmtTime(t, false), D.bars.D1.off[i]));
    D.dayIx = new Map(days.map((d, i) => [d.d, i]));
  }

  // ---------- the view: bar indices for every trade on the selected timeframe ----------
  function buildView(tf) {
    const b = D.bars[tf]; const times = b.t; const n = times.length;
    const barDay = new Array(n); const dayFirst = new Map(); const dayLast = new Map();
    let k = 0;
    for (let i = 0; i < D.days.length; i++) {
      const day = D.days[i]; const next = i + 1 < D.days.length ? D.days[i + 1].t : Infinity;
      while (k < n && times[k] < day.t) k++;
      const first = k;
      while (k < n && times[k] < next) { barDay[k] = day.d; k++; }
      if (k > first) { dayFirst.set(day.d, first); dayLast.set(day.d, k - 1); }
    }
    const ix = (t) => (t === null || t === undefined ? null : barIndex(times, t));
    const geo = {};
    for (const sid of D.meta.sids) {
      geo[sid] = {
        trades: D.strat[sid].trades.map((t) => ({ fi: ix(t.ft), xi: ix(t.xt), pi: ix(t.pt), wi: ix(t.we - 1), r0: ix(t.r0), r1: ix(t.r1) })),
        skips: D.strat[sid].skips.map((s) => ({ pi: ix(s.pt), wi: ix(s.we === undefined ? null : s.we - 1), r0: ix(s.r0), r1: ix(s.r1) })),
      };
    }
    return { tf, times, barDay, dayFirst, dayLast, geo };
  }

  // ---------- the chart ----------
  function makeChart() {
    chart = LWC.createChart($("chart"), {
      autoSize: true,
      layout: { background: { type: "solid", color: "#000000" }, textColor: "#ffffff", fontSize: 11, fontFamily: 'Tahoma, "Segoe UI", Verdana, sans-serif', panes: { separatorColor: "#3a3a3a", enableResize: true } },
      grid: { vertLines: { color: "rgba(119,136,153,0.35)", style: LWC.LineStyle.Dotted }, horzLines: { color: "rgba(119,136,153,0.35)", style: LWC.LineStyle.Dotted } },
      crosshair: { mode: LWC.CrosshairMode.Normal, vertLine: { color: "#c8c8c8", style: LWC.LineStyle.Dotted, labelBackgroundColor: "#303030" }, horzLine: { color: "#c8c8c8", style: LWC.LineStyle.Dotted, labelBackgroundColor: "#303030" } },
      rightPriceScale: { borderColor: "#3a3a3a" },
      timeScale: { borderColor: "#3a3a3a", timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 7 },
      localization: { timeFormatter: (t) => fmtTime(t, state.tf !== "D1") },
    });
    candles = chart.addSeries(LWC.CandlestickSeries, { upColor: "#000000", borderUpColor: "#00ff00", wickUpColor: "#00ff00", downColor: "#ffffff", borderDownColor: "#ffffff", wickDownColor: "#ffffff",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 }, priceLineVisible: false });
    markersApi = LWC.createSeriesMarkers(candles, []);
    overlay = new Overlay(); candles.attachPrimitive(overlay);
    const common = { priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "price", precision: 2, minMove: 0.01 } };
    regBand = chart.addSeries(LWC.HistogramSeries, { ...common, base: 0 }, 1);
    regAsia = chart.addSeries(LWC.LineSeries, { ...common, color: "#00bcd4", lineWidth: 1, title: "asia cont.", lastValueVisible: true }, 1);
    regDay = chart.addSeries(LWC.LineSeries, { ...common, color: "#ff9800", lineWidth: 1, title: "day cont.", lastValueVisible: true }, 1);
    dayHist = chart.addSeries(LWC.HistogramSeries, { ...common, base: 0, title: "trade R" }, 2);
    for (const sid of D.meta.sids) cumLines[sid] = chart.addSeries(LWC.LineSeries, { ...common, color: SCOL[sid], lineWidth: 1, title: SHORT[sid], lastValueVisible: true }, 3);
    mixLine = chart.addSeries(LWC.LineSeries, { ...common, color: "#ffffff", lineWidth: 2, title: "mix %", lastValueVisible: true }, 4);
    const share = [10, 1, 1.1, 1.9, 1.4];
    chart.panes().forEach((p, i) => { if (share[i] !== undefined) p.setStretchFactor(share[i]); });
    chart.subscribeCrosshairMove(onCrosshair); chart.subscribeClick(onClick);
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => { if (view && labelsOn() !== lastLabels) renderStrategy(); });
  }
  let lastLabels = null;
  function labelsOn() {
    if (state.tf === "H4" || state.tf === "D1") return false;
    const r = chart.timeScale().getVisibleLogicalRange(); if (!r) return true;
    return ($("chart").clientWidth - 60) / Math.max(1, r.to - r.from) >= 6;
  }

  function setTimeframe(tf, keepRange = true) {
    let centre = null;
    if (keepRange && view) { const r = chart.timeScale().getVisibleLogicalRange(); if (r) centre = view.times[Math.max(0, Math.min(view.times.length - 1, Math.round((r.from + r.to) / 2)))]; }
    state.tf = tf; view = buildView(tf);
    const b = D.bars[tf];
    markersApi.setMarkers([]);
    candles.setData(b.t.map((t, i) => ({ time: t, open: b.o[i], high: b.h[i], low: b.l[i], close: b.c[i] })));
    renderStrategy(); renderPanes();
    document.querySelectorAll(".tf").forEach((el) => el.classList.toggle("active", el.dataset.tf === tf));
    if (centre !== null) { const c = Math.max(0, barIndex(view.times, centre)); const half = BARS_SHOWN[tf] / 2; chart.timeScale().setVisibleLogicalRange({ from: c - half, to: c + half }); }
    updateCaption(null);
  }

  // ---------- markers and panes ----------
  function renderStrategy() {
    const st = D.strat[state.sid]; const g = view.geo[state.sid]; const text = labelsOn(); const list = [];
    if (!offChart(state.sid)) st.trades.forEach((t, k) => {
      const q = g.trades[k]; if (q.fi < 0 || q.xi < 0) return;
      const L = t.side === "L"; const grp = exitGroup(t.xr);
      list.push({ time: view.times[q.fi], position: L ? "atPriceBottom" : "atPriceTop", price: t.fp, shape: L ? "arrowUp" : "arrowDown", color: L ? C.buy : C.sell, size: 1, text: text ? `${L ? "B" : "S"} ${t.fp.toFixed(2)}` : "", id: `e${k}` });
      list.push({ time: view.times[q.xi], position: "atPriceMiddle", price: t.xp, shape: grp === "stop" ? "square" : "circle", color: grp === "target" ? C.win : grp === "stop" ? C.loss : C.eod,
        size: text ? (grp === "eod" ? 0.6 : 0.85) : 1, text: text ? fR(t.rn) : "", id: `x${k}` });
    });
    list.sort((a, b) => a.time - b.time);
    lastLabels = text; markersApi.setMarkers(list);
    requestAnimationFrame(() => markersApi.setMarkers(list));
    overlay.refresh(); renderSelection();
  }

  function renderPanes() {
    const band = [], asia = [], day = [];
    for (const s of (state.sid === "LAB_REGIME_C" && D.signalC ? D.signalC : D.signal)) {
      const i = view.dayFirst.get(s.d); if (i === undefined) continue;
      const color = s.pk === "ARB" ? "rgba(0,188,212,0.22)" : "rgba(255,152,0,0.22)";
      for (let j = i; j <= view.dayLast.get(s.d); j++) band.push({ time: view.times[j], value: 1, color });
      asia.push({ time: view.times[i], value: s.ca }); day.push({ time: view.times[i], value: s.cd });
    }
    regBand.setData(band); regAsia.setData(asia); regDay.setData(day);
    renderDayPanes();
  }

  function renderDayPanes() {
    const hist = [];
    for (const sid of D.meta.sids) {
      const st = D.strat[sid]; const g = view.geo[sid]; const pts = []; let cum = 0; let lastT = null;
      st.trades.forEach((t, k) => {
        const xi = g.trades[k].xi; if (xi < 0) return;
        cum += t.rn; const tt = view.times[xi];
        if (tt === lastT) pts[pts.length - 1].value = cum; else pts.push({ time: tt, value: cum });
        lastT = tt;
        if (sid === state.sid) { const grp = exitGroup(t.xr); hist.push({ time: tt, value: t.rn, color: grp === "target" ? C.win : grp === "stop" ? C.loss : C.eod }); }
      });
      cumLines[sid].setData(pts);
      cumLines[sid].applyOptions({ lineWidth: sid === state.sid ? 2 : 1, color: sid === state.sid ? SCOL[sid] : SCOL[sid] + "99" });
    }
    // two trades can share a bar on H4 / D1 (never on one strategy's day, but keep the series strictly increasing)
    const merged = []; for (const h of hist) { if (merged.length && merged[merged.length - 1].time === h.time) merged[merged.length - 1].value += h.value; else merged.push(h); }
    dayHist.setData(merged);
    renderMixLine();
  }
  function renderMixLine() {
    const m = mixSeries(); const pts = []; let cum = 0;
    let lastT = null;
    for (const r of m.rows) {
      if (!r.active) continue;
      let i = view.dayLast.get(r.d); if (i === undefined) i = barIndex(view.times, Date.parse(r.d + "T23:59:00Z") / 1000); if (i < 0) continue;
      cum += r.pct; const tt = view.times[i];
      if (tt === lastT) pts[pts.length - 1].value = cum; else pts.push({ time: tt, value: cum });
      lastT = tt;
    }
    mixLine.setData(pts);
  }

  // ---------- the overlay: reference boxes, levels, SL / TP, entry -> exit ----------
  class Overlay {
    constructor() { this._views = [new OverlayView("bottom"), new OverlayView("normal")]; this._req = null; }
    attached(p) { this._req = p.requestUpdate; } detached() { this._req = null; } updateAllViews() {} paneViews() { return this._views; } refresh() { if (this._req) this._req(); }
  }
  class OverlayView { constructor(layer) { this._layer = layer; } zOrder() { return this._layer; } renderer() { const layer = this._layer; return { draw: (target) => drawOverlay(target, layer) }; } }

  function drawOverlay(target, layer) {
    if (!view) return;
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const ts = chart.timeScale(); const vr = ts.getVisibleLogicalRange(); if (!vr) return;
      const x = (i) => ts.logicalToCoordinate(i); const y = (p) => candles.priceToCoordinate(p);
      const x0 = x(Math.floor(vr.from)), x1 = x(Math.floor(vr.from) + 1);
      const bs = x0 !== null && x1 !== null ? Math.max(1, x1 - x0) : 6;
      const st = D.strat[state.sid]; const g = view.geo[state.sid]; if (offChart(state.sid)) return;
      const lo = vr.from - 3, hi = vr.to + 3;
      const visible = (a, b) => a !== null && b !== null && a !== undefined && b !== undefined && b >= lo && a <= hi;
      const fine = state.tf === "M15" || state.tf === "H1";
      if (layer === "bottom") {
        const box = (r0, r1, rh, rl, rule) => {
          if (r0 === null || r1 === null || r0 < 0 || rh === undefined || rh === null || !visible(r0, r1)) return;
          const xa = x(r0) - bs / 2, xb = x(r1) + bs / 2, ya = y(rh), yb = y(rl); if (xa === null || ya === null || yb === null) return;
          ctx.fillStyle = rule === "ARB" ? "rgba(0,188,212,0.10)" : "rgba(255,152,0,0.08)"; ctx.fillRect(xa, ya, xb - xa, yb - ya);
          ctx.strokeStyle = rule === "ARB" ? "rgba(0,188,212,0.45)" : "rgba(255,152,0,0.4)"; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.strokeRect(xa, ya, xb - xa, yb - ya);
        };
        // scheduled US releases (NFP / CPI / FOMC): a faint yellow column over the broker day, label at the top on the fine views
        for (const [d, evs] of Object.entries(D.events)) {
          const a = view.dayFirst.get(d), b2 = view.dayLast.get(d); if (a === undefined || !visible(a, b2)) continue;
          const xa = x(a) - bs / 2, xb = x(b2) + bs / 2; if (xa === null || xb === null) continue;
          ctx.fillStyle = "rgba(255,213,79,0.07)"; ctx.fillRect(xa, 0, xb - xa, mediaSize.height);
          if (fine || bs >= 4) { ctx.font = '10px Tahoma, "Segoe UI", sans-serif'; ctx.fillStyle = "rgba(255,213,79,0.8)"; ctx.fillText(evs.map((e) => e.ev).join("+"), xa + 3, 12); }
        }
        if (!fine) st.trades.forEach((t) => {
          const a = view.dayFirst.get(t.d), b = view.dayLast.get(t.d); if (a === undefined || !visible(a, b)) return;
          const xa = x(a) - bs / 2, xb = x(b) + bs / 2; if (xa === null || xb === null) return;
          ctx.fillStyle = t.rn > 0 ? "rgba(0,200,83,0.13)" : "rgba(255,23,68,0.13)"; ctx.fillRect(xa, 0, xb - xa, mediaSize.height);
        });
        st.trades.forEach((t, k) => { const q = g.trades[k]; if ((fine || state.sel === k) && visible(q.r0, q.xi)) box(q.r0, q.r1, t.rh, t.rl, t.rule); });
        if (fine) st.skips.forEach((s, k) => { const q = g.skips[k]; if (s.rh !== undefined && q.wi !== null && visible(q.r0, q.wi)) box(q.r0, q.r1, s.rh, s.rl, s.rule); });
        return;
      }
      const seg = (xa, xb, py, color, dash, width = 1) => { const yy = y(py); if (yy === null || xa === null || xb === null) return; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(xa, yy); ctx.lineTo(xb, yy); ctx.stroke(); };
      const label = (tx, px, py, color) => { ctx.font = '10px Tahoma, "Segoe UI", sans-serif'; ctx.fillStyle = color; ctx.setLineDash([]); ctx.fillText(tx, px, py); };
      // armed levels on days without a fill (grey)
      if (fine) st.skips.forEach((s, k) => {
        const q = g.skips[k]; if (q.pi === null || q.pi < 0 || q.wi === null || !visible(q.pi, q.wi)) return;
        const xa = x(q.pi) - bs / 2, xb = x(q.wi) + bs / 2;
        if (s.eL !== undefined && s.eL !== null) seg(xa, xb, s.eL, s.v && s.v.startsWith("ADX") ? "#ffd54f88" : C.grey, [2, 3]);
        if (s.eS !== undefined && s.eS !== null) seg(xa, xb, s.eS, C.grey, [2, 3]);
      });
      st.trades.forEach((t, k) => {
        const q = g.trades[k]; if (q.fi < 0 || q.xi < 0 || !visible(Math.min(q.pi ?? q.fi, q.fi), q.xi)) return;
        const sel = state.sel === k; const L = t.side === "L"; const w = sel ? 2 : 1; const full = fine || sel;
        const same = q.fi === q.xi; const xe = x(q.fi) - (same ? bs * 0.3 : 0), xx = x(q.xi) + (same ? bs * 0.3 : 0);
        if (full && q.pi !== null && q.pi >= 0) {
          const xp = x(q.pi) - bs / 2, xf = x(q.fi);
          const filled = L ? t.eL : t.eS, other = L ? t.eS : t.eL;
          if (filled !== undefined && filled !== null) seg(xp, xf, filled, L ? C.buy : C.sell, [2, 3]);
          if (other !== undefined && other !== null) {
            seg(xp, xf, other, C.grey, [2, 3]); const yo = y(other);
            if (yo !== null && xf !== null && bs >= 3) { ctx.strokeStyle = C.grey; ctx.setLineDash([]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xf - 3, yo - 3); ctx.lineTo(xf + 3, yo + 3); ctx.moveTo(xf + 3, yo - 3); ctx.lineTo(xf - 3, yo + 3); ctx.stroke(); }
          }
        }
        const xa = x(q.fi) - bs * 0.45, xb = x(q.xi) + bs * 0.45;
        if (full) { seg(xa, xb, t.st, C.sl, [5, 3], w); seg(xa, xb, t.tg, C.tp, [5, 3], w); }
        if (full && (bs >= 7 || sel)) { const ys = y(t.st), yt = y(t.tg); if (ys !== null) label("sl", xa, ys - 2, C.sl); if (yt !== null) label("tp", xa, yt - 2, C.tp); }
        const ye = y(t.fp), yx = y(t.xp);
        if (ye !== null && yx !== null && xe !== null && xx !== null) {
          ctx.strokeStyle = L ? C.buy : C.sell; ctx.lineWidth = w; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(xe, ye); ctx.lineTo(xx, yx); ctx.stroke();
          if (bs >= 9 || sel) {
            const txt = `${fR(t.rn)}  ${fMoney(t.rn)}`; ctx.font = '11px Tahoma, "Segoe UI", sans-serif'; ctx.setLineDash([]);
            const wTxt = ctx.measureText(txt).width + 8; const bx = xx + 9, by = yx - 8;
            ctx.fillStyle = t.rn > 0 ? "rgba(0,120,50,0.85)" : "rgba(160,20,40,0.85)"; ctx.fillRect(bx, by, wTxt, 16); ctx.fillStyle = C.text; ctx.fillText(txt, bx + 4, by + 12);
          }
        }
      });
    });
  }

  // ---------- selection ----------
  function select(k, scroll) {
    state.sel = k; renderSelection();
    if (k === null) { overlay.refresh(); showDay(null); return; }
    const t = D.strat[state.sid].trades[k];
    if (scroll) { const q = view.geo[state.sid].trades[k]; const pad = state.tf === "M15" ? 60 : state.tf === "H1" ? 40 : 25; const a = Math.min(q.r0 ?? q.fi, q.fi); chart.timeScale().setVisibleLogicalRange({ from: a - pad, to: q.xi + pad }); }
    overlay.refresh(); showDay(t.d);
    document.querySelectorAll("#panel-history tr[data-k]").forEach((tr) => tr.classList.toggle("sel", Number(tr.dataset.k) === k));
    const row = document.querySelector(`#panel-history tr[data-k="${k}"]`); if (row && scroll) row.scrollIntoView({ block: "nearest" });
  }
  function renderSelection() {
    priceLines.forEach((p) => candles.removePriceLine(p)); priceLines = [];
    if (state.sel === null) return;
    const t = D.strat[state.sid].trades[state.sel]; if (!t || offChart(state.sid)) return;
    const pl = (price, color, title) => candles.createPriceLine({ price, color, lineWidth: 1, lineStyle: LWC.LineStyle.Dashed, axisLabelVisible: true, title });
    priceLines.push(pl(t.fp, t.side === "L" ? C.buy : C.sell, t.side === "L" ? "buy" : "sell")); priceLines.push(pl(t.st, C.sl, "sl")); priceLines.push(pl(t.tg, C.tp, "tp"));
  }
  const tradesInPeriod = (sid = state.sid) => { const p = periodOf(state.period); return D.strat[sid].trades.map((t, k) => [t, k]).filter(([t]) => inPeriod(t.d, p)); };
  function step(dir) {
    const list = tradesInPeriod(); if (!list.length) return;
    let pos = list.findIndex(([, k]) => k === state.sel);
    if (pos < 0) {
      const r = chart.timeScale().getVisibleLogicalRange(); const mid = r ? (r.from + r.to) / 2 : 0; const g = view.geo[state.sid].trades;
      pos = dir > 0 ? list.findIndex(([, k]) => g[k].fi >= mid) : list.length - 1 - [...list].reverse().findIndex(([, k]) => g[k].fi <= mid);
      if (pos < 0 || pos >= list.length) pos = dir > 0 ? 0 : list.length - 1;
    } else pos = Math.max(0, Math.min(list.length - 1, pos + dir));
    select(list[pos][1], true);
  }

  // ---------- hover / click ----------
  const barAt = (param) => { if (!param || param.logical === undefined || param.logical === null) return null; const i = Math.round(param.logical); return i >= 0 && i < view.times.length ? i : null; };
  function onCrosshair(param) {
    const i = param && param.point ? barAt(param) : null; updateCaption(i);
    if (i === null) { showDay(state.sel !== null ? D.strat[state.sid].trades[state.sel].d : null); return; }
    showDay(view.barDay[i], i);
  }
  function onClick(param) { const i = barAt(param); if (i === null) return; const k = D.trade[state.sid].get(view.barDay[i]); select(k === undefined ? null : k, false); }
  function updateCaption(i) {
    const b = D.bars[state.tf]; const j = i === null ? b.t.length - 1 : i; const st = D.strat[state.sid];
    $("caption").innerHTML = `<span class="sym">XAUUSD Exness lab M5 as ${state.tf}, E8 server time</span> · ${esc(st.name)}${offChart(state.sid) ? ' · <span class="ord-tag">BTC trades are not drawn on the gold candles: see History and Portfolio</span>' : ""}` +
      `<span class="ohlc">${fmtTime(b.t[j], state.tf !== "D1")}  O ${fPx(b.o[j])}  H ${fPx(b.h[j])}  L ${fPx(b.l[j])}  C ${fPx(b.c[j])}</span>`;
  }

  // ---------- data window ----------
  function showDay(d, barI) {
    const el = $("dw");
    if (!d) { el.innerHTML = `<p class="mut">Hover a candle, click one, or pick a trade in History.</p>`; return; }
    const st = D.strat[state.sid]; const R = D.meta.reasons; const rows = [];
    const off = D.dayOff.get(d) ?? 3;
    if (barI !== undefined && barI !== null) { const b = D.bars[state.tf]; rows.push(["bar", `${fmtTime(b.t[barI], state.tf !== "D1")} server (UTC+${off})`]); rows.push(["OHLC", `${fPx(b.o[barI])} / ${fPx(b.h[barI])} / ${fPx(b.l[barI])} / ${fPx(b.c[barI])}`]); }
    rows.push(["broker day", `${d} (New York 17:00 to 17:00; server = NY + 7 h)`]);
    if (D.events[d]) rows.push(["scheduled news", `<span class="flag-t">${D.events[d].map((e) => `${e.ev} at ${e.t} server`).join(", ")}</span> · the gold breakout's worst day type (S6 -0.015R on 91 fills against +0.138R elsewhere); the Portfolio tab sizes the gold leg x${mix.news} here`]);
    const k = D.trade[state.sid].get(d); let html = "";
    if (k !== undefined) {
      const t = st.trades[k]; const L = t.side === "L";
      const entryKey = st.entry === "V1_L" ? "V1_L" : st.entry === "S6_L" ? "S6_L" : st.entry === "BTCWE" ? `BTCWE_${t.side}` : st.entry === "BTC_L" ? "BTC_L" : st.entry === "EA_L" ? "EA_L" : `${t.rule}_${t.side}`;
      rows.push(["rule", t.rule + (t.pk ? ` (picked by the 60-day signal)` : "")]);
      rows.push(["side", `<span class="side-${t.side}">${L ? "BUY" : "SELL"}</span>`]);
      if (t.acc) rows.push(["your accounts", esc(t.acc).replace(/; /g, "<br>")]);
      rows.push(["reference", `${fPx(t.rh)} / ${fPx(t.rl)} (${t.rule === "ARB" ? "00-08 UTC Asian range" : "yesterday's high / low"})`]);
      rows.push(["levels", `buy ${fPx(t.eL)}${t.eS !== null && t.eS !== undefined ? ` · sell ${fPx(t.eS)}` : ""}${t.oco ? " (both filled in the day: the earlier one taken)" : ""}`]);
      rows.push(["fill", `${fmtTime(t.ft)} at ${fPx(t.fp)}${t.fb ? " (the level was crossed inside this bar)" : " (the bar opened beyond the level: filled at its open)"}`]);
      rows.push(["stop / target", `${fPx(t.st)} / ${fPx(t.tg)} · distance $${t.sd.toFixed(2)}/oz`]);
      rows.push(["exit", `${fmtTime(t.xt)} at ${fPx(t.xp)} <span class="badge ${exitGroup(t.xr)}">${t.xr}</span>`]);
      rows.push(["R", `gross ${fR(t.rg)} · cost ${t.c.toFixed(3)}R at E8's $${D.meta.e8_cost}/oz · <b class="${cls(t.rn)}">net ${fR(t.rn)}</b> = ${fMoney(t.rn)} at ${state.risk} % risk of ${fUsd(state.account)}`]);
      rows.push(["at the lab's cost", `${fR(t.rl_)} (the fill bar's spread + $0.04/oz)`]);
      if (t.w !== null && t.w !== undefined) rows.push(["worst floating", fR(t.w)]);
      if (t.r20 !== undefined) rows.push(["20-day return at the open", t.r20 === null ? "—" : `${(100 * t.r20).toFixed(2)} %${t.r20 < -0.03 ? " (a bear day under 3.2cf: the sell stop only)" : ""}`]);
      if (t.adx !== undefined) rows.push(["ADX(14) prior day", t.adx === null ? "—" : t.adx.toFixed(1) + (t.adx < 22 ? " (under 22: the ADX filter would skip this day)" : "")]);
      html = table(rows) + `<div class="dw-head">Why it entered</div><div class="dw-reason entry">${esc(R.entry[entryKey] || entryKey)}</div>` +
        `<div class="dw-head">Why it exited</div><div class="dw-reason exit">${esc(R.exit[t.xr] || t.xr)}</div>`;
    } else {
      const s = D.skip[state.sid].get(d);
      if (s) {
        rows.push(["no trade", `<span class="badge eod">${s.v}</span>${s.pk ? ` · signal picked ${s.pk}` : ""}`]);
        if (s.rh !== undefined && s.rh !== null) rows.push(["reference", `${fPx(s.rh)} / ${fPx(s.rl)}`]);
        if (s.eL !== undefined && s.eL !== null) rows.push(["levels", `buy ${fPx(s.eL)}${s.eS !== null && s.eS !== undefined ? ` · sell ${fPx(s.eS)}` : ""}`]);
        if (s.adx !== undefined) rows.push(["ADX(14) prior day", s.adx === null ? "—" : s.adx.toFixed(1)]);
        if (s.r20 !== undefined) rows.push(["20-day return at the open", s.r20 === null ? "—" : `${(100 * s.r20).toFixed(2)} %${s.r20 < -0.03 ? " (a bear day under 3.2cf)" : ""}`]);
        html = table(rows) + `<div class="dw-head">Why not</div><div class="dw-reason skip">${esc(R.skip[s.v] || s.v)}</div>`;
      } else {
        rows.push(["no trade", D.dayIx.has(d) ? "no record for this day in this strategy" : "not a weekday broker day"]);
        html = table(rows);
      }
    }
    el.innerHTML = html;
  }
  const table = (rows) => `<table class="dw-table">${rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${b}</td></tr>`).join("")}</table>`;

  // ---------- statistics ----------
  function stats(trades, period) {
    const rs = trades.map((t) => t.rn); const n = rs.length;
    const out = { n, E: null, win: null, pay: null, be: null, mix: { target: 0, stop: 0, eod: 0 }, tot: 0, dd: 0, streak: 0, perDay: null, days: 0 };
    if (!n) return out;
    const wn = rs.filter((r) => r > 0), ls = rs.filter((r) => r <= 0);
    out.E = rs.reduce((a, b) => a + b, 0) / n; out.win = wn.length / n;
    const aw = wn.length ? wn.reduce((a, b) => a + b, 0) / wn.length : null, al = ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : null;
    out.pay = aw !== null && al !== null && al !== 0 ? aw / Math.abs(al) : null; out.be = out.pay !== null ? 1 / (1 + out.pay) : null;
    trades.forEach((t) => { out.mix[exitGroup(t.xr)] += 1; });
    let cum = 0, peak = 0, cur = 0;
    for (const r of rs) { cum += r; peak = Math.max(peak, cum); out.dd = Math.max(out.dd, peak - cum); cur = r <= 0 ? cur + 1 : 0; out.streak = Math.max(out.streak, cur); }
    out.tot = cum;
    out.days = D.days.filter((d) => inPeriod(d.d, period)).length; out.perDay = out.days ? cum / out.days : null;
    return out;
  }
  const f3 = (x) => (x === null || x === undefined ? "—" : (x >= 0 ? "+" : "") + x.toFixed(3));
  const f2 = (x) => (x === null || x === undefined ? "—" : (x >= 0 ? "+" : "") + x.toFixed(2));
  function scoreRow(label, sid, p, current, attr) {
    const c = stats(D.strat[sid].trades.filter((t) => inPeriod(t.d, p)), p); const m = c.mix;
    const pct = (k) => (c.n ? pc1(m[k] / c.n) : "—");
    return `<tr class="clickable${current ? " current" : ""}"${attr}><td>${label}</td><td>${c.n}</td><td class="${cls(c.E ?? 0)}">${f3(c.E)}</td>` +
      `<td>${c.pay === null ? "—" : c.pay.toFixed(2)}</td><td>${c.be === null ? "—" : pc1(c.be)}</td><td>${c.win === null ? "—" : pc1(c.win)}${c.win !== null && c.be !== null ? `<div class="sub ${cls(c.win - c.be)}">${f2(100 * (c.win - c.be))} pt</div>` : ""}</td>` +
      `<td>${pct("target")} / ${pct("stop")} / ${pct("eod")}</td><td class="${cls(c.perDay ?? 0)}">${c.perDay === null ? "—" : (c.perDay * state.risk).toFixed(4) + " %"}<div class="sub">${c.days} days</div></td>` +
      `<td class="${cls(c.tot)}">${f2(c.tot)}<div class="sub">${fMoney(c.tot)}</div></td><td>${c.dd.toFixed(2)}R<div class="sub">${fMoney(-c.dd)}</div></td><td>${c.streak}</td></tr>`;
  }
  const scoreHead = (first) => `<thead><tr><th class="l">${first}</th><th>n</th><th>E (mean R)<br>at E8's cost</th><th>payoff<br>avg win / avg loss</th><th>break-even<br>win rate</th><th>win rate<br>(minus break-even)</th><th>exits<br>target / stop / day end</th><th>mean day %<br>at Risk %</th><th>total R<br>$ (% of account)</th><th>max closed<br>drawdown</th><th>longest<br>losing run</th></tr></thead>`;
  function renderPerf() {
    const p = periodOf(state.period);
    const left = D.meta.sids.map((sid) => scoreRow(`<span class="chip"><span class="dot" style="background:${SCOL[sid]}"></span>${esc(D.strat[sid].name)}</span>`, sid, p, sid === state.sid, ` data-sid="${sid}"`)).join("");
    const right = D.meta.periods.map((q) => scoreRow(esc(q[1]), state.sid, q, q[0] === state.period, ` data-period="${q[0]}"`)).join("");
    $("panel-perf").innerHTML = `<div class="perf-title">All lab strategies · ${esc(p[1])} · R at E8's $${D.meta.e8_cost}/oz, 'worst' inside the M5 bar · mean day % = total R x Risk % / weekday broker days in the period (the E8 money test's unit)</div>` +
      `<div class="score-wrap"><table class="grid score">${scoreHead("strategy")}${left}</table></div>` +
      `<div class="perf-title">${esc(D.strat[state.sid].name)} · by period</div><div class="score-wrap"><table class="grid score">${scoreHead("period")}${right}</table></div>`;
    $("panel-perf").querySelectorAll("tr[data-sid]").forEach((tr) => tr.addEventListener("click", () => setStrategy(tr.dataset.sid)));
    $("panel-perf").querySelectorAll("tr[data-period]").forEach((tr) => tr.addEventListener("click", () => setPeriod(tr.dataset.period)));
  }
  function renderHistory() {
    const p = periodOf(state.period); let cum = 0;
    const rows = tradesInPeriod().map(([t, k], i) => {
      cum += t.rn;
      return `<tr class="clickable${state.sel === k ? " sel" : ""}" data-k="${k}"><td class="l">${i + 1}</td><td class="l">${t.d}</td><td class="l">${t.rule}${t.pk ? "" : ""}</td><td class="l side-${t.side}">${t.side === "L" ? "buy" : "sell"}</td>` +
        `<td>${fmtTime(t.ft).slice(5)}</td><td>${fPx(t.fp)}</td><td>${fPx(t.st)}</td><td>${fPx(t.tg)}</td><td>${fmtTime(t.xt).slice(5)}</td><td>${fPx(t.xp)}</td><td class="l"><span class="badge ${exitGroup(t.xr)}">${t.xr}</span></td>` +
        `<td class="${cls(t.rn)}">${fR(t.rn)}</td><td class="${cls(t.rn)}">${fUsd(usd(t.rn))}</td><td class="${cls(cum)}">${f2(cum)}<span class="sub"> ${fMoney(cum).slice(fMoney(cum).indexOf("("))}</span></td>${(D.strat[state.sid].entry.startsWith("V1") || D.strat[state.sid].entry === "S6_L") ? `<td>${t.adx === null || t.adx === undefined ? "—" : t.adx.toFixed(1)}</td>` : ""}</tr>`;
    }).join("");
    const c = stats(tradesInPeriod().map(([t]) => t), p);
    const foot = `<div class="hist-foot"><span class="mut">${esc(D.strat[state.sid].name)} · ${esc(p[1])}:</span> n ${c.n} · E ${f3(c.E)} · payoff ${c.pay === null ? "—" : c.pay.toFixed(2)} (break-even ${c.be === null ? "—" : pc1(c.be)}) · win ${c.win === null ? "—" : pc1(c.win)} · total ${f2(c.tot)} = ${fMoney(c.tot)} · max closed drawdown ${c.dd.toFixed(2)}R = ${fMoney(-c.dd)} · longest losing run ${c.streak}</div>`;
    const adxH = (D.strat[state.sid].entry.startsWith("V1") || D.strat[state.sid].entry === "S6_L") ? "<th>ADX prior day</th>" : "";
    $("panel-history").innerHTML = `<table class="grid"><thead><tr><th class="l">#</th><th class="l">day</th><th class="l">rule</th><th class="l">side</th><th>fill time</th><th>fill</th><th>sl</th><th>tp</th><th>exit time</th><th>exit</th><th class="l">exit reason</th><th>R</th><th>$</th><th>cum R</th>${adxH}</tr></thead><tbody>${rows}</tbody></table>${foot}`;
    $("panel-history").querySelectorAll("tr[data-k]").forEach((tr) => tr.addEventListener("click", () => select(Number(tr.dataset.k), true)));
  }
  function renderDays() {
    const p = periodOf(state.period); const skips = D.strat[state.sid].skips.filter((s) => inPeriod(s.d, p));
    const counts = {}; skips.forEach((s) => { counts[s.v] = (counts[s.v] || 0) + 1; });
    const R = D.meta.reasons.skip;
    const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([v, n]) => `<tr><td class="l"><span class="badge eod">${v}</span></td><td>${n}</td><td class="l">${esc(R[v] || v)}</td></tr>`).join("");
    const rows = skips.map((s) => `<tr><td class="l">${s.d}</td><td class="l">${s.rule}${s.pk ? ` (signal ${s.pk})` : ""}</td><td class="l"><span class="badge eod">${s.v}</span></td><td>${s.rh !== undefined && s.rh !== null ? `${fPx(s.rh)} / ${fPx(s.rl)}` : "—"}</td><td>${s.eL !== undefined && s.eL !== null ? fPx(s.eL) : "—"}</td><td>${s.adx !== undefined ? (s.adx === null ? "—" : s.adx.toFixed(1)) : ""}</td></tr>`).join("");
    $("panel-days").innerHTML = `<div class="perf-title">${skips.length} weekday broker days without a trade · ${esc(p[1])}</div><table class="grid"><thead><tr><th class="l">reason</th><th>days</th><th class="l">what it means</th></tr></thead><tbody>${summary}</tbody></table>` +
      `<div class="perf-title">Day by day</div><table class="grid"><thead><tr><th class="l">day</th><th class="l">rule</th><th class="l">reason</th><th>reference</th><th>buy level</th><th>ADX</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  function renderAbout() {
    const m = D.meta;
    $("panel-about").innerHTML = `<div class="about">
      <h3>What this page shows</h3>
      Every trade the PC lab's gold strategies took on the Exness M5 XAUUSD bid bars (with the recorded spread), ${m.span[0]} to ${m.span[1]} (${m.n_days} weekday broker days), drawn as MT5 draws its trade history. The bars are the lab's: an Exness feed, not E8's, so candles differ a little from an E8 chart. Times are E8 server time (New York + 7 h, UTC+2 in US winter / +3 in US summer); H4 and D1 are built on that broker day. M15 is the finest view; the trades themselves were walked on M5 and the exit times are M5 times.
      <h3>The strategies</h3>
      ${m.sids.map((sid) => `<b style="color:${SCOL[sid]}">${esc(D.strat[sid].name)}</b>: ${esc(D.strat[sid].desc)} (${m.counts[sid]} trades).`).join("<br>")}
      <h3>Costs and ordering</h3>
      R is net of E8's $${m.e8_cost}/oz round trip (the value rr_V1_GOLD_L.json records); the data window also gives R at the lab's own cost (the fill bar's spread + $0.04/oz). Inside one M5 bar the ordering is 'worst': in the fill bar the low is read before the high, a later bar touching both levels is a stop, a bar opening beyond a level exits at its open. At the lab cost the PDB / ARB legs read ${f3(m.other_ordering_lab_E.best.PDB)} / ${f3(m.other_ordering_lab_E.best.ARB)} under 'best' (${f3(statsLab("LAB_PDB_HALF_B"))} / ${f3(statsLab("LAB_ARB_HALF_B"))} under the 'worst' shown).
      <h3>What was checked</h3>
      ${esc(m.checks)}. Generated ${m.generated} by <code>${esc(m.source)}</code>.
      <h3>Panes</h3>
      The Portfolio tab adds the legs the E8 money test runs together (pdhl_mix / e8_weekly_starts): a gold leg at its risk % plus the BTC weekday long at its risk %, in % of the initial balance a day, with E8's 2 % daily profit cap, the drawdown and streak figures, and the E8 Pro evaluation (+6 % before -6 %, a -2.5 % day a breach) walked from every start day; the white line in the bottom pane is its cumulative %. The regime signal (trailing 60-day shares of intraday continuation, cyan, and day-to-day continuation, orange; the band is cyan on days the signal picks ARB, orange on PDB days); each trade's R by exit reason; the cumulative R of every strategy (the selected one bold). Mean day % in the scorecard is total R x Risk % over the weekday broker days of the period, the unit of the E8 money test (pdhl_mix.portfolio).
      <h3>The instant account</h3>
      The Instant account tab (data/lab/instant.json, C:\\MTLab\\research\\r8\\chart_export_lab_instant.py, 28 Oct 2026) runs every gold strategy at each risk % through the Atlas Instant Funded 10K rules as the research reads them (atlas_accounts_m5.instant_funded, the walk re-checked against it) from every weekday start, and ranks the routes by the chance of losing the account among those that reach a first payout in at least half of the walks. The two bear-filter variants (3.2cf: no order, or the Asian-range sell stop only, when the 20-day return is under -3 %) are checked against trend_side_skip_m5 / bear_two_tier_m5 on every non-release day; the green ATLAS set is what runs on the account from 28 Oct.
      <h3>Rebuild</h3>
      <code>py -3 C:\\MTLab\\research\\r8\\chart_export_lab.py</code>, then reload.</div>`;
  }
  // ---------- the portfolio: gold leg x gold risk + BTC leg x BTC risk, % of the initial balance a day (pdhl_mix's unit) ----------
  function mixSeries(cfg = mix) {
    const g = D.strat[cfg.gold], b = D.strat["LAB_BTC_WK_L"], w = cfg.we && cfg.we !== "none" ? D.strat[cfg.we] : null;
    const gd = new Map(), bd = new Map(), wdm = new Map();
    g.trades.forEach((t) => gd.set(t.d, (gd.get(t.d) || 0) + t.rn)); b.trades.forEach((t) => bd.set(t.d, (bd.get(t.d) || 0) + t.rn));
    if (w) w.trades.forEach((t) => wdm.set(t.d, (wdm.get(t.d) || 0) + t.rn));
    const from = [g.trades[0].d, b.trades[0].d].sort()[1];
    const weekday = new Set(D.days.map((x) => x.d));
    // every calendar day from the first shared day to the last broker day: weekdays carry the gold and BTC legs, weekends the weekend leg
    const rows = []; const last = D.days[D.days.length - 1].d;
    for (let t = Date.parse(from + "T00:00:00Z"); ; t += 86400000) {
      const d = new Date(t).toISOString().slice(0, 10); if (d > last) break;
      const gr0 = gd.get(d) ?? null, br = bd.get(d) ?? null, wr = wdm.get(d) ?? null;
      const news = D.events[d] ? cfg.news : 1;                       // the gold leg's risk on a release day
      const gr = gr0 === null ? null : gr0 * news;
      const raw = (gr || 0) * cfg.gr + (br || 0) * cfg.br + (wr || 0) * cfg.wr;
      const active = weekday.has(d) || wr !== null;
      rows.push({ d, gr, br, wr, raw, pct: cfg.cap !== false && mix.cap ? Math.min(raw, 2.0) : raw, active, weekend: !weekday.has(d), news: !!D.events[d] });
    }
    return { rows, from };
  }
  function mixStats(rows) {
    const x = rows.map((r) => r.pct); const n = x.length; const act = rows.filter((r) => r.active);
    const out = { n: act.length, cal: n, weTrades: rows.filter((r) => r.wr !== null).length, mean: null, tot: 0, dd: 0, worst: 0, w5: 0, w10: 0, w20: 0, streak: 0, pass: null, fail: null, days: null, calDays: null };
    if (!n) return out;
    out.tot = x.reduce((a, b) => a + b, 0); out.mean = act.length ? out.tot / act.length : null; out.worst = Math.min(...x);
    let cum = 0, peak = 0, cur = 0; for (const v of x) { cum += v; peak = Math.max(peak, cum); out.dd = Math.max(out.dd, peak - cum); cur = v < 0 ? cur + 1 : 0; out.streak = Math.max(out.streak, cur); }
    for (const [k, key] of [[5, "w5"], [10, "w10"], [20, "w20"]]) { let s = 0; for (let i = 0; i < n; i++) { s += x[i]; if (i >= k) s -= x[i - k]; if (i >= k - 1) out[key] = Math.min(out[key], s); } }
    // E8 Pro evaluation from every start day: +6 % before -6 % static; a day at or under -2.5 % is a breach; 2 % a day counts (the cap above)
    // E8 Pro evaluation from every active start day over the next 560 calendar days (about 400 trading days)
    let passes = 0, fails = 0, starts = 0; const dpass = [], cpass = [];
    for (let s0 = 0; s0 < n; s0++) {
      if (!rows[s0].active) continue;
      let bal = 0, res = null, td = 0;
      for (let t = s0; t < Math.min(n, s0 + 560); t++) {
        if (rows[t].active) td++;
        const raw = rows[t].raw; if (raw <= -2.5) { res = "fail"; break; }
        bal += x[t]; if (bal >= 6) { res = "pass"; dpass.push(td); cpass.push(t - s0 + 1); break; } if (bal <= -6) { res = "fail"; break; }
      }
      if (res === null && s0 + 560 > n) continue;          // the walk ran out of data: not counted
      starts++; if (res === "pass") passes++; else if (res === "fail") fails++;
    }
    if (starts) {
      out.pass = passes / starts; out.fail = fails / starts; out.starts = starts; dpass.sort((a, b) => a - b); cpass.sort((a, b) => a - b);
      const q = (arr, f) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(f * arr.length))] : null);
      out.days = q(dpass, 0.5); out.calDays = q(cpass, 0.5); out.days25 = q(dpass, 0.25); out.days75 = q(dpass, 0.75); out.days90 = q(dpass, 0.9); out.daysMax = dpass.length ? dpass[dpass.length - 1] : null;
    }
    return out;
  }
  function renderPortfolio() {
    const el = $("panel-portfolio"); if (!el) return;
    const goldOpts = D.meta.sids.filter((sid) => !offChart(sid)).map((sid) => `<option value="${sid}"${sid === mix.gold ? " selected" : ""}>${esc(D.strat[sid].name)}</option>`).join("");
    const m = mixSeries(); const p = periodOf(state.period);
    const pct = (v, d = 2) => (v === null || v === undefined ? "—" : (v >= 0 ? "+" : "") + v.toFixed(d) + " %");
    const money = (v) => (v === null ? "—" : fUsd(v / 100 * state.account));
    const row = (label, rows, current) => {
      const c = mixStats(rows);
      return `<tr${current ? ' class="current"' : ""}><td>${label}</td><td>${c.n}<div class="sub">${c.weTrades} wk-end</div></td><td class="${cls(c.mean ?? 0)}">${pct(c.mean, 4)}</td><td class="${cls(c.tot)}">${pct(c.tot)}<div class="sub">${money(c.tot)}</div></td>` +
        `<td>${pct(-c.dd)}<div class="sub">${money(-c.dd)}</div></td><td>${pct(c.worst)}</td><td>${pct(c.w5)} / ${pct(c.w10)} / ${pct(c.w20)}</td><td>${c.streak}</td>` +
        `<td>${c.pass === null ? "—" : pc1(c.pass)}<div class="sub">${c.starts ?? 0} starts, ${c.fail === null ? "—" : pc1(c.fail)} fail</div></td><td>${c.days ?? "—"}<div class="sub">${c.calDays ?? "—"} calendar</div><div class="sub">p25 ${c.days25 ?? "—"} · p75 ${c.days75 ?? "—"} · p90 ${c.days90 ?? "—"} · max ${c.daysMax ?? "—"}</div></td></tr>`;
    };
    const head = `<thead><tr><th class="l">period</th><th>days</th><th>mean day %</th><th>total %<br>$</th><th>max closed<br>drawdown</th><th>worst day</th><th>worst 5 / 10 / 20 days</th><th>longest<br>losing run</th><th>E8 Pro pass %<br>(560-calendar-day walks)</th><th>trading days to pass<br>median of the passing walks<br>(one walk from EVERY active day)</th></tr></thead>`;
    const periods = D.meta.periods.map((q) => row(esc(q[1]), m.rows.filter((r) => inPeriod(r.d, q)), q[0] === state.period)).join("");
    const same = (c) => c.gold === mix.gold && c.gr === mix.gr && c.br === mix.br && c.we === mix.we && c.wr === mix.wr && c.news === mix.news;
    const presets = PRESETS.map(([name, c], i) => { const rows = mixSeries({ ...c, cap: mix.cap }).rows.filter((r) => inPeriod(r.d, p)); return row(`<span class="chip"${same(c) ? ' style="color:#00ff00"' : ""}>${esc(name)}</span>`, rows, same(c)).replace("<tr", `<tr class="clickable" data-preset="${i}"`); }).join("");
    let cum = 0, nday = 0, e8bal = 0, e8state = "running";
    const days = m.rows.filter((r) => inPeriod(r.d, p) && r.active).map((r) => { cum += r.pct; nday += 1;
      if (e8state === "running") { if (r.raw <= -2.5) e8state = `breach day ${nday}`; else { e8bal += r.pct; if (e8bal >= 6) e8state = `PASS day ${nday}`; else if (e8bal <= -6) e8state = `FAIL day ${nday}`; } }
      return `<tr${r.weekend ? ' class="s6row"' : ""}><td class="l">${r.d}${r.weekend ? " <span class=\"mut\">wk-end</span>" : ""}${r.news ? ` <span class="badge flag" title="${esc(D.events[r.d].map((e) => e.ev + " " + e.t).join(", "))}">${D.events[r.d].map((e) => e.ev).join("+")}</span>` : ""}</td><td class="${cls(r.gr ?? 0)}">${r.gr === null ? "—" : fR(r.gr)}</td><td class="${cls(r.br ?? 0)}">${r.br === null ? "—" : fR(r.br)}</td><td class="${cls(r.wr ?? 0)}">${r.wr === null ? "—" : fR(r.wr)}</td><td class="${cls(r.pct)}">${pct(r.pct, 3)}${r.pct !== r.raw ? ` <span class="mut">(${pct(r.raw, 3)} before the cap)</span>` : ""}</td><td class="${cls(r.pct)}">${fUsd(r.pct / 100 * state.account)}</td><td class="${cls(cum)}">${pct(cum)}</td><td class="mut">${nday}</td><td class="${e8state.startsWith("PASS") ? "pos" : e8state === "running" ? "mut" : "neg"}">${e8state}</td></tr>`; }).join("");
    el.innerHTML = `<div class="perf-title" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
        <label>gold leg <select id="mixgold">${goldOpts}</select></label> <label>gold risk % <input id="mixgr" type="number" min="0" max="5" step="0.05" value="${mix.gr}" style="width:64px"></label>
        <label>BTC risk % <input id="mixbr" type="number" min="0" max="5" step="0.05" value="${mix.br}" style="width:64px"></label>
        <label>weekend leg <select id="mixwe"><option value="none"${mix.we === "none" ? " selected" : ""}>none</option>${D.meta.sids.filter((sid) => D.strat[sid].entry === "BTCWE").map((sid) => `<option value="${sid}"${sid === mix.we ? " selected" : ""}>${esc(D.strat[sid].name)}</option>`).join("")}</select></label>
        <label>weekend risk % <input id="mixwr" type="number" min="0" max="5" step="0.05" value="${mix.wr}" style="width:64px"></label>
        <label>gold risk x on NFP / CPI / FOMC days <input id="mixnews" type="number" min="0" max="3" step="0.25" value="${mix.news}" style="width:64px"></label>
        <label><input id="mixcap" type="checkbox"${mix.cap ? " checked" : ""}> E8's 2 % daily profit cap</label>
        <span>account ${fUsd(state.account)} · from ${m.from} · ${Object.keys(D.events).length} release days (NFP / CPI / FOMC) · calendar days; mean day % over ACTIVE days (weekdays, plus weekends the weekend leg trades) · BTC legs at the lab's cost</span></div>
      <div class="perf-title">Named combinations · ${esc(p[1])} · click a row to load it into the controls (the green one is loaded)</div>
      <div class="score-wrap"><table class="grid score">${head.replace("period", "combination")}<tbody>${presets}</tbody></table></div>
      <div class="perf-title">The loaded combination by period</div>
      <div class="score-wrap"><table class="grid score">${head}<tbody>${periods}</tbody></table></div>
      <div class="perf-title">Day by day · ${esc(p[1])} · the white line in the bottom pane is this mix's cumulative %</div>
      <table class="grid"><thead><tr><th class="l">broker day</th><th>gold R</th><th>BTC R</th><th>wk-end R</th><th>day %</th><th>$</th><th>cum %</th><th>trading day #</th><th>one evaluation started on the first day (+6 before -6, 2 % cap)</th></tr></thead><tbody>${days}</tbody></table>`;
    $("mixgold").addEventListener("change", (e) => { mix.gold = e.target.value; renderPortfolio(); renderMixLine(); });
    $("mixgr").addEventListener("change", (e) => { mix.gr = Number(e.target.value) || 0; renderPortfolio(); renderMixLine(); });
    $("mixbr").addEventListener("change", (e) => { mix.br = Number(e.target.value) || 0; renderPortfolio(); renderMixLine(); });
    $("mixcap").addEventListener("change", (e) => { mix.cap = e.target.checked; renderPortfolio(); renderMixLine(); });
    $("mixwe").addEventListener("change", (e) => { mix.we = e.target.value; renderPortfolio(); renderMixLine(); });
    $("mixnews").addEventListener("change", (e) => { mix.news = Number(e.target.value); renderPortfolio(); renderMixLine(); });
    el.querySelectorAll("tr[data-preset]").forEach((tr) => tr.addEventListener("click", () => { Object.assign(mix, PRESETS[Number(tr.dataset.preset)][1]); renderPortfolio(); renderMixLine(); }));
    $("mixwr").addEventListener("change", (e) => { mix.wr = Number(e.target.value) || 0; renderPortfolio(); renderMixLine(); });
  }
  const statsLab = (sid) => { const t = D.strat[sid].trades; return t.reduce((a, x) => a + x.rl_, 0) / t.length; };

  // ---------- the instant account (Atlas Instant Funded 10K): every gold leg x risk % through the research's rule set (instant.json) ----------
  const inst = { risk: "all", window: "full" };
  function renderInstant() {
    const el = $("panel-instant"); if (!el) return;
    const I = D.instant;
    if (!I) { el.innerHTML = `<div class="perf-title">No data/lab/instant.json yet: run <code>py -3 C:\\MTLab\\research\\r8\\chart_export_lab_instant.py</code> and reload.</div>`; return; }
    const w = inst.window;
    const pc = (v, d = 1) => (v === null || v === undefined ? "—" : (100 * v).toFixed(d) + " %");
    const sp = (v, d = 2) => (v === null || v === undefined ? "—" : (v >= 0 ? "+" : "") + v.toFixed(d) + " %");
    const dollars = (v) => (v === null || v === undefined ? "—" : fUsd(v));
    const rows = I.rows.filter((r) => r[w] && (inst.risk === "all" || r.risk === Number(inst.risk)));
    const payable = (r) => r[w].first >= 0.5;
    const key = (r) => [payable(r) ? 0 : 1, r[w].dead_before_first, -(r[w].net_med ?? 0)];
    rows.sort((a, b) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return 0; });
    let rank = 0;
    const body = rows.map((r) => { const f = r[w]; const cur = r.sid === I.current.sid && r.risk === I.current.risk; const ok = payable(r); if (ok) rank += 1;
      const deadCls = f.dead_before_first >= 0.3 ? "neg" : f.dead_before_first < 0.15 ? "pos" : "";
      return `<tr class="clickable${cur ? " current" : ""}" data-sid="${r.sid}" data-risk="${r.risk}"><td>${ok ? rank : '<span class="mut">—</span>'}</td>` +
        `<td><span class="chip"><span class="dot" style="background:${SCOL[r.sid] || "#888"}"></span>${esc(r.name)}</span>${cur ? ' <span class="badge flag">the Atlas set, 28 Oct</span>' : ""}${r.symbol ? ' <span class="mut">(BTC, at the lab\'s cost)</span>' : ""}</td>` +
        `<td>${r.risk.toFixed(2)}</td><td>${pc(r.qual, 0)}<div class="sub">${pc(r.traded, 0)} days trade</div></td>` +
        `<td class="${cls(r.mean_day)}">${sp(r.mean_day, 3)}<div class="sub">${sp(r.tot_yr, 1)} a year</div></td>` +
        `<td>${sp(-r.dd)}</td><td>${sp(r.worst)}<div class="sub">${sp(r.w20)} / 20 d</div></td><td>${r.streak}</td>` +
        `<td class="${deadCls}"><b>${pc(f.dead_before_first)}</b> before any payout<div class="sub">${pc(f.dead)} within 12 months, median day ${f.dead_med_day ?? "—"}</div></td>` +
        `<td class="${f.first >= 0.5 ? "pos" : "neg"}">${pc(f.first)}<div class="sub">median day ${f.first_med_day ?? "—"} · ${dollars(f.first_med_amt)}</div></td>` +
        `<td class="${cls(f.net_med ?? 0)}">${dollars(f.net_med)}<div class="sub">mean ${dollars(f.net_mean)} · P(net > 0) ${pc(f.pos, 0)}</div></td>` +
        `<td>${f.npay.toFixed(1)}<div class="sub">${pc(f.alive, 0)} alive at 12 mo</div></td></tr>`; }).join("");
    const riskOpts = ["all", ...I.risks].map((v) => `<option value="${v}"${String(inst.risk) === String(v) ? " selected" : ""}>${v === "all" ? "every risk %" : v.toFixed(2) + " %"}</option>`).join("");
    const span = I.rows[0] && I.rows[0][w + "_span"];
    el.innerHTML = `<div class="perf-title" style="display:flex;gap:14px;flex-wrap:wrap;align-items:center">
        <label>risk % <select id="instrisk">${riskOpts}</select></label>
        <label>starts <select id="instwin"><option value="full"${w === "full" ? " selected" : ""}>full 12-month walks (starts 2022-01..2025-10)</option><option value="recent"${w === "recent" ? " selected" : ""}>recent starts (2025-01.., cut at the data's end)</option></select></label>
        <span>Atlas Instant Funded 10K · fee $${I.fee.toFixed(2)} · ${Math.round(100 * I.share)} % split · ${I.H} trading days a walk${span ? ` · starts ${span[0]} .. ${span[1]}` : ""} · NFP / CPI / FOMC days out · $${(I.slip).toFixed(2)} R slippage on losers · click a row to load that strategy and risk</span></div>
      <div class="perf-title">Rank = the lowest chance of losing the account BEFORE ANY PAYOUT (the fee gone for nothing) among the routes that reach a first payout in at least half of the walks; 'dead within 12 months' also counts deaths after payouts, when the cushion has been withdrawn (a route that never pays is not a route: a 1R win must clear the 1 % qualifying day, so a 1R strategy needs about 1.1 % risk and a 2R strategy about 0.55 %). Ties: the higher median net. The green strategy badge is the set on the account.</div>
      <div class="score-wrap"><table class="grid score"><thead><tr><th>rank</th><th class="l">strategy</th><th>risk %<br>a trade</th><th>wins that<br>qualify (>= 1 %)</th><th>mean day %<br>(total a year)</th><th>max closed<br>drawdown</th><th>worst day<br>(worst 20 days)</th><th>longest<br>losing run</th><th>DEAD before any payout<br>(and within 12 months)</th><th>first payout<br>within 12 months</th><th>net at 12 months<br>median (payouts - fee)</th><th>payouts<br>a year</th></tr></thead><tbody>${body}</tbody></table></div>
      <div class="perf-title">${esc(I.rules)}</div>`;
    $("instrisk").addEventListener("change", (e) => { inst.risk = e.target.value; renderInstant(); });
    $("instwin").addEventListener("change", (e) => { inst.window = e.target.value; renderInstant(); });
    el.querySelectorAll("tr[data-sid]").forEach((tr) => tr.addEventListener("click", () => { const r = Number(tr.dataset.risk); state.risk = r; $("risk").value = r; setStrategy(tr.dataset.sid); overlay.refresh(); }));
  }
  function renderTabs() { renderPerf(); renderHistory(); renderDays(); renderPortfolio(); renderInstant(); }

  // ---------- controls ----------
  function setStrategy(sid) {
    state.sid = sid; state.sel = null;
    document.querySelectorAll("#strategies button").forEach((b) => b.classList.toggle("active", b.dataset.sid === sid));
    renderStrategy(); renderPanes(); renderTabs(); showDay(null); updateAudit(); updateCaption(null);
  }
  function setPeriod(id) {
    state.period = id; $("period").value = id; const p = periodOf(id);
    if (p[2] !== null) { const a = barIndex(view.times, Date.parse(p[2] + "T00:00:00Z") / 1000), b = barIndex(view.times, Date.parse(p[3] + "T23:59:00Z") / 1000); if (a >= 0) chart.timeScale().setVisibleLogicalRange({ from: a, to: Math.max(a + 50, b) }); }
    else chart.timeScale().fitContent();
    renderTabs();
  }
  function updateAudit() {
    const s = D.strat[state.sid];
    $("audit").innerHTML = `${esc(s.name)}: <b>${s.trades.length} trades</b>, ${s.skips.length} days without · checked against the lab's own walk · E8 $${D.meta.e8_cost}/oz · built ${D.meta.generated}`;
  }
  function wire() {
    const sb = $("strategies");
    D.meta.sids.forEach((sid) => { const b = document.createElement("button"); b.dataset.sid = sid; b.className = sid === state.sid ? "active" : ""; b.title = D.strat[sid].desc;
      b.innerHTML = `<span class="chip"><span class="dot" style="background:${SCOL[sid]}"></span>${SHORT[sid]}</span>`; b.addEventListener("click", () => setStrategy(sid)); sb.appendChild(b); });
    const ps = $("period"); D.meta.periods.forEach((p) => { const o = document.createElement("option"); o.value = p[0]; o.textContent = p[1]; ps.appendChild(o); });
    ps.addEventListener("change", () => setPeriod(ps.value));
    document.querySelectorAll(".tf").forEach((b) => b.addEventListener("click", () => setTimeframe(b.dataset.tf)));
    $("risk").addEventListener("change", () => { state.risk = Number($("risk").value) || 1; renderTabs(); overlay.refresh(); });
    $("account").addEventListener("change", () => { state.account = Number($("account").value) || 50000; renderTabs(); overlay.refresh(); });
    $("prev").addEventListener("click", () => step(-1)); $("next").addEventListener("click", () => step(1));
    document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => { document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t)); document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `panel-${t.dataset.tab}`)); }));
    document.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; const tag = e.target && e.target.tagName; if (tag === "INPUT" || tag === "SELECT") return;
      const r = chart.timeScale().getVisibleLogicalRange(); const span = r ? r.to - r.from : 100;
      if (e.key >= "1" && e.key <= "4") setTimeframe(TFS[Number(e.key) - 1]);
      else if (e.key === "n" || e.key === "N") step(1); else if (e.key === "p" || e.key === "P") step(-1);
      else if (e.key === "Escape") select(null, false);
      else if (e.key === "ArrowLeft" && r) chart.timeScale().setVisibleLogicalRange({ from: r.from - (e.shiftKey ? span : 10), to: r.to - (e.shiftKey ? span : 10) });
      else if (e.key === "ArrowRight" && r) chart.timeScale().setVisibleLogicalRange({ from: r.from + (e.shiftKey ? span : 10), to: r.to + (e.shiftKey ? span : 10) });
      else return;
      e.preventDefault();
    });
  }

  async function main() {
    try {
      await load(); makeChart(); wire(); setTimeframe("H1", false);
      const n = view.times.length; chart.timeScale().setVisibleLogicalRange({ from: n - BARS_SHOWN.H1, to: n + 5 });
      renderTabs(); renderAbout(); updateAudit(); showDay(null);
      $("loading").hidden = true;
    } catch (err) { $("loading").textContent = `Could not load the lab data: ${err.message}. Run py -3 C:\\MTLab\\research\\r8\\chart_export_lab.py`; console.error(err); }
  }
  main();
})();
