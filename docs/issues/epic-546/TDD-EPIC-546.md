# TDD plan — EPIC-546 (OpenAI proxy TLS & packaging)

**Rule:** Tests define behavior first (red), then implementation (green), then refactor. This repo’s `.cursorrules` require TDD for feature work.

---

## Scope of testing


| Layer                         | Location (typical)                                                                    | Use for EPIC-546                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Unit**                      | `tests/` (Jest, repo root)                                                            | `openai-proxy-tls-resolve.test.ts`, `packaging/voice-agent-backend-runtime-deps.test.ts`, and other pure helpers |
| **Integration**               | `tests/integration/openai-proxy-integration.test.ts`                                  | Proxy server creation, WebSocket path, optional HTTPS/WSS with test certs or HTTP                      |
| **Packaging / install smoke** | Script or CI job (see [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md)) | `npm pack` + production `npm install` + spawn proxy; assert no `MODULE_NOT_FOUND`                      |
| **E2E**                       | `test-app/tests/e2e/`                                                                 | Only if browser/ws mixed-content or full stack must be proven; run from `test-app` per project rules   |


---

## Red → Green → Refactor (per issue)

For each sub-issue, the corresponding [TRACKING-547.md](./TRACKING-547.md) … [TRACKING-552.md](./TRACKING-552.md) file lists concrete checkboxes. At minimum:

1. **RED** — Add or extend a test that fails under the **old** behavior or proves the defect (e.g. missing module after prod install, wrong env interpretation).
2. **GREEN** — Minimal code + `package.json` changes until the test passes.
3. **REFACTOR** — Clarify names, extract helpers, keep tests green.

---

## Commands (reference)

From **repo root** (unless noted):

- `npm test` — full Jest suite (mock-first CI expectation).
- `npm test -- tests/integration/openai-proxy-integration.test.ts` — proxy integration.
- `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` — when release qualification requires real upstream (see workspace rules for proxy fixes).

From **test-app** (E2E only if needed):

- `npm run test:e2e -- <spec>` — targeted Playwright specs.

**voice-agent-backend** tests may run via root workspace scripts; follow `package.json` at repo root and `packages/voice-agent-backend/package.json`.

---

## Dependencies and mocks

- Do not invent upstream messages to turn tests green; fix protocol, packaging, or expectations.
- Packaging tests should simulate a **consumer tree** (no `devDependencies` of the published package), not only the monorepo dev install.

---

## Completion

Epic TDD is done when:

- [ ] Every sub-issue tracking file has its “Definition of done” checkboxes satisfied.
- [ ] [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md) is checked off for the release that ships the work.
