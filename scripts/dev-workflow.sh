#!/bin/bash

# Development workflow script for dg_react_agent
# Helps with common development tasks

set -e

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

# Function to show help
show_help() {
    echo "🔧 dg_react_agent Development Workflow"
    echo "======================================"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build          - Build the package"
    echo "  test           - Run all tests"
    echo "  test:e2e       - Run E2E tests"
    echo "  package        - Create local package (.tgz)"
    echo "  dev            - Start development mode (build + watch)"
    echo "  clean          - Clean build artifacts"
    echo "  install        - Install dependencies"
    echo "  lint           - Run linting"
    echo "  validate       - Run package validation"
    echo "  status         - Show git and package status"
    echo "  help           - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 build       # Build the package"
    echo "  $0 test        # Run tests"
    echo "  $0 package     # Create local package"
    echo "  $0 dev         # Start development mode"
}

# Function to show status
show_status() {
    echo "📊 dg_react_agent Status"
    echo "========================"
    
    # Git status
    print_status "Git status:"
    git status --short
    
    # Package info
    print_status "Package info:"
    echo "  Name: $(node -p "require('./package.json').name")"
    echo "  Version: $(node -p "require('./package.json').version")"
    
    # Dependencies
    print_status "Dependencies:"
    if [ -d "node_modules" ]; then
        echo "  ✅ Dependencies installed"
    else
        echo "  ❌ Dependencies not installed (run: npm install)"
    fi
    
    # Build status
    print_status "Build status:"
    if [ -d "dist" ]; then
        echo "  ✅ Build directory exists"
        echo "  📁 Build files: $(ls dist/ | wc -l) files"
    else
        echo "  ❌ Build directory missing (run: npm run build)"
    fi
    
    # Test status
    print_status "Test status:"
    if [ -d "test-results" ]; then
        echo "  📊 Test results available"
    fi
}

# Main command handling
case "${1:-help}" in
    "build")
        print_status "Building package..."
        npm run build
        print_success "Build completed!"
        ;;
    "test")
        print_status "Running tests..."
        npm test
        print_success "Tests completed!"
        ;;
    "test:e2e")
        print_status "Running E2E tests..."
        npm run test:e2e
        print_success "E2E tests completed!"
        ;;
    "package")
        print_status "Creating local package..."
        ./scripts/package-for-local.sh
        ;;
    "dev")
        print_status "Starting development mode..."
        print_status "Building package and starting watch mode..."
        npm run build:watch
        ;;
    "clean")
        print_status "Cleaning build artifacts..."
        rm -rf dist/
        rm -f *.tgz
        print_success "Cleanup completed!"
        ;;
    "install")
        print_status "Installing dependencies..."
        npm install
        print_success "Dependencies installed!"
        ;;
    "lint")
        print_status "Running linting..."
        npm run lint
        print_success "Linting completed!"
        ;;
    "validate")
        print_status "Running package validation..."
        npm run validate
        print_success "Validation completed!"
        ;;
    "status")
        show_status
        ;;
    "help"|*)
        show_help
        ;;
esac
