# Release Notes - v0.7.4

**Release Date**: January 2, 2026  
**Release Type**: Patch Release

## Overview

v0.7.4 is a patch release that includes test infrastructure improvements and comprehensive validation of proxy backend behavior. This release confirms that backend proxy support is production-ready with 100% test pass rate. No breaking changes.

## 🎯 Release Highlights

### Test Infrastructure Improvements

- **VAD Test Refactoring**: All VAD tests now use `skipIfNoRealAPI()` helper for consistency
- **Simplified Test API**: Removed `skipInCI`/`skipReason` options from `setupVADTest()` helper
- **Better CI Support**: Tests now work in both local and CI environments when API keys are configured
- **Documentation Updates**: Updated E2E test documentation and skip reasons

### Proxy Backend Validation

- **Comprehensive Validation**: Issue #345 validation pass completed
- **100% Test Pass Rate**: 47/47 proxy mode tests passing
- **Feature Parity Confirmed**: All connection-relevant features validated in proxy mode
- **Production Ready**: Backend proxy support is fully validated and production-ready

## 🔍 Proxy Backend Validation Guide

This section provides a comprehensive guide on how to validate the proxy backend in apps built with the `DeepgramVoiceInteraction` component. Use this guide to ensure your proxy implementation is working correctly.

### 1. Pre-Validation Setup

#### Environment Configuration

Before validating your proxy backend, ensure you have:

1. **Deepgram API Key**: A valid Deepgram API key stored securely on your backend
   - Never expose this key to the frontend
   - Store it in environment variables or secure key management system

2. **Proxy Server Running**: Your backend proxy endpoint must be accessible
   - Default test endpoint: `ws://localhost:8080/deepgram-proxy` (for local testing)
   - Production endpoint: `wss://api.yourdomain.com/deepgram-proxy` (for production)

3. **Frontend Configuration**: Update your component to use proxy mode
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint="wss://api.yourdomain.com/deepgram-proxy"
     proxyAuthToken={authToken} // Optional: JWT or session token
     agentOptions={agentOptions}
     // ... other props
   />
   ```

#### Test Environment Preparation

For local testing:

1. **Start Proxy Server** (if using test proxy):
   ```bash
   cd test-app
   npm run test:proxy:server
   ```

2. **Set Environment Variables**:
   ```bash
   export USE_PROXY_MODE=true
   export VITE_PROXY_ENDPOINT=ws://localhost:8080/deepgram-proxy
   export VITE_DEEPGRAM_API_KEY=your-api-key-here  # For proxy server
   ```

3. **Run E2E Tests**:
   ```bash
   USE_PROXY_MODE=true npm run test:e2e
   ```

### 2. Validation Procedures

#### Connection Validation

**Direct Mode Connection Testing**

1. **Basic Connection**:
   ```tsx
   <DeepgramVoiceInteraction
     apiKey={apiKey}  // Direct mode
     agentOptions={agentOptions}
   />
   ```

2. **Verify Connection State**:
   - Component should connect to `wss://agent.deepgram.com/v1/agent/converse`
   - Connection state should transition: `connecting` → `connected`
   - `onConnectionStateChange` callback should fire with `connected` state

3. **Expected Behavior**:
   - Connection establishes within 2-3 seconds
   - No authentication errors
   - Settings message sent and `SettingsApplied` received

**Proxy Mode Connection Testing**

1. **Basic Connection**:
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint="wss://api.yourdomain.com/deepgram-proxy"
     agentOptions={agentOptions}
   />
   ```

2. **Verify Connection Flow**:
   - Component connects to your proxy endpoint (not directly to Deepgram)
   - Proxy forwards connection to Deepgram with API key
   - Connection state transitions correctly
   - Settings message flows through proxy correctly

3. **Expected Behavior**:
   - Connection establishes within 2-3 seconds
   - Proxy endpoint receives WebSocket connection
   - Proxy successfully connects to Deepgram
   - Settings message sent and `SettingsApplied` received

**Authentication Verification**

If using `proxyAuthToken`:

1. **Verify Token Transmission**:
   - Token should be included in connection URL: `wss://api.yourdomain.com/deepgram-proxy?token=<jwt-token>`
   - Backend should extract and validate token
   - Invalid tokens should result in connection rejection

2. **Test Scenarios**:
   - Valid token → connection succeeds
   - Invalid token → connection fails with appropriate error
   - Missing token (if required) → connection fails

**Connection State Monitoring**

Monitor connection state changes:

