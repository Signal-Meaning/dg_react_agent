# Issue #570 — tracking notes

**GitHub checklist:** [#570](https://github.com/Signal-Meaning/dg_react_agent/issues/570)

Use the **issue body on GitHub** for the authoritative checkbox list ([release checklist template](../../../.github/ISSUE_TEMPLATE/release-checklist.md)). **Repo copy:** [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) (fixed versions and commands — keep in sync as you work). This file is for short local notes only.

---

## Branch workflow

1. **`issue-570`** — optional docs / prep PRs linked to #570.
2. **`release/v0.11.0`** — required for version bump, `docs/releases/v0.11.0/`, and the ref GitHub Release targets before tag/publish.

Preferred scripted path (when versions match): `npm run release:issue 0.11.0 minor` per checklist.

---

## While working

- [x] Pre-release: `npm run lint`, `npm run test:mock`; real-API + OpenAI proxy E2E slice per [RELEASE-CHECKLIST.md](./RELEASE-CHECKLIST.md) **2026-04-09**.
- [x] `docs/releases/v0.11.0/` + `npm run validate:release-docs v0.11.0` (minor doc set).
- [x] Bump root (and backend), commit on **`release/v0.11.0`**, GitHub Release **`v0.11.0`**, CI publish, merge **`release/v0.11.0` → `main`** **2026-04-09**.

---

## After publish

- [x] [README.md](./README.md) **Status** **Closed** **2026-04-09**; GitHub **#570** closed same day with resolution comment.
- Optional: record publish run notes under `docs/releases/v0.11.0/` if the project convention includes that.
