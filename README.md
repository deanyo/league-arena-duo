# league-arena-duo

Static UI for an Arena duo roast report. Ships in demo mode until a Worker
endpoint is wired up.

## Configure
- Set `API_BASE` in `index.html` to your Cloudflare Worker URL.
- The worker should expose `GET /duo` with query params:
  - `region`, `me`, `duo`, `matches`, `tone`, `verdict` (`auto` or `fresh`)
- Response shape should follow the `demoData` structure in `index.html`.
- Inputs can be plain summoner names or Riot IDs (`name#TAG`), including op.gg-style `name-TAG`.

## Cloudflare Worker (Wrangler)
Worker lives in `worker/`.

### Setup
```bash
cd worker
wrangler secret put RIOT_API_KEY
```

Optional defaults (already in `worker/wrangler.toml`):
- `DEFAULT_REGION`
- `DEFAULT_ME`
- `DEFAULT_DUO`
- `DEFAULT_MATCHES`
- `CACHE_TTL_SECONDS`

### Local dev
```bash
cd worker
wrangler dev
```

### Deploy
```bash
cd worker
wrangler deploy
```

## Notes
- URL params drive the UI, so any duo can be shared via the query string.
- AI verdicts can be added server-side later and cached separately.
- GitHub Pages will redirect to `https://dnyo.co.uk/league-arena-duo/` while the user site CNAME points to `dnyo.co.uk`.
