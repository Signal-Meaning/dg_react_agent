# Issue #242: Backend Proxy Support for Secure API Key Management

## Problem Statement

Currently, the `DeepgramVoiceInteraction` component requires the Deepgram API key to be passed as a prop (`apiKey`), which means the API key must be embedded in the client-side JavaScript bundle. This creates a security vulnerability because:

1. React's build process embeds `REACT_APP_*` environment variables directly into the JavaScript bundle
2. The API key is visible in plain text to anyone who views the source code or uses browser DevTools
3. This is a fundamental limitation of client-side JavaScript - you cannot hide secrets in code that runs in the browser

### Current Implementation

```tsx
<DeepgramVoiceInteraction
  apiKey={process.env.REACT_APP_DEEPGRAM_API_KEY}  // ❌ Exposed in bundle
  // ... other props
/>
```

After React's build process, this becomes:

```javascript
const apiKey = "dg_your_actual_api_key_here";  // Literal string in bundle!
```

### Security Impact

- API keys can be extracted from the JavaScript bundle by anyone
- Risk of unauthorized usage and potential cost overruns
- Current mitigations (domain restrictions, monitoring) are reactive, not preventive
- Compliance concerns for organizations with strict security requirements

## Proposed Solution

Add support for a backend proxy mode where the component can connect to a developer's **existing backend infrastructure** instead of directly to Deepgram, allowing the API key to remain server-side.

**Important**: This is **not a new service to deploy**. Instead, it's an **interface contract** that developers implement in their existing backend by adding a WebSocket proxy endpoint. The developer's existing backend API simply adds a new route/endpoint that proxies WebSocket connections to Deepgram.

### Architecture

#### Overview (Proxy Mode)

```
┌─────────────┐
│   Browser   │
│             │
│  ┌────────┐ │
│  │test-app│ │  Uses
│  │(React) │ │──────┐
│  │        │ │      │
│  │┌──────┐│ │      │
│  ││dg_   ││ │      │
│  ││react ││ │      │
│  ││_agent││ │      │
│  ││Comp. ││ │      │
│  │└──────┘│ │      │
│  └────────┘ │      │
└─────────────┘      │
                      │ WSS (no API key)
                      ▼
        ┌───────────────────────┐
        │  Developer's Existing│
        │  Backend API          │
        │  (No new service!)    │
        │                       │
        │  + New endpoint:      │
        │    /deepgram-proxy    │
        │                       │
        │  - Authenticates      │
        │  - Stores API Key     │
        │  - Proxies WSS        │
        └───────────────────────┘
                      │
                      │ WSS (with API key)
                      ▼
        ┌───────────────────────┐
        │   Deepgram API        │
        │                       │
        └───────────────────────┘
```

#### Current Architecture (Direct Mode)

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              test-app (React App)                      │   │
│  │  ┌──────────────────────────────────────────────────┐ │   │
│  │  │  dg_react_agent Component                        │ │   │
│  │  │  (DeepgramVoiceInteraction)                      │ │   │
│  │  │  ❌ apiKey prop exposed in bundle                │ │   │
│  │  └──────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │ WSS
                            │ (with API key)
                            ▼
                ┌───────────────────────┐
                │   Deepgram API         │
                │   (wss://agent.       │
                │    deepgram.com/v1)   │
                └───────────────────────┘
```

#### Proposed Architecture (Proxy Mode)

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              test-app (React App)                      │   │
│  │  ┌──────────────────────────────────────────────────┐ │   │
│  │  │  dg_react_agent Component                        │ │   │
│  │  │  (DeepgramVoiceInteraction)                      │ │   │
│  │  │  ✅ proxyEndpoint prop (no API key)               │ │   │
│  │  └──────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │ WSS
                            │ (no API key)
                            ▼
        ┌───────────────────────────────────────┐
        │  Developer's Existing Backend API     │
        │  (No new service - just add endpoint) │
        │                                       │
        │  Implementation: Add WebSocket proxy  │
        │  endpoint to existing backend:        │
        │  - /api/deepgram-proxy (or similar)   │
        │                                       │
        │  Responsibilities:                    │
        │  - Authenticates frontend requests    │
        │  - Stores API Key (server-side secret) │
        │  - Proxies WebSocket to Deepgram      │
        │  - Manages connection lifecycle       │
        └───────────────────────────────────────┘
                            │ WSS
                            │ (with API key)
                            ▼
                ┌───────────────────────┐
                │   Deepgram API         │
                │   (wss://agent.       │
                │    deepgram.com/v1)   │
                └───────────────────────┘
```

