# 🔍 Debugging GitHub Actions Publishing Issue

## Problem
The GitHub Action is still failing with 401 Unauthorized error even after using `NPM_PACKAGES_TOKEN`.

## Local Debugging Steps

### 1. **Test with Your Token Locally**

```bash
# Set your NPM_PACKAGES_TOKEN
export NPM_PACKAGES_TOKEN="your_actual_token_here"

# Run the debug script
node scripts/debug-npm-auth.js

# Or run the full workflow simulation
./scripts/simulate-github-action.sh
```

### 2. **Check Token Permissions**

Go to https://github.com/settings/tokens and verify your `NPM_PACKAGES_TOKEN` has:

- ✅ `write:packages` - Required for publishing
- ✅ `read:packages` - Required for reading packages  
- ✅ `repo` - Required if repository is private
- ✅ Access to `@signal-meaning` organization

### 3. **Test Specific Authentication Commands**

```bash
# Test 1: Check who you are
npm whoami --registry https://npm.pkg.github.com

# Test 2: Ping the registry
npm ping --registry https://npm.pkg.github.com

# Test 3: Check package access
npm view @signal-meaning/deepgram-voice-interaction-react --registry https://npm.pkg.github.com
```

### 4. **Verify Repository Settings**

Check these GitHub repository settings:

1. **Repository Settings** → **General** → **Features**
   - ✅ "Packages" should be enabled

2. **Repository Settings** → **Actions** → **General**
   - ✅ "Read and write permissions" should be selected
   - ✅ "Allow GitHub Actions to create and approve pull requests" should be enabled

3. **Organization Settings** (if applicable)
   - ✅ Check if there are any organization-level restrictions

### 5. **Common Issues and Solutions**

#### Issue: Token doesn't have package permissions
**Solution:** Create a new Personal Access Token with `write:packages` scope

#### Issue: Token doesn't have organization access
**Solution:** Ensure the token has access to the `@signal-meaning` organization

#### Issue: Repository doesn't have packages enabled
**Solution:** Enable packages in repository settings

#### Issue: Token is expired
**Solution:** Generate a new token

### 6. **Alternative Authentication Methods**

If the current approach doesn't work, try these alternatives:

#### Option A: Use GITHUB_TOKEN with explicit permissions
```yaml
permissions:
  contents: read
  packages: write
  id-token: write
```

#### Option B: Use Personal Access Token as repository secret
1. Create a new PAT with `write:packages` scope
2. Add it as `NPM_PACKAGES_TOKEN` secret
3. Use it in the workflow

#### Option C: Use npm login approach
```yaml
- name: Login to GitHub Package Registry
  run: |
    echo "//npm.pkg.github.com/:_authToken=${{ secrets.NPM_PACKAGES_TOKEN }}" > ~/.npmrc
    echo "@signal-meaning:registry=https://npm.pkg.github.com" >> ~/.npmrc
    npm whoami --registry https://npm.pkg.github.com
```

### 7. **Debug the GitHub Action Logs**

When you run the action, look for these specific log sections:

1. **Setup Node.js step** - Check if token is being passed correctly
2. **Configure npm authentication step** - Check the .npmrc content
3. **Publish step** - Check the exact error message

### 8. **Test Commands to Run**

```bash
# Test 1: Basic authentication
export NPM_PACKAGES_TOKEN="your_token"
echo "//npm.pkg.github.com/:_authToken=$NPM_PACKAGES_TOKEN" > ~/.npmrc
echo "@signal-meaning:registry=https://npm.pkg.github.com" >> ~/.npmrc
npm whoami --registry https://npm.pkg.github.com

# Test 2: Package access
npm view @signal-meaning/deepgram-voice-interaction-react --registry https://npm.pkg.github.com

# Test 3: Dry run publish
npm publish --dry-run
```

## Expected Results

If everything is working correctly, you should see:

1. ✅ `npm whoami` returns your GitHub username
2. ✅ `npm ping` succeeds
3. ✅ `npm view` can access the package (or shows 404 if it doesn't exist yet)
4. ✅ `npm publish --dry-run` succeeds

## Next Steps

1. Run the local debug scripts with your actual token
2. Check the token permissions
3. Verify repository settings
4. If local testing works, the issue might be in the GitHub Action configuration
5. If local testing fails, the issue is with the token or permissions

## Files Created for Debugging

- `scripts/debug-npm-auth.js` - Comprehensive authentication testing
- `scripts/simulate-github-action.sh` - Full workflow simulation
- `DEBUG-GITHUB-ACTIONS.md` - This debugging guide
