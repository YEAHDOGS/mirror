/* MIRROR — ambient wall dashboard. Static, no deps. Pure client-side fetches. */
(function () {
"use strict";

var params = new URLSearchParams(location.search);
var MODE = (params.get("mode") || "dash").toLowerCase();      // "dash" | "ticker"
var STATS_URL = params.get("stats") || "";                    // paper stats JSON endpoint
var ROTATE = parseInt(params.get("rotate") || "0", 10) || 0;  // seconds between view rotations

var CRYPTO = [
  { sym: "BTC", id: "bitcoin" },
  { sym: "ETH", id: "ethereum" },
  { sym: "SOL", id: "solana" }
];
var STOCKS = [
  { sym: "NVDA" }, { sym: "TSLA" }, { sym: "AAPL" }, { sym: "SPY" }
];
var CRYPTO_MS = 60000, STOCK_MS = 120000, STATS_MS = 60000;

var state = {}; // sym -> {price, chg, stale, note}

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function fmt(p) {
  if (typeof p !== "number" || !isFinite(p)) return "—";
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 10) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return p.toLocaleString("en-US", { maximumFractionDigits: 4 });
}
function fmtChg(c) {
  if (typeof c !== "number" || !isFinite(c)) return "—";
  return (c >= 0 ? "+" : "") + c.toFixed(2) + "%";
}

/* ---------- clock ---------- */
function tickClock() {
  var d = new Date(), h = d.getHours(), m = d.getMinutes();
  var t = (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m);
  var c = $("clock"); if (c) c.textContent = t;
  var tc = $("to-clock"); if (tc) tc.textContent = t;
}
setInterval(tickClock, 5000); tickClock();

/* ---------- crypto (CoinGecko, live-ish) ---------- */
function fetchCrypto() {
  var ids = CRYPTO.map(function (c) { return c.id; }).join(",");
  fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=" + ids + "&price_change_percentage=24h")
    .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
    .then(function (rows) {
      rows.forEach(function (row) {
        var c = CRYPTO.filter(function (x) { return x.id === row.id; })[0];
        if (!c) return;
        state[c.sym] = { price: row.current_price, chg: row.price_change_percentage_24h, stale: false, note: "24h" };
      });
      render();
    })
    .catch(function () {
      CRYPTO.forEach(function (c) { if (state[c.sym]) state[c.sym].stale = true; });
      render();
    });
}

/* ---------- stocks (Yahoo chart API, no key; delayed — labeled) ---------- */
function fetchStocks() {
  var pending = STOCKS.length, done = false;
  function one(sym, host, cb) {
    fetch("https://" + host + ".finance.yahoo.com/v8/finance/chart/" + sym + "?interval=1d&range=1d")
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (j) {
        var m = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
        if (!m || !(m.regularMarketPrice > 0)) throw new Error("bad quote");
        state[sym] = {
          price: m.regularMarketPrice,
          chg: typeof m.regularMarketChangePercent === "number" ? m.regularMarketChangePercent : null,
          stale: false, note: "Yahoo · may be delayed"
        };
        cb(true);
      })
      .catch(function () { cb(false); });
  }
  STOCKS.forEach(function (s) {
    one(s.sym, "query1", function (ok) {
      if (ok) { render(); check(); return; }
      one(s.sym, "query2", function (ok2) {
        if (!ok2 && state[s.sym]) state[s.sym].stale = true;
        render(); check();
      });
    });
  });
  function check() {
    if (--pending === 0 && !done) { done = true; render(); }
  }
}

