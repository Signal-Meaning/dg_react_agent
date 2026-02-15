# Issue #444: Resolution plan

**Objective:** Remove references to the deprecated package name `@signal-meaning/deepgram-voice-interaction-react` (and the unscoped name `deepgram-voice-interaction-react`) from **source and forward-looking docs only**, so that current package (`@signal-meaning/voice-agent-react`) and repo name (`dg_react_agent`) are used consistently where we control the narrative.

---

## 1. Scope boundaries

**In scope (we update):**

- CI/workflows, forward-looking docs (migration guides, test-app docs), and **templates** used for future releases. For these we use current package name and, where helpful, a one-line note that earlier releases were originally published under `@signal-meaning/deepgram-voice-interaction-react`.

**Out of scope (we do not update):**

- **Prior issue docs** (e.g. ISSUE-412, 382, 388, 420, 373, 362, 352, 341, 338, 81). Those remain as historical record; we may learn from them for context only.
- **Documentation of prior releases** (`docs/releases/v*` for past versions). We do not change existing release docs; they continue to reflect what was published at the time.

---

## 2. Naming conventions to apply (in-scope files only)

| Context | Old (remove/replace) | New |
|--------|------------------------|-----|
| npm package name | `@signal-meaning/deepgram-voice-interaction-react` | `@signal-meaning/voice-agent-react` |
| Unscoped import / package reference | `deepgram-voice-interaction-react` | `@signal-meaning/voice-agent-react` |
| tgz / folder name in templates | `signal-meaning-deepgram-voice-interaction-react-*` | `signal-meaning-voice-agent-react-*` |
| Component name in prose | "deepgram-voice-interaction-react component" | "voice-agent-react component" or "dg_react_agent component" as appropriate |

Where we add a one-line note in forward-looking docs, use: *"Earlier releases were originally published under the package name `@signal-meaning/deepgram-voice-interaction-react`; the package has been renamed to `@signal-meaning/voice-agent-react`."*

---

## 3. File inventory and update strategy

### 3.1 CI / workflows (source)

| File | Current reference | Action |
|------|-------------------|--------|
| `.github/workflows/debug-auth.yml` | `npm view @signal-meaning/deepgram-voice-interaction-react` | Replace with `@signal-meaning/voice-agent-react` |

### 3.2 Docs – forward-looking / current (update all)

| File | Action |
|------|--------|
| `docs/BACKEND-PROXY/MIGRATION-GUIDE.md` | Replace import/package refs with `@signal-meaning/voice-agent-react`. |
| `test-app/docs/README.md` | Replace all `@signal-meaning/deepgram-voice-interaction-react` with `@signal-meaning/voice-agent-react`. |

### 3.3 Templates (used for current/future releases)

| File | Action |
|------|--------|
| `docs/releases/PACKAGE-STRUCTURE.template.md` | Use `@signal-meaning/voice-agent-react` and `signal-meaning-voice-agent-react-*`; add one-line historical note if useful. |
| `PACKAGE-STRUCTURE.md` (root) | Same. |

---

## 4. Search patterns for audit (in-scope files only)

- `deepgram-voice-interaction-react` (unscoped and scoped)
- `@signal-meaning/deepgram`
- `signal-meaning-deepgram-voice-interaction-react` (tgz/folder names)

Run these on **in-scope** paths only. References that remain in prior issue docs or prior release docs are expected and acceptable.

---

## 5. Acceptance checklist

- [ ] **CI:** `.github/workflows/debug-auth.yml` uses `@signal-meaning/voice-agent-react`.
- [ ] **Forward-looking docs:** `docs/BACKEND-PROXY/MIGRATION-GUIDE.md`, `test-app/docs/README.md` use only `@signal-meaning/voice-agent-react` / `dg_react_agent` as appropriate.
- [ ] **Templates:** `docs/releases/PACKAGE-STRUCTURE.template.md` and root `PACKAGE-STRUCTURE.md` use current package and path names (and optional one-line historical note).
- [ ] **No updates to prior issue docs or prior release docs** (confirmed out of scope).
- [ ] **Grep (in-scope only):** No remaining references to `@signal-meaning/deepgram-voice-interaction-react` or `deepgram-voice-interaction-react` except in this plan’s “old” column or an explicit historical note.
- [ ] **Tests / build:** `npm run build` and relevant tests pass (no code logic change; doc/config only).

---

## 6. Implementation order

1. Update CI workflow (single file, high visibility).
2. Update forward-looking docs (BACKEND-PROXY, test-app/docs).
3. Update templates (PACKAGE-STRUCTURE.template.md, root PACKAGE-STRUCTURE.md).
4. Run grep on in-scope paths and fix any stragglers.
5. Run build and tests; mark checklist complete.
