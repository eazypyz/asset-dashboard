// Add domains here or pass SCAN_DOMAINS env var (comma-separated) at runtime.

// ── Provider selection ─────────────────────────────────────────────────────────
// SCAN_PROVIDER can be: "crtsh" | "securitytrails" | "both"
// Defaults to "crtsh" to avoid burning SecurityTrails API quota unintentionally.
// Set via GitHub Actions workflow_dispatch dropdown, or env var locally.
const SCAN_PROVIDER = (process.env.SCAN_PROVIDER || "crtsh").toLowerCase();

const isProviderSelected = (id) =>
  SCAN_PROVIDER === "both" || SCAN_PROVIDER === id;

export const config = {
  // ── Target domains ─────────────────────────────────────────────────────────
  domains: (process.env.SCAN_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
    .concat([
      // ← Add your domains here
      "wise.com",
      "fifa.com",
      "bov.com"
    ])
    .filter((v, i, a) => a.indexOf(v) === i), // deduplicate

  // ── Provider selection + toggles ─────────────────────────────────────────────
  // A provider runs only if BOTH conditions are true:
  //   1. it is selected (via SCAN_PROVIDER, default "both")
  //   2. it has what it needs to run (e.g. an API key)
  selectedProvider: SCAN_PROVIDER,

  providers: {
    crtsh: {
      enabled: isProviderSelected("crtsh"),
    },
    securitytrails: {
      enabled:
        isProviderSelected("securitytrails") &&
        Boolean(process.env.SECURITYTRAILS_API_KEY),
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
