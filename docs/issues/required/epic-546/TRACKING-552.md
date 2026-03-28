# Tracking — GitHub #552

**Issue:** [Docs: OpenAI proxy supported TLS modes and host integration (Voice Commerce contract)](https://github.com/Signal-Meaning/dg_react_agent/issues/552)  
**Epic:** [#546](https://github.com/Signal-Meaning/dg_react_agent/issues/546)

## Goal

Publish a **single clear story** for integrators (including Voice Commerce) covering:

1. **HTTP localhost** — when to use; mixed-content / browser caveats.
2. **Bring-your-own-cert** — PEM env vars; mkcert alignment with main API optional note.
3. **Optional built-in dev cert** — explicit opt-in only; trust warnings.

Include the **packaging rule**: runtime `require()` ⇒ listed under `dependencies` (or documented peers).

## Specification links

- [SPEC-PROXY-TLS-AND-ENV.md](./SPEC-PROXY-TLS-AND-ENV.md) (keep in sync; implementation may update spec first)
- [RELEASE-AND-QUALIFICATION.md](./RELEASE-AND-QUALIFICATION.md)

## TDD note

Documentation work is still **acceptance-driven**: do not mark this issue done until **#549–#551** behavior is implemented and tests exist; docs must match shipped behavior.

## Checklist

- [ ] Update `packages/voice-agent-backend/README.md` (or agreed primary doc) with **Supported modes** section.
- [ ] Add or update repo `docs/` cross-links if maintainers index from there (e.g. `docs/BACKEND-PROXY/` if proxy is documented there — search repo for “openai-proxy” / “OPENAI_PROXY”).
- [ ] Document **subprocess env contract**: which vars the host should pass vs strip (`HTTPS`, proxy-specific vars).
- [ ] Document **migration** from pre-epic `HTTPS=1` self-signed behavior.
- [ ] Add **packaging rule** verbatim or by reference to spec.
- [ ] Optional: short “Voice Commerce / EPIC-1131” pointer for traceability (neutral wording).

## Definition of done

- [ ] New developer can configure all supported modes from docs alone.
- [ ] Examples use final env var names from implementation.
- [ ] Links to GitHub #546 / sub-issues or this folder as needed.
- [ ] GitHub #552 closed with PR link and this file.

## Verification log

- [ ] _Peer review: maintainer followed docs on clean machine — date / reviewer / notes_
