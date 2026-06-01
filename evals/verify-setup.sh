#!/bin/bash
set -uo pipefail

# Usage: verify-setup.sh <workdir> <fixture>
# Dispatches to the per-library verifier in evals/library-checks/<library>.sh.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

WORKDIR="${1:?Usage: verify-setup.sh <workdir> <fixture>}"
FIXTURE="${2:?Usage: verify-setup.sh <workdir> <fixture>}"

MANIFEST="$SCRIPT_DIR/fixtures.json"

if [ ! -f "$MANIFEST" ]; then
  echo "ERROR: Fixture manifest not found: $MANIFEST"
  exit 1
fi

FIXTURE_CONFIG=$(jq -e ".\"$FIXTURE\"" "$MANIFEST" 2>/dev/null) || {
  echo "ERROR: Fixture '$FIXTURE' not found in $MANIFEST"
  exit 1
}

LIBRARY=$(echo "$FIXTURE_CONFIG" | jq -r '.library // empty')
VARIANT=$(echo "$FIXTURE_CONFIG" | jq -r '.variant // empty')

if [ -z "$LIBRARY" ]; then
  echo "ERROR: Fixture '$FIXTURE' has no library — Layer B should not be used for library-less fixtures (e.g. hard-stops)"
  exit 2
fi

VERIFIER="$SCRIPT_DIR/library-checks/$LIBRARY.sh"

if [ ! -f "$VERIFIER" ]; then
  echo "ERROR: No verifier for library '$LIBRARY' yet (expected: $VERIFIER)"
  exit 2
fi

exec "$VERIFIER" "$WORKDIR" "$FIXTURE" "$VARIANT"
