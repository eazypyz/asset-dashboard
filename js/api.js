// js/api.js

const DATA_BASE = "./data";

/**
 * Coba load manifest. Kalau gagal atau kosong,
 * fallback ke GitHub API untuk list semua file di data/domains/
 */
export async function fetchManifest() {
  try {
    const res = await fetch(`${DATA_BASE}/manifest.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const manifest = await res.json();

    // Kalau manifest ada tapi domains kosong, coba GitHub API
    if (!manifest.domains?.length) {
      manifest.domains = await listDomainsFromRepo();
    }
    return manifest;
  } catch {
    // Manifest tidak ada sama sekali, fallback ke GitHub API
    const domains = await listDomainsFromRepo();
    return { updated: null, domains };
  }
}

/**
 * Baca daftar domain langsung dari GitHub API
 * Bekerja tanpa autentikasi untuk repo public
 */
async function listDomainsFromRepo() {
  try {
    // Ambil repo info dari URL GitHub Pages
    const { owner, repo } = detectRepoFromUrl();
    if (!owner) return [];

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/data/domains`;
    const res = await fetch(apiUrl, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return [];

    const files = await res.json();
    return files
      .filter((f) => f.name.endsWith(".json"))
      .map((f) => f.name.replace(".json", ""))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Deteksi owner/repo dari URL GitHub Pages saat ini
 * Format: https://owner.github.io/repo/ atau custom domain
 */
function detectRepoFromUrl() {
  const hostname = window.location.hostname;
  const pathParts = window.location.pathname.split("/").filter(Boolean);

  // Format standar GitHub Pages: username.github.io/repo
  if (hostname.endsWith(".github.io")) {
    const owner = hostname.replace(".github.io", "");
    const repo  = pathParts[0] ?? "";
    return { owner, repo };
  }

  // Custom domain — baca dari meta tag yang akan kita tambah di index.html
  const meta = document.querySelector('meta[name="github-repo"]');
  if (meta) {
    const [owner, repo] = meta.content.split("/");
    return { owner, repo };
  }

  return { owner: null, repo: null };
}

export async function fetchDomain(domain) {
  const res = await fetch(`${DATA_BASE}/domains/${domain}.json`);
  if (!res.ok) throw new Error(`Domain data not found: ${domain}`);
  return res.json();
}

export async function fetchAllDomains(domains) {
  return Promise.all(
    domains.map((d) => fetchDomain(d).catch(() => null)),
  );
}

export async function fetchHistory(domain) {
  const res = await fetch(`${DATA_BASE}/history/${domain}.json`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchAllSubdomains(domains) {
  const records = await fetchAllDomains(domains);
  return records
    .filter(Boolean)
    .flatMap((r) => r.subdomains.map((s) => ({ ...s, _domain: r.domain })));
}
