// crawler/providers/crtsh.js
import fetch from "node-fetch";
import { ProviderInterface } from "./provider_interface.js";

const CRTSH_URL = "https://crt.name/v1/search?apex={domain}";
const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 4;
const RETRY_DELAYS = [3_000, 8_000, 15_000, 30_000]; // backoff bertahap

export class CrtshProvider extends ProviderInterface {
  constructor() {
    super("crtsh");
  }

  async fetchSubdomains(domain) {
    const url = CRTSH_URL.replace("{domain}", encodeURIComponent(domain));

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      this._log(`Query attempt ${attempt}/${MAX_RETRIES} for ${domain}`);
      try {
        const rows = await this._fetch(url);

        // crt.sh kadang balik array kosong padahal domain valid
        // kalau kosong dan masih ada retry, coba lagi
        if (rows.length === 0 && attempt < MAX_RETRIES) {
          this._log(`Empty result on attempt ${attempt}, retrying...`);
          await sleep(RETRY_DELAYS[attempt - 1]);
          continue;
        }

        const raw = rows.flatMap((row) =>
          String(row.name_value ?? "").split("\n"),
        );
        const hosts = this._normalise(raw, domain);
        this._log(`Found ${hosts.length} unique subdomains`);
        return hosts;

      } catch (err) {
        this._error(`Attempt ${attempt} failed: ${err.message}`);
        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt - 1];
          this._log(`Waiting ${delay / 1000}s before retry...`);
          await sleep(delay);
        }
      }
    }

    this._error(`All ${MAX_RETRIES} attempts failed for ${domain}`);
    return [];
  }

  async _fetch(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          // User-Agent membantu menghindari block dari crt.sh
          "User-Agent": "Mozilla/5.0 (compatible; AssetScanner/1.0)",
        },
      });
      clearTimeout(timer);

      if (res.status === 429) {
        throw new Error("Rate limited (429) by crt.sh");
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} from crt.sh`);
      }

      const text = await res.text();
      // crt.sh kadang return HTML error page bukan JSON
      if (!text.trim().startsWith("[")) {
        throw new Error("Non-JSON response from crt.sh (likely server error)");
      }

      return JSON.parse(text);
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
