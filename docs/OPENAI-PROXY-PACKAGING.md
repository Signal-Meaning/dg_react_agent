# OpenAI proxy: packaging for integrators (Issue #445)

**Audience:** Backend integrators (e.g. voice-commerce) that run the OpenAI Realtime translation proxy.

---

## Where the proxy lives

The **OpenAI translation proxy** (the script that translates between the component protocol and the OpenAI Realtime API) is shipped in **@signal-meaning/voice-agent-backend**, not in the React package.

- **Package:** `@signal-meaning/voice-agent-backend`
- **Path in package:** `scripts/openai-proxy/run.ts` (and server, translator, logger, etc. in the same directory)

---

## How to run the proxy from your backend

**Do not** resolve or depend on `@signal-meaning/voice-agent-react` to run the proxy. Use the **backend** package only.

1. Install the backend package: `npm install @signal-meaning/voice-agent-backend`
2. Resolve the package directory:  
   `const backendPkgDir = path.dirname(require.resolve('@signal-meaning/voice-agent-backend/package.json'));`
3. Spawn the proxy with that directory as `cwd`:  
   `npx tsx scripts/openai-proxy/run.ts`  
   with `cwd: backendPkgDir`, and pass `OPENAI_API_KEY` in the environment (or a `.env` file the proxy can load).

Example (Node):

```js
const path = require('path');
const backendPkgDir = path.dirname(require.resolve('@signal-meaning/voice-agent-backend/package.json'));
// spawn with cwd: backendPkgDir, command: 'npx', args: ['tsx', 'scripts/openai-proxy/run.ts'], env: { OPENAI_API_KEY: process.env.OPENAI_API_KEY }, port: 8081
```

See **packages/voice-agent-backend/README.md** for the full `attachVoiceAgentUpgrade` options and example.

---

## Why not the React package?

The React package (`@signal-meaning/voice-agent-react`) is for **frontend** use: React components and browser-side behavior. The proxy is a **backend** process (WebSocket server, no React). Shipping or resolving it from the React package would force backends to depend on a UI package they do not use and can cause resolve/hoisting issues. Issue #445 moved the proxy into the backend package so backends have a single, correct dependency.

---

## If OpenAI is “disabled” in your app

If your backend disables the OpenAI proxy when it cannot find the script, ensure you are resolving **voice-agent-backend** (not voice-agent-react) for the spawn `cwd`. Update `buildOpenAIOptions()` (or equivalent) to use `require.resolve('@signal-meaning/voice-agent-backend/package.json')` and remove any dependency on the React package for proxy path resolution.

---

## References

- **Backend package README:** `packages/voice-agent-backend/README.md`
- **Proxy README (in package):** `packages/voice-agent-backend/scripts/openai-proxy/README.md`
- **Issue #445:** `docs/issues/ISSUE-445/README.md` (bug report, allocation, acceptance criteria)
- **Packaging policy:** `docs/PACKAGING-POLICY.md`
