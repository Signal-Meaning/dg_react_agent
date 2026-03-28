# Release and qualification — EPIC-546

Use this checklist when shipping `@signal-meaning/voice-agent-backend` changes for the OpenAI proxy (packaging + TLS contract).

**Full release process (branch, docs, GitHub Release, CI publish, dist-tags, merge to `main`):** GitHub [#554](https://github.com/Signal-Meaning/dg_react_agent/issues/554) — see [ISSUE-554/](./ISSUE-554/README.md).

---

## Versioning

- [ ] **Patch** (e.g. `0.2.11`) for packaging-only fix ([#547](https://github.com/Signal-Meaning/dg_react_agent/issues/547)) if behavior is unchanged except dependency graph / crash fix.
- [ ] **Minor** (e.g. `0.3.0`) if env contract is **breaking** (e.g. removing `HTTPS` as trigger without compatibility shim) — follow semver and changelog.

---

## Pre-publish checks (monorepo)

- [ ] `npm test` (root) passes.
- [ ] `npm test -- tests/integration/openai-proxy-integration.test.ts` passes (mock upstream).
- [ ] `npm test -- tests/integration/openai-proxy-run-ts-entrypoint.test.ts` passes — **same entrypoint as test-app** (`npx tsx scripts/openai-proxy/run.ts` from `packages/voice-agent-backend`, mock upstream via `OPENAI_REALTIME_URL`).
- [ ] Lint / build per release checklist if this repo ties them to publish.
- [ ] If behavior touches proxy↔API ordering or timing: `USE_REAL_APIS=1 npm test -- tests/integration/openai-proxy-integration.test.ts` when `OPENAI_API_KEY` is available (per `.cursorrules` release qualification).

---

## Packaging smoke (consumer simulation)

**Goal:** Prove a clean **production** install loads the proxy without `MODULE_NOT_FOUND`.

- [ ] From `packages/voice-agent-backend`: `npm pack` (or root script if defined).
- [ ] Install tarball in an **empty** temp project: `npm install ./signal-meaning-voice-agent-backend-*.tgz` (exact filename from pack).
- [ ] Do **not** install devDependencies of the tarball as if you were the package author; the temp project should only have the tarball as dependency.
- [ ] Run the proxy entry with `OPENAI_API_KEY` set and env combinations documented for the release (HTTP default; PEM mode; explicit dev TLS if shipped).
- [ ] Confirm process starts and listens (or fails only on expected validation such as missing key), **not** on missing modules.

Record command, date, and outcome in the relevant [TRACKING-547.md](./TRACKING-547.md) / [TRACKING-548.md](./TRACKING-548.md).

---

## Publish

- [ ] Follow [docs/PUBLISHING-AND-RELEASING.md](../../../PUBLISHING-AND-RELEASING.md) for GitHub Packages.
- [ ] Changelog / release notes mention: packaging fix, any env renames, migration from `HTTPS` for proxy.

---

## Post-publish

- [ ] Notify integrators (e.g. Voice Commerce) with version to adopt and removal of `selfsigned` workaround if applicable.
- [ ] Close or update GitHub issues #547–#552 and epic #546 per actual shipped scope.
