# Backend Proxy Implementation Guide - Python/FastAPI

**Issue #242** - Backend Proxy Support for Secure API Key Management

This guide shows how to implement the backend proxy interface contract using Python and FastAPI.

## Prerequisites

- Python 3.8+
- FastAPI
- `websockets` package for WebSocket support
- Deepgram API key (stored server-side)

## Installation

```bash
pip install fastapi uvicorn websockets python-dotenv
```

## Basic Implementation

### 1. Create WebSocket Proxy Endpoint

```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.responses import HTMLResponse
import websockets
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Get Deepgram API key from environment (server-side only!)
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
DEEPGRAM_URL = "wss://agent.deepgram.com/v1/agent/converse"

@app.websocket("/deepgram-proxy")
async def deepgram_proxy(websocket: WebSocket, token: str = Query(None)):
    """
    WebSocket proxy endpoint that forwards connections to Deepgram.
    
    Args:
        websocket: WebSocket connection from frontend
        token: Optional authentication token from query parameter
    """
    # Optional: Validate authentication token
    if token:
        # Validate token using your auth system
        # For example, verify JWT:
        # if not validate_jwt_token(token):
        #     await websocket.close(code=1008, reason="Invalid token")
        #     return
        pass
    
    if not DEEPGRAM_API_KEY:
        await websocket.close(code=1011, reason="Server configuration error")
        return
    
    # Accept frontend connection
    await websocket.accept()
    
    try:
        # Connect to Deepgram with API key in subprotocol
        deepgram_uri = DEEPGRAM_URL
        headers = {}
        
        # Create connection to Deepgram
        async with websockets.connect(
            deepgram_uri,
            subprotocols=["token", DEEPGRAM_API_KEY],
            extra_headers=headers
        ) as deepgram_ws:
            
            # Create tasks for bidirectional message forwarding
            async def forward_to_deepgram():
                """Forward messages from frontend to Deepgram"""
                try:
                    while True:
                        data = await websocket.receive()
                        if "bytes" in data:
                            await deepgram_ws.send(data["bytes"])
                        elif "text" in data:
                            await deepgram_ws.send(data["text"])
                except WebSocketDisconnect:
                    pass
                except Exception as e:
                    print(f"Error forwarding to Deepgram: {e}")
            
            async def forward_to_client():
                """Forward messages from Deepgram to frontend"""
                try:
                    async for message in deepgram_ws:
                        if isinstance(message, bytes):
                            await websocket.send_bytes(message)
                        else:
                            await websocket.send_text(message)
                except Exception as e:
                    print(f"Error forwarding to client: {e}")
            
            # Run both forwarding tasks concurrently
            await asyncio.gather(
                forward_to_deepgram(),
                forward_to_client()
            )
            
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"Proxy error: {e}")
        await websocket.close(code=1011, reason="Proxy error")
    finally:
        await websocket.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Advanced: JWT Authentication

```python
import jwt
from fastapi import HTTPException, status

JWT_SECRET = os.getenv("JWT_SECRET")

def validate_jwt_token(token: str) -> bool:
    """Validate JWT token"""
    try:
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return True
    except jwt.InvalidTokenError:
        return False

@app.websocket("/deepgram-proxy")
async def deepgram_proxy(websocket: WebSocket, token: str = Query(None)):
    # Require authentication
    if not token:
        await websocket.close(code=1008, reason="Authentication required")
        return
    
    # Validate token
    if not validate_jwt_token(token):
        await websocket.close(code=1008, reason="Invalid token")
        return
    
    # Continue with proxy logic...
    await websocket.accept()
    # ... rest of implementation
```

## Advanced: Connection Pooling

For high-traffic scenarios, you might want connection pooling:

```python
from collections import defaultdict
import asyncio

# Connection pool (in production, use Redis or similar)
connection_pool = defaultdict(list)

@app.websocket("/deepgram-proxy")
async def deepgram_proxy(websocket: WebSocket, token: str = Query(None)):
    await websocket.accept()
    
    # Get or create Deepgram connection from pool
    user_id = get_user_id_from_token(token)  # Your implementation
    
    if user_id not in connection_pool:
        # Create new Deepgram connection
        deepgram_ws = await websockets.connect(
            DEEPGRAM_URL,
            subprotocols=["token", DEEPGRAM_API_KEY]
        )
        connection_pool[user_id].append(deepgram_ws)
    else:
        deepgram_ws = connection_pool[user_id][0]
    
    # Forward messages...
```

## Environment Variables

Create a `.env` file:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
JWT_SECRET=your_jwt_secret_here
```

## Running the Server

```bash
# Development
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Frontend Usage

Once your backend proxy is running, use it in your React component:

```tsx
<DeepgramVoiceInteraction
  proxyEndpoint="wss://api.example.com/deepgram-proxy"
  proxyAuthToken={userJwtToken} // Optional
  agentOptions={agentOptions}
/>
```

## Testing

1. Start your proxy server:
   ```bash
   uvicorn main:app --reload
   ```

2. Test with the component:
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint="ws://localhost:8000/deepgram-proxy"
     agentOptions={agentOptions}
   />
   ```

## Security Checklist

- [ ] API key stored in environment variables (never in code)
- [ ] HTTPS/WSS used in production
- [ ] Authentication tokens validated
- [ ] Rate limiting implemented (use FastAPI's rate limiting middleware)
- [ ] Error logging (without exposing sensitive data)
- [ ] CORS configured appropriately

## Troubleshooting

### Connection Refused
- Check that server is running
- Verify WebSocket path matches (`/deepgram-proxy`)
- Check firewall/network settings

### Authentication Failures
- Verify JWT secret matches
- Check token expiration
- Validate token format

### Deepgram Connection Issues
- Verify `DEEPGRAM_API_KEY` is set correctly
- Check API key permissions
- Verify network connectivity to Deepgram
- Check subprotocol format: `["token", api_key]`

## Additional Resources

- [FastAPI WebSocket Documentation](https://fastapi.tiangolo.com/advanced/websockets/)
- [Python websockets Library](https://websockets.readthedocs.io/)
