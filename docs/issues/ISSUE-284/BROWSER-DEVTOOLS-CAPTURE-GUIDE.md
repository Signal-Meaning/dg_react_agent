# Browser DevTools WebSocket Capture Guide

**Purpose**: Capture the exact Settings message JSON payload sent to Deepgram's Voice Agent API  
**Issue**: #284 - Function Calling SettingsApplied Investigation  
**Date**: January 2025

## Overview

This guide provides step-by-step instructions for using Browser DevTools to capture the exact WebSocket Settings message payload. This is the most reliable method to verify what's being sent to Deepgram's API, bypassing any module caching or code execution issues.

## Prerequisites

1. **Test App Running**: The test-app dev server must be running on `http://localhost:5173`
2. **API Keys**: Valid Deepgram API key and Project ID in `.env` file
3. **Browser**: Chrome, Edge, or any Chromium-based browser (recommended for best DevTools experience)

## Step-by-Step Instructions

### Step 1: Start the Test App Dev Server

```bash
cd /Users/davidmcgee/Development/dg_react_agent/test-app
npm run dev
```

**Expected Output**: 
```
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Verify**: Open `http://localhost:5173` in your browser to confirm the app loads.

### Step 2: Open Browser DevTools

1. **Open Chrome/Edge** (or your preferred Chromium-based browser)
2. **Navigate to**: `http://localhost:5173`
3. **Open DevTools** using one of these methods:
   - Press `F12` (Windows/Linux)
   - Press `Cmd+Option+I` (Mac)
   - Right-click → "Inspect"
   - Menu → More Tools → Developer Tools

### Step 3: Navigate to Network Tab

1. In DevTools, click the **"Network"** tab
2. If you don't see it, click the **">>"** icon to show more tabs

### Step 4: Filter for WebSocket Connections

1. In the Network tab, look for the **filter bar** at the top
2. Click the **filter dropdown** (shows "All" by default)
3. Select **"WS"** (WebSocket) from the filter options
   - Alternatively, type `WS` in the filter box

**Note**: You may not see any WebSocket connections yet - that's normal. They'll appear when the connection is established.

### Step 5: Navigate to Test App with Function Calling Enabled

1. In the browser address bar, navigate to:
   ```
   http://localhost:5173/?test-mode=true&enable-function-calling=true&function-type=minimal&debug=true
   ```

   **URL Parameters Explained**:
   - `test-mode=true`: Enables test mode (exposes Settings to window)
   - `enable-function-calling=true`: Enables function calling feature
   - `function-type=minimal`: Uses minimal function definition (simplest test case)
   - `debug=true`: Enables debug logging

2. **Press Enter** to navigate

### Step 6: Establish WebSocket Connection

1. On the test app page, you should see the Deepgram Voice Interaction Test interface
2. **Fill in the text input** with any message (e.g., "Hello")
3. **Click the "Send" button** (or press Enter)
4. This will establish the WebSocket connection to Deepgram

**What to Watch For**:
- The Network tab should now show a WebSocket connection
- Look for a connection to: `wss://agent.deepgram.com/v1/agent/converse`
- The connection status should show as "101 Switching Protocols" (WebSocket handshake)

### Step 7: Find the WebSocket Connection

1. In the Network tab, look for the **WebSocket connection** entry
2. It should be named something like:
   - `converse?agent_uuid=...` or
   - `v1/agent/converse?agent_uuid=...`
3. The **Type** column should show "websocket"
4. The **Status** should show "101" (Switching Protocols)

**If you don't see it**:
- Make sure the filter is set to "WS"
- Try refreshing the page and sending a message again
- Check the browser console for any connection errors

### Step 8: Open WebSocket Messages View

1. **Click on the WebSocket connection entry** in the Network tab
2. A **details panel** will open on the right (or bottom, depending on DevTools layout)
3. Click the **"Messages"** tab in the details panel

**What You'll See**:
- A list of WebSocket messages (both sent and received)
- Messages are color-coded:
  - **Green arrows (→)**: Outgoing messages (sent by client)
  - **Red arrows (←)**: Incoming messages (received from server)

### Step 9: Find the Settings Message

1. **Scroll through the messages** to find the Settings message
2. Look for a message with:
   - **Green arrow (→)** indicating it's outgoing
   - **JSON content** that includes `"type": "Settings"`
   - **Timestamp** near the beginning of the connection

**Identifying the Settings Message**:
- It will be one of the **first messages** sent after connection
- The JSON will start with something like: `{"type":"Settings","agent":{...}}`
- It should contain `"agent"` object with `"think"` object
- If functions are included, you'll see `"functions"` array in `agent.think.functions`

### Step 10: Expand and View the Full Settings Message

1. **Click on the Settings message** in the Messages list
2. The full JSON payload will be displayed in the details panel
3. **Expand all nested objects** by clicking the **"▶"** arrows to see the complete structure

**What to Look For**:
- `"type": "Settings"` at the root level
- `"agent"` object containing:
  - `"think"` object containing:
    - `"functions"` array (if functions are included)
