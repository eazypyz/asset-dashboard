// crawler/providers/crtsh.js
// Queries crt.sh (Certificate Transparency) for subdomain discovery.
// No API key required; rate-limited by the public endpoint.

import fetch from "node-fetch";
import { ProviderInterface } from "./provider_interface.js";

const CRTSH_URL = "https://crt.sh/?q=%25.{domain}&output=json";
const TIMEOUT_MS = 30_000;

export class CrtshProvider extends ProviderInterface {
  constructor() {
    super("crtsh");
  }

  async fetchSubdomains(domain) {
    const url = CRTSH_URL.replace("{domain}", encodeURIComponent(domain));
    this._log(`Querying ${url}`);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timer);

      if (!res.ok) {
        this._error(`HTTP ${res.status} from crt.sh`);
        return [];
      }

      const rows = await res.json();
      if (!Array.isArray(rows)) return [];

      // crt.sh returns {name_value} which may contain newline-separated SANs
      const raw = rows.flatMap((row) =>
        String(row.name_value ?? "").split("\n"),
      );

      const hosts = this._normalise(raw, domain);
      this._log(`Found ${hosts.length} unique subdomains`);
      return hosts;

    } catch (err) {
      this._error(err.message);
      return [];
    }
  }
}
