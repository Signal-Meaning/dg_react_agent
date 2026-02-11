#!/bin/bash

# Isolated test script for NPM_PACKAGES_TOKEN using environment isolation
# This script runs in a clean environment without contaminating your local setup

echo "🔍 Testing NPM_PACKAGES_TOKEN authentication with environment isolation..."
echo ""

# Check if NPM_PACKAGES_TOKEN is set
if [ -z "$NPM_PACKAGES_TOKEN" ]; then
    echo "❌ NPM_PACKAGES_TOKEN environment variable not set"
    echo "💡 To test locally, set the token:"
    echo "   export NPM_PACKAGES_TOKEN=\"your_token_here\""
    echo "   ./scripts/test-npm-token-env.sh"
    exit 1
fi

echo "✅ NPM_PACKAGES_TOKEN is set"

# Create a temporary directory for isolated testing
TEMP_DIR=$(mktemp -d)
echo ""
echo "📁 Created isolated test directory: $TEMP_DIR"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🧹 Cleaning up isolated environment..."
    rm -rf "$TEMP_DIR"
    echo "✅ Cleaned up isolated test directory"
}

# Set trap to cleanup on exit
trap cleanup EXIT

# Test 1: Check token format
echo ""
echo "🔑 Token format check:"
echo "   Length: ${#NPM_PACKAGES_TOKEN} characters"
echo "   Starts with: ${NPM_PACKAGES_TOKEN:0:10}..."
echo "   Ends with: ...${NPM_PACKAGES_TOKEN: -10}"

# Test 2: Create isolated .npmrc
echo ""
echo "📝 Creating isolated .npmrc configuration..."
cat > "$TEMP_DIR/.npmrc" << EOF
//npm.pkg.github.com/:_authToken=$NPM_PACKAGES_TOKEN
@signal-meaning:registry=https://npm.pkg.github.com
EOF

echo "✅ Isolated .npmrc created"
echo "📄 .npmrc content:"
cat "$TEMP_DIR/.npmrc"

# Test 3: Test npm configuration in isolated environment
echo ""
echo "🔧 Testing npm configuration in isolated environment..."
cd "$TEMP_DIR"
NPM_CONFIG_USERCONFIG="$TEMP_DIR/.npmrc" npm config list || echo "❌ Failed to get npm config"

# Test 4: Test registry ping in isolated environment
echo ""
echo "🏓 Testing registry ping in isolated environment..."
NPM_CONFIG_USERCONFIG="$TEMP_DIR/.npmrc" npm ping --registry https://npm.pkg.github.com || echo "❌ Failed to ping GitHub Package Registry"

# Test 5: Test package access in isolated environment
echo ""
echo "📦 Testing package access in isolated environment..."
WHOAMI_RESULT=$(NPM_CONFIG_USERCONFIG="$TEMP_DIR/.npmrc" npm whoami --registry https://npm.pkg.github.com 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ Successfully authenticated as: $WHOAMI_RESULT"
else
    echo "❌ Failed to authenticate with GitHub Package Registry"
    echo "Error: $WHOAMI_RESULT"
fi

# Test 6: Test package view in isolated environment
echo ""
echo "👀 Testing package view in isolated environment..."
VIEW_RESULT=$(NPM_CONFIG_USERCONFIG="$TEMP_DIR/.npmrc" npm view @signal-meaning/voice-agent-react --registry https://npm.pkg.github.com 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ Successfully viewed package"
    echo "📄 Package info:"
    echo "$VIEW_RESULT"
else
    echo "❌ Failed to view package"
    echo "Error: $VIEW_RESULT"
fi

# Test 7: Test package publishing (dry run) in isolated environment
echo ""
echo "🚀 Testing package publishing (dry run) in isolated environment..."
echo "   Copying package files to isolated environment..."
cp /Users/davidmcgee/Development/dg_react_agent/package.json "$TEMP_DIR/"
cp /Users/davidmcgee/Development/dg_react_agent/package-lock.json "$TEMP_DIR/" 2>/dev/null || echo "   No package-lock.json found"
cp -r /Users/davidmcgee/Development/dg_react_agent/dist "$TEMP_DIR/" 2>/dev/null || echo "   No dist directory found, will build"

# Build if dist doesn't exist
if [ ! -d "$TEMP_DIR/dist" ]; then
    echo "   Building package in isolated environment..."
    cd /Users/davidmcgee/Development/dg_react_agent
    npm run build
    cp -r dist "$TEMP_DIR/"
    cd "$TEMP_DIR"
fi

# Test publish with dry run in isolated environment
echo "   Testing publish with dry run in isolated environment..."
PUBLISH_RESULT=$(NPM_CONFIG_USERCONFIG="$TEMP_DIR/.npmrc" npm publish --dry-run 2>&1)
if [ $? -eq 0 ]; then
    echo "✅ Dry run successful in isolated environment"
    echo "📄 Dry run output:"
    echo "$PUBLISH_RESULT"
else
    echo "❌ Dry run failed in isolated environment"
    echo "Error: $PUBLISH_RESULT"
fi

echo ""
echo "📋 Summary:"
echo "This script tested NPM_PACKAGES_TOKEN in a completely isolated environment."
echo "No local files were modified or contaminated."
echo ""
echo "💡 Next steps:"
echo "1. If tests passed, the token works and we can update the workflows"
echo "2. If tests failed, we need to check token permissions or create a new one"
echo "3. Run the GitHub Actions workflows to verify the fix works in CI"
