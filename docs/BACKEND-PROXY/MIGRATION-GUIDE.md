# Migration Guide: Direct Connection to Backend Proxy

**Issue #242** - Backend Proxy Support for Secure API Key Management

This guide helps you migrate from direct connection mode (using `apiKey`) to backend proxy mode (using `proxyEndpoint`).

## Why Migrate?

**Security Benefits:**
- API keys never exposed to frontend
- Better compliance with security standards
- Reduced risk of unauthorized usage
- Better control over API usage

**When to Migrate:**
- Production deployments
- Enterprise applications
- Applications with strict security requirements
- Applications handling sensitive data

## Migration Steps

### Step 1: Implement Backend Proxy

First, implement the backend proxy endpoint in your existing backend infrastructure.

**See Implementation Guides:**
- [Node.js/Express Guide](./IMPLEMENTATION-NODEJS.md)
- [Python/FastAPI Guide](./IMPLEMENTATION-FASTAPI.md)
- [Python/Django Guide](./IMPLEMENTATION-DJANGO.md)
- [Interface Contract Specification](./INTERFACE-CONTRACT.md)

### Step 2: Update Frontend Code

#### Before (Direct Connection)

```tsx
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function MyApp() {
  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    // ... other options
  }), []);

  return (
    <DeepgramVoiceInteraction
      apiKey={process.env.REACT_APP_DEEPGRAM_API_KEY}  // ❌ Exposed in bundle
      agentOptions={agentOptions}
    />
  );
}
```

#### After (Backend Proxy)

```tsx
import { DeepgramVoiceInteraction } from '@signal-meaning/deepgram-voice-interaction-react';

function MyApp() {
  const agentOptions = useMemo(() => ({
    language: 'en',
    listenModel: 'nova-3',
    // ... other options
  }), []);

  // Get auth token from your auth system
  const authToken = useAuthToken(); // Your implementation

  return (
    <DeepgramVoiceInteraction
      proxyEndpoint="wss://api.example.com/deepgram-proxy"  // ✅ API key stays server-side
      proxyAuthToken={authToken}  // Optional: if your backend requires auth
      agentOptions={agentOptions}
    />
  );
}
```

### Step 3: Environment Configuration

#### Before

```env
# Frontend .env (exposed in bundle!)
REACT_APP_DEEPGRAM_API_KEY=dg_your_api_key_here
```

#### After

```env
# Frontend .env (no API key needed)
VITE_PROXY_ENDPOINT=wss://api.example.com/deepgram-proxy

# Backend .env (server-side only!)
DEEPGRAM_API_KEY=dg_your_api_key_here
```

### Step 4: Remove API Key from Frontend

**Remove from:**
- Environment variables (`.env` files)
- Build configuration
- Source code
- Version control history (if committed)

**Verify:**
- Search codebase for API key references
- Check browser bundle doesn't contain API key
- Verify `.gitignore` excludes `.env` files

### Step 5: Test Migration

1. **Test Backend Proxy:**
   ```bash
   # Start your backend proxy
   npm start  # or python manage.py runserver, etc.
   
   # Test connection
   curl -i -N \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     http://localhost:3000/deepgram-proxy
   ```

2. **Test Frontend:**
   ```tsx
   // Test with proxy endpoint
   <DeepgramVoiceInteraction
     proxyEndpoint="ws://localhost:3000/deepgram-proxy"
     agentOptions={agentOptions}
     debug={true}  // Enable debug logging
   />
   ```

3. **Verify Features:**
   - [ ] Connection establishes successfully
   - [ ] Transcription works
   - [ ] Agent responses work
   - [ ] VAD events fire
   - [ ] All callbacks work
   - [ ] Reconnection works

## Gradual Migration Strategy

If you need to migrate gradually:

### Option 1: Feature Flag

```tsx
const USE_PROXY = process.env.REACT_APP_USE_PROXY === 'true';

<DeepgramVoiceInteraction
  {...(USE_PROXY 
    ? { 
        proxyEndpoint: process.env.REACT_APP_PROXY_ENDPOINT,
        proxyAuthToken: authToken
      }
    : { 
        apiKey: process.env.REACT_APP_DEEPGRAM_API_KEY 
      }
  )}
  agentOptions={agentOptions}
/>
```

