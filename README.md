# AssetScout — Asset Collection Dashboard

A fully static asset monitoring platform running entirely on GitHub infrastructure.
No VPS, no database, no backend API. GitHub Actions collects data; GitHub Pages serves it.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  GitHub Actions (cron: every hour)                               │
│                                                                  │
│  main.js ──► providers (crtsh, securitytrails, …)               │
│         ──► dns validator (node:dns)                             │
│         ──► http prober (node-fetch + p-limit)                   │
│         ──► file collector (robots / security / sitemap)         │
│         ──► change detector (diff vs. previous JSON)             │
│         ──► json_store (write data/**/*.json)                    │
│         ──► git commit (only when data changes)                  │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ git push
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  GitHub Repository  (data/**/*.json  ←→  index.html)            │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ GitHub Pages
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  Browser  (index.html + js/* + assets/css/*)                     │
│                                                                  │
│  api.js ──► fetch data/manifest.json                            │
│         ──► fetch data/domains/*.json                           │
│  filters.js — pure filter/sort functions                         │
│  ui.js ─────── DOM rendering                                     │
│  charts.js ─── canvas bar + donut charts                        │
│  app.js ───── controller / state manager                        │
└──────────────────────────────────────────────────────────────────┘
```

### Key design decisions

| Decision | Rationale |
|---|---|
| No database | GitHub repo + JSON files = zero infrastructure cost, full audit trail via git history |
| Provider abstraction | Adding a new data source = create one file extending `ProviderInterface` + register it |
| `p-limit` for concurrency | Prevents network storms on large domain sets; limits are tunable per `config.js` |
| Idempotent commits | `git diff --cached` check before commit prevents empty commits on unchanged data |
| Pure JS modules | ES modules throughout — no build step needed for the frontend |
| Canvas charts | No charting library dependency keeps the page load under 50 KB |
| SHA-256 hashes | Content hashing enables reliable change detection without storing entire file history |

---

## Quick Start (5 minutes)

### 1. Fork or create the repository

```bash
gh repo create your-org/asset-dashboard --public
git clone https://github.com/your-org/asset-dashboard
```

Copy all files from this project into the repo root.

### 2. Add your domains

Edit `crawler/config.js` and add your apex domains:

```js
domains: ["your-company.com", "your-other-domain.io"],
```

### 3. Add secrets (optional)

For SecurityTrails support, add the API key as a GitHub secret:

```
Settings → Secrets and variables → Actions → New repository secret
Name:  SECURITYTRAILS_API_KEY
Value: your_key_here
```

### 4. Enable GitHub Pages

```
Settings → Pages → Source: Deploy from a branch → Branch: main → / (root)
```

### 5. Run the first scan

```
Actions → Asset Collection → Run workflow
```

The first run may take 5–30 minutes depending on domain count. Subsequent runs skip unchanged data and commit only when something changes.

---

## Repository Structure

```
/
├── index.html                  Dashboard entry point
├── .nojekyll                   Disables Jekyll on GitHub Pages
│
├── assets/
│   └── css/
│       └── main.css            All styles (dark/light mode, responsive)
│
├── js/
│   ├── app.js                  Application controller / state
│   ├── api.js                  Data fetching (fetch → JSON)
│   ├── filters.js              Pure filter + sort functions
│   ├── ui.js                   DOM rendering components
│   └── charts.js               Canvas chart helpers
│
├── data/
│   ├── manifest.json           Domain list + last-updated timestamp
│   ├── domains/
│   │   └── example.com.json    Full scan result per domain
│   ├── robots/
│   │   └── example.com/        robots.txt content files
│   ├── security/
│   │   └── example.com/        security.txt content files
│   ├── sitemaps/
│   │   └── example.com/        sitemap.xml content files
│   └── history/
│       └── example.com.json    Change event log
│
├── crawler/
│   ├── config.js               All tunable settings
│   ├── main.js                 Pipeline orchestrator
│   ├── package.json
│   │
│   ├── providers/
│   │   ├── provider_interface.js   Base class + contract
│   │   ├── registry.js             Provider factory
│   │   ├── crtsh.js                Certificate Transparency
│   │   └── securitytrails.js       SecurityTrails API
│   │
│   ├── collectors/
│   │   └── file_collector.js       robots/security/sitemap fetcher
│   │
│   ├── validators/
│   │   ├── dns.js                  DNS resolution
│   │   └── http.js                 HTTP liveness probing
│   │
│   ├── processors/
│   │   ├── change_detector.js      Diff engine
│   │   └── result_builder.js       Schema assembler
│   │
│   └── storage/
│       └── json_store.js           File I/O layer
│
└── .github/
    └── workflows/
        └── collect.yml             Hourly cron + manual trigger
```

---

## Adding a New Data Provider

1. Create `crawler/providers/yourprovider.js`:

```js
import { ProviderInterface } from "./provider_interface.js";

export class YourProvider extends ProviderInterface {
  constructor(apiKey) {
    super("yourprovider");
    this._apiKey = apiKey;
  }

  async fetchSubdomains(domain) {
    // ... fetch from your API ...
    const raw = ["api.example.com", "dev.example.com"];
    return this._normalise(raw, domain); // handles lowercase + dedup
  }
}
```

2. Register it in `crawler/providers/registry.js`:

```js
import { YourProvider } from "./yourprovider.js";

const PROVIDER_MAP = {
  // ... existing providers ...
  yourprovider: (cfg) => new YourProvider(cfg.apiKey),
};
```

3. Enable it in `crawler/config.js`:

```js
providers: {
  // ... existing ...
  yourprovider: { enabled: true, apiKey: process.env.YOUR_API_KEY },
},
```

4. Add the secret to GitHub Actions. Done.

---

## Configuration Reference

All settings are in `crawler/config.js`:

| Key | Default | Description |
|---|---|---|
| `domains` | `[]` | Apex domains to scan |
| `providers.crtsh.enabled` | `true` | Enable crt.sh provider |
| `providers.securitytrails.enabled` | auto | Enabled when API key present |
| `concurrency.dns` | `50` | Parallel DNS lookups |
| `concurrency.http` | `20` | Parallel HTTP probes |
| `http.timeoutMs` | `8000` | Per-request timeout |
| `http.followRedirects` | `true` | Follow HTTP redirects |
| `http.userAgent` | AssetScanner/1.0 | Request User-Agent |

---

## Scaling Strategy

### 100 domains / 10,000 subdomains (current design handles this)

The current architecture handles this comfortably within the 60-minute Actions limit:

- DNS: 10,000 lookups @ 50 concurrent ≈ 30–60 seconds
- HTTP: 10,000 probes @ 20 concurrent ≈ 5–15 minutes
- File collection: alive subset only, same concurrency
- Total expected: 15–30 minutes for 10k subdomains

### If you need more scale

**Parallelise by domain** — split `config.domains` across multiple workflow jobs using a matrix strategy:

```yaml
jobs:
  collect:
    strategy:
      matrix:
        domain: [example.com, other.com]
    steps:
      - run: SCAN_DOMAINS=${{ matrix.domain }} node main.js
```

**Increase runner count** — GitHub's free tier allows up to 20 concurrent jobs.

**Shard the data layer** — the `manifest.json` can point to paginated domain lists; `api.js` already handles async loading.

---

## Maintenance Guide

### The workflow runs but no data appears

1. Check Actions logs for errors
2. Verify `data/manifest.json` lists your domains
3. Confirm GitHub Pages is enabled and pointing to `main` branch root

### SecurityTrails returns 0 results

Check that `SECURITYTRAILS_API_KEY` secret is set and the plan includes subdomain API access.

### Committed data is stale

The workflow checks `git diff --cached` before committing. If you want to force a commit, use the manual trigger with `force: true`.

### Rotating credentials

Update the GitHub secret. No code changes needed — the key is read from environment at runtime.

### Data storage growth

Each `data/history/*.json` is capped at 10,000 events (see `json_store.js`). Domain JSON files grow linearly with subdomain count; at 10k subdomains each file is roughly 2–3 MB.

---

## Future Extension Recommendations

| Feature | Implementation path |
|---|---|
| Shodan integration | New provider: `crawler/providers/shodan.js` |
| Port scanning | New collector: `crawler/collectors/port_scanner.js` (use `net.createConnection`) |
| TLS cert details | New collector: `crawler/collectors/tls.js` (use `tls.connect`) |
| Screenshot capture | Add a Playwright step in the Actions workflow |
| Slack/Discord alerts | Add a `notify` step in `collect.yml` when `steps.changes.outputs.changed == 'true'` |
| Multi-user auth | Replace GitHub Pages with Cloudflare Pages + Access |
| API backend | The frontend's `api.js` is the only coupling point — swap the `fetch` calls |
| Historical charts | Extend `js/charts.js` and load `data/history/*.json` in `app.js` |
