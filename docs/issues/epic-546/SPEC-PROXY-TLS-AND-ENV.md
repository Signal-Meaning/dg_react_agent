# Specification — OpenAI proxy TLS modes and environment (EPIC-546)

**Status:** Implemented in `listen-tls.ts`, `run.ts`, and `attach-upgrade.js`. Integrator-facing documentation: **packages/voice-agent-backend/README.md** (TLS section), [RUN-OPENAI-PROXY.md](../../BACKEND-PROXY/RUN-OPENAI-PROXY.md), Issue [#552](https://github.com/Signal-Meaning/dg_react_agent/issues/552). Doc regression: `tests/docs/openai-proxy-tls-integrator-docs.test.ts`.

**Code anchor:** `packages/voice-agent-backend/scripts/openai-proxy/run.ts`, `listen-tls.ts`, `server.ts`.

---

## Design goals

1. **Packaging:** Any `require()` / static `import` executed when a consumer runs the shipped proxy entrypoint must resolve from **`dependencies`** (or documented **`peerDependencies`**) of `@signal-meaning/voice-agent-backend`.
2. **Integration:** Embedded subprocess must not silently enable TLS because the host set global `HTTPS=true` for a *different* server (see [#550](https://github.com/Signal-Meaning/dg_react_agent/issues/550)).
3. **Operations:** Prefer **PEM files** (e.g. mkcert) for trusted local HTTPS; avoid in-process generation on production-oriented paths.
4. **Dev ergonomics:** Optional **explicit** in-process dev certificate remains available behind a dedicated flag, not as the default for mounted packages.

---

## Supported modes (normative)

### Mode 1 — HTTP / WS (default for integrated proxy)

- Proxy listens **HTTP**; WebSocket scheme **ws**.
- No TLS modules required.
- Host documents how the SPA avoids mixed content when the main site is HTTPS (reverse proxy, dev HTTP session, etc.).

### Mode 2 — TLS from PEM paths (recommended for local HTTPS)

- Operator sets **`OPENAI_PROXY_TLS_KEY_PATH`** and **`OPENAI_PROXY_TLS_CERT_PATH`** to PEM files.
- Proxy uses `https.createServer` reading key/cert from disk.
- **No** `selfsigned.generate()` on this path.

### Mode 3 — Explicit insecure dev TLS (in-process cert)

- Set **`OPENAI_PROXY_INSECURE_DEV_TLS=1`** (or `true`).
- Uses `selfsigned`; listed under **`dependencies`**.
- **Blocked** when `NODE_ENV=production` (fatal exit).

---

## Deprecation / migration

**Previous behavior:** `HTTPS=true` or `HTTPS=1` triggered in-process self-signed TLS in `run.ts`.

**Current:**

- [x] Generic `HTTPS` is **not** the signal for proxy listen TLS (`run.ts` ignores it).
- [x] **`attachVoiceAgentUpgrade`** strips `HTTPS` from the subprocess and sets `OPENAI_PROXY_INSECURE_DEV_TLS` when the outer server is HTTPS and PEM paths are absent.
- [x] Integrator migration documented in package README and RUN-OPENAI-PROXY.

---

## Priority of configuration (resolution order)

Matches `resolveOpenAIProxyListenMode` + `run.ts`:

1. `NODE_ENV=production` and `OPENAI_PROXY_INSECURE_DEV_TLS` → **fatal**.
2. Both PEM paths set → **Mode 2** (file read errors exit).
3. `OPENAI_PROXY_INSECURE_DEV_TLS` → **Mode 3** (non-production).
4. Else → **Mode 1**.

---

## Packaging rule (normative)

> Any code path that executes a runtime `require()` of an npm package must list that package under **`dependencies`** (or documented **`peerDependencies`**) of `@signal-meaning/voice-agent-backend`.

---

## References

- Partner context: [PARTNER-REPORT-SUMMARY.md](./PARTNER-REPORT-SUMMARY.md)
- Tracking: [TRACKING-549.md](./TRACKING-549.md)–[TRACKING-552.md](./TRACKING-552.md)
