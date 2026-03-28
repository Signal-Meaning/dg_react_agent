# Tracking — GitHub #555 (OpenAI proxy real-API integration regression)

**Issue:** [OpenAI proxy: real-API integration regressions (USE_REAL_APIS)](https://github.com/Signal-Meaning/dg_react_agent/issues/555)  
**Epic (parent):** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546) — registered as a **GitHub sub-issue** of the epic.

## Goal

Restore confidence in **`USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`** for release qualification: classify failures (repo vs OpenAI), fix or document, and close with evidence.

## Symptoms (recorded)

| Case | Failure mode |
|------|----------------|
| Issue #470 real-API | 60s timeout — no assistant `ConversationText` after function-call backend HTTP + `FunctionCallResponse` |
| `translates InjectUserMessage …` (real API) | 25s Jest timeout; upstream log **`Unexpected server response: 504`** on Realtime WebSocket |

## Work plan

- [ ] Bisect / compare with last green baseline (tag or branch); note commit or “upstream flake”
- [ ] Multiple real-API runs; capture logs (`LOG_LEVEL=debug` if useful)
- [ ] Implement fix **or** document qualification exception + any monitoring
- [ ] Keep `openai-proxy-run-ts-entrypoint.test.ts` green in CI (mock, `run.ts` path)

## Definition of done

Mirror GitHub issue checkboxes; close #555 with PR link and short root-cause note.

## Verification log

_Add dated entries (command, outcome, operator)._

- _…_
