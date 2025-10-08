#!/bin/bash

# Package dg_react_agent for local development and testing
# This script creates a .tgz package that can be installed locally

set -e  # Exit on any error

echo "📦 Packaging dg_react_agent for local development..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the dg_react_agent root directory."
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found in dg_react_agent directory"
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
fi

# Run tests first
print_status "Running tests to ensure package quality..."
if npm test; then
    print_success "All tests passed!"
else
    print_warning "Some tests failed, but continuing with packaging..."
fi

# Build the package
print_status "Building the package..."
npm run build

# Update test-app dependencies
print_status "Updating test-app dependencies..."
cd test-app
npm install
cd ..

# Pack the package
print_status "Creating package tarball..."
PACKAGE_FILE=$(npm pack)
print_success "Created package: $PACKAGE_FILE"

# Show package details
print_status "Package details:"
ls -lh $PACKAGE_FILE

# Show installation instructions
echo ""
print_success "✅ Package created successfully!"
echo ""
print_status "To install this package in another project:"
echo "  npm install ./$PACKAGE_FILE"
echo ""
print_status "To install in a parent directory project:"
echo "  npm install ./dg_react_agent/$PACKAGE_FILE"
echo ""
print_status "Package file location: $(pwd)/$PACKAGE_FILE"

# Ask if user wants to keep the file
read -p "Do you want to keep the .tgz file? (Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    print_status "Cleaning up .tgz file..."
    rm -f $PACKAGE_FILE
    print_success "Cleanup completed"
else
    print_success "Package file kept: $PACKAGE_FILE"
fi
