#!/usr/bin/env bash
# Validate both @signal-meaning packages exist on GitHub Packages (via GitHub API).
# Requires: gh auth with read:packages scope. Run: gh auth refresh -h github.com -s read:packages
set -e
ORG="Signal-Meaning"
FRONTEND_PKG="voice-agent-react"
BACKEND_PKG="voice-agent-backend"

echo "Validating packages under org $ORG..."
echo ""

# Frontend
if resp=$(gh api "orgs/$ORG/packages/npm/$FRONTEND_PKG" 2>&1); then
  echo "  @$ORG/$FRONTEND_PKG: found"
else
  if echo "$resp" | grep -q "404"; then
    echo "  @$ORG/$FRONTEND_PKG: NOT FOUND (404)"
  elif echo "$resp" | grep -q "403"; then
    echo "  @$ORG/$FRONTEND_PKG: cannot check (403 - need read:packages). Run: gh auth refresh -h github.com -s read:packages"
  else
    echo "  @$ORG/$FRONTEND_PKG: error"
    echo "$resp" | head -5
  fi
fi
echo ""

# Backend
if resp=$(gh api "orgs/$ORG/packages/npm/$BACKEND_PKG" 2>&1); then
  echo "  @$ORG/$BACKEND_PKG: found"
else
  if echo "$resp" | grep -q "404"; then
    echo "  @$ORG/$BACKEND_PKG: NOT FOUND (404)"
  elif echo "$resp" | grep -q "403"; then
    echo "  @$ORG/$BACKEND_PKG: cannot check (403 - need read:packages). Run: gh auth refresh -h github.com -s read:packages"
  else
    echo "  @$ORG/$BACKEND_PKG: error"
    echo "$resp" | head -5
  fi
fi
echo ""
echo "Done."
