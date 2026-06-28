// js/app.js
// Application controller: coordinates data loading, filter state, and rendering.
// Single source of truth for app state; delegates all presentation to ui.js.

import { fetchManifest, fetchAllSubdomains, fetchHistory } from "./api.js";
import {
  applyFilters, computeStats, extractSources, DEFAULT_FILTERS,
} from "./filters.js";
import {
  renderStats, renderTableHeader, renderTableRows,
  renderHistory, renderDomainSelect, renderCharts, showToast,
} from "./ui.js";

// ── State ─────────────────────────────────────────────────────────────────────

const state = {
  allSubdomains:    [],   // full unfiltered dataset
  filteredSubdomains: [],
  filters:          { ...DEFAULT_FILTERS },
  domains:          [],
  manifest:         null,
  loading:          false,
};

// ── DOM references (cached once on init) ──────────────────────────────────────

const $ = (id) => document.getElementById(id);

const els = {
  loading:     $("loading"),
  app:         $("app"),
  statsGrid:   $("stats-grid"),
  tbody:       $("table-body"),
  thead:       $("table-head"),
  domainSelect:$("domain-select"),
  searchInput: $("search-input"),
  filterStatus:$("filter-status"),
  filterDns:   $("filter-dns"),
  filterRobots:$("filter-robots"),
  filterSec:   $("filter-security"),
  filterSitemap:$("filter-sitemap"),
  sourceList:  $("source-filter-list"),
  resultCount: $("result-count"),
  lastUpdated: $("last-updated"),
  themeToggle: $("theme-toggle"),
  barChart:    $("chart-bar"),
  donutChart:  $("chart-donut"),
  historyPanel:$("history-panel"),
  historyList: $("history-list"),
  exportBtn:   $("export-btn"),
  clearBtn:    $("clear-filters"),
};

// ── Bootstrap ─────────────────────────────────────────────────────────────────

export async function init() {
  restoreTheme();
  bindStaticListeners();

  try {
    setLoading(true);
    const manifest = await fetchManifest();
    state.manifest = manifest;
    state.domains  = manifest.domains;

    renderDomainSelect(els.domainSelect, state.domains);
    els.lastUpdated.textContent = `Last scan: ${fmtDateTime(manifest.updated)}`;

    state.allSubdomains = await fetchAllSubdomains(state.domains);
    applyAndRender();
    setLoading(false);
    showToast(`Loaded ${state.allSubdomains.length} subdomains across ${state.domains.length} domains`, "success");
  } catch (err) {
    setLoading(false);
    showError(err);
  }
}

// ── Filter & render cycle ─────────────────────────────────────────────────────

function applyAndRender() {
  state.filteredSubdomains = applyFilters(state.allSubdomains, state.filters);

  const stats = computeStats(state.filteredSubdomains);
  renderStats(stats, els.statsGrid);
  renderTableHeader(els.thead, state.filters.sortKey, state.filters.sortDir, onSort);
  renderTableRows(els.tbody, state.filteredSubdomains);
  renderCharts(stats, els.barChart, els.donutChart);
  renderSourceFilters(extractSources(state.allSubdomains));

  els.resultCount.textContent =
    `${state.filteredSubdomains.length.toLocaleString()} / ${state.allSubdomains.length.toLocaleString()} hosts`;
}

// ── Listeners ─────────────────────────────────────────────────────────────────

