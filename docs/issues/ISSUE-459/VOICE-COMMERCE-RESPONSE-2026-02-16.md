# voice-commerce response (2026-02-16)

**From:** voice-commerce  
**To:** dg_react_agent team  
**Re:** Our 2026-02-16 follow-up ([RESPONSE-TO-VOICE-COMMERCE-FOLLOW-UP.md](./RESPONSE-TO-VOICE-COMMERCE-FOLLOW-UP.md))  
**Tracking:** [Issue #462](https://github.com/Signal-Meaning/dg_react_agent/issues/462) — Fix conversation_already_has_active_response still on 0.9.1; release then follow up with voice-commerce.

---

## Summary (our paraphrase)

- They will keep log sanitization until the error is resolved and will help with logs/repro.
- **Proxy logs:** They use `LOG_LEVEL=debug` when starting the backend; proxy inherits it. They have a capture script (`docs/issues/issue-901/capture-proxy-log.sh`) that starts backend with debug, runs the failing E2E, and writes to `capture.log`. They will paste the relevant excerpt (first connection through function-call flow to error) and fill in the Analysis template (session.update count, response.create count, order).
- **Double submission:** They do **not** call `sendFunctionCallResponse` twice for the same call. They use `processedFunctionCallIdsRef` (Set of function call `id`s): at the start of `handleFunctionCallRequest` they check `if (processedFunctionCallIdsRef.current.has(id))` and return without sending; then they add `id` to the set. So at most one send per `id`. They can add a log before each `sendFunctionCallResponse` or when skipping a duplicate if we want proof in the next capture.
- **Minimal repro:** They can prepare one (connect → one user message → one function call → one sendFunctionCallResponse) and share if the proxy log doesn’t give a clear root cause.
- **E2E + debug:** They can run the failing E2E and attach backend + frontend logs in the same follow-up.

They may send the document as-is (with capture steps and template) or with the log excerpt and analysis already filled in.

---

## Next steps (dg_react_agent)

1. **Get the log excerpt** (from voice-commerce’s follow-up with excerpt + analysis, or from our own capture): Use it to check session.update count, response.create count, and message order. Look for a second session.update, a second response.create for the same turn, or responseInProgress cleared too early.
2. **If we run our own capture:** test-app or voice-commerce minimal repro with LOG_LEVEL=debug to reproduce and capture proxy logs locally.
3. **Follow up** with voice-commerce: either root cause + fix (e.g. patch release) or request for minimal repro if logs are inconclusive.
