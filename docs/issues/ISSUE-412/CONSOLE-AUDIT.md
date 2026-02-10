# Issue #412: Audit of console.* call sites

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md)

This document lists all `console.log`, `console.warn`, and `console.error` call sites to drive migration to the shared logger. Excludes the logger’s own default sink (`src/utils/logger.ts`, `test-app/scripts/logger.js`).

---

## Component and core (src/)

### DeepgramVoiceInteraction (src/components/DeepgramVoiceInteraction/index.tsx)

| Line | Type | Notes |
|------|------|--------|
| 232 | warn | Remount detection |
| 242 | log | Mount (new instance) |
| 405 | warn | VAD conflicting signals |
| 412 | error | VAD event tracking error |
| 441 | log | Internal log() helper |
| 448 | log | Sleep cycle (core) |
| 489–493 | log | Error details (service, code, message, details) |
| 563 | log | getConnectionOptions direct mode |
| 638, 644 | log | VAD config (utterance_end_ms, interim_results) |
| 720, 729 | log | Transcription state (debug) |
| 741 | error | Transcription manager creation exception |
| 775–779 | log | WebSocketManager creation (AGENT) |
| 798, 821 | log | Agent state (debug) |
| 828–839, 848, 854, 862, 870 | log/error | Connection close handling |
| 881–934 | log | Connection state, Settings send |
| 952 | error | Agent manager creation exception |
| 977, 1027, 1033, 1081, 1104, 1121, 1138 | log | Component init / re-init |
| 1190–1241 | log | Cleanup, StrictMode, unmount |
| 1276–1447 | log | agentOptions useEffect / change detection |
| 1510–1662 | log | handleTranscriptionMessage debug, type guard |
| 1727–1762 | log | UtteranceEnd / speech |
| 1792–1823, 1894, 1920–1921, 1937, 1981 | log | sendAgentSettings |
| 1951–1952, 1974–1975 | error | Protocol send failure |
| 2002 | log | FunctionCallResponse send |
| 2026 | log | Thinking state |
| 2056, 2063 | log/error | FunctionCallRequest / error after Settings |
| 2075, 2085 | warn | Agent message handling |
| 2122–2126 | log | UserStartedSpeaking |
| 2169, 2178, 2184–2185, 2198–2199 | log | SettingsApplied, agent events |
| 2224 | log | ConversationText |
| 2279–2326, 2347, 2359, 2404–2410, 2496 | log/warn/error | Function call flow |
| 2513 | log | Server-side function (not handled) |
| 2589, 2629–2660 | log | VAD, audio events |

**Rough count:** ~120+ call sites in the component (many gated by `props.debug` or similar).

### IdleTimeoutService (src/utils/IdleTimeoutService.ts)

| Line | Type | Notes |
|------|------|--------|
| 46, 119, 278, 295, 302, 358, 376, 388, 398, 435, 441, 452, 465, 473, 478 | log | Debug / state (gate on config.debug) |
| 510 | log | Internal this.log() |

**Count:** 17 call sites; all should be gated on debug and moved to logger.

### Other src (hooks, utils, websocket)

- **src/hooks/useIdleTimeoutManager.ts:** 15+ console.log (debug)
- **src/utils/websocket/WebSocketManager.ts:** 1 console.log (DEBUG sendJSON)
- **src/utils/instructions-loader.ts:** 0 (uses calm message per Issue #410)
- **src/utils/function-call-logger.ts:** 0 direct; may use process.env
- **src/services/AgentStateService.ts:** 1
- **src/utils/component-helpers.ts:** 0
- **src/utils/instructions-loader.cjs:** 0

---

## Scripts

### openai-proxy (scripts/openai-proxy/)

| File | Line | Type | Notes |
|------|------|------|--------|
| server.ts | 438, 445, 452 | log | upstream→client message (debug) |
| server.ts | 489, 493 | log | speech_started / speech_stopped (if debug) |
| server.ts | 513, 527 | log | TTS boundary / chunk lengths |
| run.ts | 40 | error | OPENAI_API_KEY required (bootstrap) |
| run.ts | 73–74 | log | Listening message (startup) |
| cli.ts | 69 | log | Usage (CLI) |

**Bootstrap / allowlist candidates:** run.ts:40 (fatal), run.ts:73–74 (startup), cli.ts:69 (usage).

### backend-server (test-app/scripts/backend-server.js)

| Area | Count | Notes |
|------|--------|--------|
| Startup / API key | 104–110, 132, 141–143, 149–150 | Bootstrap / config; some are fatal |
| Connection / Deepgram proxy | 309–334, 340–351, 360–618, 646–704 | Many; use rootLog/requestLog |
| OpenAI forwarder | 736–739, 774, 784, 798 | Subprocess / errors |
| Listen / shutdown | 819–833, 839, 846 | Startup / shutdown |

**Already using logger:** POST /function-call path. Rest to be migrated to rootLog or request-scoped logger.

---

## Test-app (test-app/src)

- **App.tsx:** 2 (console.warn for function-call; console.log audio constraints from URL). See grep for line numbers if needed.

---

## Summary

| Area | Est. count | Priority |
|------|------------|----------|
| DeepgramVoiceInteraction | ~120 | High (gate on debug, use logger) |
| IdleTimeoutService | 17 | High |
| useIdleTimeoutManager | 15 | High |
| WebSocketManager | 1 | Medium |
| openai-proxy server.ts | 6 | Medium (use emitLog with connectionAttrs) |
| openai-proxy run.ts / cli.ts | 3 | Allowlist (bootstrap/CLI) |
| backend-server | ~70 | Medium (use rootLog; request-scoped where applicable) |
| test-app App | 2 | Low |

**Allowlist (justified direct console):** Logger default sink; run.ts fatal + startup; cli usage; backend fatal bootstrap (no key, etc.). See [ALLOWLIST.md](./ALLOWLIST.md).
