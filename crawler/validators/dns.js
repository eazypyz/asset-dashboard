// crawler/validators/dns.js
// Resolves hostnames using Node's built-in dns/promises module.
// Returns a Map<hostname, boolean> for fast lookup.

import { promises as dnsPromises } from "dns";
import pLimit from "p-limit";
import { config } from "../config.js";

/**
 * Resolves all hostnames concurrently.
 *
 * @param {string[]} hostnames
 * @returns {Promise<Map<string, boolean>>}
 */
export async function resolveAll(hostnames) {
  const limit = pLimit(config.concurrency.dns);
  const results = new Map();

  await Promise.all(
    hostnames.map((host) =>
      limit(async () => {
        results.set(host, await resolveOne(host));
      }),
    ),
  );

  const resolved = [...results.values()].filter(Boolean).length;
  console.log(`[dns] ${resolved}/${hostnames.length} hosts resolved`);
  return results;
}

/**
 * @param {string} hostname
 * @returns {Promise<boolean>}
 */
async function resolveOne(hostname) {
  try {
    await dnsPromises.lookup(hostname);
    return true;
  } catch {
    return false;
  }
}
