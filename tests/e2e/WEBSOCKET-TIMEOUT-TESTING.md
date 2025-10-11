# WebSocket Timeout and Context Preservation Testing

## Overview

This test suite validates the critical behavior of maintaining conversation context across WebSocket timeouts and reconnections in the Deepgram Voice Agent. This is essential for voice commerce applications where users may have extended conversations with natural pauses that could trigger WebSocket timeouts.

## Test Sequence

The main test follows this exact sequence:

1. **Send audio or text to Deepgram server** - Establishes initial connection and conversation
2. **Observe successful transcript reception** - Verifies the first message was processed
3. **Advance timer to force WebSocket timeout** - Simulates real-world timeout scenarios
4. **Observe connection timeout** - Confirms the WebSocket connection has timed out
5. **Send second audio or text to Deepgram server** - Triggers reconnection
6. **Observe context preservation** - Verifies the agent remembers the previous conversation
7. **Close socket and cleanup** - Ensures proper resource cleanup

## Technical Implementation

### Time Acceleration

The test uses a sophisticated time acceleration mechanism to simulate WebSocket timeouts without waiting for real-world timeouts:

```javascript
// Accelerate time by 50x to simulate timeout quickly
const timeAcceleration = 50;
let currentTime = Date.now();

// Override timer functions to use accelerated time
Date.now = () => currentTime;
window.setInterval = (callback, interval) => originalSetInterval(callback, interval / timeAcceleration);
window.setTimeout = (callback, delay) => originalSetTimeout(callback, delay / timeAcceleration);

// Advance time to trigger keepalive timeout
setTimeout(() => {
  currentTime += 15 * 60 * 1000; // 15 minutes in accelerated time
}, 100);
```

### Context Preservation Validation

**CRITICAL TEST PRINCIPLE:** The agent's response to the second message must demonstrate understanding of the first message. If context is lost, the agent will give generic responses instead of contextually relevant ones.

**Test Scenarios:**
- **Filmmaker**: "I'm a filmmaker working on documentary projects" → "What equipment would you recommend?"
  - **Success**: Agent recommends filmmaking equipment (cameras, lenses, tripods, microphones, lighting, editing software, drones, gimbals, audio recorders)
  - **Failure**: Agent gives generic hardware advice or asks "What kind of equipment do you need?"

- **Teacher**: "I'm a third-grade teacher planning a science unit" → "What experiments would be appropriate?"
  - **Success**: Agent recommends age-appropriate experiments (simple, easy, basic, safe, hands-on, visual experiments for 8-year-olds)
  - **Failure**: Agent gives generic science experiments or asks "What age group are you teaching?"

- **Scientist**: "I'm a scientist researching climate change" → "What equipment do I need for field research?"
  - **Success**: Agent recommends scientific field equipment (sensors, data loggers, weather stations, sampling equipment, portable/durable gear)
  - **Failure**: Agent gives generic equipment advice or asks "What kind of research are you doing?"

**Validation Logic:**
1. **Context Keywords**: Check for references to the profession/role from the first message
2. **Specific Equipment/Advice**: Verify the response contains contextually relevant recommendations
3. **Generic Response Detection**: Fail if the agent gives generic advice that could apply to anyone
4. **Continuation Flow**: Ensure the agent doesn't treat the second message as a new conversation

### WebSocket Monitoring

The test captures WebSocket activity to verify:

- Initial connection establishment
- Message sending and receiving
- Connection state changes
- Reconnection behavior

## Test Cases

### 1. Main Context Preservation Test
- Tests the complete sequence with text input
- Validates conversation context is maintained across timeout
- Verifies proper reconnection behavior

### 2. Audio Input Context Preservation Test
- Similar to main test but focuses on audio input path
- Tests the same WebSocket behavior with audio messages
- Validates context preservation for voice interactions

### 3. Rapid Reconnection Test
- Tests handling of multiple rapid reconnection attempts
- Validates system stability under rapid connection changes
- Ensures no race conditions or connection conflicts

## Requirements

### API Credentials
These tests require **real Deepgram API credentials** in `test-app/.env`:

```env
VITE_DEEPGRAM_API_KEY=your-real-deepgram-api-key
VITE_DEEPGRAM_PROJECT_ID=your-real-project-id
```

### Test Environment
- Playwright E2E test environment
- Real WebSocket connections to Deepgram services
- No mocking - uses actual Deepgram APIs

## Running the Tests

```bash
# Run all WebSocket timeout tests
npm run test:e2e -- --grep "WebSocket Timeout"

# Run specific test
npm run test:e2e -- --grep "should preserve conversation context across WebSocket timeout"

# Run with debug output
DEBUG=pw:api npm run test:e2e -- --grep "WebSocket Timeout"
```

## Expected Behavior

### Successful Test Run
- ✅ First message sent and processed
- ✅ WebSocket timeout simulated and observed
- ✅ Second message triggers reconnection
- ✅ Agent response references both messages (context preserved)
- ✅ Connection properly re-established
- ✅ Clean resource cleanup

### Failure Scenarios
- ❌ Context lost - agent gives generic response to second message
- ❌ Connection not re-established after second message
- ❌ WebSocket timeout not properly simulated
- ❌ Resource leaks or improper cleanup

## Debugging

### Common Issues

1. **Context not preserved**: Check if the agent response contains references to both the original and new messages
2. **Timeout not triggered**: Verify the time acceleration mechanism is working correctly
3. **Connection not re-established**: Check WebSocket connection state after second message
4. **Test timeouts**: Increase timeout values if the test environment is slow

### Debug Output

The test provides detailed console output:

```
🧪 Starting WebSocket timeout and context preservation test...
📝 Step 1: Sending first message...
✅ First message sent and displayed
🤖 First agent response received: That sounds exciting! What type of documentaries...
⏰ Step 3: Advancing timer to force WebSocket timeout...
🔌 Initial WebSocket connections: 5 sent, 8 received
🔍 Step 4: Checking for connection timeout...
📊 Connection status after timeout: closed
✅ Step 4: Connection timeout observed
📝 Step 5: Sending second message to trigger reconnection...
✅ Second message sent and displayed
🤖 Second agent response received: For video editing hardware, I'd recommend...
✅ Step 6: Context preservation verified - agent referenced previous conversation
🎉 WebSocket timeout and context preservation test completed successfully!
```

## Integration with Voice Commerce

This test is critical for voice commerce applications because:

1. **Shopping sessions** can be long with natural pauses
2. **Product comparisons** require context from earlier in the conversation
3. **Checkout processes** need to remember items discussed earlier
4. **Customer support** requires maintaining conversation history

The test ensures that users can have natural, extended conversations without losing context due to technical timeouts.
