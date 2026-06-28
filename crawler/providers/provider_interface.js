// crawler/providers/provider_interface.js
// Every subdomain provider must extend this class.
// This enforces a uniform contract across all data sources.

export class ProviderInterface {
  /** @param {string} name — unique identifier used in data/source arrays */
  constructor(name) {
    if (!name) throw new Error("Provider name is required");
    this.name = name;
  }

  /**
   * Discover subdomains for the given apex domain.
   *
   * @param {string} domain — apex domain, e.g. "example.com"
   * @returns {Promise<string[]>} — array of fully-qualified hostnames (no wildcards)
   *
   * Implementations MUST:
   *  - Return only valid hostnames (no leading dots, no wildcards)
   *  - Normalise to lowercase
   *  - Return an empty array on failure (never throw to the pipeline)
   *  - Log errors internally with this._error()
   */
  async fetchSubdomains(domain) { // eslint-disable-line no-unused-vars
    throw new Error(`${this.name}.fetchSubdomains() not implemented`);
  }

  // ── Shared utilities available to all providers ──────────────────────────

  /**
   * Cleans and validates a list of raw hostnames.
   * @param {string[]} raw
   * @param {string}   apex — the apex domain being scanned
   * @returns {string[]}
   */
  _normalise(raw, apex) {
    const apexSuffix = `.${apex}`;
    return [...new Set(
      raw
        .map((h) => h.trim().toLowerCase().replace(/^\*\./, ""))
        .filter((h) => h.endsWith(apexSuffix) || h === apex)
        .filter((h) => /^[a-z0-9._-]+$/.test(h)),
    )];
  }

  _log(msg)   { console.log(`[${this.name}] ${msg}`); }
  _error(msg) { console.error(`[${this.name}] ERROR: ${msg}`); }
}
