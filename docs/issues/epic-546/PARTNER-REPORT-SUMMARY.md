# Partner context — Voice Commerce (EPIC-546)

**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)  
**Audience:** Maintainers implementing packaging and TLS behavior for `@signal-meaning/voice-agent-backend`.

---

## Defect (packaging)

- **Observed:** `@signal-meaning/voice-agent-backend@0.2.10` ships `scripts/openai-proxy/run.ts`. When `HTTPS=1` / `HTTPS=true`, the script `require('selfsigned')`, but `selfsigned` was listed only under **`devDependencies`**. Consumers do not get nested devDependencies → **`MODULE_NOT_FOUND: selfsigned`**. Proxy subprocess exits; OpenAI-backed flows break.
- **Immediate ask:** Move `selfsigned` to **`dependencies`**, or remove the runtime `require` from consumer-hit paths; publish a patch (e.g. 0.2.11).

## Strategic asks (non-blocking for minimal patch)

- Prefer **HTTP-by-default** for the embedded proxy unless the host explicitly configures TLS for the proxy.
- Avoid **inheriting** the main app’s global `HTTPS=true` unintentionally for the proxy subprocess.
- Support **PEM-from-env** (mkcert-friendly); no in-process generation on that path.
- **Optional** in-process dev cert only behind an **explicit** opt-in flag.
- **No** runtime cert generation when `NODE_ENV=production` (or equivalent deployed signal).

## Workaround (until upstream fix)

- Direct dependency on `selfsigned` in the host app, **or** run proxy with `HTTPS` unset/false if the browser strategy allows `ws` to the proxy.

## Internal partner references (Voice Commerce)

- EPIC-1131 (Voice Commerce mounts voice agent + OpenAI proxy).
- Their mkcert docs apply to the **main** API TLS; the OpenAI proxy is a **separate** listener (e.g. port 8080) unless paths and SANs are aligned.

Full vendor report text may live in Voice Commerce’s own issue tracker; this summary is sufficient to drive **#547–#552** in this repo.