function bindStaticListeners() {
  // Search — debounced
  let debounce;
  els.searchInput?.addEventListener("input", (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.filters.query = e.target.value;
      applyAndRender();
    }, 250);
  });

  // Simple select filters
  const selectMap = {
    "filter-status":   "status",
    "filter-dns":      "dns",
    "filter-robots":   "robots",
    "filter-security": "security",
    "filter-sitemap":  "sitemap",
  };
  Object.entries(selectMap).forEach(([id, key]) => {
    $(id)?.addEventListener("change", (e) => {
      state.filters[key] = e.target.value;
      applyAndRender();
    });
  });

  // Domain selector — filters dataset before applying other filters
  els.domainSelect?.addEventListener("change", async (e) => {
    const domain = e.target.value;
    try {
      setLoading(true);
      if (domain === "all") {
        state.allSubdomains = await fetchAllSubdomains(state.domains);
      } else {
        state.allSubdomains = await fetchAllSubdomains([domain]);
        await loadHistory(domain);
      }
      applyAndRender();
      setLoading(false);
    } catch (err) { setLoading(false); showError(err); }
  });

  // Theme toggle
  els.themeToggle?.addEventListener("click", toggleTheme);

  // Clear all filters
  els.clearBtn?.addEventListener("click", () => {
    state.filters = { ...DEFAULT_FILTERS };
    resetFilterUI();
    applyAndRender();
  });

  // Export to CSV
  els.exportBtn?.addEventListener("click", exportCsv);
}

function onSort(key) {
  if (state.filters.sortKey === key) {
    state.filters.sortDir = state.filters.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.filters.sortKey = key;
    state.filters.sortDir = "asc";
  }
  applyAndRender();
}

function renderSourceFilters(sources) {
  if (!els.sourceList) return;
  els.sourceList.innerHTML = sources.map((src) => {
    const checked = state.filters.sources.includes(src);
    return `<label class="source-check">
      <input type="checkbox" value="${src}" ${checked ? "checked" : ""}>
      <span>${src}</span>
    </label>`;
  }).join("");

  els.sourceList.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      state.filters.sources = [...els.sourceList.querySelectorAll("input:checked")]
        .map((el) => el.value);
      applyAndRender();
    });
  });
}

async function loadHistory(domain) {
  try {
    const { fetchHistory } = await import("./api.js");
    const events = await fetchHistory(domain);
    renderHistory(els.historyList, events);
    els.historyPanel?.classList.remove("hidden");
  } catch {
    /* history is optional */
  }
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  els.themeToggle.textContent = isDark ? "☀ Light" : "☾ Dark";
  // Redraw charts to reflect new colour scheme
  if (state.filteredSubdomains.length) {
    renderCharts(computeStats(state.filteredSubdomains), els.barChart, els.donutChart);
  }
}

function restoreTheme() {
  const saved = localStorage.getItem("theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = saved ? saved === "dark" : prefersDark;
  if (dark) document.documentElement.classList.add("dark");
  if (els.themeToggle) els.themeToggle.textContent = dark ? "☀ Light" : "☾ Dark";
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCsv() {
  const headers = ["host","domain","sources","dns","alive","status",
                   "robots","security_txt","sitemap","first_seen","last_seen"];
  const rows = state.filteredSubdomains.map((s) => [
    s.host, s._domain, (s.source ?? []).join("|"),
    s.dns, s.alive, s.status ?? "",
    s.robots, s.security_txt, s.sitemap,
    s.first_seen ?? "", s.last_seen ?? "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), {
    href: url, download: "asset-export.csv",
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`Exported ${rows.length} rows`, "success");
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function setLoading(on) {
  state.loading = on;
  els.loading?.classList.toggle("hidden", !on);
  els.app?.classList.toggle("hidden", on);
}

function showError(err) {
  console.error(err);
  showToast(`Error: ${err.message}`, "error");
  // Show a helpful state when no data is available yet
  if (els.tbody) {
    els.tbody.innerHTML = `<tr><td colspan="11" class="td-empty td-empty--error">
      <strong>No data available.</strong><br>
      Run the GitHub Actions workflow to collect data, then refresh this page.
    </td></tr>`;
  }
  els.app?.classList.remove("hidden");
  els.loading?.classList.add("hidden");
}

function resetFilterUI() {
  if (els.searchInput)       els.searchInput.value = "";
  if (els.filterStatus)      els.filterStatus.value = "all";
  if (els.filterDns)         els.filterDns.value = "all";
  if (els.filterRobots)      els.filterRobots.value = "all";
  if (els.filterSec)         els.filterSec.value = "all";
  if (els.filterSitemap)     els.filterSitemap.value = "all";
}

function fmtDateTime(iso) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
