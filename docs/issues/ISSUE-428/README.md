# Issue #428: OpenAI proxy path — invoke onSettingsApplied when session.created is received

**Branch:** `davidrmcgee/issue428`  
**GitHub:** [#428](https://github.com/Signal-Meaning/dg_react_agent/issues/428)  
**Severity:** Critical

---

## Summary

When the backend (OpenAI proxy) sends a **`session.created`** message over the WebSocket, the component does not invoke **`onSettingsApplied`**. Consumers (e.g. voice-commerce) rely on `onSettingsApplied` as the readiness signal before sending user messages. For the Deepgram path the component already invokes `onSettingsApplied` when **`SettingsApplied`** is received; the OpenAI proxy path should do the same when **`session.created`** is received (so both providers expose a single readiness contract).

---

## Requested fix

In the component’s message-handling path, when a WebSocket message of type **`session.created`** is received, call the **`onSettingsApplied`** prop (if provided) and update internal “settings applied” state the same way as for **`SettingsApplied`**, so that app and E2E can treat “session created” as the readiness signal for the OpenAI proxy path.

---

## Docs in this directory

| Doc | Purpose |
|-----|--------|
| [README.md](./README.md) | This file — issue summary. |
| [RESOLUTION.md](./RESOLUTION.md) | Resolution plan: location, TDD steps, and implementation notes. |

---

## References

- Bug report body: [../OPENAI-PROXY-BUG-1-BODY.md](../OPENAI-PROXY-BUG-1-BODY.md)
- Deepgram path: `SettingsApplied` handling in `src/components/DeepgramVoiceInteraction/index.tsx` (~lines 2179–2192)
- OpenAI proxy protocol: `scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md` (session.created vs session.updated)
- Related: Issue #414 (proxy/client protocol), Issue #406 (SettingsApplied and session.updated)
