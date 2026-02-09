# Issue #414: Doc retention

**Principle:** Keep only docs with a **unique, persistent purpose** (for future devs or contract). Do not retain every twist of the investigation.

## Keep (unique purpose)

| Doc | Purpose |
|-----|--------|
| **README.md** | Issue summary, acceptance criteria, status, pointers. Entry for the issue. |
| **CURRENT-UNDERSTANDING.md** | Single source of truth: two errors (buffer-too-small vs idle-timeout closure), commit strategy, VAD facts, doc index. |
| **REFACTOR-PHASE.md** | Refactor review: scope, correctness, coverage, DRYness, clarity; recommendations. |
| **REGRESSION-SERVER-ERROR-INVESTIGATION.md** | Authoritative record of what was ruled out (4 cycles, session.update not the cause). Prevents re-running same experiments. |
| **COMPONENT-PROXY-INTERFACE-TDD.md** | Persistent contract: component ↔ proxy message types, VAD mapping. |
| **NEXT-STEPS.md** | Plan and priorities; what’s done vs optional next steps. |
| **E2E-RELAXATIONS-EXPLAINED.md** | Why E2E assertions were relaxed (idle_timeout, Repro 9/10, greeting). Undo instructions. |

Wire protocol lives in **scripts/openai-proxy/PROTOCOL-AND-MESSAGE-ORDERING.md** (canonical).

## Remove or fold (investigation twist or redundant)

| Doc | Action | Reason |
|-----|--------|--------|
| **firm-audio-5run-results.txt** | Deleted. | Point-in-time run log; not a persistent artifact. |
| **E2E-RUN-RESULTS.md** | Remove. | One-off run summary; outcomes reflected in NEXT-STEPS / CURRENT. |
| **E2E-FAILURE-REVIEW.md** | Remove. | Failure review twist; conclusions in NEXT-STEPS / E2E-RELAXATIONS. |
| **RESOLUTION-PLAN.md** | Optional: keep or fold §1–2 into CURRENT. | Actionable plan mostly done; headline and “fixed vs remains” useful in CURRENT. |
| **RESOLVING-SERVER-ERROR-AUDIO-CONNECTION.md** | Remove or merge 1 para into REGRESSION. | Overlaps REGRESSION + PROTOCOL; firm-audio protocol is in PROTOCOL. |
| **PASSING-VS-FAILING-TESTS-THEORY.md** | Remove. | Investigation theory; outcome in CURRENT-UNDERSTANDING §2.1. |
| **OPENAI-AUDIO-PLAYBACK-INVESTIGATION.md** | Remove or shorten to 1 page. | Step-by-step investigation; conclusions in README + CURRENT. Test-tone button removed from app. |
| **OPENAI-REALTIME-AUDIO-TESTING.md** | Remove or merge into TEST-STRATEGY. | Generic approach; if kept, move to docs/development. |
| **OPENAI-SESSION-STATE-AND-TESTS.md** | Remove. | Overlaps PROTOCOL and session state in README. |
| **PROTOCOL-TEST-GAPS.md** | Remove. | Point-in-time gaps; covered by integration tests and NEXT-STEPS. |
| **VAD-FAILURES-AND-RESOLUTION-PLAN.md** | Remove or merge into COMPONENT-PROXY-INTERFACE. | VAD resolution; contract is in COMPONENT-PROXY-INTERFACE. |
| **MULTI-TURN-E2E-CONVERSATION-HISTORY.md** | Remove. | Multi-turn context; covered by tests and NEXT-STEPS. |
| **REPRO-RELOAD-STALE-RESPONSE.md** | Remove. | Repro twist; resolution in Repro tests 9/10 and NEXT-STEPS. |

After removals, update **CURRENT-UNDERSTANDING.md** §5 (doc index) to list only retained docs.
