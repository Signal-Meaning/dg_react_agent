# Issue #570 — tracking notes

**GitHub checklist:** [#570](https://github.com/Signal-Meaning/dg_react_agent/issues/570)

Use the **issue body on GitHub** for the authoritative checkbox list ([release checklist template](../../../.github/ISSUE_TEMPLATE/release-checklist.md)). This file is for short local notes only.

---

## Branch workflow

1. **`issue-570`** — optional docs / prep PRs linked to #570.
2. **`release/v0.11.0`** — required for version bump, `docs/releases/v0.11.0/`, and the ref GitHub Release targets before tag/publish.

Preferred scripted path (when versions match): `npm run release:issue 0.11.0 minor` per checklist.

---

## While working

- [ ] Pre-release: `npm run lint`, `npm run test:mock`; full proxy E2E and real-API steps as in #570 when applicable.
- [ ] `docs/releases/v0.11.0/` + `npm run validate:release-docs v0.11.0` (minor → full doc set per template).
- [ ] Bump root (and backend if needed), commit on **`release/v0.11.0`**, then GitHub Release → CI publish → tag → merge to `main` via PR.

---

## After publish

- Update this README [README.md](./README.md) **Status** to **Closed** if you keep folders in sync with GitHub.
- Record publish run / notes under `docs/releases/v0.11.0/` if the project convention includes that.
