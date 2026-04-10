# Issue #571 — next step

**GitHub:** [#571](https://github.com/Signal-Meaning/dg_react_agent/issues/571) (**closed**); fix [#572](https://github.com/Signal-Meaning/dg_react_agent/pull/572) on **`main`**.

---

## Done

- Branch **`issue-571`**, PR **#572**, merge to **`main`**, issue **#571** closed.
- **TDD + implementation:** `attach-upgrade.js` queue, `tests/voice-agent-backend-issue-571-createOpenAIWss-queue.test.js`.
- **Release prep on `release/v0.11.1`:** Root **0.11.1**, backend **0.2.13**, `docs/releases/v0.11.1/` (`CHANGELOG`, `PACKAGE-STRUCTURE`, `RELEASE-NOTES`), `npm run validate:release-docs 0.11.1`, lint, audit, `test:mock`, targeted Jest (see [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) Progress).

---

## Recommended follow-ups (publish)

1. **Push** — completed **2026-04-10** (`origin/release/v0.11.1`).
2. **GitHub Release** — Tag **`v0.11.1`**, target branch **`release/v0.11.1`** (not `main` until versions exist on that branch). See [docs/PUBLISHING-AND-RELEASING.md](../../PUBLISHING-AND-RELEASING.md).
3. **CI** — Confirm **Test and Publish** green; **`latest`** on GitHub Packages if you verify manually.
4. **Optional qualification** — With `OPENAI_API_KEY`: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts`; from `test-app`, OpenAI E2E slice per checklist.
5. **Mergeback** — PR **`release/v0.11.1` → `main`** so published versions and `docs/releases/v0.11.1/` land on **`main`**.
6. **Issue docs** — [README](./README.md) / [CURRENT-STATUS](./CURRENT-STATUS.md) already reflect **closed** and release branch; refresh [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) checkboxes after publish.

---

## References

- [README.md](./README.md) — defect description and file pointers.
- [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) — full release checklist.
- [TRACKING.md](./TRACKING.md) — TDD checklist (complete).
