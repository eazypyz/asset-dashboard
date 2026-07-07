---
name: Add retries and validation for crt.sh provider
about: Improve crt.sh provider resilience by adding retries, backoff, timeout, and response validation.
---

### What

This PR updates `crawler/providers/crtsh.js` to add:

- Retries with exponential backoff + jitter (configurable MAX_RETRIES).
- Per-request timeout using AbortController.
- Validation of response content-type and JSON payload shape (must be an array).
- Distinguish between permanent (4xx) and transient (5xx/timeout) errors.
- Keep compatibility: provider still returns an empty array on final failure.

### Why

`crt.sh` sometimes returns HTML error pages, rate-limits, or transient network errors. Previously the provider would parse or pass-through invalid responses. This change reduces false-positive results and ensures scans are retried before failing.

### Notes

- No API or schema changes.
- Defaults: MAX_RETRIES=4, TIMEOUT_MS=30_000. Tweak if needed.
