# Issue #410: Backend consolidation and test-app polish

**Branch:** `davidrmcgee/issue410`  
**GitHub:** [#410](https://github.com/Signal-Meaning/dg_react_agent/issues/410)

---

## Scope

### Done (backend consolidation)

- Single backend server (`test-app/scripts/backend-server.js`) hosts both Deepgram and OpenAI proxy endpoints.
- Removed duplicate proxy logic; OpenAI proxy runs via spawned `scripts/openai-proxy/run.ts`.
- Docs: `docs/BACKEND-PROXY/ARCHITECTURE.md`, script renames, release checklists.

### Open (follow-ups in this scope)

1. **setState-during-render bug (mute button)** — **Fixed**  
   **Symptom:** React error: "Cannot update a component (`ForwardRef(DeepgramVoiceInteraction)`) while rendering a different component (`App`)." Stack points to `interruptAgent` (index.tsx) called from App.tsx (mute toggle).  
   **Cause:** `handleMuteToggle` called `deepgramRef.current.interruptAgent()` inside the `setTtsMuted(prev => { ... })` updater. Invoking ref methods that dispatch state inside a parent’s state updater can run during commit and trigger the warning.  
   **Fix (done):** Compute next mute value, call `setTtsMuted(nextMuted)`, then call `interruptAgent()` / `allowAgent()` in the same handler outside the updater. See `test-app/src/App.tsx` `handleMuteToggle`.

2. **Instructions loader – browser log noise** — **Fixed**  
   In the browser, loading instructions always falls back to default (file read not supported). The previous `console.warn(..., error)` made it look like a failure.  
   **Fix (done):** In `loadInstructionsFromFile`, when in browser and the error is "File reading not supported in browser environment", log a single calm `console.log('Using default instructions (file load not available in browser).')` instead of a warning. A TODO remains for the sync loader if desired.

---

## References

- BACKEND-PROXY: `docs/BACKEND-PROXY/ARCHITECTURE.md`
- OpenAI proxy input_text/output_text fix: commit on same branch (translator + tests).
