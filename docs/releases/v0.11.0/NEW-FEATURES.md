# New Features - v0.11.0

This minor release emphasizes **OpenAI proxy reliability and observability**, **microphone / commit timing**, and **test-app Live mode** as an integration reference. The headless component’s **public props surface is unchanged**; new UX patterns live primarily in **test-app** and **voice-agent-backend**.

---

## Test-app Live mode (Issue #561)

### Overview

The test application adds a **Live** presentation flow: start control, `LiveModeView`, RTL coverage for the presentational shell, and E2E smoke that exercises proxy-related paths (including function-call-in-flight affordances in the UI layer).

### Benefits

- Clear reference for integrators building Live-style experiences on top of the headless component.
- Regression coverage for OpenAI proxy + mic flows in Playwright.

### References

- [Issue #561](../../issues/ISSUE-561/README.md) (if present) or GitHub [#561](https://github.com/Signal-Meaning/dg_react_agent/issues/561)

---

## OpenAI proxy — commit scheduler and VAD (Issue #560)

### Overview

The OpenAI proxy gains a **commit scheduler** (continuous microphone and connection close flush), tuning for **first-commit** behavior and **orphan tail** audio, and **Server VAD** defaults/options with shared idle-bound helpers where applicable.

### Benefits

- More predictable uplink timing against the OpenAI Realtime API.
- Better alignment between mock tests, real API timing, and production mic behavior.

### References

- [Issue #560](../../issues/ISSUE-560/README.md) and linked TDD / handoff docs.

---

## OpenAI proxy — OTel-style logging (Issue #565)

### Overview

Proxy logs use an explicit **OTel resource** (`service.name` / `service.version`), **W3C-aligned trace context** when `trace_id` is present, and a **compact console exporter** that omits undefined trace fields.

### Benefits

- Easier correlation in log aggregators without noisy `undefined` trace lines.
- Consistent service identity instead of generic `unknown_service`.

### References

- [Issue #565](../../issues/ISSUE-565/README.md), PR [#567](https://github.com/Signal-Meaning/dg_react_agent/pull/567)

---

## Backend package (@signal-meaning/voice-agent-backend 0.2.12)

Ship **0.2.12** when using the OpenAI proxy or mounted backend routes from this release. See `packages/voice-agent-backend/README.md` and [CHANGELOG.md](./CHANGELOG.md) for this version train.

---

## Related documentation

- [API-CHANGES.md](./API-CHANGES.md)
- [EXAMPLES.md](./EXAMPLES.md)
- [CHANGELOG.md](./CHANGELOG.md)
