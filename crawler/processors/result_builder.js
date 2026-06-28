// crawler/processors/result_builder.js
// Pure transformation layer — takes raw pipeline data and produces
// the final structured subdomain records that match the JSON schema.

/**
 * Builds a subdomain record array from all pipeline stage outputs.
 *
 * @param {Object} params
 * @param {string[]}                      params.hosts        — normalised hostname list
 * @param {string[][]}                    params.sourcesMap   — Map<host, string[]>
 * @param {Map<string, boolean>}          params.dnsResults
 * @param {Map<string, {alive,status}>}   params.httpResults
 * @param {Map<string, {robots,security,sitemap}>} params.fileResults
 * @param {Map<string, {first_seen}>}     params.previousMap  — keyed by host
 * @returns {Object[]}
 */
export function buildSubdomainRecords({
  hosts,
  sourcesMap,
  dnsResults,
  httpResults,
  fileResults,
  previousMap,
}) {
  const now = new Date().toISOString();

  return hosts.map((host) => {
    const dns    = dnsResults.get(host) ?? false;
    const http   = httpResults.get(host) ?? { alive: false, status: null };
    const files  = fileResults.get(host) ?? {};
    const robots   = files.robots   ?? { found: false, hash: null };
    const security = files.security ?? { found: false, hash: null };
    const sitemap  = files.sitemap  ?? { found: false, hash: null };
    const prev     = previousMap?.get(host);

    return {
      host,
      source:        sourcesMap.get(host) ?? [],
      dns,
      alive:         http.alive,
      status:        http.status,
      robots:        robots.found,
      security_txt:  security.found,
      sitemap:       sitemap.found,
      robots_hash:   robots.hash   ?? "",
      security_hash: security.hash ?? "",
      sitemap_hash:  sitemap.hash  ?? "",
      first_seen:    prev?.first_seen ?? now,
      last_seen:     now,
    };
  });
}
