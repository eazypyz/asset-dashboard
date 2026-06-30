// crawler/config.js
// Central configuration — all tuneable values live here.
// Add domains here or pass SCAN_DOMAINS env var (comma-separated) at runtime.

export const config = {
  // ── Target domains ─────────────────────────────────────────────────────────
  domains: (process.env.SCAN_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .concat([
      // ← Add your domains here
      "nvidia.com",
      "googlesource.com",
      "fintual.cl",
      "grokipedia.com"
    ])
    .filter((v, i, a) => a.indexOf(v) === i), // deduplicate

  // ── Provider toggles ────────────────────────────────────────────────────────
  providers: {
    crtsh: { enabled: true },
    securitytrails: {
      enabled: Boolean(process.env.SECURITYTRAILS_API_KEY),
      apiKey: process.env.SECURITYTRAILS_API_KEY || "",
    },
  },

  // ── Concurrency limits ──────────────────────────────────────────────────────
  concurrency: {
    dns: 50,      // parallel DNS lookups
    http: 20,     // parallel HTTP probes
    providers: 5, // parallel provider fetches per domain
  },

  // ── HTTP probe settings ──────────────────────────────────────────────────────
  http: {
    timeoutMs: 8_000,
    followRedirects: true,
    maxRedirects: 5,
    userAgent:
      "Mozilla/5.0 (compatible; AssetScanner/1.0; +https://github.com/your-org/asset-dashboard)",
  },

  // ── File paths (relative to repo root) ──────────────────────────────────────
  paths: {
    data:     "../data",
    domains:  "../data/domains",
    robots:   "../data/robots",
    security: "../data/security",
    sitemaps: "../data/sitemaps",
    history:  "../data/history",
  },

  // ── Change detection ─────────────────────────────────────────────────────────
  changeEvents: [
    "new_subdomain",
    "subdomain_disappeared",
    "robots_changed",
    "security_txt_changed",
    "sitemap_changed",
    "status_changed",
  ],
};