- Verify functions are in `agent.think.functions` (not in root, not in `agent.functions`)

### Step 11: Copy the Settings Message JSON

1. **Right-click** on the JSON payload in the details panel
2. Select **"Copy"** or **"Copy message"** (exact option name varies by browser)
3. **Alternative method**:
   - Select all the JSON text (Ctrl+A / Cmd+A)
   - Copy (Ctrl+C / Cmd+C)

**Verify the Copy**:
- Paste into a text editor to confirm you have the full JSON
- The JSON should be valid (no syntax errors)
- It should start with `{` and end with `}`

### Step 12: Save the Captured Payload

1. **Create a file** to store the captured payload:
   ```bash
   cd /Users/davidmcgee/Development/dg_react_agent/docs/issues/ISSUE-284
   ```

2. **Save the JSON** to a file (e.g., `captured-settings-payload.json`)

3. **Verify the structure**:
   - Check that `"type": "Settings"` is present
   - Check that `agent.think.functions` contains the function definitions
   - Verify function structure matches expectations

## Expected Settings Message Structure

### With Functions (Minimal Function Type)

```json
{
  "type": "Settings",
  "agent": {
    "think": {
      "functions": [
        {
          "name": "test",
          "description": "test",
          "parameters": {
            "type": "object",
            "properties": {}
          }
        }
      ]
    }
  }
}
```

### Key Verification Points

1. ✅ **Type is "Settings"**: `"type": "Settings"` at root level
2. ✅ **Functions location**: Functions are in `agent.think.functions` array
3. ✅ **No functions elsewhere**: No `functions` in root, no `agent.functions`
4. ✅ **Function structure**: Each function has `name`, `description`, `parameters`
5. ✅ **Parameters structure**: `parameters.type` is "object", `parameters.properties` exists

## Troubleshooting

### WebSocket Connection Not Appearing

**Problem**: No WebSocket connection shows in Network tab

**Solutions**:
1. Verify test app is running: `http://localhost:5173` loads
2. Check browser console for errors
3. Verify API keys are set in `.env` file
4. Try refreshing the page and sending a message again
5. Check that the connection URL is `wss://agent.deepgram.com/v1/agent/converse`

### Settings Message Not Found

**Problem**: Can't find the Settings message in the messages list

**Solutions**:
1. Settings is usually one of the **first messages** sent
2. Look for messages with green arrow (outgoing)
3. Search for `"type":"Settings"` in the message content
4. Check the timestamp - Settings should be sent immediately after connection

### JSON Not Valid

**Problem**: Copied JSON has syntax errors or is incomplete

**Solutions**:
1. Make sure you copied the **entire message**, not just part of it
2. Try expanding all nested objects before copying
3. Use "Copy message" option if available (more reliable than manual selection)
4. Verify the JSON in a JSON validator (e.g., jsonlint.com)

### Functions Not in Expected Location

**Problem**: Functions appear in wrong location (e.g., `agent.functions` instead of `agent.think.functions`)

**Solutions**:
1. This would indicate a **component bug** - functions should be in `agent.think.functions`
2. Document the actual location found
3. Compare with Deepgram API specification
4. Update support ticket with this finding

## Next Steps After Capture

1. **Verify the payload structure** matches expectations
2. **Compare with Deepgram API spec** to ensure compliance
3. **Update support ticket** (`DEEPGRAM-SUPPORT-TICKET.md`) with the captured payload
4. **Document findings** in `EVIDENCE.md`
5. **Proceed with ticket submission** if the payload is correct but `SettingsApplied` is still not received

## Alternative: Using Browser Console

If you prefer using the browser console instead of Network tab:

1. **Open Browser Console** (Console tab in DevTools)
2. **Navigate to test app** with function calling enabled
3. **After connection is established**, check for:
   - `window.__DEEPGRAM_LAST_SETTINGS__` (if test mode is enabled)
   - Component console logs showing Settings message
4. **Access the Settings object**:
   ```javascript
   JSON.stringify(window.__DEEPGRAM_LAST_SETTINGS__, null, 2)
   ```
5. **Copy the output** - this is the Settings message JSON

**Note**: This method relies on the component's window exposure, which may not always be available. The Network tab method is more reliable.

## Screenshots Reference

For visual reference, the WebSocket messages view should look like:

```
Network Tab
├── WS Filter Applied
└── WebSocket Connection
    └── Messages Tab
        ├── → {"type":"Settings",...}  [Outgoing - This is what we need]
        ├── ← {"type":"SettingsApplied"} [Incoming - Expected but not received]
        └── ... other messages
```

## Related Documents

- `WEBSOCKET-CAPTURE-IMPLEMENTATION.md` - Automated capture implementation (not working due to Vite caching)
- `DEEPGRAM-SUPPORT-TICKET.md` - Support ticket template
- `EVIDENCE.md` - Evidence collection document
- `CAPTURE-WEBSOCKET-MESSAGES.md` - Alternative capture methods

