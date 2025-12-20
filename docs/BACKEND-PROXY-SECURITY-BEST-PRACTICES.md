# Backend Proxy Security Best Practices

**Issue #242** - Backend Proxy Support for Secure API Key Management

This document outlines security best practices for implementing the backend proxy interface contract.

## Core Security Principles

### 1. Never Expose API Keys to the Frontend

**❌ NEVER DO THIS:**
```tsx
// BAD: API key in frontend code
<DeepgramVoiceInteraction
  apiKey="dg_your_actual_api_key_here"  // ❌ Exposed in bundle!
/>
```

**✅ ALWAYS DO THIS:**
```tsx
// GOOD: Use backend proxy
<DeepgramVoiceInteraction
  proxyEndpoint="wss://api.example.com/deepgram-proxy"  // ✅ API key stays server-side
/>
```

### 2. Store API Keys Securely

**Server-Side Storage Options (in order of preference):**

1. **Secrets Manager** (AWS Secrets Manager, Azure Key Vault, Google Secret Manager)
   ```python
   # Example: AWS Secrets Manager
   import boto3
   client = boto3.client('secretsmanager')
   api_key = client.get_secret_value(SecretId='deepgram-api-key')['SecretString']
   ```

2. **Environment Variables** (for development and small deployments)
   ```bash
   # .env file (never commit to git!)
   DEEPGRAM_API_KEY=your_api_key_here
   ```

3. **Configuration Files** (with proper access controls)
   - Restrict file permissions: `chmod 600 config/secrets.json`
   - Never commit to version control
   - Use `.gitignore` to exclude

**❌ NEVER:**
- Hardcode in source code
- Store in client-side JavaScript
- Commit to version control
- Log in plain text

### 3. Use HTTPS/WSS in Production

**❌ NEVER in Production:**
```tsx
proxyEndpoint="ws://api.example.com/deepgram-proxy"  // ❌ Unencrypted
```

**✅ ALWAYS in Production:**
```tsx
proxyEndpoint="wss://api.example.com/deepgram-proxy"  // ✅ Encrypted
```

**Why:**
- Prevents man-in-the-middle attacks
- Protects authentication tokens
- Ensures data integrity

### 4. Authenticate Proxy Requests

**Implement Authentication:**

```javascript
// Example: JWT validation
const jwt = require('jsonwebtoken');

function verifyClient(info) {
  const token = extractTokenFromQuery(info.req.url);
  
  if (!token) {
    return false; // Reject unauthenticated requests
  }
  
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    return true;
  } catch (error) {
    return false; // Reject invalid tokens
  }
}
```

**Authentication Options:**
- **JWT Tokens**: Stateless, scalable
- **Session Tokens**: Stateful, requires session storage
- **OAuth 2.0**: Industry standard for third-party auth
- **API Keys**: Simple but less secure (use with rate limiting)

### 5. Implement Rate Limiting

**Protect Against Abuse:**

```javascript
// Example: Express rate limiting
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 connections per window
  keyGenerator: (req) => req.ip
});
```

**Rate Limiting Strategies:**
- **Per IP**: Limit connections per IP address
- **Per User**: Limit connections per authenticated user
- **Per API Key**: Limit usage per Deepgram API key
- **Tiered Limits**: Different limits for different user tiers

### 6. Validate and Sanitize Inputs

**Validate Proxy Endpoint URLs:**

```typescript
function validateProxyEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow WSS in production
    if (parsed.protocol !== 'wss:') {
      return false;
    }
    // Validate domain (whitelist approach)
    const allowedDomains = ['api.example.com', 'api-staging.example.com'];
    if (!allowedDomains.includes(parsed.hostname)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
```

### 7. Logging and Monitoring

**Log Security Events (without sensitive data):**

```javascript
// ✅ GOOD: Log without exposing secrets
logger.info('WebSocket connection established', {
  clientIp: req.socket.remoteAddress,
  timestamp: new Date().toISOString(),
  // Don't log: API keys, tokens, message content
});

// ❌ BAD: Logging sensitive data
logger.info('Connection established', {
  apiKey: process.env.DEEPGRAM_API_KEY,  // ❌ Never log API keys!
  token: authToken  // ❌ Never log tokens!
});
```

**Monitor:**
- Connection attempts
- Authentication failures
- Rate limit violations
- Error rates
- Unusual traffic patterns

### 8. Error Handling

**Don't Expose Internal Details:**

```javascript
// ❌ BAD: Exposes internal details
catch (error) {
  await websocket.close(1011, `Deepgram API key invalid: ${apiKey.substring(0, 5)}`);
}

// ✅ GOOD: Generic error message
catch (error) {
  logger.error('Proxy error', { error: error.message });
  await websocket.close(1011, 'Proxy error');
}
```

### 9. CORS Configuration

**Restrict Origins:**

```javascript
// Express example
const cors = require('cors');

app.use(cors({
  origin: [
    'https://yourdomain.com',
    'https://app.yourdomain.com'
  ],
  credentials: true
}));
```

### 10. Network Security

**Firewall Rules:**
- Only allow WebSocket connections from trusted sources
- Block direct access to Deepgram API from frontend
- Use VPN or private networks for backend-to-Deepgram communication

**Network Isolation:**
- Run proxy in private network
- Use load balancers with SSL termination
- Implement DDoS protection

## Security Checklist

Before deploying your backend proxy:

- [ ] API key stored in secrets manager or environment variables
- [ ] API key never exposed to frontend
- [ ] HTTPS/WSS used in production
- [ ] Authentication implemented and validated
- [ ] Rate limiting configured
- [ ] Input validation (URLs, tokens)
- [ ] Error messages don't expose sensitive data
- [ ] Logging configured (without sensitive data)
- [ ] CORS properly configured
- [ ] Firewall rules in place
- [ ] DDoS protection enabled
- [ ] Regular security audits scheduled
- [ ] API key rotation plan in place

## Common Security Pitfalls

### 1. API Key in Frontend Bundle

**Problem:** API key visible in browser DevTools
**Solution:** Always use backend proxy mode

### 2. Weak Authentication

**Problem:** No authentication or weak token validation
**Solution:** Implement proper JWT/session validation

### 3. Missing Rate Limiting

**Problem:** Unlimited connections can lead to abuse
**Solution:** Implement per-IP and per-user rate limits

### 4. Exposing Errors

**Problem:** Error messages reveal internal details
**Solution:** Use generic error messages, log details server-side

### 5. HTTP Instead of HTTPS

**Problem:** Unencrypted connections in production
**Solution:** Always use WSS in production

## Incident Response

If you suspect a security breach:

1. **Immediately rotate API keys**
2. **Review access logs** for suspicious activity
3. **Revoke compromised tokens**
4. **Update security measures** based on findings
5. **Notify affected users** if necessary

## Compliance Considerations

For enterprise deployments:

- **SOC 2**: Ensure API keys are properly managed
- **GDPR**: Don't log personal data unnecessarily
- **HIPAA**: Encrypt all communications (WSS required)
- **PCI DSS**: If handling payment data, ensure proper isolation

## Additional Resources

- [OWASP WebSocket Security](https://owasp.org/www-community/vulnerabilities/WebSocket_Security)
- [Deepgram Security Best Practices](https://developers.deepgram.com/docs/security-best-practices)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
