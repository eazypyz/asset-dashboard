// crawler/processors/change_detector.js
// Compares a new scan against the previously stored domain data.
// Emits typed change events that become the history record.

/**
 * @typedef {Object} ChangeEvent
 * @property {string} type        — one of config.changeEvents
 * @property {string} host
 * @property {string} timestamp
 * @property {*}      [previous]  — previous value when applicable
 * @property {*}      [current]   — new value
 */

/**
 * Detects all changes between the previous and current subdomain lists.
 *
 * @param {Object[]} previous  — previously stored subdomains array
 * @param {Object[]} current   — freshly scanned subdomains array
 * @returns {ChangeEvent[]}
 */
export function detectChanges(previous, current) {
  const prevMap = indexBy(previous, "host");
  const currMap = indexBy(current, "host");
  const events = [];
  const now = new Date().toISOString();

  // ── New subdomains ──────────────────────────────────────────────────────────
  for (const host of currMap.keys()) {
    if (!prevMap.has(host)) {
      events.push({ type: "new_subdomain", host, timestamp: now });
    }
  }

  // ── Disappeared subdomains ──────────────────────────────────────────────────
  for (const host of prevMap.keys()) {
    if (!currMap.has(host)) {
      events.push({ type: "subdomain_disappeared", host, timestamp: now });
    }
  }

  // ── Per-host field changes ──────────────────────────────────────────────────
  for (const [host, curr] of currMap.entries()) {
    const prev = prevMap.get(host);
    if (!prev) continue; // already logged as new_subdomain

    checkField(events, host, now, "robots_changed",       prev.robots_hash,    curr.robots_hash);
    checkField(events, host, now, "security_txt_changed", prev.security_hash,  curr.security_hash);
    checkField(events, host, now, "sitemap_changed",      prev.sitemap_hash,   curr.sitemap_hash);
    checkField(events, host, now, "status_changed",       prev.status,         curr.status);
  }

  return events;
}

function checkField(events, host, timestamp, type, previous, current) {
  // Treat null/undefined as equivalent
  if ((previous ?? null) !== (current ?? null)) {
    events.push({ type, host, timestamp, previous: previous ?? null, current: current ?? null });
  }
}

/** @returns {Map<string, Object>} */
function indexBy(arr, key) {
  return new Map((arr ?? []).map((item) => [item[key], item]));
}
