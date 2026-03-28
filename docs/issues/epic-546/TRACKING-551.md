# Tracking — GitHub #551

**Issue:** [OpenAI proxy: explicit insecure dev TLS + forbid in-process cert generation in production](https://github.com/Signal-Meaning/dg_react_agent/issues/551)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

- In-process self-signed certificate generation only when a **dedicated** opt-in env is set (exact name **TBD**; e.g. `OPENAI_PROXY_INSECURE_DEV_TLS=1`).
- When **`NODE_ENV=production`** (and any other agreed “deployed” signals), **do not** call `selfsigned.generate()`; use HTTP or PEM paths only.

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) § Mode 3, Priority
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)

## TDD — RED

- [ ] Test: `NODE_ENV=production` + explicit dev TLS flag → **error exit** or **ignored with documented code path** (choose one; test locks behavior).
- [ ] Test: non-production + explicit dev TLS flag → in-process cert path works (if still supported).
- [ ] Test: dev TLS flag unset → no `selfsigned` load (unless #547 temporarily still moves dep — align with final design).

## TDD — GREEN

- [ ] Implement guards around `selfsigned.generate()`.
- [ ] Ensure `dependencies` still satisfy any remaining dev path ([#547](./TRACKING-547.md), [#548](./TRACKING-548.md)).

## TDD — REFACTOR

- [ ] Clear error messages for misconfiguration (prod + dev TLS).

## Definition of done

- [ ] Behavior documented in integrator docs ([#552](./TRACKING-552.md)).
- [ ] GitHub #551 closed with PR link and this file.

## Verification log

- [ ] _Jest/integration: date / command / outcome_
