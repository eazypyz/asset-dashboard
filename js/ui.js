// js/ui.js
// All DOM rendering lives here. No business logic — only view concerns.
// Components are pure functions: (data) → HTML string or DOM node.

import { drawBarChart, drawDonutChart } from "./charts.js";

// ── Stat cards ────────────────────────────────────────────────────────────────

/**
 * Renders the top-row stat cards.
 * @param {Object} stats
 * @param {HTMLElement} container
 */
export function renderStats(stats, container) {
  const cards = [
    { label: "Total Subdomains", value: stats.total,    icon: "⬡", accent: "cyan"   },
    { label: "Alive",            value: stats.alive,    icon: "◉", accent: "green"  },
    { label: "DNS Resolved",     value: stats.dns,      icon: "◎", accent: "blue"   },
    { label: "robots.txt",       value: stats.robots,   icon: "🤖", accent: "amber"  },
    { label: "security.txt",     value: stats.security, icon: "🔒", accent: "violet" },
    { label: "sitemap.xml",      value: stats.sitemap,  icon: "🗺", accent: "rose"   },
  ];

  container.innerHTML = cards
    .map(
      ({ label, value, icon, accent }) => `
    <div class="stat-card stat-card--${accent}">
      <span class="stat-icon">${icon}</span>
      <span class="stat-value">${value.toLocaleString()}</span>
      <span class="stat-label">${label}</span>
    </div>`,
    )
    .join("");
}

// ── Subdomain table ───────────────────────────────────────────────────────────

const COLUMNS = [
  { key: "host",        label: "Host",         sortable: true  },
  { key: "_domain",     label: "Domain",       sortable: true  },
  { key: "source",      label: "Sources",      sortable: false },
  { key: "dns",         label: "DNS",          sortable: true  },
  { key: "alive",       label: "Alive",        sortable: true  },
  { key: "status",      label: "Status",       sortable: true  },
  { key: "robots",      label: "robots",       sortable: true  },
  { key: "security_txt",label: "security",     sortable: true  },
  { key: "sitemap",     label: "sitemap",      sortable: true  },
  { key: "first_seen",  label: "First Seen",   sortable: true  },
  { key: "last_seen",   label: "Last Seen",    sortable: true  },
];

/**
 * Renders the table header with sort controls.
 * @param {HTMLElement} thead
 * @param {string} sortKey
 * @param {string} sortDir
 * @param {function} onSort
 */
export function renderTableHeader(thead, sortKey, sortDir, onSort) {
  thead.innerHTML = `<tr>${COLUMNS.map(({ key, label, sortable }) => {
    const active = sortKey === key;
    const arrow  = active ? (sortDir === "asc" ? " ↑" : " ↓") : "";
    return `<th
      class="th ${sortable ? "th--sortable" : ""} ${active ? "th--active" : ""}"
      data-key="${key}"
      ${sortable ? 'role="button" tabindex="0"' : ""}
    >${label}${arrow ? `<span class="sort-arrow">${arrow}</span>` : ""}</th>`;
  }).join("")}</tr>`;

  if (onSort) {
    thead.querySelectorAll(".th--sortable").forEach((th) => {
      th.addEventListener("click", () => onSort(th.dataset.key));
      th.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") onSort(th.dataset.key);
      });
    });
  }
}

/**
 * Renders table rows from a subdomain array.
 * @param {HTMLElement} tbody
 * @param {Object[]} subdomains
 */
export function renderTableRows(tbody, subdomains) {
  if (!subdomains.length) {
    tbody.innerHTML = `<tr><td colspan="${COLUMNS.length}" class="td-empty">
      No subdomains match the current filters.
    </td></tr>`;
    return;
  }

  tbody.innerHTML = subdomains.map((s) => `
    <tr class="tr ${s.alive ? "tr--alive" : "tr--dead"}">
      <td class="td td--host">
        <a href="https://${s.host}" target="_blank" rel="noopener noreferrer"
           class="host-link">${s.host}</a>
      </td>
      <td class="td td--domain">${s._domain ?? "—"}</td>
      <td class="td">${(s.source ?? []).map((src) =>
        `<span class="badge badge--source">${src}</span>`).join(" ")}</td>
      <td class="td">${pill(s.dns,         "DNS",  "●")}</td>
      <td class="td">${pill(s.alive,       "LIVE", "●")}</td>
      <td class="td">${statusBadge(s.status)}</td>
      <td class="td">${boolIcon(s.robots)}</td>
      <td class="td">${boolIcon(s.security_txt)}</td>
      <td class="td">${boolIcon(s.sitemap)}</td>
      <td class="td td--date">${fmtDate(s.first_seen)}</td>
      <td class="td td--date">${fmtDate(s.last_seen)}</td>
    </tr>`).join("");
}

