#!/bin/bash
set -uo pipefail

# Usage: verify-manifest.sh
# Static verifier for skills/globalize-guide/manifest.json.
#
# Three layers, in order of how expensive they are to get wrong:
#   1. JSON-Schema validation against manifest.schema.json
#   2. Every path-shaped string in the manifest resolves on disk
#   3. Cross-file invariants a schema cannot express (unique variants,
#      rulesTemplate coverage, $schema itself resolving)
#
# Runs standalone against a checkout - no fixture, no model, no network.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$REPO_ROOT/skills/globalize-guide"

PASS=0
FAIL=0
WARN=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }

echo "--- Layer 1: JSON-Schema validation ---"

if python3 -c "import jsonschema" 2>/dev/null; then
  if OUT=$(python3 - "$SKILL_DIR" <<'PY' 2>&1
import json, sys, pathlib
import jsonschema
d = pathlib.Path(sys.argv[1])
schema = json.loads((d / "manifest.schema.json").read_text())
manifest = json.loads((d / "manifest.json").read_text())
# Newest validator this install provides. jsonschema 3.x tops out at Draft 7,
# which predates $defs as a keyword - but "#/$defs/..." is an ordinary JSON
# pointer, so the refs still resolve and every keyword used here is Draft 6+.
Validator = next(
    c for c in (
        getattr(jsonschema, n, None)
        for n in ("Draft202012Validator", "Draft201909Validator",
                  "Draft7Validator", "Draft6Validator")
    ) if c is not None
)
v = Validator(schema)
errors = sorted(v.iter_errors(manifest), key=lambda e: list(e.absolute_path))
for e in errors[:20]:
    loc = "/".join(str(x) for x in e.absolute_path) or "<root>"
    print(f"{loc}: {e.message}")
sys.exit(1 if errors else 0)
PY
  ); then
    pass "manifest.json validates against manifest.schema.json"
  else
    while IFS= read -r line; do [ -n "$line" ] && fail "schema: $line"; done <<< "$OUT"
  fi

  # The schema must reject a manifest it should reject, or it is decoration.
  if python3 - "$SKILL_DIR" <<'PY' >/dev/null 2>&1
import json, sys, pathlib, copy
import jsonschema
d = pathlib.Path(sys.argv[1])
schema = json.loads((d / "manifest.schema.json").read_text())
m = json.loads((d / "manifest.json").read_text())
Validator = next(
    c for c in (
        getattr(jsonschema, n, None)
        for n in ("Draft202012Validator", "Draft201909Validator",
                  "Draft7Validator", "Draft6Validator")
    ) if c is not None
)
v = Validator(schema)
cases = []
a = copy.deepcopy(m); a["stacks"][0]["supportLevel"] = "mostly-stable"; cases.append(a)
b = copy.deepcopy(m); b["stacks"][0]["referenves"] = b["stacks"][0].pop("references"); cases.append(b)
c = copy.deepcopy(m); del c["stacks"][0]["references"]["rulesTemplate"]; cases.append(c)
e = copy.deepcopy(m); e["stacks"][0]["references"]["setup"] = ["setup.md"]; cases.append(e)
sys.exit(0 if all(not v.is_valid(x) for x in cases) else 1)
PY
  then
    pass "schema rejects a bad supportLevel, a typo'd key, a missing rulesTemplate, and an unrooted path"
  else
    fail "schema accepts at least one manifest it should reject - it is not constraining what it claims to"
  fi
else
  warn "jsonschema not installed (pip install jsonschema) - Layer 1 skipped, Layers 2 and 3 still ran"
fi

echo "--- Layer 2: every path in the manifest resolves ---"

OUT=$(python3 - "$SKILL_DIR" <<'PY'
import json, sys, pathlib
d = pathlib.Path(sys.argv[1])
m = json.loads((d / "manifest.json").read_text())

paths = []
def walk(node, trail):
    if isinstance(node, dict):
        for k, v in node.items():
            walk(v, f"{trail}/{k}")
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, f"{trail}[{i}]")
    elif isinstance(node, str) and (node.endswith(".md") or node.endswith(".json")):
        paths.append((trail, node))

walk(m, "")
missing = [(t, p) for t, p in paths if not (d / p).exists()]
print(f"COUNT {len(paths)} {len({p for _, p in paths})}")
for t, p in missing:
    print(f"MISSING {t} {p}")
PY
)
COUNTS=$(echo "$OUT" | awk '/^COUNT/ {print $2" "$3}')
TOTAL=$(echo "$COUNTS" | cut -d' ' -f1)
UNIQ=$(echo "$COUNTS" | cut -d' ' -f2)
MISSING=$(echo "$OUT" | grep -c '^MISSING' || true)

# Deliberately walks EVERY string value ending in .md or .json, not only the
# ones under a `references` block. A `references`-only walk reported "all
# paths resolve" for 60 days while the root-level `$schema` pointed at a file
# that did not exist. An exhaustive check over a partial candidate set reads
# exactly like an exhaustive check.
if [ "$MISSING" -eq 0 ]; then
  pass "all $TOTAL path-shaped strings ($UNIQ unique) resolve on disk"
else
  echo "$OUT" | grep '^MISSING' | while read -r _ trail path; do
    fail "unresolved path at $trail -> $path"
  done
fi

echo "--- Layer 3: cross-file invariants ---"

OUT=$(python3 - "$SKILL_DIR" <<'PY'
import json, sys, pathlib, collections
d = pathlib.Path(sys.argv[1])
m = json.loads((d / "manifest.json").read_text())
stacks = m["stacks"]

dupes = [v for v, n in collections.Counter(s["variant"] for s in stacks).items() if n > 1]
print("DUPES " + (",".join(dupes) if dupes else "-"))

no_tmpl = [s["variant"] for s in stacks if not s.get("references", {}).get("rulesTemplate")]
print("NOTMPL " + (",".join(no_tmpl) if no_tmpl else "-"))
print("NSTACKS %d" % len(stacks))

decl = m.get("$schema")
print("SCHEMAKEY %s" % (decl or "-"))
print("SCHEMARESOLVES %s" % ("yes" if decl and (d / decl).exists() else "no"))
PY
)
DUPES=$(echo "$OUT" | awk '/^DUPES/{print $2}')
NOTMPL=$(echo "$OUT" | awk '/^NOTMPL/{print $2}')
NSTACKS=$(echo "$OUT" | awk '/^NSTACKS/{print $2}')
SCHEMAKEY=$(echo "$OUT" | awk '/^SCHEMAKEY/{print $2}')
SCHEMARESOLVES=$(echo "$OUT" | awk '/^SCHEMARESOLVES/{print $2}')

[ "$DUPES" = "-" ] && pass "all $NSTACKS stack variants are unique" || fail "duplicate variant id(s): $DUPES"
[ "$NOTMPL" = "-" ] && pass "$NSTACKS/$NSTACKS stacks declare a rulesTemplate" || fail "stack(s) with no rulesTemplate: $NOTMPL"

if [ "$SCHEMAKEY" = "-" ]; then
  warn "manifest.json declares no \$schema"
elif [ "$SCHEMARESOLVES" = "yes" ]; then
  pass "\$schema ($SCHEMAKEY) resolves"
else
  fail "\$schema points at $SCHEMAKEY, which does not exist"
fi

echo
echo "--- Verification Report ---"
echo "  Passed:   $PASS"
echo "  Failed:   $FAIL"
echo "  Warnings: $WARN"
[ "$FAIL" -eq 0 ]
