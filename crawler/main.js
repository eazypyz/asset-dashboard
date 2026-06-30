// crawler/main.js
// Orchestrates the full collection pipeline for every configured domain.
// Pipeline order is fixed per the specification:
//   collect → normalise → deduplicate → dns → http → files → hashes
//   → change detection → save → manifest

import { config } from "./config.js";
import { buildProviders } from "./providers/registry.js";
import { resolveAll } from "./validators/dns.js";
import { probeAll } from "./validators/http.js";
import { collectFiles } from "./collectors/file_collector.js";
import { buildSubdomainRecords } from "./processors/result_builder.js";
import { detectChanges } from "./processors/change_detector.js";
import {
  loadDomainData,
  saveDomainData,
  appendHistory,
  saveFileContent,
  updateManifest,
} from "./storage/json_store.js";

async function main() {
  console.log("═".repeat(60));
  console.log(`Asset Collector — ${new Date().toISOString()}`);
  console.log(`Domains: ${config.domains.join(", ")}`);
  console.log("═".repeat(60));

  const providers = buildProviders();
  if (!providers.length) {
    console.error(
      `No providers enabled for selection "${config.selectedProvider}".`,
    );
    if (config.selectedProvider === "securitytrails") {
      console.error(
        "Reason: SECURITYTRAILS_API_KEY secret is missing or empty.",
      );
    }
    process.exit(1);
  }
  console.log(`Active provider(s): ${providers.map((p) => p.name).join(", ")}`);

  const processedDomains = [];

  for (const domain of config.domains) {
    try {
      await processDomain(domain, providers);
      processedDomains.push(domain);
    } catch (err) {
      console.error(`[main] FATAL error for ${domain}: ${err.message}`);
      console.error(err.stack);
      // Continue with remaining domains
    }
  }

  await updateManifest(processedDomains);
  console.log("\n✅ Collection complete.");
}

async function processDomain(domain, providers) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Processing: ${domain}`);
  console.log("─".repeat(60));

  // ── 1. Collect subdomains from all providers ───────────────────────────────
  const sourcesMap = new Map(); // host → string[]

  for (const provider of providers) {
    const hosts = await provider.fetchSubdomains(domain);
    for (const host of hosts) {
      if (!sourcesMap.has(host)) sourcesMap.set(host, []);
      sourcesMap.get(host).push(provider.name);
    }
  }

  // ── 2. Normalise + deduplicate (Map keys are already unique) ──────────────
  const allHosts = [...sourcesMap.keys()].sort();
  console.log(`[pipeline] ${allHosts.length} unique subdomains after dedup`);

  // ── 3. DNS resolution ─────────────────────────────────────────────────────
  const dnsResults = await resolveAll(allHosts);
  const resolvedHosts = allHosts.filter((h) => dnsResults.get(h));

  // ── 4. HTTP availability check ────────────────────────────────────────────
  const httpResults = await probeAll(resolvedHosts);
  const aliveHosts  = resolvedHosts.filter((h) => httpResults.get(h)?.alive);

  // ── 5. Fetch robots / security.txt / sitemap ──────────────────────────────
  const fileResults = await collectFiles(aliveHosts);

  // ── 6. Load previous data for change detection + first_seen tracking ──────
  const previous     = await loadDomainData(domain);
  const previousList = previous?.subdomains ?? [];
  const previousMap  = new Map(previousList.map((s) => [s.host, s]));

  // ── 7. Build normalised records ────────────────────────────────────────────
  const subdomains = buildSubdomainRecords({
    hosts: allHosts,
    sourcesMap,
    dnsResults,
    httpResults,
    fileResults,
    previousMap,
  });

  // ── 8. Detect changes ─────────────────────────────────────────────────────
  const changes = detectChanges(previousList, subdomains);
  if (changes.length) {
    console.log(`[pipeline] ${changes.length} change event(s) detected`);
    changes.forEach((e) => console.log(`  → ${e.type}: ${e.host}`));
  } else {
    console.log("[pipeline] No changes detected");
  }

  // ── 9. Persist well-known file contents ───────────────────────────────────
  for (const [host, files] of fileResults.entries()) {
    if (files.robots?.content)   await saveFileContent("robots",   domain, host, files.robots.content);
    if (files.security?.content) await saveFileContent("security", domain, host, files.security.content);
    if (files.sitemap?.content)  await saveFileContent("sitemaps", domain, host, files.sitemap.content);
  }

  // ── 10. Save domain record ─────────────────────────────────────────────────
  const record = {
    domain,
    last_update: new Date().toISOString(),
    stats: buildStats(subdomains),
    subdomains,
  };
  await saveDomainData(domain, record);

  // ── 11. Append to history ──────────────────────────────────────────────────
  await appendHistory(domain, changes);

  console.log(`[pipeline] Saved ${subdomains.length} subdomains for ${domain}`);
}

function buildStats(subdomains) {
  return {
    total:        subdomains.length,
    dns_resolved: subdomains.filter((s) => s.dns).length,
    alive:        subdomains.filter((s) => s.alive).length,
    has_robots:   subdomains.filter((s) => s.robots).length,
    has_security: subdomains.filter((s) => s.security_txt).length,
    has_sitemap:  subdomains.filter((s) => s.sitemap).length,
  };
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