#### Component Architecture Overview

**Direct Mode Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      test-app (React App)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Uses: <DeepgramVoiceInteraction apiKey="dg_xxx..." />    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Uses
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    dg_react_agent Package                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  DeepgramVoiceInteraction Component                       │  │
│  │  - Connection Mode: Direct                                 │  │
│  │  - WebSocket URL: wss://agent.deepgram.com/v1/...         │  │
│  │  - API Key: Included in connection                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │ WSS
                            │ (with API key)
                            ▼
                ┌───────────────────────┐
                │   Deepgram API         │
                │   (wss://agent.       │
                │    deepgram.com/v1)   │
                └───────────────────────┘
```

**Proxy Mode Flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                      test-app (React App)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Uses: <DeepgramVoiceInteraction                          │  │
│  │         proxyEndpoint="https://api.example.com/proxy" />  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Uses
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    dg_react_agent Package                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  DeepgramVoiceInteraction Component                       │  │
│  │  - Connection Mode: Proxy                                  │  │
│  │  - WebSocket URL: wss://api.example.com/proxy              │  │
│  │  - API Key: NOT included (stays server-side)              │  │
│  │  - Authentication: JWT/Session token (optional)            │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │ WSS
                            │ (no API key)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  Developer's Existing Backend API                                │
│  (No new service - implement interface contract)                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Implementation: Add WebSocket proxy endpoint              │  │
│  │  Example: /api/deepgram-proxy or /deepgram/ws             │  │
│  │                                                            │  │
│  │  Interface Contract:                                       │  │
│  │  - Accepts WebSocket connections from frontend             │  │
│  │  - Authenticates requests (JWT, session, etc.)            │  │
│  │  - Stores Deepgram API key (server-side secret)             │  │
│  │  - Proxies WebSocket traffic to Deepgram                   │  │
│  │  - Handles reconnection & connection lifecycle             │  │
│  │                                                            │  │
│  │  No new deployment needed - just add endpoint to existing │  │
│  │  backend infrastructure                                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │ WSS
                            │ (with API key)
                            ▼
                ┌───────────────────────┐
                │   Deepgram API         │
                │   (wss://agent.       │
                │    deepgram.com/v1)   │
                └───────────────────────┘
```

**Component Features (work in both modes):**
```
┌─────────────────────────────────────────────────────────────────┐
│                    dg_react_agent Package                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  DeepgramVoiceInteraction Component                       │  │
│  │                                                            │  │
│  │  Connection Mode Selection:                               │  │
│  │  ├─ Direct Mode:  apiKey prop → Direct to Deepgram       │  │
│  │  └─ Proxy Mode:   proxyEndpoint prop → Via Backend Proxy  │  │
│  │                                                            │  │
│  │  Features (work in both modes):                           │  │
│  │  ├─ WebSocket connection management                       │  │
│  │  ├─ Audio capture & streaming                             │  │
│  │  ├─ Transcription                                         │  │
│  │  ├─ Agent interactions                                    │  │
│  │  ├─ VAD events                                            │  │
│  │  └─ All callbacks & event handlers                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ Used by
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      test-app (React App)                        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  - Reference implementation                               │  │
│  │  - Demonstrates both connection modes                     │  │
│  │  - E2E testing environment                                 │  │
│  │  - Mock proxy server for testing                          │  │
│  │  - Documentation examples                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Proposed API

```tsx
<DeepgramVoiceInteraction
  // Option 1: Direct connection (current behavior)
  apiKey="dg_xxx..."

  // Option 2: Backend proxy mode (new)
  proxyEndpoint="https://api.example.com/deepgram-proxy"
  // OR
  useBackendProxy={true}
  backendUrl="https://api.example.com"
