# Tracking — GitHub #550

**Issue:** [OpenAI proxy: scoped TLS env contract — avoid silent inheritance of host HTTPS=true](https://github.com/Signal-Meaning/dg_react_agent/issues/550)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

The proxy subprocess must **not** enable TLS solely because the host exported generic **`HTTPS=true`** for another service. TLS for the OpenAI proxy must follow **proxy-specific** configuration documented with the package.

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) § Deprecation / migration
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)
- [PARTNER-REPORT-SUMMARY.md](./PARTNER-REPORT-SUMMARY.md)

## TDD — RED

- [ ] Add test: env has `HTTPS=1` but **no** proxy TLS opt-in / PEM paths → proxy uses **HTTP** (or documented transitional behavior with deprecation warning).
- [ ] Add test: explicit proxy TLS signal (PEM paths and/or dedicated flag per final spec) → TLS/WSS as expected.

## TDD — GREEN

- [ ] Implement proxy-specific env contract in `run.ts` (and dotenv load order if relevant).
- [ ] Update `test-app` / E2E env examples that set `HTTPS` for proxy so they match the new contract.
- [ ] Tests green.

## TDD — REFACTOR

- [ ] Centralize “resolve listen options” in one module if helpful.

## Migration

- [ ] Document for integrators: unset `HTTPS` for proxy child process **or** set new vars (link from package README / [#552](./TRACKING-552.md)).
- [ ] Changelog entry for behavior change.

## Definition of done

- [ ] No accidental TLS from global `HTTPS` alone (per tests).
- [ ] Docs and examples updated.
- [ ] GitHub #550 closed with PR link and this file.

## Verification log

- [ ] _Unit/integration: date / command / outcome_
- [ ] _E2E if mixed-content path touched: date / command / outcome_
