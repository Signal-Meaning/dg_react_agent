# Issue #410: Backend consolidation and test-app polish

**Branch:** `davidrmcgee/issue410`  
**GitHub:** [#410](https://github.com/Signal-Meaning/dg_react_agent/issues/410)

---

## Scope

### Done

- **Backend consolidation:** Single backend server (`test-app/scripts/backend-server.js`) hosts both Deepgram and OpenAI proxy endpoints; removed duplicate proxy logic; OpenAI proxy runs via spawned `scripts/openai-proxy/run.ts`. Docs: `docs/BACKEND-PROXY/ARCHITECTURE.md`, script renames, release checklists.
- **setState-during-render (mute button):** `handleMuteToggle` was calling `interruptAgent()` inside the `setTtsMuted(prev => ...)` updater, causing "Cannot update component while rendering another". Fix: compute `nextMuted`, call `setTtsMuted(nextMuted)`, then call `interruptAgent()` / `allowAgent()` outside the updater. See `test-app/src/App.tsx` `handleMuteToggle`.
- **Instructions loader (async):** In browser, `loadInstructionsFromFile` now logs a calm message instead of `console.warn(..., error)` when the error is "File reading not supported in browser environment". See `src/utils/instructions-loader.ts`.
- **Backend-agnostic logs and redundant test-app logs:** "Settings confirmed by agent", "Text message sent to agent"; removed duplicate addLog entries in test-app that mirrored component logs.

### Remaining TODOs

None. Sync loader updated to use the same calm browser message; async loader comment updated.

---

## References

- BACKEND-PROXY: `docs/BACKEND-PROXY/ARCHITECTURE.md`
- OpenAI proxy input_text/output_text fix: commit on same branch (translator + tests).