### Option 2: A/B Testing

```tsx
const useProxy = Math.random() < 0.5; // 50% of users

<DeepgramVoiceInteraction
  {...(useProxy 
    ? { proxyEndpoint: proxyEndpoint }
    : { apiKey: apiKey }
  )}
  agentOptions={agentOptions}
/>
```

### Option 3: Environment-Based

```tsx
const isProduction = process.env.NODE_ENV === 'production';

<DeepgramVoiceInteraction
  {...(isProduction
    ? { 
        proxyEndpoint: process.env.VITE_PROXY_ENDPOINT,
        proxyAuthToken: authToken
      }
    : { 
        apiKey: process.env.VITE_DEEPGRAM_API_KEY 
      }
  )}
  agentOptions={agentOptions}
/>
```

## OpenAI proxy (agent-only)

When your proxy URL path contains `/openai` (e.g. `wss://localhost:3001/api/openai/proxy`), the component treats the session as **agent-only**. It does not open a separate Deepgram transcription WebSocket; transcript and VAD are delivered over the single agent connection. You can pass `transcriptionOptions` and `endpointConfig` if you like—the component will ignore transcription for that session and `start()` with no arguments will succeed. See [Issue #439](https://github.com/Signal-Meaning/dg_react_agent/issues/439).

## Common Issues and Solutions

### Issue: Connection Refused

**Symptoms:** WebSocket connection fails immediately

**Solutions:**
- Verify backend proxy is running
- Check WebSocket path matches exactly
- Verify firewall/network settings
- Check CORS configuration

### Issue: Authentication Failures

**Symptoms:** Connection closes with authentication error

**Solutions:**
- Verify token format (JWT, session, etc.)
- Check token expiration
- Validate token on backend
- Check token is passed correctly in query parameter

### Issue: Deepgram Connection Fails

**Symptoms:** Backend proxy can't connect to Deepgram

**Solutions:**
- Verify `DEEPGRAM_API_KEY` is set correctly
- Check API key permissions
- Verify network connectivity
- Check subprotocol format: `["token", api_key]`

### Issue: Messages Not Forwarding

**Symptoms:** Connection works but no messages

**Solutions:**
- Check bidirectional message forwarding
- Verify message types (binary vs text)
- Check WebSocket state before sending
- Review error logs

## Rollback Plan

If you need to rollback:

1. **Revert Frontend Code:**
   ```tsx
   // Back to direct connection
   <DeepgramVoiceInteraction
     apiKey={process.env.REACT_APP_DEEPGRAM_API_KEY}
     agentOptions={agentOptions}
   />
   ```

2. **Restore Environment Variables:**
   ```env
   REACT_APP_DEEPGRAM_API_KEY=your_api_key_here
   ```

3. **Redeploy Frontend**

## Post-Migration Checklist

After migration:

- [ ] Backend proxy is running and accessible
- [ ] Frontend uses `proxyEndpoint` instead of `apiKey`
- [ ] API key removed from frontend code and environment
- [ ] Authentication working (if implemented)
- [ ] All features tested and working
- [ ] Error handling tested
- [ ] Monitoring and logging configured
- [ ] Security audit completed
- [ ] Documentation updated

## Benefits Realized

After successful migration:

✅ **Security:**
- API keys never exposed to frontend
- Better compliance posture
- Reduced security risk

✅ **Control:**
- Centralized API key management
- Better usage monitoring
- Easier key rotation

✅ **Scalability:**
- Rate limiting per user
- Better resource management
- Easier to add features (logging, analytics, etc.)

## Support

If you encounter issues during migration:

1. Check the [Interface Contract Specification](./INTERFACE-CONTRACT.md)
2. Review implementation guides for your framework
3. Test with the mock proxy server: `test-app/scripts/mock-proxy-server.js`
4. Enable debug mode: `<DeepgramVoiceInteraction debug={true} />`
5. Check browser console and backend logs

## Next Steps

After migration:

1. **Monitor Usage:** Track API usage through your backend
2. **Implement Analytics:** Add usage metrics and monitoring
3. **Optimize:** Fine-tune rate limits and connection pooling
4. **Document:** Update internal documentation
5. **Train Team:** Ensure team understands new architecture
