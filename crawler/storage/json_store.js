// crawler/storage/json_store.js
// Handles all file I/O for the crawler.
// All paths are resolved relative to GITHUB_WORKSPACE or the repo root.

import fs from "fs/promises";
import path from "path";
import { config } from "../config.js";

// Repo root = one level up from crawler/
const REPO_ROOT = process.env.GITHUB_WORKSPACE
  ? process.env.GITHUB_WORKSPACE
  : path.resolve(import.meta.dirname, "../");

const abs = (rel) => path.resolve(REPO_ROOT, rel);

/** ── Domain result file ──────────────────────────────────────────────────── */

export async function loadDomainData(domain) {
  const file = abs(`data/domains/${domain}.json`);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return null; // first run or missing
  }
}

export async function saveDomainData(domain, record) {
  await ensureDir(abs("data/domains"));
  const file = abs(`data/domains/${domain}.json`);
  await fs.writeFile(file, JSON.stringify(record, null, 2), "utf8");
}

/** ── Change history ─────────────────────────────────────────────────────── */

export async function appendHistory(domain, events) {
  if (!events.length) return;

  await ensureDir(abs("data/history"));
  const file = abs(`data/history/${domain}.json`);

  let existing = [];
  try {
    existing = JSON.parse(await fs.readFile(file, "utf8"));
  } catch { /* first run */ }

  const updated = [...existing, ...events].slice(-10_000); // cap at 10k entries
  await fs.writeFile(file, JSON.stringify(updated, null, 2), "utf8");
}

/** ── Well-known file storage ─────────────────────────────────────────────── */

export async function saveFileContent(type, domain, host, content) {
  if (!content) return;

  const dir  = abs(`data/${type}/${domain}`);
  await ensureDir(dir);
  const safe = host.replace(/[^a-z0-9._-]/gi, "_");
  await fs.writeFile(path.join(dir, `${safe}.txt`), content, "utf8");
}

/** ── Manifest (index for the frontend) ─────────────────────────────────── */

export async function updateManifest(domains) {
  const file = abs("data/manifest.json");
  const manifest = {
    updated: new Date().toISOString(),
    domains,
  };
  await fs.writeFile(file, JSON.stringify(manifest, null, 2), "utf8");
}

/** ── Helpers ────────────────────────────────────────────────────────────── */

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}
