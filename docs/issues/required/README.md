# Required completion documentation (by epic)

## What is the `required` directory?

**`docs/issues/required/`** is **not** a GitHub or npm concept. It is a project convention: documentation stored here is **required to complete** the associated epic—specs, TDD plans, per-issue tracking with checkboxes, and (when needed) a folder per GitHub issue (e.g. `epic-546/ISSUE-554/`) for release execution or other work that does not fit a single `TRACKING-NNN.md` file alone.

Older issue docs often live under `docs/issues/ISSUE-NNN/`. **`required`** groups **epic-scoped** completion artifacts in one place so integrators and maintainers know where the “definition of done” lives for that epic.

---

This folder holds **specifications and tracking documents** used to finish an epic under **test-driven development (TDD)**. Each epic has its own subdirectory.

## Epics

| Epic | Directory | GitHub |
|------|-----------|--------|
| OpenAI proxy TLS, packaging, host integration (Voice Commerce) | [epic-546](./epic-546/README.md) | [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546) |

## Conventions

- **Per-issue tracking:** One `TRACKING-<issue-number>.md` per GitHub sub-issue, with visible checkboxes (under the epic directory).
- **Issue folders:** Some issues (e.g. full **release checklist** bodies) use `epic-…/ISSUE-NNN/` with `GITHUB-ISSUE-BODY.md` + `TRACKING.md`.
- **Shared specs:** Epic folder may include `TDD-*.md`, `SPEC-*.md`, and release/qualification docs referenced by all tracking files.
- **Updates:** Check boxes in Git as work completes; keep tracking files the source of truth for epic status alongside GitHub issues.
