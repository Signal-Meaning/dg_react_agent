# Specification — OpenAI proxy TLS modes and environment (EPIC-546)

**Status:** Target contract for implementation driven by [#549](https://github.com/Signal-Meaning/dg_react_agent/issues/549)–[#551](https://github.com/Signal-Meaning/dg_react_agent/issues/551). Until implemented, behavior may differ; update this doc when behavior lands.

**Code anchor:** `packages/voice-agent-backend/scripts/openai-proxy/run.ts` and related `server.ts`.

---

## Design goals

1. **Packaging:** Any `require()` / static `import` executed when a consumer runs the shipped proxy entrypoint must resolve from **`dependencies`** (or documented **`peerDependencies`**) of `@signal-meaning/voice-agent-backend`.
2. **Integration:** Embedded subprocess must not silently enable TLS because the host set global `HTTPS=true` for a *different* server (see [#550](https://github.com/Signal-Meaning/dg_react_agent/issues/550)).
3. **Operations:** Prefer **PEM files** (e.g. mkcert) for trusted local HTTPS; avoid in-process generation on production-oriented paths.
4. **Dev ergonomics:** Optional **explicit** in-process dev certificate remains available behind a dedicated flag, not as the default for mounted packages.

---

## Supported modes (normative target)

### Mode 1 — HTTP / WS (default for integrated proxy)

- Proxy listens **HTTP**; WebSocket scheme **ws**.
- No TLS modules required.
- Host documents how the SPA avoids mixed content when the main site is HTTPS (reverse proxy, dev HTTP session, etc.).

### Mode 2 — TLS from PEM paths (recommended for local HTTPS)

- Operator provides **key** and **certificate** file paths via env (exact names **TBD** in implementation; placeholder names below).
- Proxy uses `https.createServer({ key, cert })` reading from disk.
- **No** `selfsigned.generate()` on this path.

**Placeholder env (to be finalized in implementation + docs):**

- `OPENAI_PROXY_TLS_KEY_PATH` — filesystem path to PEM private key  
- `OPENAI_PROXY_TLS_CERT_PATH` — filesystem path to PEM certificate  

### Mode 3 — Explicit insecure dev TLS (in-process cert)

- Enabled **only** when a **dedicated** env is set (exact name **TBD**; e.g. `OPENAI_PROXY_INSECURE_DEV_TLS=1`).
- May use `selfsigned` or equivalent; module must be a **runtime** dependency if this path ships.
- **Must not** activate in production: when `NODE_ENV === 'production'`, do not run in-process generation; prefer Mode 1 or 2 only (see [#551](https://github.com/Signal-Meaning/dg_react_agent/issues/551)).

---

## Deprecation / migration (from current behavior)

**Current (pre-epic):** `HTTPS=true` or `HTTPS=1` triggers `require('selfsigned')` and in-memory cert.

**Target:**

- [ ] Generic `HTTPS` is **not** the sole signal for proxy TLS (or is ignored for proxy unless documented bridge period).
- [ ] Document migration for integrators: set PEM paths, or unset `HTTPS` for proxy subprocess, or set explicit dev flag during transition.

---

## Priority of configuration (resolution order)

Define in implementation and tests (example order — adjust to match code):

1. If `NODE_ENV === 'production'` **and** explicit dev TLS requested → **error or ignore dev TLS** (tests must lock behavior).
2. If PEM key + cert paths valid → **Mode 2**.
3. If explicit dev TLS flag → **Mode 3** (non-production).
4. Else → **Mode 1**.

---

## Packaging rule (normative)

> Any code path that executes a runtime `require()` of an npm package must list that package under **`dependencies`** (or documented **`peerDependencies`**) of `@signal-meaning/voice-agent-backend`.

---

## References

- Partner context: [PARTNER-REPORT-SUMMARY.md](./PARTNER-REPORT-SUMMARY.md)
- Tracking: [TRACKING-549.md](./TRACKING-549.md), [TRACKING-550.md](./TRACKING-550.md), [TRACKING-551.md](./TRACKING-551.md)
