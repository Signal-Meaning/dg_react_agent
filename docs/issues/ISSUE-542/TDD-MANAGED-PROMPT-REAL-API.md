# TDD: Managed prompt — real-API qualification via env (Issue #539)

**Purpose:** Qualify **`session.prompt`** on live OpenAI Realtime when the integrator provides a **real** dashboard prompt id, without hardcoding secrets in the repo. When the id env is **unset**, the dedicated integration test **skips** (CI and local mock runs stay green).

**Env (repository root or shell):**

| Variable | Required | Behavior |
|----------|----------|----------|
| `OPENAI_MANAGED_PROMPT_ID` | For real-API managed-prompt test | Non-empty after trim → test runs (with `USE_REAL_APIS=1` + `OPENAI_API_KEY`). Unset or whitespace-only → **skip** (not a failure). |
| `OPENAI_MANAGED_PROMPT_VERSION` | No | Optional template version string (trimmed; empty omitted). |
| `OPENAI_MANAGED_PROMPT_VARIABLES` | No | Optional JSON **object** string for template variables. If set but invalid JSON or non-object → test file or parser **throws** with a clear message (misconfiguration). |

**Implementation:** `tests/integration/helpers/managed-prompt-env.ts` (`parseManagedPromptFromEnv`). **Unit tests:** `tests/managed-prompt-env.test.ts`.

---

## TDD phases

### RED

- [x] Unit: unset / blank id → `undefined`; valid id → object; invalid `VARIABLES` → throw with actionable message.

### GREEN

- [x] Integration: `openai-proxy-integration.test.ts` — `Issue #539 real-API: managed prompt from env …` runs only when `useRealAPIs && parseManagedPromptFromEnv()` is defined; sends `Settings` with `agent.think.managedPrompt` and minimal `think.prompt`; expects `SettingsApplied` then assistant `ConversationText` without component `Error`.

### REFACTOR

- [x] Reuse `runRealApiJsonWsSession` for this test and refactor at least one existing real-API JSON test (#537) to share the helper.

### Verified

- [x] `npm test -- tests/managed-prompt-env.test.ts`
- [x] With keys: `USE_REAL_APIS=1 OPENAI_MANAGED_PROMPT_ID=<your id> npm test -- tests/integration/openai-proxy-integration.test.ts --testNamePattern="Issue #539 real-API"`

---

## References

- [ISSUE-539.md](./ISSUE-539.md)
- [session.update — prompt](https://platform.openai.com/docs/api-reference/realtime-client-events/session/update)
- [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md)
