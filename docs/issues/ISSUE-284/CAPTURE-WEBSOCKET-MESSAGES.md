# How to Capture WebSocket Settings Message

**⚠️ RECOMMENDED**: See `BROWSER-DEVTOOLS-CAPTURE-GUIDE.md` for the most comprehensive step-by-step guide with exact URLs, app names, and detailed instructions.

## Method 1: Browser DevTools Network Tab (RECOMMENDED) ⭐

This is the **best and most reliable** method. It captures the actual WebSocket frames as they're sent over the wire.

**For detailed instructions**: See `BROWSER-DEVTOOLS-CAPTURE-GUIDE.md`

### Steps:

1. **Open Browser DevTools**
   - Chrome/Edge: `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
   - Firefox: `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)

2. **Go to Network Tab**
   - Click on "Network" tab in DevTools

3. **Filter for WebSocket**
   - In the filter box, type `WS` or `WebSocket`
   - Or look for connections to `wss://agent.deepgram.com`

4. **Start Your Test**
   - Load your test app with function calling enabled
   - Establish connection (send a text message)
   - Wait for Settings message to be sent

5. **Find the WebSocket Connection**
   - Click on the WebSocket connection (it will show as `v1/agent/converse` or similar)
   - Click on the "Messages" tab

6. **Find the Settings Message**
   - Look for outgoing messages (sent from client)
   - Find the message with `"type": "Settings"`
   - Click on it to see the full JSON payload

7. **Copy the Payload**
   - Right-click on the message → "Copy message"
   - Or manually copy the JSON shown in the details pane

### What to Capture:

- **Full JSON payload** of the Settings message
- **Timestamp** of when it was sent
- **Verify**:
  - `"type": "Settings"` is present
  - Functions are in `agent.think.functions` (not root, not `agent.functions`)
  - No extraneous keys in function definitions

### Screenshot Example:

```
Network Tab → WS Filter → Click Connection → Messages Tab
Outgoing: {"type":"Settings","audio":{...},"agent":{"think":{"functions":[...]}}}
```

## Method 2: Enhanced Component Logging

We've added enhanced logging to `WebSocketManager.sendJSON()` that:
- Always logs Settings messages (even without debug mode)
- Logs both the JSON string and parsed object
- Exposes to `window.__DEEPGRAM_WS_SETTINGS_PAYLOAD__` for programmatic access

### Steps:

1. **Enable Test Mode** (if using E2E tests):
   ```javascript
   window.__DEEPGRAM_TEST_MODE__ = true;
   ```

2. **Run Your Test**
   - Load test app with function calling enabled
   - Establish connection

3. **Check Console Logs**
   - Look for: `📤 [WEBSOCKET.sendJSON] Settings message payload (exact JSON string):`
   - This shows the exact JSON string being sent

4. **Access Programmatically** (in browser console):
   ```javascript
   // Get the exact JSON string sent
   window.__DEEPGRAM_WS_SETTINGS_PAYLOAD__
   
   // Get the parsed object
   window.__DEEPGRAM_WS_SETTINGS_PARSED__
   ```

## Method 3: Manual WebSocket Wrapping

Create a simple test page that wraps `WebSocket.send` before the component loads:

```html
<!DOCTYPE html>
<html>
<head>
  <title>WebSocket Capture Test</title>
</head>
<body>
  <script>
    // Wrap WebSocket.send BEFORE component loads
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new OriginalWebSocket(url, protocols);
      const originalSend = ws.send;
      
      ws.send = function(data) {
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'Settings') {
              console.log('🔍 CAPTURED Settings message:', data);
              console.log('🔍 CAPTURED Settings message (parsed):', parsed);
              // Store for later access
              window.capturedSettings = { raw: data, parsed: parsed };
            }
          } catch (e) {
            // Not JSON, ignore
          }
        }
        return originalSend.call(this, data);
      };
      
      return ws;
    };
  </script>
  
  <!-- Your component script here -->
  <script src="your-component.js"></script>
</body>
</html>
```

## Which Method to Use?

- **For Support Ticket**: Use **Method 1 (DevTools)** - it's the most reliable and what Deepgram support expects
- **For Automated Testing**: Use **Method 2 (Enhanced Logging)** - already implemented
- **For Quick Manual Test**: Use **Method 3 (Manual Wrapping)** - standalone test page

## Verification Checklist

Once you've captured the Settings message, verify:

- [ ] `"type": "Settings"` is present
- [ ] Functions array is at `agent.think.functions` (not root, not `agent.functions`)
- [ ] Function structure matches spec (name, description, parameters)
- [ ] No `client_side` key in function definitions
- [ ] No extraneous keys in function definitions
- [ ] JSON is valid and well-formed

