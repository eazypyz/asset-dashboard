// crawler/providers/crtsh.js
// Queries crt.sh (Certificate Transparency) for subdomain discovery.
// No API key required; rate-limited by the public endpoint.

import fetch from "node-fetch";
import { ProviderInterface } from "./provider_interface.js";

const CRTSH_URL = "https://crt.sh/?q=%25.{domain}&output=json";
// per-request timeout
const TIMEOUT_MS = 30_000;
// retry config
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 800; // starting backoff (ms)
const MAX_BACKOFF_MS = 30_000;

export class CrtshProvider extends ProviderInterface {
  constructor() {
    super("crtsh");
  }

  async fetchSubdomains(domain) {
    const url = CRTSH_URL.replace("{domain}", encodeURIComponent(domain));
    this._log(`Querying ${url}`);

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const fetchWithRetry = async () => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          clearTimeout(timer);

          // Handle non-2xx responses
          if (!res.ok) {
            // 4xx -> likely client error, don't retry
            if (res.status >= 400 && res.status < 500) {
              const text = await res.text().catch(() => "");
              throw new Error(`crt.sh returned ${res.status}: ${text}`);
            }
            // 5xx -> server error, will be retried
            throw new Error(`crt.sh server error ${res.status}`);
          }

          // Read as text first to handle cases where content-type is wrong but body is JSON
          const text = await res.text();

          // Validate content-type / JSON
          const contentType = (res.headers.get("content-type") || "").toLowerCase();
          let data;
          if (contentType.includes("application/json")) {
            try {
              data = JSON.parse(text);
            } catch (e) {
              throw new Error("crt.sh returned invalid JSON");
            }
          } else {
            // Sometimes crt.sh returns an HTML error page or text; try parse but treat as invalid if not JSON array
            try {
              data = JSON.parse(text);
            } catch (e) {
              throw new Error("Unexpected content-type or invalid JSON from crt.sh");
            }
          }

          if (!Array.isArray(data)) {
            throw new Error("crt.sh payload shape unexpected (not an array)");
          }

          return data;
        } catch (err) {
          clearTimeout(timer);
          const isAbort = err.name === "AbortError";
          const message = err.message || String(err);
          const transient = isAbort || /NetworkError|failed to fetch|server error|timeout|timed out/i.test(message);

          const isLastAttempt = attempt === MAX_RETRIES;
          this._error(`Attempt ${attempt + 1}/${MAX_RETRIES + 1} failed: ${message}`);

          if (isLastAttempt || !transient) {
            // Final failure or permanent error -> propagate
            throw err;
          }

          // Exponential backoff with jitter
          const backoff = Math.min(MAX_BACKOFF_MS, BACKOFF_BASE_MS * Math.pow(2, attempt));
          const jitter = Math.random() * 300;
          const wait = backoff + jitter;
          this._log(`Retrying crt.sh in ${Math.round(wait)}ms...`);
          await delay(wait);
          // continue loop to retry
        }
      }
      // Shouldn't reach here
      throw new Error("Unexpected retry loop exit");
    };

    try {
      const rows = await fetchWithRetry().catch((e) => {
        // bubble error up
        throw e;
      });

      // crt.sh returns {name_value} which may contain newline-separated SANs
      const raw = rows.flatMap((row) => String(row.name_value ?? "").split("\n"));

      const hosts = this._normalise(raw, domain);
      this._log(`Found ${hosts.length} unique subdomains`);
      return hosts;
    } catch (err) {
      this._error(`crt.sh fetch failed: ${err.message}`);
      // Keep behaviour consistent: on failure return empty list
      return [];
    }
  }
}
