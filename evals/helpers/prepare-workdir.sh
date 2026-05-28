#!/bin/bash
set -euo pipefail

# Usage: prepare-workdir.sh <fixture-name> <workdir>
#
# Populates <workdir> with the fixture's project files, based on its entry in
# evals/fixtures.json. Handles three fixture types:
#   - local:   copy fixtures/<path>/. into the workdir
#   - git:     clone <repo> and checkout <commit>
#   - derived: copy <base>/. then overlay <overlay>/. (overlay wins on conflict)
#
# Shared by run-eval-layer-a.sh and run-eval-layer-b.sh so workdir preparation
# stays consistent across both layers. Echoes a "==> ..." trace to stderr and
# leaves the populated project in <workdir>.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MANIFEST="$REPO_ROOT/evals/fixtures.json"

FIXTURE="${1:?Usage: prepare-workdir.sh <fixture-name> <workdir>}"
WORKDIR="${2:?Usage: prepare-workdir.sh <fixture-name> <workdir>}"

err() { echo "ERROR: $*" >&2; exit 1; }

[ -f "$MANIFEST" ] || err "Fixture manifest not found: $MANIFEST"

CONFIG=$(jq -e ".\"$FIXTURE\"" "$MANIFEST" 2>/dev/null) || err "Fixture '$FIXTURE' not found in $MANIFEST"

TYPE=$(echo "$CONFIG" | jq -r '.type')

echo "==> Preparing fixture: $FIXTURE (type: $TYPE)" >&2
mkdir -p "$WORKDIR"

case "$TYPE" in
  local)
    REL_PATH=$(echo "$CONFIG" | jq -r '.path')
    SRC="$REPO_ROOT/$REL_PATH"
    [ -d "$SRC" ] || err "Local fixture path not found: $SRC"
    cp -R "$SRC/." "$WORKDIR/"
    ;;

  git)
    REPO_URL=$(echo "$CONFIG" | jq -r '.repo')
    COMMIT=$(echo "$CONFIG" | jq -r '.commit')
    echo "==> Cloning $REPO_URL at $COMMIT" >&2
    git clone "$REPO_URL" "$WORKDIR" >&2 2>&1
    git -C "$WORKDIR" checkout "$COMMIT" >&2 2>&1
    ;;

  derived)
    BASE_REL=$(echo "$CONFIG" | jq -r '.base')
    OVERLAY_REL=$(echo "$CONFIG" | jq -r '.overlay')
    BASE="$REPO_ROOT/$BASE_REL"
    OVERLAY="$REPO_ROOT/$OVERLAY_REL"
    [ -d "$BASE" ] || err "Derived fixture base not found: $BASE"
    [ -d "$OVERLAY" ] || err "Derived fixture overlay not found: $OVERLAY"
    echo "==> Base: $BASE_REL  Overlay: $OVERLAY_REL (overlay wins)" >&2
    cp -R "$BASE/." "$WORKDIR/"
    cp -R "$OVERLAY/." "$WORKDIR/"
    ;;

  *)
    err "Unknown fixture type: $TYPE"
    ;;
esac

echo "==> Fixture prepared in $WORKDIR" >&2