/* ---------- paper stats (Castle endpoint, optional) ---------- */
function fetchPaper() {
  if (!STATS_URL) return;
  fetch(STATS_URL, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
    .then(function (j) { renderPaper(j); })
    .catch(function () { /* stays hidden / keeps last values */ });
}

/* ---------- render ---------- */
var ORDER = ["BTC", "ETH", "SOL", "NVDA", "TSLA", "AAPL", "SPY"];

function render() {
  var d = new Date();
  var u = $("updated");
  if (u) u.textContent = "updated " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  var cards = $("cards");
  if (cards) {
    cards.innerHTML = ORDER.map(function (sym) {
      var s = state[sym];
      var price = s ? fmt(s.price) : "—";
      var chg = s ? fmtChg(s.chg) : "—";
      var cls = s && typeof s.chg === "number" ? (s.chg >= 0 ? "up" : "down") : "";
      var stale = s && s.stale ? " stale" : "";
      var note = s && s.note ? esc(s.note) : "—";
      return '<div class="card' + stale + '">' +
        '<div class="sym">' + esc(sym) + '</div>' +
        '<div class="price">$' + price + '</div>' +
        '<div class="chg ' + cls + '">' + chg + '</div>' +
        '<div class="note">' + note + '</div></div>';
    }).join("");
  }

  var items = ORDER.map(function (sym) {
    var s = state[sym];
    var cls = s && typeof s.chg === "number" ? (s.chg >= 0 ? "chg-up" : "chg-down") : "";
    return '<span class="tick"><span class="sym">' + esc(sym) + '</span> $' + (s ? fmt(s.price) : "—") +
      ' <span class="' + cls + '">' + (s ? fmtChg(s.chg) : "—") + '</span><span class="sep"> ·</span></span>';
  }).join("");
  var tt = $("tape-track");
  if (tt) tt.innerHTML = items + items; // doubled for seamless loop

  var tot = $("to-track");
  if (tot) {
    tot.innerHTML = ORDER.map(function (sym) {
      var s = state[sym];
      var cls = s && typeof s.chg === "number" ? (s.chg >= 0 ? "up" : "down") : "";
      return '<div><span class="sym">' + esc(sym) + '</span> $' + (s ? fmt(s.price) : "—") +
        ' <span class="' + cls + '">' + (s ? fmtChg(s.chg) : "—") + '</span></div>';
    }).join("");
  }
}

function renderPaper(j) {
  if (!j || typeof j !== "object") return;
  var sec = $("paper");
  sec.classList.remove("hidden");
  var eq = typeof j.equity === "number" ? "$" + fmt(j.equity) : "—";
  var pnl = typeof j.dayPnl === "number" ? j.dayPnl : null;
  var wr = typeof j.winRate === "number" ? (j.winRate * 100).toFixed(0) + "%" : "—";
  var pnlCls = pnl === null ? "" : (pnl >= 0 ? "up" : "down");
  var pnlTxt = pnl === null ? "—" : ((pnl >= 0 ? "+" : "−") + "$" + fmt(Math.abs(pnl)));
  $("paper-stats").innerHTML =
    '<div class="pstat"><div class="lbl">EQUITY</div><div class="val">' + eq + '</div></div>' +
    '<div class="pstat"><div class="lbl">DAY P&amp;L</div><div class="val ' + pnlCls + '">' + pnlTxt + '</div></div>' +
    '<div class="pstat"><div class="lbl">WIN RATE</div><div class="val">' + wr + '</div></div>';
  var pos = Array.isArray(j.positions) ? j.positions : [];
  $("paper-pos").innerHTML = pos.slice(0, 12).map(function (p) {
    var u = typeof p.unrealized === "number" ? p.unrealized : null;
    var cls = u === null ? "" : (u >= 0 ? "up" : "down");
    var ut = u === null ? "" : ' <span class="' + cls + '">(' + (u >= 0 ? "+" : "−") + "$" + fmt(Math.abs(u)) + ")</span>";
    return '<div class="ppos"><span class="sym">' + esc(p.symbol || "?") + '</span> ' +
      esc(p.side || "") + " " + esc(p.qty || "") + ut + "</div>";
  }).join("");
}

/* ---------- boot ---------- */
function applyMode() {
  if (MODE === "ticker") {
    $("dash").classList.add("hidden");
    $("tape").classList.add("hidden");
    $("tickeronly").classList.remove("hidden");
  } else {
    $("dash").classList.remove("hidden");
    $("tape").classList.remove("hidden");
    $("tickeronly").classList.add("hidden");
  }
}
applyMode();

if (ROTATE > 0) {
  setInterval(function () {
    MODE = (MODE === "ticker") ? "dash" : "ticker";
    applyMode(); render();
  }, ROTATE * 1000);
}

fetchCrypto(); fetchStocks(); fetchPaper();
setInterval(fetchCrypto, CRYPTO_MS);
setInterval(fetchStocks, STOCK_MS);
if (STATS_URL) setInterval(fetchPaper, STATS_MS);
render();

})();