```tsx
<DeepgramVoiceInteraction
  proxyEndpoint={proxyEndpoint}
  onConnectionStateChange={(service, state) => {
    console.log(`Connection state: ${service} -> ${state}`);
    // Expected: 'agent' -> 'connected'
  }}
/>
```

#### Feature Validation

**Agent Responses**

1. **Test Basic Interaction**:
   ```tsx
   // Send text message
   ref.current?.injectUserMessage('Hello, how are you?');
   
   // Wait for agent response
   // onAgentUtterance callback should fire
   ```

2. **Expected Behavior**:
   - Agent receives message
   - Agent generates response
   - `onAgentUtterance` callback fires with response text
   - Audio playback starts (if TTS enabled)

**Function Calling**

1. **Setup Functions**:
   ```tsx
   const agentOptions = useMemo(() => ({
     functions: [
       {
         name: 'get_weather',
         description: 'Get weather for a location',
         parameters: {
           type: 'object',
           properties: {
             location: { type: 'string' }
           }
         }
       }
     ],
     onFunctionCallRequest: async (functionCall, sendResponse) => {
       // Handle function call
       sendResponse({ result: 'sunny' });
     }
   }), []);
   ```

2. **Test Function Call**:
   - Send message that triggers function: "What's the weather in New York?"
   - `onFunctionCallRequest` should fire
   - Function executes and sends response
   - Agent continues conversation with function result

3. **Expected Behavior**:
   - Functions included in Settings message
   - Function calls received correctly
   - Function responses sent correctly
   - Agent continues conversation after function execution

**VAD Events (Voice Activity Detection)**

1. **Test VAD Detection**:
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint={proxyEndpoint}
     onUserStartedSpeaking={() => {
       console.log('User started speaking');
     }}
     onUtteranceEnd={(data) => {
       console.log('Utterance ended', data);
     }}
     onUserStoppedSpeaking={() => {
       console.log('User stopped speaking');
     }}
   />
   ```

2. **Expected Behavior**:
   - `onUserStartedSpeaking` fires when speech begins
   - `onUtteranceEnd` fires when speech ends (with timing data)
   - `onUserStoppedSpeaking` fires after utterance end

**Audio Playback**

1. **Test TTS Audio**:
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint={proxyEndpoint}
     onPlaybackStateChange={(isPlaying) => {
       console.log('Audio playing:', isPlaying);
     }}
   />
   ```

2. **Expected Behavior**:
   - Audio playback starts when agent responds
   - `onPlaybackStateChange` fires with `true`
   - Audio plays correctly through speakers
   - `onPlaybackStateChange` fires with `false` when complete

**Callbacks and Event Handlers**

Verify all callbacks fire correctly:

- `onReady` - Component initialization
- `onConnectionStateChange` - Connection state changes
- `onAgentStateChange` - Agent state changes
- `onAgentUtterance` - Agent text responses
- `onUserMessage` - User messages received
- `onUserStartedSpeaking` - VAD speech start
- `onUtteranceEnd` - VAD utterance end
- `onUserStoppedSpeaking` - VAD speech stop
- `onPlaybackStateChange` - Audio playback state
- `onFunctionCallRequest` - Function calls
- `onError` - Error handling

#### Error Handling Validation

**Connection Failures**

1. **Test Invalid Proxy Endpoint**:
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint="ws://invalid-endpoint:8080/proxy"
   />
   ```

2. **Expected Behavior**:
   - Connection fails
   - `onConnectionStateChange` fires with `disconnected` or `error`
   - `onError` callback fires with error details
   - Component handles error gracefully

**Authentication Errors**

1. **Test Invalid API Key** (on backend):
   - Backend uses invalid Deepgram API key
   - Connection to Deepgram fails
   - Error forwarded to frontend
   - `onError` callback fires

2. **Test Invalid Auth Token** (if using `proxyAuthToken`):
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint={proxyEndpoint}
     proxyAuthToken="invalid-token"
   />
   ```
   - Backend rejects invalid token
   - Connection fails
   - `onError` callback fires

**Network Issues**

1. **Test Network Interruption**:
   - Disconnect network during active connection
   - Component should detect disconnection
   - `onConnectionStateChange` fires with `disconnected`
   - Component attempts reconnection (if configured)

**Timeout Handling**

1. **Test Idle Timeout**:
   - No activity for configured timeout period
   - Connection should close gracefully
   - `onConnectionStateChange` fires with `disconnected`

### 3. Test Scenarios

#### Basic Connection and Agent Interaction

