# Issue #412: Audit of console.* call sites

**Branch:** `davidrmcgee/issue412`  
**Parent:** [README.md](./README.md)

This document lists all `console.log`, `console.warn`, and `console.error` call sites to drive migration to the shared logger. Excludes the logger’s own default sink (`src/utils/logger.ts`, `test-app/scripts/logger.js`).

---

## Component and core (src/)

### DeepgramVoiceInteraction (src/components/DeepgramVoiceInteraction/index.tsx)

**Status: ✅ Migrated (Issue #412).** Uses getLogger({ debug: props.debug }), log(), sleepLog(), logConsole('debug'|'info'|'warn'|'error'). No direct console.*.

| Line | Type | Notes |
|------|------|--------|
| (was 232) | warn | Remount detection → logConsole('warn', ...) |
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

**Status: ✅ Migrated (Issue #412).** Uses getLogger({ debug: !!config.debug }); private log() → logger.debug().

### Other src (hooks, utils, websocket)

- **src/hooks/useIdleTimeoutManager.ts:** ✅ Migrated — getLogger({ debug }), logger.debug/info.
- **src/utils/websocket/WebSocketManager.ts:** ✅ Migrated — getLogger({ debug: options.debug }), private log() → logger.debug; connection close → logger.info; errors → logger.error.
- **src/utils/instructions-loader.ts:** ✅ Migrated — getLogger(), log.info/warn.
- **src/utils/function-call-logger.ts:** ✅ Migrated — uses getLogger(); all levels via logger.
- **src/services/AgentStateService.ts:** ✅ Migrated — getLogger({ debug }), private log() → logger.debug.
- **src/utils/component-helpers.ts:** ✅ Migrated — getLogger(), log.warn.
- **src/utils/audio/AudioUtils.ts:** ✅ Migrated — getLogger(), log.warn/error.
- **src/utils/audio/AudioManager.ts:** ✅ Migrated — getLogger({ debug: options.debug }), private log() → logger.debug; errors → logger.error.
- **src/hooks/declarative-props.ts:** ✅ Migrated — getLogger().error in catch.
- **src/utils/instructions-loader.cjs:** ✅ Minimal local log.warn (CJS; shared logger is ESM); single abstraction.
- **src/test-utils/test-helpers.ts:** ✅ Local log() in addInitScript (browser context); no direct console.* at call sites.

---

## Scripts

### openai-proxy (scripts/openai-proxy/)

| File | Status | Notes |
|------|--------|--------|
| server.ts | ✅ Migrated | All former console.log replaced with emitLog (connectionAttrs; Issue #412). |
| run.ts | Allowlist | 40: fatal OPENAI_API_KEY; 73–74: startup listen (bootstrap). |
| cli.ts | Allowlist | 69: usage (CLI). |

### backend-server (test-app/scripts/backend-server.js)

**Status: ✅ Migrated (Issue #412).** All console.* replaced with rootLog (info/debug/warn/error). Fatal startup (no API key) uses rootLog.error then process.exit(1). POST /function-call uses request-scoped logger (rootLog.child({ traceId })). No remaining direct console.*.

---

## Test-app (test-app/src)

- **App.tsx:** ✅ Migrated (Issue #412). Uses getLogger and sessionLogger (logger.child({ traceId: sessionTraceId })); all former console.log/warn/error replaced with sessionLogger.debug/info/warn/error. Only remaining references are comments (e.g. line 222 commented-out test log; line 675 comment about skipping console.error).

---

## Summary

| Area | Status |
|------|--------|
| DeepgramVoiceInteraction | ✅ Migrated |
| IdleTimeoutService | ✅ Migrated |
| useIdleTimeoutManager | ✅ Migrated |
| WebSocketManager | ✅ Migrated |
| AudioUtils, AudioManager, declarative-props, instructions-loader, component-helpers | ✅ Migrated |
| function-call-logger, AgentStateService | ✅ Migrated |
| instructions-loader.cjs | ✅ Local log.warn (CJS) |
| test-helpers | ✅ Local log() in init scripts |
| openai-proxy server.ts | ✅ Migrated (emitLog) |
| openai-proxy run.ts / cli.ts | Allowlist (bootstrap/CLI) |
| backend-server | ✅ Migrated (rootLog) |
| test-app App | ✅ Migrated |

**Allowlist (justified direct console):** Logger default sink only; run.ts fatal + startup; cli usage. See [ALLOWLIST.md](./ALLOWLIST.md).
