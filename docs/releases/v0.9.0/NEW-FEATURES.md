# New Features - v0.9.0

This release does not add new component APIs. It adds **testing and documentation capabilities** and clarifies **backend contract and scope**.

---

## Real-API test support (Epic #455, Issue #451)

### Overview

You can run the relevant test suite against real APIs (e.g. OpenAI provider) using the `USE_REAL_APIS` environment variable. Scope, run instructions, and optional release-step documentation are in place.

### Benefits

- **Confidence:** Verify behavior against real providers before release.
- **Documented scope:** Clear definition of which tests must pass with real APIs.
- **CI-friendly:** Real-API run is optional; CI uses mocks by default.

### Usage

```bash
# Run tests that are in scope for real APIs (see docs/development/TEST-STRATEGY.md)
USE_REAL_APIS=1 npm test
```

See `docs/development/TEST-STRATEGY.md` and `docs/issues/ISSUE-451/` for scope, env vars, and keys.

---

## Function-call backend contract (Issue #452)

### Overview

The single `POST /function-call` backend contract is **intentional**. Callers (e.g. voice-commerce) may customize their own backends; this repo documents the common contract we use for the test-app and reference implementation.

### Documentation

- **Backend contract:** [docs/BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md](../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md)
- **Third-party scope:** Third parties maintain their own backend contracts (Issue #454); we keep the common single-endpoint contract for our package and test-app.

---

## Backend package 0.2.0 (voice-agent-backend)

### Overview

**@signal-meaning/voice-agent-backend** is released as **0.2.0** alongside this component release. It includes the OpenAI proxy moved into the package, fixes for Realtime 401 and real-API tests, and contract/docs updates.

### Relevant for integrators

- No change to the **component** API.
- If you use **voice-agent-backend** (e.g. test-app or a custom backend), upgrade to 0.2.0 for the latest proxy and function-call behavior. See backend README and CHANGELOG for details.

---

## References

- [Epic #455](https://github.com/Signal-Meaning/dg_react_agent/issues/455) — Real-API tests, function-call contract, 3pp scope
- [Release #456](https://github.com/Signal-Meaning/dg_react_agent/issues/456) — Release v0.9.0 checklist
- [TEST-STRATEGY.md](../../development/TEST-STRATEGY.md) — Test strategy and real-API scope
- [BACKEND-FUNCTION-CALL-CONTRACT.md](../../BACKEND-PROXY/BACKEND-FUNCTION-CALL-CONTRACT.md) — Backend contract and 3pp scope
