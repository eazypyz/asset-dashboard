// crawler/providers/securitytrails.js
// Uses the SecurityTrails API to enumerate subdomains.
// Requires SECURITYTRAILS_API_KEY secret in GitHub Actions.

import fetch from "node-fetch";
import { ProviderInterface } from "./provider_interface.js";

const BASE_URL = "https://api.securitytrails.com/v1";
const TIMEOUT_MS = 20_000;
const PAGE_LIMIT = 100; // max pages to fetch per domain (100 × ~100 = 10k results)

export class SecurityTrailsProvider extends ProviderInterface {
  /** @param {string} apiKey */
  constructor(apiKey) {
    super("securitytrails");
    if (!apiKey) throw new Error("SecurityTrails API key is required");
    this._apiKey = apiKey;
  }

  async fetchSubdomains(domain) {
    this._log(`Querying SecurityTrails for ${domain}`);

    try {
      let page = 1;
      let totalPages = 1;
      const collected = [];

      while (page <= totalPages && page <= PAGE_LIMIT) {
        const data = await this._fetchPage(domain, page);
        if (!data) break;

        totalPages = data.meta?.total_pages ?? 1;
        const subdomains = (data.subdomains ?? []).map(
          (sub) => `${sub}.${domain}`,
        );
        collected.push(...subdomains);

        this._log(`Page ${page}/${totalPages} — ${subdomains.length} entries`);
        page++;

        // Respect rate limits between pages
        if (page <= totalPages) await sleep(300);
      }

      const hosts = this._normalise(collected, domain);
      this._log(`Found ${hosts.length} unique subdomains`);
      return hosts;

    } catch (err) {
      this._error(err.message);
      return [];
    }
  }

  async _fetchPage(domain, page) {
    const url = `${BASE_URL}/domain/${encodeURIComponent(domain)}/subdomains?children_only=false&include_inactive=true&page=${page}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          APIKEY: this._apiKey,
          Accept: "application/json",
        },
      });
      clearTimeout(timer);

      if (res.status === 429) {
        this._error("Rate limited by SecurityTrails — waiting 60s");
        await sleep(60_000);
        return this._fetchPage(domain, page); // single retry
      }

      if (!res.ok) {
        this._error(`HTTP ${res.status} on page ${page}`);
        return null;
      }

      return res.json();
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
