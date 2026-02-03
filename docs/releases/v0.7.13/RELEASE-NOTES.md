# Release Notes - v0.7.13

**Release Date**: February 2026  
**Release Type**: Patch Release

## Overview

v0.7.13 is a documentation and release-tracking release. It delivers the Issue #392 production-ready proxy audit outcome and explicit **support scope for proxies**: we do not support third-party proxy implementations; customers should adopt third-party implementations or vendors for hosted proxy services or support.

## Changes (Issue #392)

- **Proxy audit**: OpenAI and Deepgram proxy code confirmed production-ready (protocol, tests, docs). Audit report in `docs/issues/ISSUE-392/AUDIT-REPORT.md`.
- **Support scope**: PROXY-OWNERSHIP-DECISION and BACKEND-PROXY/README now state clearly that we provide reference proxy code and the integration contract only; we do not support third-party proxy implementations; for hosted/support, use third-party offerings.
- **No code changes** in this release.

## Migration

No migration required. Fully backward compatible.
