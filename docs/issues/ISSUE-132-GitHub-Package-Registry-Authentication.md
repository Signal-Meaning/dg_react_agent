# Issue #132: GitHub Package Registry 401 Authentication Error

## 🚨 Problem Summary

**Issue**: GitHub Actions workflows failing with 401 Unauthorized error when publishing to GitHub Package Registry, blocking v0.4.0 release.

**Status**: 🔄 **INVESTIGATING** - Multiple approaches attempted, root cause identified but not resolved

**Impact**: 
- v0.4.0 release blocked
- Voice-commerce team cannot access updated package
- Release process broken

## 📋 Issue History

### Initial Report
- **Date**: October 21, 2025
- **Issue**: #132 - GitHub Package Registry 401 authentication error
- **Initial Error**: `npm error 401 Unauthorized - PUT https://npm.pkg.github.com/@signal-meaning%2fdeepgram-voice-interaction-react - unauthenticated: User cannot be authenticated with the token provided.`

### Multiple Reopenings
1. **First Reopening**: After initial GITHUB_TOKEN fix attempt
2. **Second Reopening**: After NPM_PACKAGES_TOKEN configuration
3. **Third Reopening**: After workflow cleanup and debug enhancement
4. **Current Status**: Still investigating authentication differences between local and CI environments

## 🔍 Investigation Progress

### Phase 1: Initial Diagnosis
- **Problem**: GITHUB_TOKEN lacks package write permissions
- **Solution Attempted**: Updated workflows to use GITHUB_TOKEN with proper permissions
- **Result**: ❌ Still failed with 401 error

### Phase 2: Token Configuration
- **Problem**: GITHUB_TOKEN insufficient for package operations
- **Solution Attempted**: Switched to NPM_PACKAGES_TOKEN secret
- **Result**: ❌ Still failed with 401 error

### Phase 3: Workflow Analysis
- **Problem**: Debug workflow passing but publish workflow failing
- **Discovery**: Debug workflow only tested read operations, not write operations
- **Solution Attempted**: Enhanced debug workflow to test actual publishing
- **Result**: ✅ Debug workflow now properly fails on authentication errors

### Phase 4: Local vs CI Environment Analysis
- **Problem**: Local testing passes but GitHub Actions fails
- **Discovery**: Local environment contaminated with personal GITHUB_TOKEN
- **Solution Attempted**: Created truly isolated test environment
- **Result**: ✅ Local testing still passes even without GITHUB_TOKEN contamination

### Phase 5: Workflow Simplification
- **Problem**: Conflicting authentication methods in workflow
- **Solution Attempted**: Simplified workflow to use only setup-node authentication
- **Result**: ❌ Still fails in GitHub Actions

## 🧪 Testing Results

### Local Environment Testing
- **Registry Ping**: ✅ Success
- **Authentication**: ✅ Successfully authenticated as `davidrmcgee`
- **Package View**: ✅ Successfully viewed existing packages
- **Publish Dry Run**: ❌ Fails due to missing rollup (expected in isolated environment)

### GitHub Actions Testing
- **Debug Workflow**: ❌ Fails with 403/401 errors
- **Publish Workflow**: ❌ Fails with 401 Unauthorized error
- **Token**: NPM_PACKAGES_TOKEN confirmed as only secret in repository

## 🔧 Technical Details

### Workflow Configuration
```yaml
# Current publish.yml configuration
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    registry-url: 'https://npm.pkg.github.com'
    scope: '@signal-meaning'
    token: ${{ secrets.NPM_PACKAGES_TOKEN }}
```

### Token Analysis
- **Token Type**: GitHub Personal Access Token (ghp_*)
- **Length**: 40 characters
- **Format**: Valid GitHub token format
- **Local Testing**: Works perfectly
- **CI Testing**: Fails with 401

### Package Configuration
```json
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}
```

## 🎯 Root Cause Analysis

### Primary Hypothesis
The `NPM_PACKAGES_TOKEN` has different permissions or behavior in the GitHub Actions environment compared to local development environment.

### Possible Causes
1. **Token Scope Restrictions**: Token may not have `write:packages` scope in CI
2. **Repository Settings**: Package access restrictions at repository level
3. **Organization Settings**: OAuth App access restrictions at organization level
4. **Token Expiration**: Token may be expired or invalid in CI environment
5. **Environment Differences**: Different authentication behavior in CI vs local

### Evidence Supporting Hypothesis
- ✅ Token works locally with full permissions
- ❌ Same token fails in GitHub Actions with 401
- ✅ Local environment has additional GITHUB_TOKEN (contamination)
- ❌ GitHub Actions environment has only NPM_PACKAGES_TOKEN

## 🚀 Attempted Solutions

### Solution 1: GITHUB_TOKEN Configuration
- **Approach**: Use GITHUB_TOKEN with package write permissions
- **Result**: ❌ Failed - GITHUB_TOKEN lacks package permissions

### Solution 2: NPM_PACKAGES_TOKEN Configuration
- **Approach**: Use dedicated NPM_PACKAGES_TOKEN secret
- **Result**: ❌ Failed - Still 401 error in CI

### Solution 3: Workflow Simplification
- **Approach**: Remove conflicting manual .npmrc configuration
- **Result**: ❌ Failed - Still 401 error in CI

### Solution 4: Debug Workflow Enhancement
- **Approach**: Add proper error handling and publish testing
- **Result**: ✅ Improved debugging capabilities

## 🔄 Current Status

### What's Working
- ✅ Local authentication with NPM_PACKAGES_TOKEN
- ✅ Package registry connectivity
- ✅ Package viewing and reading
- ✅ Debug workflow error handling

### What's Not Working
- ❌ GitHub Actions authentication
- ❌ Package publishing in CI
- ❌ v0.4.0 release completion

### Next Steps
1. **Investigate token permissions** in GitHub settings
2. **Check repository package settings** for access restrictions
3. **Verify organization OAuth App settings**
4. **Consider alternative authentication methods**

## 🛠️ Workarounds

### Immediate Workaround
**Manual Package Publishing**: Publish package manually from local environment
```bash
# Set token
export NPM_PACKAGES_TOKEN="your_token_here"

# Publish manually
npm publish
```

### Alternative Approaches
1. **Use different token type**: Try GitHub App token instead of PAT
2. **Use different authentication method**: Try SSH keys or different npm auth
3. **Publish to different registry**: Use npmjs.org as fallback
4. **Manual release process**: Bypass GitHub Actions for publishing

## 📊 Impact Assessment

### Business Impact
- **High**: v0.4.0 release blocked
- **High**: Voice-commerce team cannot access updated package
- **Medium**: Release process automation broken

### Technical Impact
- **High**: Package publishing workflow broken
- **Medium**: Release automation disrupted
- **Low**: Development workflow unaffected

## 🔗 Related Issues

- **Issue #132**: Main tracking issue
- **Issue #129**: v0.4.0 release planning
- **Issue #81**: Previous packaging issues (resolved)

## 📚 References

- [GitHub Package Registry Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [GitHub Actions setup-node Documentation](https://github.com/actions/setup-node)
- [npm Authentication Documentation](https://docs.npmjs.com/cli/v8/configuring-npm/registry)

## 🏷️ Labels

- `bug`
- `high-priority`
- `release-blocking`
- `authentication`
- `github-actions`
- `package-registry`

---

**Last Updated**: October 21, 2025  
**Assignee**: @davidrmcgee  
**Status**: 🔄 Investigating  
**Priority**: High
