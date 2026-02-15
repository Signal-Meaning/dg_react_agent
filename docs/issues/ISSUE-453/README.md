# Issue #453: Real-API testing scope – adopt best-practice shape if needed; 3pp backends out of scope

**GitHub:** [#453 Real-API testing scope: adopt best-practice shape if needed; 3pp backends out of scope](https://github.com/Signal-Meaning/dg_react_agent/issues/453)  
**Epic:** [#455 – Real-API tests, function-call contract, and 3pp scope](../ISSUE-455/README.md)

**Note:** This is a documentation-only issue. It may be done in **any order** with #452 and #454. When the issue is completed, **update both this README and the epic [TRACKING.md](../ISSUE-455/TRACKING.md)**.

---

## Summary

**(a)** If a given shape (e.g. from voice-commerce or community) is best practice, we may adopt it only to meet the requirements in #451 (tests passing with USE_REAL_APIS, mock upstream where appropriate). **(b)** voice-commerce and any other third-party backend are **out of scope**—we do not support, mandate, or test against their contracts. Our integration tests use our proxy and mock (or real OpenAI) only.

---

## Acceptance Criteria

- [x] **Scope documented** – Test-strategy or scope doc states that 3pp backends are out of scope (not supported or tested by this repo).
- [x] **Adoption clarified** – Any shape adoption is for our own real-API and mock-upstream testing only, not for supporting 3pp.
- [x] **Locations updated** – e.g. `docs/development/TEST-STRATEGY.md` or equivalent updated.
- [x] **Docs updated on completion** – When all work is done, both this README and the epic [TRACKING.md](../ISSUE-455/TRACKING.md) are updated. Close #453 on GitHub with a link to this doc and TRACKING.

---

## Status (update when issue is completed)

| Criterion | Status |
|----------|--------|
| 3pp out of scope stated | ✅ `docs/development/TEST-STRATEGY.md` section “Third-party backends and scope” |
| “Adoption for our tests only” stated | ✅ Same section |
| Doc locations updated | ✅ |
| This README and TRACKING.md updated | ✅ |
| Issue closed | ⬜ (close on GitHub when merging PR) |

---

## Docs

- **[../ISSUE-455/TRACKING.md](../ISSUE-455/TRACKING.md)** – Epic tracking; update it and this README when this issue is completed.
