# Changelog - v0.7.13

**Release Date**: February 2026  
**Release Type**: Patch Release

## Documentation

### Production-ready proxy code and support scope (Issue #392)

- **Audit**: Confirmed OpenAI proxy (`scripts/openai-proxy/`) and Deepgram proxy (test-app mock) meet production-ready bar for code quality and test coverage. No code changes in this release.
- **PROXY-OWNERSHIP-DECISION.md**: Added **Support scope for proxies** section: we do not support third-party proxy implementations; for hosted proxy services or support, customers should adopt third-party proxy implementations or vendors.
- **BACKEND-PROXY/README.md**: Added Support scope section and link to PROXY-OWNERSHIP-DECISION for the full statement.
- **Issue #392**: Audit report (`docs/issues/ISSUE-392/AUDIT-REPORT.md`), checklist completed, follow-up link from PROXY-OWNERSHIP-DECISION fixed to Issue #392.

## Backward Compatibility

✅ **Fully backward compatible** — No code changes. Documentation and release tracking only.
