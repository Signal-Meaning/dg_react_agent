# Tracking — GitHub #549

**Issue:** [OpenAI proxy: TLS from PEM paths (mkcert / operator-provided certs)](https://github.com/Signal-Meaning/dg_react_agent/issues/549)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

Support **HTTPS/WSS** using operator-provided **key and certificate files** (e.g. mkcert), with **no** `selfsigned.generate()` on this path.

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) § Mode 2
- [TDD-EPIC-546.md](./TDD-EPIC-546.md)
- [PARTNER-REPORT-SUMMARY.md](./PARTNER-REPORT-SUMMARY.md)

## Env names (finalize in implementation)

- [ ] Confirm final env var names (spec placeholders: `OPENAI_PROXY_TLS_KEY_PATH`, `OPENAI_PROXY_TLS_CERT_PATH`).
- [ ] Update [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) to match shipped names.

## TDD — RED

- [ ] Add test that supplies temp PEM files (or fixtures in `tests/fixtures/`) and expects proxy/server to listen with TLS.
- [ ] Add negative tests: missing file, unreadable path, only one of key/cert set — expect clear error (define expected behavior in test).

## TDD — GREEN

- [ ] Implement `https.createServer` using `fs.readFileSync` or async equivalent consistent with `run.ts` startup.
- [ ] Wire `createOpenAIProxyServer` / `run.ts` per design.
- [ ] All new tests green.

## TDD — REFACTOR

- [ ] Shared helper for “load TLS options from env” if duplicated.

## Definition of done

- [ ] PEM mode documented for integrators (cross-link [#552](./TRACKING-552.md)).
- [ ] Real key never committed; tests use generated or fixture certs only.
- [ ] GitHub #549 closed with PR link and this file.

## Verification log

- [ ] _Integration test run: date / command / outcome_
- [ ] _Optional: manual mkcert sanity: date / notes_
