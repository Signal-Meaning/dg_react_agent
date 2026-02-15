# Issue #454: Document – Third parties maintain their own backend contracts for function calls

**GitHub:** [#454 Document: Third parties maintain their own backend contracts for function calls](https://github.com/Signal-Meaning/dg_react_agent/issues/454)  
**Epic:** [#455 – Real-API tests, function-call contract, and 3pp scope](../ISSUE-455/README.md)

**Note:** This is a documentation-only issue. It may be done in **any order** with #452 and #453. When the issue is completed, **update both this README and the epic [TRACKING.md](../ISSUE-455/TRACKING.md)**.

---

## Summary

Third parties (e.g. voice-commerce) maintain their own backend contracts for any specific functions they expose (e.g. per-route `/api/functions/search-products` or custom request/response shapes). We stick to the **common** single-endpoint contract (`POST /function-call` with `{ content }` / `{ error }`) for all functions in this repo’s test-app and documentation. Callers that need a different shape implement an adapter or their own backend and are responsible for their own contracts and tests.

---

## Acceptance Criteria

- [x] **Contract doc updated** – e.g. `docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md` (or related doc) states that 3pp maintain their own backend contracts.
- [x] **Expectations clear** – Readers understand we keep the common shape; 3pp own their contracts and tests.
- [x] **Docs updated on completion** – When all work is done, both this README and the epic [TRACKING.md](../ISSUE-455/TRACKING.md) are updated. Close #454 on GitHub with a link to this doc and TRACKING.

---

## Status (update when issue is completed)

| Criterion | Status |
|----------|--------|
| BACKEND-FUNCTION-CALL-CONTRACT or related updated | ✅ Section “Intent and third-party scope” |
| 3pp “maintain own contracts” stated | ✅ Same section |
| This README and TRACKING.md updated | ✅ |
| Issue closed | ⬜ (close on GitHub when merging PR) |

---

## Docs

- **[../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md](../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md)** – Backend contract (project docs).
- **[../ISSUE-455/TRACKING.md](../ISSUE-455/TRACKING.md)** – Epic tracking; update it and this README when this issue is completed.