**Scenario**: User connects and has a basic conversation

1. Initialize component with proxy endpoint
2. Wait for connection (`onConnectionStateChange` → `connected`)
3. Send text message: "Hello"
4. Wait for agent response (`onAgentUtterance`)
5. Verify response is received and audio plays

**Expected Result**: Full conversation flow works correctly

#### Function Calling Workflows

**Scenario**: User triggers a function call

1. Configure component with functions
2. Connect and wait for `SettingsApplied`
3. Send message that triggers function: "What's the weather?"
4. Verify `onFunctionCallRequest` fires
5. Execute function and send response
6. Verify agent continues conversation with function result

**Expected Result**: Function calling works end-to-end

#### VAD Event Detection

**Scenario**: User speaks and VAD events fire

1. Connect component
2. Start microphone capture
3. Speak into microphone
4. Verify `onUserStartedSpeaking` fires
5. Continue speaking
6. Stop speaking
7. Verify `onUtteranceEnd` fires (with timing data)
8. Verify `onUserStoppedSpeaking` fires

**Expected Result**: All VAD events fire correctly with proper timing

#### Audio Playback and Interruption

**Scenario**: Agent speaks and user interrupts

1. Connect and send message
2. Wait for agent response
3. Verify audio playback starts (`onPlaybackStateChange` → `true`)
4. Call `interruptAgent()` during playback
5. Verify audio stops (`onPlaybackStateChange` → `false`)
6. Send new message
7. Verify new response plays

**Expected Result**: Audio playback and interruption work correctly

#### Reconnection Scenarios

**Scenario**: Connection drops and reconnects

1. Establish connection
2. Simulate network interruption
3. Verify connection state changes to `disconnected`
4. Wait for automatic reconnection (if enabled)
5. Verify connection re-establishes
6. Verify conversation continues

**Expected Result**: Reconnection works correctly

#### Error Recovery

**Scenario**: Error occurs and component recovers

1. Establish connection
2. Trigger error (invalid message, network issue, etc.)
3. Verify `onError` callback fires
4. Verify component handles error gracefully
5. Attempt to continue conversation
6. Verify component recovers and continues working

**Expected Result**: Error handling and recovery work correctly

### 4. Validation Tools

#### E2E Test Suite Usage

The component includes a comprehensive E2E test suite that validates proxy backend functionality:

**Run Proxy Mode Tests**:
```bash
# Start proxy server
cd test-app
npm run test:proxy:server

# In another terminal, run tests
USE_PROXY_MODE=true npm run test:e2e
```

**Test Files**:
- `test-app/tests/e2e/backend-proxy-mode.spec.js` - Core proxy functionality
- `test-app/tests/e2e/backend-proxy-authentication.spec.js` - Authentication flow
- `test-app/tests/e2e/function-calling-e2e.spec.js` - Function calling (works in both modes)

**Test Coverage**:
- ✅ 47/47 proxy mode tests passing (100% pass rate)
- ✅ Connection validation
- ✅ Feature parity (transcription, agent, VAD, callbacks, function calling)
- ✅ Error handling
- ✅ Reconnection

#### Manual Testing Procedures

**Browser DevTools**

1. **Network Tab**:
   - Monitor WebSocket connections
   - Verify proxy endpoint is used (not direct Deepgram)
   - Check connection status and messages

2. **Console Logging**:
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint={proxyEndpoint}
     debug={true}  // Enable verbose logging
     onConnectionStateChange={(service, state) => {
       console.log(`[${service}] Connection: ${state}`);
     }}
     onError={(error) => {
       console.error('Error:', error);
     }}
   />
   ```

3. **WebSocket Inspection**:
   - Use browser DevTools to inspect WebSocket frames
   - Verify messages flow correctly through proxy
   - Check for authentication headers/tokens

**Backend Logging**

Enable detailed logging on your proxy server:

```javascript
// Example: Node.js proxy server
ws.on('connection', (clientWs, req) => {
  console.log('Client connected:', req.url);
  console.log('Auth token:', req.url.split('token=')[1]);
  
  // Log all messages
  clientWs.on('message', (data) => {
    console.log('Client message:', data.toString().substring(0, 100));
  });
});
```

#### Debugging Techniques

**Connection Issues**

1. **Verify Proxy Endpoint**:
   - Check URL is correct: `wss://api.yourdomain.com/deepgram-proxy`
   - Verify endpoint is accessible (not blocked by firewall)
   - Test endpoint with WebSocket client tool

