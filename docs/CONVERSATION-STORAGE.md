# Conversation storage (persistence) architecture

This document describes the intended architecture for **conversation persistence** (e.g. surviving full page refresh): what the **component** owns versus what the **application** provides. See also [Issue #406](../issues/ISSUE-406/README.md) for context.

## Responsibility split

### Component owns

- **What** to persist: conversation messages (role, content, timestamp) in a defined shape.
- **When** to persist: e.g. after each conversation update; when to trim (e.g. last N messages).
- **When** to restore: on mount or when storage is first provided.
- **Data format**: serialized form (e.g. JSON) and validation when loading.
- **Key semantics**: logical key (e.g. `"conversation"`) or default key; the component does **not** own the storage medium or any “connection” details.

The component does **not** reference `localStorage`, `sessionStorage`, or any specific storage backend. It depends only on an **injected storage interface** provided by the application.

### Application owns

- **Storage implementation**: the actual backend (e.g. `localStorage`, `sessionStorage`, encrypted storage, IndexedDB, or remote sync).
- **Security and compliance**: ensuring conversations can be protected (e.g. encrypted storage, user-scoped keys). The component reads/writes opaque strings; the app can encrypt before `setItem` and decrypt after `getItem`.
- **Key scoping** (optional): the app’s implementation can prefix or scope the key (e.g. per user or session) inside its `getItem`/`setItem` implementation.

### Interface (application-provided)

The component will accept an optional storage abstraction, for example:

- `getItem(key: string): Promise<string | null>`
- `setItem(key: string, value: string): Promise<void>`

Using **async** allows the app to plug in encrypted storage, IndexedDB, or network-backed storage. The app can wrap sync storage (e.g. `localStorage`) in an adapter that returns `Promise.resolve(...)`.

If no storage is provided, the component behaves as today: no persist/restore (backward compatible).

## Best practices

- **Injection over configuration**: Pass a storage **implementation**, not a connection string. The component never touches credentials or storage internals.
- **Single source of truth**: The component should maintain the canonical conversation list (from protocol events), persist it via the interface, and expose it to the app (e.g. ref or callback) for display. The app does not maintain a separate copy for persistence.
- **Optional feature**: Persistence is opt-in when the app provides the storage implementation.
- **Function calls**: For production, execute function calls on the app backend, not in the browser. See [BACKEND-PROXY](../docs/BACKEND-PROXY/README.md#function-calls-execute-on-the-app-backend-issue-407) and [Issue #407](../docs/issues/ISSUE-407/README.md).

## Test-app role

The **test-app** demonstrates this pattern by providing a storage implementation backed by **localStorage** and (when the component supports it) using the component’s exposed conversation list for the Conversation History UI. See [Test-app docs](../test-app/docs/README.md#conversation-storage) for the test-app-specific notes.

## Status

As of Issue #406, the **test-app** implements persistence and restore in the **application layer** (React state + `sessionStorage` in `test-app/src/App.tsx`) so that conversation survives refresh for both OpenAI and Deepgram backends. The **component** does not yet own persistence logic or accept an injected storage interface; that is the intended next step so the component owns the logic and the app only provides the storage.