// ── History timeline ──────────────────────────────────────────────────────────

const EVENT_ICONS = {
  new_subdomain:         { icon: "＋", cls: "event--new"     },
  subdomain_disappeared: { icon: "✕",  cls: "event--gone"    },
  robots_changed:        { icon: "🤖", cls: "event--changed" },
  security_txt_changed:  { icon: "🔒", cls: "event--changed" },
  sitemap_changed:       { icon: "🗺", cls: "event--changed" },
  status_changed:        { icon: "⚡", cls: "event--status"  },
};

/**
 * Renders the change history timeline.
 * @param {HTMLElement} container
 * @param {Object[]} events
 */
export function renderHistory(container, events) {
  if (!events.length) {
    container.innerHTML = `<p class="history-empty">No change events recorded yet.</p>`;
    return;
  }

  const recent = [...events].reverse().slice(0, 200);
  container.innerHTML = recent.map((e) => {
    const meta = EVENT_ICONS[e.type] ?? { icon: "·", cls: "" };
    return `
    <div class="event ${meta.cls}">
      <span class="event-icon">${meta.icon}</span>
      <span class="event-body">
        <span class="event-type">${e.type.replace(/_/g, " ")}</span>
        <span class="event-host">${e.host}</span>
        ${e.previous != null ? `<span class="event-diff">${e.previous} → ${e.current}</span>` : ""}
      </span>
      <span class="event-time">${fmtDate(e.timestamp)}</span>
    </div>`;
  }).join("");
}

// ── Domain selector ───────────────────────────────────────────────────────────

/**
 * Populates the domain dropdown.
 * @param {HTMLSelectElement} select
 * @param {string[]} domains
 */
export function renderDomainSelect(select, domains) {
  select.innerHTML =
    `<option value="all">All Domains (${domains.length})</option>` +
    domains.map((d) => `<option value="${d}">${d}</option>`).join("");
}

// ── Charts ────────────────────────────────────────────────────────────────────

export function renderCharts(stats, barCanvas, donutCanvas) {
  if (barCanvas) {
    const accent = getComputedStyle(document.documentElement);
    drawBarChart(barCanvas, [
      { label: "alive",    value: stats.alive,    color: "#4ade80" },
      { label: "dns",      value: stats.dns,      color: "#60a5fa" },
      { label: "robots",   value: stats.robots,   color: "#fbbf24" },
      { label: "security", value: stats.security, color: "#a78bfa" },
      { label: "sitemap",  value: stats.sitemap,  color: "#f472b6" },
    ]);
  }
  if (donutCanvas) {
    drawDonutChart(donutCanvas, stats.alive, stats.total);
  }
}

// ── Toast notifications ───────────────────────────────────────────────────────

let toastTimer = null;

export function showToast(message, type = "info") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.className  = `toast toast--${type} toast--visible`;
  toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("toast--visible"), 3500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pill(value, label, icon) {
  const ok = Boolean(value);
  return `<span class="pill ${ok ? "pill--ok" : "pill--no"}">${icon} ${ok ? label : "—"}</span>`;
}

function statusBadge(code) {
  if (!code) return `<span class="badge badge--unknown">—</span>`;
  const cls = code < 300 ? "badge--ok" : code < 400 ? "badge--redirect" : "badge--error";
  return `<span class="badge ${cls}">${code}</span>`;
}

function boolIcon(val) {
  return val
    ? `<span class="bool-icon bool-icon--yes" aria-label="yes">✓</span>`
    : `<span class="bool-icon bool-icon--no"  aria-label="no">✗</span>`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