/>
```

### Key Clarification: Interface Contract, Not New Service

**This is NOT a new service to deploy.** Instead, it's an **interface contract** that developers implement in their existing backend:

1. **No New Deployment**: Developers add a WebSocket proxy endpoint to their existing backend API
2. **Existing Infrastructure**: Uses the same backend server, deployment, and infrastructure
3. **Interface Contract**: The component defines what the endpoint must do (accept WSS, proxy to Deepgram, etc.)
4. **Developer Implementation**: Each developer implements the proxy endpoint in their preferred backend framework (Express, FastAPI, Django, etc.)

**Example**: A developer with an existing backend at `https://api.example.com` would:
- Add a new route: `/deepgram-proxy` or `/api/deepgram/ws`
- Implement WebSocket proxying logic (we'll provide examples)
- Store Deepgram API key in their existing secrets management
- Use their existing authentication system

**Result**: No new service deployment - just adding an endpoint to existing backend infrastructure.

## Development Approach: Test-Driven Development (TDD)

### TDD Philosophy

This feature will be developed using **Test-Driven Development (TDD)** methodology:

1. **Red**: Write failing tests first that define the expected behavior
2. **Green**: Implement minimal code to make tests pass
3. **Refactor**: Improve code quality while keeping tests green
4. **Repeat**: Continue cycle for each feature increment

### TDD Benefits for This Feature

- **Security-Critical Feature**: TDD ensures we don't introduce security vulnerabilities
- **Backward Compatibility**: Tests verify existing `apiKey` prop continues to work
- **Clear Requirements**: Tests serve as executable specifications
- **Regression Prevention**: Comprehensive test coverage prevents breaking changes

## Testing Strategy

### Test Layers

#### 1. Unit Tests (Jest) - Component Logic

**Location**: `tests/` directory

**Purpose**: Test component logic, prop handling, and connection mode selection

**Test Files to Create**:
- `tests/backend-proxy-mode.test.tsx` - Component prop handling and mode selection
- `tests/connection-mode-selection.test.tsx` - Logic for choosing direct vs proxy mode
- `tests/backward-compatibility.test.tsx` - Verify existing `apiKey` prop still works

**Example Test Structure**:
```typescript
describe('Backend Proxy Mode', () => {
  it('should use proxy endpoint when proxyEndpoint prop is provided', () => {
    // Test that component selects proxy mode
  });

  it('should use direct connection when apiKey prop is provided', () => {
    // Test backward compatibility
  });

  it('should throw error when neither apiKey nor proxyEndpoint provided', () => {
    // Test validation
  });
});
```

#### 2. Integration Tests (Jest) - WebSocket Connection Logic

**Location**: `tests/` directory

**Purpose**: Test WebSocket connection establishment for both modes

**Test Files to Create**:
- `tests/websocket-proxy-connection.test.ts` - WebSocket connection through proxy
- `tests/websocket-direct-connection.test.ts` - WebSocket direct connection (existing)
- `tests/connection-mode-switching.test.ts` - Switching between modes

**Mocking Strategy**:
- Mock WebSocket connections
- Mock backend proxy server responses
- Verify correct endpoint URLs are used

#### 3. E2E Tests (Playwright) - Full Integration

**Location**: `test-app/tests/e2e/` directory

**Purpose**: Test complete end-to-end workflows with real backend proxy

**Test Files to Create**:
- `test-app/tests/e2e/backend-proxy-mode.spec.js` - Full E2E proxy mode tests
- `test-app/tests/e2e/backend-proxy-authentication.spec.js` - Authentication flow
- `test-app/tests/e2e/backend-proxy-reconnection.spec.js` - Reconnection through proxy

**E2E Test Requirements**:
- Requires mock backend proxy server (see Test App Setup below)
- Tests real WebSocket connections through proxy
- Validates all component features work in proxy mode

### Test App Role

The `test-app/` serves multiple critical roles in TDD for this feature:

#### 1. **Reference Implementation**

**Location**: `test-app/src/App.tsx`

**Purpose**: Demonstrate both connection modes side-by-side

**Implementation**:
```tsx
// Add toggle/selector for connection mode
const [connectionMode, setConnectionMode] = useState<'direct' | 'proxy'>('direct');

// Conditional prop passing
<DeepgramVoiceInteraction
  {...(connectionMode === 'direct' 
    ? { apiKey: import.meta.env.VITE_DEEPGRAM_API_KEY }
    : { proxyEndpoint: import.meta.env.VITE_PROXY_ENDPOINT }
  )}
  // ... other props
/>
```

**Benefits**:
- Visual demonstration of both modes
- Manual testing during development
- Reference for developers using the feature

#### 2. **Mock Backend Proxy Server**

**Location**: `test-app/scripts/mock-proxy-server.js` (to be created)

**Purpose**: Provide a test backend proxy for E2E tests

**Implementation**:
- Simple Node.js/Express server
- WebSocket proxy to Deepgram
- Accepts frontend WebSocket connections
- Forwards to Deepgram with API key
- Handles authentication (JWT, session tokens, etc.)

**Usage**:
```bash
# Start mock proxy server
npm run test:proxy:server

# Run E2E tests against proxy
npm run test:e2e:proxy
```

**Benefits**:
- Enables E2E testing without real backend
- Tests authentication flows
- Validates proxy behavior

#### 3. **E2E Test Environment**

**Location**: `test-app/tests/e2e/`

**Purpose**: Comprehensive E2E test coverage

**Test Scenarios**:
1. **Connection Establishment**
   - Connect through proxy
   - Verify WebSocket URL is proxy endpoint
   - Verify connection succeeds

2. **Feature Parity**
   - All existing features work in proxy mode
   - Transcription works
   - Agent responses work
   - VAD events work
   - All callbacks fire correctly

3. **Authentication**
   - JWT token authentication
   - Session token authentication
   - Error handling for invalid auth

4. **Reconnection**
   - Reconnection through proxy
   - Context preservation
   - State recovery

5. **Error Handling**
   - Proxy server unavailable
   - Authentication failures
   - Network errors

#### 4. **Documentation Examples**

**Location**: `test-app/docs/` and `docs/`

**Purpose**: Provide working examples and integration guides

**Documents to Create**:
- `docs/BACKEND-PROXY-SETUP.md` - Backend proxy implementation guide
- `test-app/docs/releases/v0.X.X/BACKEND-PROXY-INTEGRATION.md` - Integration examples
- `docs/SECURITY-BEST-PRACTICES.md` - Security recommendations

## TDD Implementation Plan

### Phase 1: Foundation (Red Phase)

**Goal**: Establish test infrastructure and failing tests

1. **Create Unit Tests** (Failing)
   - [ ] `tests/backend-proxy-mode.test.tsx` - Component prop handling
   - [ ] `tests/connection-mode-selection.test.tsx` - Mode selection logic
   - [ ] `tests/backward-compatibility.test.tsx` - Existing apiKey prop

2. **Create Integration Tests** (Failing)
   - [ ] `tests/websocket-proxy-connection.test.ts` - Proxy WebSocket connection
   - [ ] `tests/websocket-direct-connection.test.ts` - Direct connection (verify existing)

3. **Create E2E Test Infrastructure** (Failing)
   - [ ] `test-app/scripts/mock-proxy-server.js` - Mock backend proxy
   - [ ] `test-app/tests/e2e/backend-proxy-mode.spec.js` - E2E test skeleton
   - [ ] Update `test-app/src/App.tsx` - Add proxy mode toggle

**Expected**: All tests fail (Red) ✅

### Phase 2: Core Implementation (Green Phase)

**Goal**: Implement minimal code to make tests pass

1. **Component Changes**
   - [ ] Add `proxyEndpoint` prop to component interface
   - [ ] Add `useBackendProxy` and `backendUrl` props (alternative API)
   - [ ] Implement connection mode selection logic
   - [ ] Update WebSocket connection logic to support proxy mode
   - [ ] Maintain backward compatibility with `apiKey` prop

2. **Connection Logic**
   - [ ] Modify WebSocket URL construction for proxy mode
   - [ ] Add authentication header support (JWT, session tokens)
   - [ ] Update connection state management for proxy mode

3. **Test App Updates**
   - [ ] Implement mock proxy server
   - [ ] Add proxy mode toggle to test app UI
   - [ ] Update test app to support both modes

**Expected**: All tests pass (Green) ✅

### Phase 3: Feature Parity (Green Phase)

**Goal**: Ensure all features work in proxy mode

1. **Feature Testing**
   - [ ] Transcription works through proxy
   - [ ] Agent responses work through proxy
   - [ ] VAD events work through proxy
   - [ ] All callbacks fire correctly
   - [ ] Reconnection works through proxy

2. **E2E Test Coverage**
   - [ ] Complete `backend-proxy-mode.spec.js` with all scenarios
   - [ ] Add `backend-proxy-authentication.spec.js`
   - [ ] Add `backend-proxy-reconnection.spec.js`

**Expected**: All features work, all tests pass ✅

### Phase 4: Refactoring & Documentation (Refactor Phase)

**Goal**: Improve code quality and document the feature

1. **Code Quality**
   - [ ] Refactor connection logic for clarity
   - [ ] Add comprehensive error handling
   - [ ] Improve type safety
   - [ ] Add code comments and JSDoc

2. **Documentation**
   - [x] `docs/BACKEND-PROXY/` - Backend proxy documentation directory
   - [x] `docs/BACKEND-PROXY/INTERFACE-CONTRACT.md` - Interface contract specification
   - [x] `docs/BACKEND-PROXY/IMPLEMENTATION-NODEJS.md` - Node.js/Express implementation guide
   - [x] `docs/BACKEND-PROXY/IMPLEMENTATION-FASTAPI.md` - Python/FastAPI implementation guide
   - [x] `docs/BACKEND-PROXY/IMPLEMENTATION-DJANGO.md` - Python/Django implementation guide
   - [x] `docs/BACKEND-PROXY/SECURITY-BEST-PRACTICES.md` - Security guide
   - [x] `docs/BACKEND-PROXY/MIGRATION-GUIDE.md` - Migration guide
   - [x] Update API reference with proxy mode examples

3. **Test App Documentation**
   - [ ] Document mock proxy server usage
   - [ ] Add examples for different authentication methods
   - [ ] Provide backend proxy implementation templates

**Expected**: Clean code, comprehensive documentation ✅

## Test App Setup for Backend Proxy

### Mock Backend Proxy Server

**File**: `test-app/scripts/mock-proxy-server.js`

**Purpose**: Provide a test backend proxy for E2E testing

**Features**:
- WebSocket server that accepts frontend connections
- Proxies WebSocket traffic to Deepgram
- Handles authentication (JWT, session tokens)
- Logs traffic for debugging
- Supports reconnection scenarios

**Usage**:
```bash
# Start mock proxy server
cd test-app
npm run test:proxy:server

# In another terminal, run E2E tests
npm run test:e2e:proxy
```

### Test App UI Updates

**File**: `test-app/src/App.tsx`

**Changes**:
1. Add connection mode selector (Direct vs Proxy)
2. Add proxy endpoint input field
3. Add authentication token input (for JWT/session)
4. Display connection status for both modes
5. Show which mode is active

**Benefits**:
- Visual testing during development
- Demonstrates both modes side-by-side
- Reference implementation for developers

## Acceptance Criteria

### Functional Requirements

- [x] Component supports proxy mode via `proxyEndpoint` prop
- [x] Backward compatible with existing `apiKey` prop
- [x] WebSocket connections work through backend proxy
- [x] All existing features work in proxy mode:
  - [x] Transcription
  - [x] Agent responses
  - [x] VAD events
  - [x] All callbacks
  - [x] Reconnection
- [x] Authentication support (JWT, session tokens via `proxyAuthToken` prop)
- [x] Error handling for proxy failures

### Test Requirements

- [x] Unit tests: 100% coverage of new code paths (15/15 tests passing)
- [x] Integration tests: All connection modes tested
- [x] E2E tests: Complete proxy mode workflow tested
- [x] Backward compatibility tests: Existing apiKey prop verified
- [x] All existing tests continue to pass

### Documentation Requirements

- [x] Backend proxy interface contract specification (`docs/BACKEND-PROXY/INTERFACE-CONTRACT.md`)
- [x] Implementation guide with examples for common frameworks:
  - [x] Node.js/Express example (`docs/BACKEND-PROXY/IMPLEMENTATION-NODEJS.md`)
  - [x] Python/FastAPI example (`docs/BACKEND-PROXY/IMPLEMENTATION-FASTAPI.md`)
  - [x] Python/Django example (`docs/BACKEND-PROXY/IMPLEMENTATION-DJANGO.md`)
- [x] Integration examples in test-app (test-app/src/App.tsx demonstrates both modes)
- [x] Security best practices guide (`docs/BACKEND-PROXY/SECURITY-BEST-PRACTICES.md`)
- [x] Migration guide for existing implementations (`docs/BACKEND-PROXY/MIGRATION-GUIDE.md`)
- [x] API reference updated with new props (`docs/API-REFERENCE.md`)

## Implementation Considerations

### Backend Requirements (Interface Contract)

**Important**: This is **not a new service to deploy**. Developers implement this interface contract in their **existing backend infrastructure** by adding a WebSocket proxy endpoint.

The interface contract requires the backend endpoint to:

- Accept WebSocket connections from the frontend (at the `proxyEndpoint` URL)
- Authenticate requests (JWT, session tokens, etc.) - using developer's existing auth system
- Store Deepgram API key server-side (in environment variables, secrets manager, etc.)
- Proxy WebSocket traffic bidirectionally to Deepgram API
- Handle reconnection logic
- Manage connection lifecycle

**Implementation Approach**:
- Developer adds a new route/endpoint to their existing backend API
- Example: `wss://api.example.com/deepgram-proxy` or `/api/deepgram/ws`
- Uses existing backend infrastructure (same server, same deployment)
- No new service deployment required
- Can leverage existing authentication, logging, monitoring systems

### Component Changes

- Add `proxyEndpoint` or `useBackendProxy` prop
- Modify WebSocket connection logic to support proxy mode
- Maintain all existing event handlers and behavior
- Ensure feature parity between direct and proxy modes

### Security Considerations

- Never expose API keys in client-side code
- Support secure authentication methods (JWT, session tokens)
- Validate proxy endpoint URLs
- Handle authentication failures gracefully
- Document security best practices

## Related Context

- **GitHub Issue**: [Signal-Meaning/dg_react_agent#242](https://github.com/Signal-Meaning/dg_react_agent/issues/242)
- **Discovered in**: Signal-Meaning/voice-commerce Issue #379
- **Security analysis**: `docs/issues/issue-379/security-analysis.md` (if exists)
- **Current implementation**: Requires `REACT_APP_DEEPGRAM_API_KEY` in client bundle

## Priority

**High** - This is a security concern that affects enterprise deployments and compliance requirements. While current mitigations exist (domain restrictions, monitoring), a backend proxy provides true security by keeping secrets server-side.

## Development Timeline

### Week 1: Foundation & Tests
- Set up test infrastructure
- Write failing tests (Red phase)
- Create mock proxy server
- Update test app UI

### Week 2: Core Implementation
- Implement proxy mode support
- Make tests pass (Green phase)
- Basic proxy connection working

### Week 3: Feature Parity & Refactoring
- Ensure all features work in proxy mode
- Refactor and improve code quality
- Complete E2E test coverage

### Week 4: Documentation & Polish
- Write comprehensive documentation
- Create backend implementation examples
- Security best practices guide
- Final testing and validation

## Notes

- This feature would significantly improve the security posture of applications using this component, especially in enterprise environments where API keys must remain server-side.
- The TDD approach ensures we don't introduce security vulnerabilities while maintaining backward compatibility.
- The test-app serves as both a testing ground and a reference implementation for developers.
