# league-arena-duo

Static UI for an Arena duo roast report. Ships in demo mode until a Worker
endpoint is wired up.

## Configure
- Set `API_BASE` in `index.html` to your Cloudflare Worker URL.
- The worker should expose `GET /duo` with query params:
  - `region`, `me`, `duo`, `matches`, `tone`, `verdict` (`auto`, `fresh`, or `ai`)
- Response shape should follow the `demoData` structure in `index.html`.
- Inputs can be plain summoner names or Riot IDs (`name#TAG`), including op.gg-style `name-TAG`.

## Tier List (Meta Roasts)
Meta roasts pull from `tierlist.json`. Update the tiers as needed (manual or scripted).
Champions missing from the list are treated as off-meta, so fill out the list for best results.

Worker settings (in `worker/wrangler.toml`):
- `TIERLIST_URL` (defaults to the raw GitHub URL for `tierlist.json`)
- `TIERLIST_TTL_SECONDS` (defaults to 86400)

### Update script
Use `scripts/update-tierlist.js` to convert a simple text list into `tierlist.json`.
It accepts a file (`--input`) or stdin, and supports `S:`/`A:`/`B:`/`C:`/`D:` blocks.

Example:
```bash
cat <<'EOF' > tiers.txt
S: Ahri, Jinx, Ashe
A: Ezreal, Swain
B: Nami
EOF

node scripts/update-tierlist.js --input tiers.txt
```

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
- `AI_VERDICT_TTL_SECONDS`
- `AI_ROASTS_TTL_SECONDS`
- `OPENAI_MODEL`

### AI verdicts + roasts (optional)
Set an OpenAI key to enable `verdict=ai`:
```bash
cd worker
wrangler secret put OPENAI_API_KEY
```

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
