# Backend Proxy Documentation

**Issue #242** - Backend Proxy Support for Secure API Key Management

This directory contains comprehensive documentation for implementing and using backend proxy mode with the `DeepgramVoiceInteraction` component.

## Documentation Files

### Core Documentation

- **[Interface Contract](./INTERFACE-CONTRACT.md)** - Specification of the backend proxy interface contract that developers must implement
- **[Security Best Practices](./SECURITY-BEST-PRACTICES.md)** - Security guidelines and best practices for backend proxy implementation
- **[Migration Guide](./MIGRATION-GUIDE.md)** - Step-by-step guide for migrating from direct connection to proxy mode

### Implementation Guides

- **[Node.js/Express Implementation](./IMPLEMENTATION-NODEJS.md)** - Complete guide for implementing backend proxy with Node.js and Express
- **[Python/FastAPI Implementation](./IMPLEMENTATION-FASTAPI.md)** - Complete guide for implementing backend proxy with Python and FastAPI
- **[Python/Django Implementation](./IMPLEMENTATION-DJANGO.md)** - Complete guide for implementing backend proxy with Python and Django

## Quick Start

1. **Read the Interface Contract** - Understand what your backend must implement
2. **Choose Your Framework** - Select the implementation guide for your backend stack
3. **Follow Security Best Practices** - Ensure your implementation is secure
4. **Update Your Frontend** - Use `proxyEndpoint` prop instead of `apiKey`

## Key Concepts

### Interface Contract, Not New Service

**Important**: This is **not a new service to deploy**. Instead, it's an **interface contract** that developers implement in their existing backend infrastructure by adding a WebSocket proxy endpoint.

### Connection Modes

- **Direct Mode**: Component connects directly to Deepgram using `apiKey` prop
- **Proxy Mode**: Component connects through your backend proxy using `proxyEndpoint` prop

### Security Benefits

- API keys never exposed to frontend
- Better compliance with security standards
- Reduced risk of unauthorized usage
- Better control over API usage

## Validation & Testing

Backend proxy support has been comprehensively validated and is production-ready:

- ✅ 47/47 proxy mode tests passing (100% pass rate)
- ✅ All connection-relevant features validated
- ✅ Equivalent test coverage confirmed between proxy and direct modes
- ✅ All regression fixes validated in proxy mode

For detailed validation results, see the [validation documentation](../issues/ISSUE-345/ISSUE-345-VALIDATION-REPORT.md).

## Support scope

We provide **reference proxy code** and the **interface contract** (protocol, event order). We do **not** support third-party proxy implementations: we do not provide technical support, debugging, or SLAs for proxies built or operated by others. For hosted proxy services or support, customers should adopt third-party proxy implementations or vendors that implement the same contract. See [Proxy ownership and support scope](../issues/ISSUE-388/PROXY-OWNERSHIP-DECISION.md#support-scope-for-proxies) for the full statement.

## Related Documentation

- [API Reference](../API-REFERENCE.md) - Component API documentation with proxy mode examples
- [Issue #242 Tracking](../issues/ISSUE-242-BACKEND-PROXY-SUPPORT.md) - Complete feature tracking document
- [Proxy ownership decision](../issues/ISSUE-388/PROXY-OWNERSHIP-DECISION.md) - What we own (code, contract) and support scope for proxies
