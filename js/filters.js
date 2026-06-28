// js/filters.js
// All filtering and sorting logic — pure functions, zero DOM coupling.
// The UI layer imports these and passes raw subdomain arrays in.

/**
 * @typedef {Object} FilterState
 * @property {string}   query        — text search string
 * @property {string}   status       — "all" | "alive" | "dead"
 * @property {string}   dns          — "all" | "resolved" | "unresolved"
 * @property {string}   robots       — "all" | "yes" | "no"
 * @property {string}   security     — "all" | "yes" | "no"
 * @property {string}   sitemap      — "all" | "yes" | "no"
 * @property {string[]} sources      — [] = all, otherwise filter to included
 * @property {string}   sortKey      — field name to sort by
 * @property {string}   sortDir      — "asc" | "desc"
 */

export const DEFAULT_FILTERS = {
  query:    "",
  status:   "all",
  dns:      "all",
  robots:   "all",
  security: "all",
  sitemap:  "all",
  sources:  [],
  sortKey:  "host",
  sortDir:  "asc",
};

/**
 * Applies all active filters and sort to a subdomain array.
 *
 * @param {Object[]}    subdomains
 * @param {FilterState} filters
 * @returns {Object[]}
 */
export function applyFilters(subdomains, filters) {
  let result = subdomains;

  // ── Text search ────────────────────────────────────────────────────────────
  if (filters.query.trim()) {
    const q = filters.query.trim().toLowerCase();
    result = result.filter((s) => s.host.toLowerCase().includes(q));
  }

  // ── Status filter ──────────────────────────────────────────────────────────
  if (filters.status === "alive")  result = result.filter((s) => s.alive);
  if (filters.status === "dead")   result = result.filter((s) => !s.alive);

  // ── DNS filter ─────────────────────────────────────────────────────────────
  if (filters.dns === "resolved")   result = result.filter((s) => s.dns);
  if (filters.dns === "unresolved") result = result.filter((s) => !s.dns);

  // ── File presence filters ──────────────────────────────────────────────────
  if (filters.robots   === "yes") result = result.filter((s) => s.robots);
  if (filters.robots   === "no")  result = result.filter((s) => !s.robots);
  if (filters.security === "yes") result = result.filter((s) => s.security_txt);
  if (filters.security === "no")  result = result.filter((s) => !s.security_txt);
  if (filters.sitemap  === "yes") result = result.filter((s) => s.sitemap);
  if (filters.sitemap  === "no")  result = result.filter((s) => !s.sitemap);

  // ── Source filter ──────────────────────────────────────────────────────────
  if (filters.sources.length > 0) {
    result = result.filter((s) =>
      filters.sources.some((src) => s.source.includes(src)),
    );
  }

  // ── Sort ───────────────────────────────────────────────────────────────────
  result = sortSubdomains(result, filters.sortKey, filters.sortDir);

  return result;
}

function sortSubdomains(arr, key, dir) {
  return [...arr].sort((a, b) => {
    let va = a[key] ?? "";
    let vb = b[key] ?? "";

    // Booleans → sort true-first when asc
    if (typeof va === "boolean") { va = va ? 1 : 0; vb = vb ? 1 : 0; }
    // Numbers
    if (typeof va === "number")  return dir === "asc" ? va - vb : vb - va;
    // Strings
    const cmp = String(va).localeCompare(String(vb));
    return dir === "asc" ? cmp : -cmp;
  });
}

/**
 * Computes aggregate statistics for a subdomain array.
 * @param {Object[]} subdomains
 * @returns {Object}
 */
export function computeStats(subdomains) {
  const total = subdomains.length;
  if (!total) return { total: 0, alive: 0, dns: 0, robots: 0, security: 0, sitemap: 0 };

  return {
    total,
    alive:    subdomains.filter((s) => s.alive).length,
    dns:      subdomains.filter((s) => s.dns).length,
    robots:   subdomains.filter((s) => s.robots).length,
    security: subdomains.filter((s) => s.security_txt).length,
    sitemap:  subdomains.filter((s) => s.sitemap).length,
  };
}

/**
 * Extracts all unique provider sources from a subdomain list.
 * @param {Object[]} subdomains
 * @returns {string[]}
 */
export function extractSources(subdomains) {
  return [...new Set(subdomains.flatMap((s) => s.source ?? []))].sort();
}
