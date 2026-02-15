# Issue #452: Document – Function-call backend contract is intentional; callers may customize

**GitHub:** [#452 Document: Function-call backend contract is intentional; callers may customize](https://github.com/Signal-Meaning/dg_react_agent/issues/452)  
**Epic:** [#455 – Real-API tests, function-call contract, and 3pp scope](../ISSUE-455/README.md)

**Note:** This is a documentation-only issue. It may be done in **any order** with #453 and #454. When the issue is completed, **update both this README and the epic [TRACKING.md](../ISSUE-455/TRACKING.md)**.

---

## Summary

The single `POST /function-call` endpoint with request `{ id, name, arguments }` and response `{ content }` or `{ error }` is the **intended API** for this repo (test-app and docs). Callers (e.g. voice-commerce) may customize their own backends and routes; we stick to this common shape. Documentation only—no implementation change.

---

## Acceptance Criteria

- [x] **Locations identified** – Document where the contract and “intentional” message live (e.g. `docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md`, README, release notes).
- [x] **Wording added** – Explicit statement that this contract is intentional and that 3pp may implement different shapes (e.g. per-route `/api/functions/<name>`) on their side.
- [x] **No code change** – Confirmed; documentation only.
- [x] **Docs updated on completion** – When all work is done, both this README and the epic [TRACKING.md](../ISSUE-455/TRACKING.md) are updated. Close #452 on GitHub with a link to this doc and TRACKING.

---

## Status (update when issue is completed)

| Criterion | Status |
|----------|--------|
| Doc locations updated | ✅ `docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md` |
| “Intentional; callers may customize” stated | ✅ Section “Intent and third-party scope” |
| This README and TRACKING.md updated | ✅ |
| Issue closed | ⬜ (close on GitHub when merging PR) |

---

## Docs

- **[../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md](../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md)** – Backend contract (project docs).
- **[../ISSUE-455/TRACKING.md](../ISSUE-455/TRACKING.md)** – Epic tracking; update it and this README when this issue is completed.