2. **Check Authentication**:
   - Verify token is included in URL if using `proxyAuthToken`
   - Check backend logs for token validation
   - Verify Deepgram API key is configured on backend

3. **Monitor Connection State**:
   ```tsx
   const [connectionState, setConnectionState] = useState('disconnected');
   
   <DeepgramVoiceInteraction
     proxyEndpoint={proxyEndpoint}
     onConnectionStateChange={(service, state) => {
       setConnectionState(state);
       console.log(`Connection state: ${state}`);
     }}
   />
   ```

**Message Flow Issues**

1. **Verify Settings Message**:
   - Check that Settings message is sent after connection
   - Verify `SettingsApplied` is received
   - Check backend logs for message forwarding

2. **Check Message Format**:
   - Verify messages are valid JSON
   - Check message structure matches Deepgram API spec
   - Verify binary audio data is forwarded correctly

**Feature-Specific Debugging**

1. **Function Calling**:
   - Verify functions are included in Settings message
   - Check `onFunctionCallRequest` fires
   - Verify function response format is correct

2. **VAD Events**:
   - Check microphone permissions
   - Verify audio is being captured
   - Monitor VAD event callbacks

3. **Audio Playback**:
   - Check browser audio permissions
   - Verify TTS audio is received from Deepgram
   - Check `onPlaybackStateChange` callbacks

### 5. Troubleshooting

#### Common Issues and Solutions

**Issue: Connection Fails Immediately**

**Symptoms**:
- Connection state goes from `connecting` to `disconnected` immediately
- `onError` callback fires with connection error

**Possible Causes**:
1. Invalid proxy endpoint URL
2. Proxy server not running
3. Network/firewall blocking connection
4. Invalid authentication token

**Solutions**:
1. Verify proxy endpoint URL is correct and accessible
2. Check proxy server is running and listening on correct port
3. Check network/firewall rules allow WebSocket connections
4. Verify authentication token is valid (if using `proxyAuthToken`)

**Issue: Authentication Errors**

**Symptoms**:
- Connection fails with 401 Unauthorized
- Backend logs show authentication failure

**Possible Causes**:
1. Invalid Deepgram API key on backend
2. API key not configured on backend
3. Invalid auth token (if using `proxyAuthToken`)

**Solutions**:
1. Verify Deepgram API key is valid and configured on backend
2. Check API key is stored in environment variables or secure storage
3. Verify auth token validation logic on backend
4. Check token format matches backend expectations

**Issue: Messages Not Received**

**Symptoms**:
- Connection established but no responses
- `onAgentUtterance` never fires
- Settings message sent but no `SettingsApplied` received

**Possible Causes**:
1. Proxy not forwarding messages correctly
2. Message format incorrect
3. Backend connection to Deepgram failed

**Solutions**:
1. Check backend logs for message forwarding
2. Verify message format matches Deepgram API spec
3. Check backend connection to Deepgram is established
4. Verify WebSocket is bidirectional (messages flow both ways)

**Issue: Function Calling Not Working**

**Symptoms**:
- Functions configured but `onFunctionCallRequest` never fires
- Agent doesn't trigger functions

**Possible Causes**:
1. Functions not included in Settings message
2. Function schema incorrect
3. Agent not configured to use functions

**Solutions**:
1. Verify functions are included in `agentOptions.functions`
2. Check function schema matches Deepgram function calling spec
3. Verify Settings message includes functions (check WebSocket capture)
4. Test with simple function first

**Issue: VAD Events Not Firing**

**Symptoms**:
- `onUserStartedSpeaking` never fires
- No VAD event callbacks

**Possible Causes**:
1. Microphone not enabled
2. Microphone permissions denied
3. Audio not being captured
4. VAD configuration incorrect

**Solutions**:
1. Verify microphone is enabled: `ref.current?.startAudioCapture()`
2. Check browser microphone permissions
3. Verify audio constraints are correct
4. Check VAD configuration in `agentOptions`

**Issue: Audio Playback Not Working**

**Symptoms**:
- Agent responds but no audio plays
- `onPlaybackStateChange` never fires with `true`

**Possible Causes**:
1. Browser audio permissions
2. Audio context suspended
3. TTS not enabled in agent options
4. Audio format issues

**Solutions**:
1. Check browser audio permissions
2. Verify AudioContext is not suspended
3. Check `agentOptions.voice` is configured
4. Verify audio format is supported

#### Debugging Connection Problems

**Step 1: Verify Proxy Endpoint**

