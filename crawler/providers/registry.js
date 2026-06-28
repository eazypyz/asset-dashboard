// crawler/providers/registry.js
// Instantiates providers based on config.providers flags.
// Adding a new provider = add one import + one entry in PROVIDER_MAP.

import { config } from "../config.js";
import { CrtshProvider } from "./crtsh.js";
import { SecurityTrailsProvider } from "./securitytrails.js";

// Map of provider-id → factory function
// Factory receives provider-specific config slice
const PROVIDER_MAP = {
  crtsh: (_cfg) => new CrtshProvider(),
  securitytrails: (cfg) => new SecurityTrailsProvider(cfg.apiKey),
};

/**
 * Returns an array of instantiated, enabled providers.
 * @returns {ProviderInterface[]}
 */
export function buildProviders() {
  return Object.entries(config.providers)
    .filter(([, cfg]) => cfg.enabled)
    .map(([id, cfg]) => {
      const factory = PROVIDER_MAP[id];
      if (!factory) throw new Error(`Unknown provider: ${id}`);
      console.log(`[registry] Enabling provider: ${id}`);
      return factory(cfg);
    });
}
