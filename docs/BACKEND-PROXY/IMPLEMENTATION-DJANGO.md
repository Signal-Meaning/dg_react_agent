# Backend Proxy Implementation Guide - Python/Django

**Issue #242** - Backend Proxy Support for Secure API Key Management

This guide shows how to implement the backend proxy interface contract using Python and Django with Django Channels.

## Prerequisites

- Python 3.8+
- Django 3.2+
- Django Channels 3.0+
- Deepgram API key (stored server-side)

## Installation

```bash
pip install django channels channels-redis websockets python-dotenv
```

## Setup

### 1. Configure Django Settings

```python
# settings.py
import os
from dotenv import load_dotenv

load_dotenv()

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',  # Add channels
    'your_app',
]

# Channels configuration
ASGI_APPLICATION = 'your_project.asgi.application'

# Channel layers (for production, use Redis)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [('127.0.0.1', 6379)],
        },
    },
}

# Deepgram configuration
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
DEEPGRAM_URL = "wss://agent.deepgram.com/v1/agent/converse"
```

### 2. Create ASGI Application

```python
# your_project/asgi.py
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import your_app.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'your_project.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            your_app.routing.websocket_urlpatterns
        )
    ),
})
```

### 3. Create WebSocket Routing

```python
# your_app/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/deepgram-proxy/$', consumers.DeepgramProxyConsumer.as_asgi()),
]
```

### 4. Create WebSocket Consumer

```python
# your_app/consumers.py
import json
import asyncio
import websockets
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

class DeepgramProxyConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer that proxies connections to Deepgram.
    """
    
    async def connect(self):
        """
        Handle WebSocket connection from frontend.
        """
        # Extract token from query string
        query_string = self.scope.get('query_string', b'').decode()
        token = None
        
        if query_string:
            params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
            token = params.get('token')
        
        # Optional: Validate authentication token
        if token:
            # Validate token using your auth system
            # For example:
            # if not await self.validate_token(token):
            #     await self.close(code=1008)
            #     return
            pass
        
        # Check Deepgram API key is configured
        if not settings.DEEPGRAM_API_KEY:
            await self.close(code=1011, reason="Server configuration error")
            return
        
        # Accept connection
        await self.accept()
        
        # Connect to Deepgram
        try:
            self.deepgram_ws = await websockets.connect(
                settings.DEEPGRAM_URL,
                subprotocols=["token", settings.DEEPGRAM_API_KEY]
            )
            
            # Start forwarding messages
            asyncio.create_task(self.forward_to_deepgram())
            asyncio.create_task(self.forward_to_client())
            
        except Exception as e:
            print(f"Error connecting to Deepgram: {e}")
            await self.close(code=1011, reason="Proxy error")
    
    async def disconnect(self, close_code):
        """
        Handle WebSocket disconnection.
        """
        if hasattr(self, 'deepgram_ws'):
            await self.deepgram_ws.close()
    
    async def receive(self, text_data=None, bytes_data=None):
        """
        Receive message from frontend and forward to Deepgram.
        """
        if hasattr(self, 'deepgram_ws') and self.deepgram_ws.open:
            if bytes_data:
                await self.deepgram_ws.send(bytes_data)
            elif text_data:
                await self.deepgram_ws.send(text_data)
    
    async def forward_to_deepgram(self):
        """
        Forward messages from frontend to Deepgram.
        """
        try:
            while True:
                # Messages are handled in receive() method
                await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            pass
    
    async def forward_to_client(self):
        """
        Forward messages from Deepgram to frontend.
        """
        try:
            async for message in self.deepgram_ws:
                if isinstance(message, bytes):
                    await self.send(bytes_data=message)
                else:
                    await self.send(text_data=message)
        except websockets.exceptions.ConnectionClosed:
            await self.close()
        except Exception as e:
            print(f"Error forwarding to client: {e}")
            await self.close()
```

## Advanced: JWT Authentication

```python
import jwt
from django.conf import settings

class DeepgramProxyConsumer(AsyncWebsocketConsumer):
    
    async def validate_token(self, token: str) -> bool:
        """Validate JWT token"""
        try:
            jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
            return True
        except jwt.InvalidTokenError:
            return False
    
    async def connect(self):
        # Extract and validate token
        query_string = self.scope.get('query_string', b'').decode()
        token = None
        
        if query_string:
            params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
            token = params.get('token')
        
        # Require authentication
        if not token:
            await self.close(code=1008, reason="Authentication required")
            return
        
        # Validate token
        if not await self.validate_token(token):
            await self.close(code=1008, reason="Invalid token")
            return
        
        # Continue with connection...
        await self.accept()
        # ... rest of implementation
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
python manage.py runserver

# Production (with Daphne)
daphne -b 0.0.0.0 -p 8000 your_project.asgi:application
```

## Frontend Usage

Once your backend proxy is running, use it in your React component:

```tsx
<DeepgramVoiceInteraction
  proxyEndpoint="wss://api.example.com/ws/deepgram-proxy/"
  proxyAuthToken={userJwtToken} // Optional
  agentOptions={agentOptions}
/>
```

## Testing

1. Start your Django server:
   ```bash
   python manage.py runserver
   ```

2. Test with the component:
   ```tsx
   <DeepgramVoiceInteraction
     proxyEndpoint="ws://localhost:8000/ws/deepgram-proxy/"
     agentOptions={agentOptions}
   />
   ```

## Security Checklist

- [ ] API key stored in environment variables (never in code)
- [ ] HTTPS/WSS used in production
- [ ] Authentication tokens validated
- [ ] Rate limiting implemented (use Django middleware)
- [ ] Error logging (without exposing sensitive data)
- [ ] CORS configured appropriately
- [ ] CSRF protection (for HTTP endpoints)

## Troubleshooting

### Connection Refused
- Check that server is running
- Verify WebSocket path matches (`/ws/deepgram-proxy/`)
- Check firewall/network settings
- Verify ASGI application is configured correctly

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

- [Django Channels Documentation](https://channels.readthedocs.io/)
- [Django WebSockets Guide](https://channels.readthedocs.io/en/stable/tutorial/part_1.html)
