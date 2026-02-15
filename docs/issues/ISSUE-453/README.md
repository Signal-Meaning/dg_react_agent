# Issue #453: Real-API testing scope – adopt best-practice shape if needed; 3pp backends out of scope

**GitHub:** [#453 Real-API testing scope: adopt best-practice shape if needed; 3pp backends out of scope](https://github.com/Signal-Meaning/dg_react_agent/issues/453)  
**Epic:** [#455 – Real-API tests, function-call contract, and 3pp scope](../ISSUE-455/README.md)

---

## Summary

**(a)** If a given shape (e.g. from voice-commerce or community) is best practice, we may adopt it only to meet the requirements in #451 (tests passing with USE_REAL_APIS, mock upstream where appropriate). **(b)** voice-commerce and any other third-party backend are **out of scope**—we do not support, mandate, or test against their contracts. Our integration tests use our proxy and mock (or real OpenAI) only.

---

## Completion criteria (track to conclusion)

- [ ] **Scope documented** – Test-strategy or scope doc states that 3pp backends are out of scope (not supported or tested by this repo).
- [ ] **Adoption clarified** – Any shape adoption is for our own real-API and mock-upstream testing only, not for supporting 3pp.
- [ ] **Locations updated** – e.g. `docs/development/TEST-STRATEGY.md` or equivalent.
- [ ] **Issue closed** – #453 closed with resolution; link to this doc or to epic TRACKING.md.

---

## Status

| Criterion | Status |
|----------|--------|
| 3pp out of scope stated | ⬜ |
| “Adoption for our tests only” stated | ⬜ |
| Doc locations updated | ⬜ |
| Issue closed | ⬜ |

---

## Docs

- **[../ISSUE-455/TRACKING.md](../ISSUE-455/TRACKING.md)** – Epic tracking checklist for this issue.
