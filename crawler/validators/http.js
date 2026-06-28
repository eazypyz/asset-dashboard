// crawler/validators/http.js
// Probes each host over HTTPS (with HTTP fallback) to check liveness.
// Returns a Map<hostname, {alive, status, finalUrl}>.

import fetch from "node-fetch";
import pLimit from "p-limit";
import { config } from "../config.js";

/**
 * @param {string[]} hostnames  — only DNS-resolved hosts should be passed in
 * @returns {Promise<Map<string, {alive: boolean, status: number|null, finalUrl: string|null}>>}
 */
export async function probeAll(hostnames) {
  const limit = pLimit(config.concurrency.http);
  const results = new Map();

  await Promise.all(
    hostnames.map((host) =>
      limit(async () => {
        results.set(host, await probeOne(host));
      }),
    ),
  );

  const alive = [...results.values()].filter((r) => r.alive).length;
  console.log(`[http] ${alive}/${hostnames.length} hosts alive`);
  return results;
}

/**
 * Tries HTTPS first, falls back to HTTP.
 * @param {string} hostname
 * @returns {Promise<{alive: boolean, status: number|null, finalUrl: string|null}>}
 */
async function probeOne(hostname) {
  for (const scheme of ["https", "http"]) {
    const url = `${scheme}://${hostname}`;
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        config.http.timeoutMs,
      );

      const res = await fetch(url, {
        method: "HEAD",           // cheap — no body transfer
        redirect: config.http.followRedirects ? "follow" : "manual",
        signal: controller.signal,
        headers: { "User-Agent": config.http.userAgent },
      });
      clearTimeout(timer);

      return {
        alive: true,
        status: res.status,
        finalUrl: res.url || url,
      };
    } catch {
      // scheme failed — try next
    }
  }

  return { alive: false, status: null, finalUrl: null };
}
