// js/api.js
// All data access goes through this module.
// In production, files are served statically from /data/.
// Centralising fetches here makes it easy to swap to a real API later.

const DATA_BASE = "./data";

/**
 * Loads the manifest listing all scanned domains.
 * @returns {Promise<{updated: string, domains: string[]}>}
 */
export async function fetchManifest() {
  const res = await fetch(`${DATA_BASE}/manifest.json`);
  if (!res.ok) throw new Error(`Manifest not found (${res.status})`);
  return res.json();
}

/**
 * Loads the full scan result for one domain.
 * @param {string} domain
 * @returns {Promise<DomainRecord>}
 */
export async function fetchDomain(domain) {
  const res = await fetch(`${DATA_BASE}/domains/${domain}.json`);
  if (!res.ok) throw new Error(`Domain data not found: ${domain}`);
  return res.json();
}

/**
 * Loads all domains in parallel.
 * Failed fetches are returned as null entries — the UI handles gaps gracefully.
 * @param {string[]} domains
 * @returns {Promise<(DomainRecord|null)[]>}
 */
export async function fetchAllDomains(domains) {
  return Promise.all(
    domains.map((d) => fetchDomain(d).catch(() => null)),
  );
}

/**
 * Loads the change history for a domain.
 * @param {string} domain
 * @returns {Promise<ChangeEvent[]>}
 */
export async function fetchHistory(domain) {
  const res = await fetch(`${DATA_BASE}/history/${domain}.json`);
  if (!res.ok) return [];
  return res.json();
}

/**
 * Loads and aggregates all domain data into a flat list of subdomain records
 * enriched with a `domain` field for cross-domain views.
 * @param {string[]} domains
 * @returns {Promise<EnrichedSubdomain[]>}
 */
export async function fetchAllSubdomains(domains) {
  const records = await fetchAllDomains(domains);
  return records
    .filter(Boolean)
    .flatMap((r) =>
      r.subdomains.map((s) => ({ ...s, _domain: r.domain })),
    );
}
