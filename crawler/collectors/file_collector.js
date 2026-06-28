// crawler/collectors/file_collector.js
// Fetches known well-known files from each alive host.
// Returns structured content + hashes for change detection.

import fetch from "node-fetch";
import crypto from "crypto";
import pLimit from "p-limit";
import { config } from "../config.js";

const WELL_KNOWN_FILES = [
  {
    key: "robots",
    paths: ["/robots.txt"],
  },
  {
    key: "security",
    paths: ["/.well-known/security.txt", "/security.txt"],
  },
  {
    key: "sitemap",
    paths: ["/sitemap.xml", "/sitemap_index.xml"],
  },
];

/**
 * @typedef {Object} FileResult
 * @property {boolean} found
 * @property {string|null} content
 * @property {string|null} hash     — SHA-256 of content
 * @property {string|null} url      — final URL that returned 200
 */

/**
 * Fetches all well-known files for every alive host.
 *
 * @param {string[]} aliveHosts
 * @returns {Promise<Map<string, {robots: FileResult, security: FileResult, sitemap: FileResult}>>}
 */
export async function collectFiles(aliveHosts) {
  const limit = pLimit(config.concurrency.http);
  const results = new Map();

  await Promise.all(
    aliveHosts.map((host) =>
      limit(async () => {
        results.set(host, await collectForHost(host));
      }),
    ),
  );

  return results;
}

async function collectForHost(host) {
  const output = {};
  for (const { key, paths } of WELL_KNOWN_FILES) {
    output[key] = await fetchFirstMatch(host, paths);
  }
  return output;
}

/**
 * Tries each path in order; returns the first 200 response.
 * @param {string} host
 * @param {string[]} paths
 * @returns {Promise<FileResult>}
 */
async function fetchFirstMatch(host, paths) {
  for (const scheme of ["https", "http"]) {
    for (const path of paths) {
      const url = `${scheme}://${host}${path}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          config.http.timeoutMs,
        );
        const res = await fetch(url, {
          redirect: "follow",
          signal: controller.signal,
          headers: { "User-Agent": config.http.userAgent },
        });
        clearTimeout(timer);

        if (res.status === 200) {
          const content = await res.text();
          return {
            found: true,
            content,
            hash: sha256(content),
            url,
          };
        }
      } catch {
        // try next
      }
    }
  }

  return { found: false, content: null, hash: null, url: null };
}

function sha256(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}
