# Issue #454: Document – Third parties maintain their own backend contracts for function calls

**GitHub:** [#454 Document: Third parties maintain their own backend contracts for function calls](https://github.com/Signal-Meaning/dg_react_agent/issues/454)  
**Epic:** [#455 – Real-API tests, function-call contract, and 3pp scope](../ISSUE-455/README.md)

---

## Summary

Third parties (e.g. voice-commerce) maintain their own backend contracts for any specific functions they expose (e.g. per-route `/api/functions/search-products` or custom request/response shapes). We stick to the **common** single-endpoint contract (`POST /function-call` with `{ content }` / `{ error }`) for all functions in this repo’s test-app and documentation. Callers that need a different shape implement an adapter or their own backend and are responsible for their own contracts and tests.

---

## Completion criteria (track to conclusion)

- [ ] **Contract doc updated** – e.g. `docs/issues/ISSUE-407/BACKEND-FUNCTION-CALL-CONTRACT.md` (or related doc) states that 3pp maintain their own backend contracts.
- [ ] **Expectations clear** – Readers understand we keep the common shape; 3pp own their contracts and tests.
- [ ] **Issue closed** – #454 closed with resolution; link to this doc or to epic TRACKING.md.

---

## Status

| Criterion | Status |
|----------|--------|
| BACKEND-FUNCTION-CALL-CONTRACT or related updated | ⬜ |
| 3pp “maintain own contracts” stated | ⬜ |
| Issue closed | ⬜ |

---

## Docs

- **[../ISSUE-407/BACKEND-FUNCTION-CALL-CONTRACT.md](../ISSUE-407/BACKEND-FUNCTION-CALL-CONTRACT.md)** – Backend contract (primary location for updates).
- **[../ISSUE-455/TRACKING.md](../ISSUE-455/TRACKING.md)** – Epic tracking checklist for this issue.
