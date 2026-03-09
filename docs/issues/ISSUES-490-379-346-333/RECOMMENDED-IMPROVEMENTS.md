# Recommended improvements (PR #490, #379, #346, #333)

Refactors and follow-ups suggested for this PR or later.

---

## Done in this refactor

- **E2E idle-timeout diagnostics:** Added `attachIdleTimeoutDiagnostics(page, testInfo, options)` in `test-app/tests/e2e/helpers/test-helpers.js` so specs no longer repeat the same capture+attach block. The four failing tests (idle-timeout-behavior ×3, idle-timeout-during-agent-speech ×1) now call this helper. Keeps attachment shape and naming consistent.

---

## Recommended next

1. **getIdleTimeoutDiagnostics testids:** The helper uses hardcoded `data-testid` strings inside `page.evaluate()`. To avoid drift, consider passing a small map (e.g. from `SELECTORS`) as a serialized argument into `evaluate` so the single source of truth stays in test-helpers.

2. **TDD doc length:** TDD-ISSUE-346 has grown (run results, isolation table, diagnostics, notes). If it becomes hard to scan, split “Run results” and “Isolation” into a short `DIRECT-MODE-RESULTS.md` and keep the TDD doc focused on phases and requirements.

3. **#346 merge note:** The README holds the one-line “when closing #346, link to #503.” Optionally move that into TDD-ISSUE-346 so the main README stays minimal; the TDD doc is the natural place for issue-specific merge/close notes.

4. **Unit vs E2E Settings helpers:** `assertSettingsStructure` (unit, `component-test-helpers.tsx`) and `assertSettingsStructureE2E` (E2E, `test-helpers.js`) duplicate shape logic. If the shape is stable, consider a shared JSON schema or a small shared validation module used by both (without pulling in the full test runtime in the other).

5. **E2E README:** The “Idle timeout failure diagnostics” and “Targeted runs” bullets are brief. If more E2E docs are added, group “Issue #346 / #379” diagnostics under a single “Failure diagnostics” section with subsections.

---

## Optional (backlog)

- When #503 is picked up: run the four direct-mode tests with the current diagnostics, inspect the attached JSON, then implement VAD parity (component or test-app) per TDD-ISSUE-346 requirement.
- Add a “Status” column to ORDERING.md’s “Recommended order” table (e.g. Done / Deferred / —) so the table doubles as a checklist without re-reading the top status line.
