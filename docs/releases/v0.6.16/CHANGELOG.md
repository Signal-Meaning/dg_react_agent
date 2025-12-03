# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.16] - 2025-12-03

### Fixed

- **Issue #318**: Fixed `useEffect` not running when `agentOptions` changes in minified builds
  - Changed dependency array from `[agentOptions, props.debug]` to `[props.agentOptions, props.debug]`
  - Reason: Destructured variables in dependency arrays may not work correctly in minified builds
  - React's dependency tracking works more reliably with direct property access
  - This ensures Settings are re-sent correctly when `agentOptions` changes, even in production/minified builds

### Changed

- Updated release script to create `release/vX.X.X` branch format (matches checklist requirements)
- Fixed lint warning: Replaced `any` with `unknown` in `TranscriptionOptions.metadata` type