```bash
# Test WebSocket connection manually
wscat -c ws://localhost:8080/deepgram-proxy
```

**Step 2: Check Backend Logs**

Enable verbose logging on your proxy server to see:
- Connection attempts
- Message forwarding
- Errors

**Step 3: Monitor Network Traffic**

Use browser DevTools Network tab to:
- See WebSocket connection
- Monitor message flow
- Check for errors

**Step 4: Test Direct Mode**

Compare with direct mode to isolate proxy issues:

```tsx
// Test direct mode
<DeepgramVoiceInteraction
  apiKey={apiKey}  // Direct mode
  agentOptions={agentOptions}
/>

// If direct mode works but proxy doesn't, issue is in proxy implementation
```

#### API Key Issues

**Problem**: Backend can't connect to Deepgram

**Check**:
1. API key is valid and active
2. API key has correct permissions
3. API key is stored securely on backend
4. Backend uses correct API key format (raw key, not `dgkey_` prefixed)

**Solution**:
- Verify API key in Deepgram dashboard
- Check backend environment variables
- Test API key with direct connection first

#### Proxy Server Configuration

**Problem**: Proxy server not working correctly

**Check**:
1. Proxy server is running
2. Correct port is configured
3. WebSocket upgrade is handled correctly
4. CORS headers are set (if needed)

**Solution**:
- Review proxy server implementation
- Check server logs for errors
- Verify WebSocket library is configured correctly
- Test with mock proxy server first (`test-app/scripts/mock-proxy-server.js`)

#### Network and Firewall Considerations

**Problem**: Connection blocked by network/firewall

**Check**:
1. WebSocket connections allowed
2. Port is not blocked
3. SSL/TLS certificates valid (for `wss://`)
4. Proxy endpoint is accessible from client

**Solution**:
- Configure firewall rules for WebSocket connections
- Use `wss://` (secure) instead of `ws://` in production
- Verify SSL certificates are valid
- Test from different networks

## 📊 Validation Results

### Test Results Summary

**Proxy Mode Test Results**:
- ✅ **47/47 tests passing** (100% pass rate)
- ✅ All connection-relevant features validated
- ✅ Equivalent test coverage with direct mode
- ✅ All v0.7.3 fixes validated in proxy mode

**Feature Coverage**:
- ✅ Connection establishment
- ✅ Authentication (with and without tokens)
- ✅ Agent responses
- ✅ Transcription (if applicable)
- ✅ Function calling
- ✅ VAD events
- ✅ Audio playback
- ✅ Callbacks and event handlers
- ✅ Error handling
- ✅ Reconnection

### Production Readiness

Backend proxy support is **production-ready**:
- ✅ Comprehensive test coverage
- ✅ All features validated
- ✅ Error handling verified
- ✅ Documentation complete
- ✅ Security best practices documented

## 📚 Related Documentation

- **Issue #345 Validation Report**: `docs/issues/ISSUE-345/ISSUE-345-VALIDATION-REPORT.md`
- **Backend Proxy Documentation**: `docs/BACKEND-PROXY/README.md`
- **Interface Contract**: `docs/BACKEND-PROXY/INTERFACE-CONTRACT.md`
- **Security Best Practices**: `docs/BACKEND-PROXY/SECURITY-BEST-PRACTICES.md`
- **Migration Guide**: `docs/BACKEND-PROXY/MIGRATION-GUIDE.md`
- **E2E Test Documentation**: `test-app/tests/e2e/README.md`

## 🔄 Migration Guide

**No migration required!** v0.7.4 is fully backward compatible. All existing code continues to work without changes.

This is a patch release focused on:
- Test infrastructure improvements
- Proxy backend validation
- Documentation updates

No API changes were made.

## 📦 Installation

```bash
npm install @signal-meaning/deepgram-voice-interaction-react@0.7.4
```

## 🧪 Testing

- ✅ Jest tests: All passing
- ✅ E2E tests (direct mode): All passing
- ✅ E2E tests (proxy mode): 47/47 passing (100% pass rate)
- ✅ Linting: Clean
- ✅ Build: Successful

## 🎉 What's Next

This release confirms that backend proxy support is production-ready with comprehensive validation. Future releases will continue to:
- Improve test reliability and coverage
- Enhance developer experience
- Add new features and capabilities

We welcome feedback and contributions! See [DEVELOPMENT.md](../../DEVELOPMENT.md) for contribution guidelines.

---

**Previous Release**: [v0.7.3](./../v0.7.3/RELEASE-NOTES.md)

