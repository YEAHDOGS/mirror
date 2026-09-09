# MIRROR

Smart-mirror / ambient wall dashboard: live tickers + paper trading stats. Pure black, huge type, glanceable from across the room. Static files, zero dependencies — point any browser at it, fullscreen it, hang it on the wall.

## Run it

Any static file server works. On Castle:

```
cd /path/to/mirror
python3 -m http.server 8080
```

Then open `http://castle:8080` on the mirror's browser in fullscreen (F11).

## Query params

| Param | Values | Default | What it does |
|---|---|---|---|
| `mode` | `dash`, `ticker` | `dash` | Full dashboard, or ticker-only (huge clock + big prices). |
| `stats` | URL | *(empty)* | Paper-stats JSON endpoint. Panel stays hidden until this is set. |
| `rotate` | seconds | `0` (off) | Auto-rotate between `dash` and `ticker` views every N seconds. Nice for mirrors. |

Example: `index.html?mode=ticker&stats=https://castle.local:8443/paper/stats&rotate=60`

## Data

- **Crypto** (BTC, ETH, SOL): CoinGecko `/coins/markets`, refreshed every 60s. No key needed. Live-ish, labeled "24h".
- **Stocks** (NVDA, TSLA, AAPL, SPY): your own free API key — **Finnhub** (free, 60 req/min, preferred) with **Twelve Data** as fallback. Same feeds as PAPER. Refreshed every ~2 min.
  - **Adding the key:** tap the clock on the mirror — a small panel opens. Paste the key, hit SAVE. It lives in that display's `localStorage` only — never in the repo, never in URLs (query params leak into history and logs).
  - **No key:** stock cards honestly say "no key — tap clock to add one" instead of showing dead numbers. Crypto cards keep working regardless.
- The old Yahoo Finance approach is gone: Yahoo sends no CORS headers, so real browsers block it — it only ever worked in curl, never on an actual mirror. (Stooq's free CSV endpoint died in 2026, so there is no reliable keyless stock feed left.)
- If a feed fails, that card dims and keeps its last value instead of lying.

## Paper stats JSON contract

The Castle endpoint behind `?stats=` should return:

```json
{
  "equity": 52340.12,
  "dayPnl": 312.55,
  "winRate": 0.62,
  "positions": [
    { "symbol": "BTC", "side": "LONG", "qty": 0.05, "unrealized": 120.40 },
    { "symbol": "NVDA", "side": "SHORT", "qty": 10, "unrealized": -45.10 }
  ]
}
```

- `equity`: total paper equity across accounts (number).
- `dayPnl`: realized + unrealized P&L today (number, can be negative).
- `winRate`: 0–1 fraction of closed trades that won.
- `positions`: up to ~12 shown; each needs `symbol`, `side`, `qty`; `unrealized` optional.
- Serve it with `Access-Control-Allow-Origin: *` (or the mirror's origin) so the browser can fetch it.
- Until the endpoint exists, the panel simply stays hidden. Nothing breaks.

## Castle side (not in this repo)

1. An endpoint serving the JSON above — ideally fed by PAPER's export (`YEAHDOGS/paper` has export/import JSON; a small script can reshape it into this contract).
2. CORS header so the mirror page can read it.
3. HTTPS if the mirror page is served over HTTPS (browsers block mixed-content fetches).

## Files

- `index.html` — the page
- `styles.css` — wall-display styling
- `mirror.js` — all logic, vanilla JS, no deps
- `LICENSE` — MIT

**MIRROR — watch the money from across the room.**
