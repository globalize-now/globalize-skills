#!/bin/bash
set -uo pipefail

# Usage: ./evals/verify-cli-use.sh
#
# Static check (no model, no network) that globalize-now-cli-use leads with Workflow setup
# and keeps its Project path behind a pointer. Each check is a tripwire for one behaviour,
# named in its message.
#
# Checks:
#   1. The description triggers on setting up translation for a repository and on
#      Workflows, and no longer on creating a translation project.
#   2. Step 2 is "Set up a Workflow and start a translation" and names every Workflow
#      command it needs; the Command Reference has a row for each.
#   3. Every `workflows` command and `--flag` the skill names (SKILL.md and references/)
#      exists in the CLI's api-client/src/commands/workflows.ts.
#   4. The Project steps live in a references/ file, introduced as "for a repository a
#      Project already translates", and SKILL.md loads it on a REPOSITORY_HELD_BY_PROJECT
#      refusal or when the user names a Project. Glossary and style guides stay in SKILL.md.
#   5. The CLI bin keeps its real name, `globalise-now-cli`, and every references/ path
#      SKILL.md names exists.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SKILL_DIR="$REPO_ROOT/skills/globalize-now-cli-use"
SKILL="$SKILL_DIR/SKILL.md"
PROJECT_REF_NAME="references/project-held-repository.md"
PROJECT_REF="$SKILL_DIR/$PROJECT_REF_NAME"
CLI_WORKFLOWS="$REPO_ROOT/api-client/src/commands/workflows.ts"

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# Text of a markdown section: from the line equal to $2 up to the next heading of the
# same or a higher level. Lines inside ``` fences are never headings (shell comments).
section() {
  awk -v h="$2" '
    /^```/ { fence = !fence }
    !fence && $0 == h { f = 1; match(h, /^#+/); lvl = RLENGTH; print; next }
    f && !fence && /^#+ / { match($0, /^#+/); if (RLENGTH <= lvl) exit }
    f { print }
  ' "$1"
}

has() { printf '%s' "$1" | grep -qF -- "$2"; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "--- 1. description: repository translation and Workflows, not a translation project ---"
DESC="$(awk '/^---$/ { n++; next } n == 1' "$SKILL" | awk '/^description:/ { f = 1; next } f && /^[a-z]+:/ { exit } f' | tr '\n' ' ')"
DESC_LC="$(printf '%s' "$DESC" | tr '[:upper:]' '[:lower:]')"
if printf '%s' "$DESC_LC" | grep -qE 'translation project|create a (translation )?project'; then
  fail "description still triggers on creating a translation project"
else
  pass "description no longer triggers on creating a translation project"
fi
for marker in 'workflow' 'repository'; do
  if has "$DESC_LC" "$marker"; then pass "description names '$marker'"; else fail "description does not name '$marker'"; fi
done

echo ""
echo "--- 2. Step 2 sets up a Workflow and starts a translation ---"
STEP2_HEADING='## Step 2: Set up a Workflow and start a translation'
SECOND_STEP="$(grep -E '^## Step ' "$SKILL" | sed -n 2p)"
if [ "$SECOND_STEP" = "$STEP2_HEADING" ]; then
  pass "the second step is '$STEP2_HEADING'"
else
  fail "the second step is '$SECOND_STEP', not '$STEP2_HEADING'"
fi
STEP2="$(section "$SKILL" "$STEP2_HEADING")"
REQUIRED_CMDS='workflows preview-setup
workflows setup
workflows list
workflows get
workflows languages
workflows runs start
workflows runs list
workflows runs get
translation-memories list'
REFERENCE="$(section "$SKILL" '## Command Reference')"
while IFS= read -r cmd; do
  if printf '%s' "$STEP2" | grep -qE -- "$cmd( |\`|\$)"; then
    pass "Step 2 names '$cmd'"
  else
    fail "Step 2 does not name '$cmd'"
  fi
  if printf '%s\n' "$REFERENCE" | grep -qF -- "| \`$cmd\` |"; then
    pass "Command Reference has a row for '$cmd'"
  else
    fail "Command Reference has no row for '$cmd'"
  fi
done <<< "$REQUIRED_CMDS"

echo ""
echo "--- 3. every workflows command and flag the skill names exists in the CLI ---"
# The CLI's commands and their flags, one "command<TAB>flag" line per flag (and one
# "command<TAB>" line per command). Setup options are shared by preview-setup and setup.
awk '
  /^function withSetupOptions/ { insetup = 1 }
  insetup && /^}/ { insetup = 0 }
  insetup { s = $0; while (match(s, /"--[a-z][a-z-]*/)) { setup[substr(s, RSTART + 1, RLENGTH - 1)] = 1; s = substr(s, RSTART + RLENGTH) } next }
  /const runs = / { inruns = 1 }
  match($0, /\.command\("[a-z-]+"\)/) {
    name = substr($0, RSTART + 10, RLENGTH - 12)
    if (name == "runs") { cmd = ""; next }
    cmd = inruns ? "runs " name : name
    print cmd "\t"
    if (cmd == "preview-setup" || cmd == "setup") for (f in setup) print cmd "\t" f
  }
  cmd != "" { s = $0; while (match(s, /"--[a-z][a-z-]*/)) { print cmd "\t" substr(s, RSTART + 1, RLENGTH - 1); s = substr(s, RSTART + RLENGTH) } }
' "$CLI_WORKFLOWS" | sort -u > "$TMP/cli"
if [ ! -s "$TMP/cli" ]; then
  fail "no workflows commands parsed from $CLI_WORKFLOWS"
fi

# Every `workflows …` invocation the skill names: shell lines in code fences (backslash
# continuations joined), Command Reference rows, and inline code spans. One record per
# invocation: "file:line<TAB>command<TAB>flags".
extract() {
  awk -v file="${1#"$SKILL_DIR"/}" '
    function parse(text, where,   rest, n, w, cmd, flags, s) {
      if (!match(text, /(^|[ \t`])workflows [a-z]/)) return
      rest = substr(text, RSTART + RLENGTH - 1)
      n = split(rest, w, /[ \t`|]+/)
      cmd = w[1]
      if (cmd == "runs") cmd = "runs " w[2]
      flags = ""; s = text
      while (match(s, /--[a-z][a-z-]*/)) { flags = flags " " substr(s, RSTART, RLENGTH); s = substr(s, RSTART + RLENGTH) }
      print where "\t" cmd "\t" flags
    }
    /^```/ { fence = !fence; buf = ""; next }
    fence {
      line = (buf == "" ? $0 : buf " " $0)
      if (line ~ /\\$/) { sub(/\\$/, "", line); buf = line; start = start ? start : NR; next }
      parse(line, file ":" (start ? start : NR)); buf = ""; start = 0; next
    }
    /^\|/ { if (match($0, /^\| `workflows [^`]*`/)) parse($0, file ":" NR); next }
    {
      s = $0
      while (match(s, /`[^`]+`/)) {
        span = substr(s, RSTART + 1, RLENGTH - 2); s = substr(s, RSTART + RLENGTH)
        if (span ~ /^workflows [a-z]/ || span ~ /(cli-client|globalise-now-cli) workflows [a-z]/) parse(span, file ":" NR)
      }
    }
  ' "$1"
}
: > "$TMP/named"
for f in "$SKILL" "$SKILL_DIR"/references/*.md; do
  [ -f "$f" ] && extract "$f" >> "$TMP/named"
done
if [ ! -s "$TMP/named" ]; then
  fail "the skill names no 'workflows' command"
fi
BAD=0
while IFS=$'\t' read -r where cmd flags; do
  if ! grep -qxF -- "$cmd	" "$TMP/cli"; then
    fail "$where names 'workflows $cmd', which the CLI does not define"
    BAD=$((BAD + 1))
    continue
  fi
  for flag in $flags; do
    [ "$flag" = "--json" ] && continue   # global output option
    if ! grep -qxF -- "$cmd	$flag" "$TMP/cli"; then
      fail "$where passes $flag to 'workflows $cmd', which the CLI does not define"
      BAD=$((BAD + 1))
    fi
  done
done < "$TMP/named"
if [ -s "$TMP/named" ] && [ "$BAD" -eq 0 ]; then
  pass "all $(wc -l < "$TMP/named" | tr -d ' ') 'workflows' invocations use commands and flags the CLI defines"
fi

echo ""
echo "--- 4. the Project steps live behind a pointer ---"
if [ -f "$PROJECT_REF" ]; then
  pass "$PROJECT_REF_NAME exists"
  if head -n 8 "$PROJECT_REF" | grep -qF 'a Project already translates'; then
    pass "$PROJECT_REF_NAME is introduced as 'for a repository a Project already translates'"
  else
    fail "$PROJECT_REF_NAME's opening does not say it is for a repository a Project already translates"
  fi
  for marker in 'projects create' 'repositories create' 'project-languages add' 'patterns create' 'projects update' 'repositories translate' 'gitlab connections'; do
    if grep -qF -- "$marker" "$PROJECT_REF"; then pass "$PROJECT_REF_NAME covers '$marker'"; else fail "$PROJECT_REF_NAME does not cover '$marker'"; fi
  done
else
  fail "$PROJECT_REF_NAME does not exist"
fi
for marker in 'projects create' 'repositories create' 'project-languages add' 'patterns create' 'Create a Project'; do
  if grep -qF -- "$marker" "$SKILL"; then
    fail "SKILL.md still carries the Project step '$marker' — it belongs in $PROJECT_REF_NAME"
  else
    pass "SKILL.md no longer carries '$marker'"
  fi
done
POINTERS="$(grep -F -- "$PROJECT_REF_NAME" "$SKILL" || true)"
if printf '%s' "$POINTERS" | grep -qF 'REPOSITORY_HELD_BY_PROJECT'; then
  pass "SKILL.md loads $PROJECT_REF_NAME on a REPOSITORY_HELD_BY_PROJECT refusal"
else
  fail "no line of SKILL.md loads $PROJECT_REF_NAME on a REPOSITORY_HELD_BY_PROJECT refusal"
fi
if printf '%s' "$POINTERS" | grep -qiE 'names a Project'; then
  pass "SKILL.md loads $PROJECT_REF_NAME when the user names a Project"
else
  fail "no line of SKILL.md loads $PROJECT_REF_NAME when the user names a Project"
fi
for marker in 'glossary create' 'style-guides upsert'; do
  if grep -qF -- "$marker" "$SKILL"; then pass "glossary and style guides stay in SKILL.md ('$marker')"; else fail "SKILL.md no longer covers '$marker'"; fi
done

echo ""
echo "--- 5. bin name and reference paths ---"
if grep -qF 'globalise-now-cli' "$SKILL"; then
  pass "SKILL.md names the bin as 'globalise-now-cli'"
else
  fail "SKILL.md does not name the bin 'globalise-now-cli'"
fi
WRONG_BIN="$(grep -nE 'globalize-now-cli([^-]|$)' "$SKILL" "$SKILL_DIR"/references/*.md 2>/dev/null || true)"
if [ -z "$WRONG_BIN" ]; then
  pass "no 'globalize-now-cli' bin misspelling"
else
  fail "the bin is 'globalise-now-cli', not: $WRONG_BIN"
fi
MISSING=0
while IFS= read -r ref; do
  if [ ! -f "$SKILL_DIR/$ref" ]; then fail "SKILL.md names missing $ref"; MISSING=$((MISSING + 1)); fi
done < <(grep -ohE 'references/[A-Za-z0-9_./-]+\.md' "$SKILL" | sort -u)
[ "$MISSING" -eq 0 ] && pass "every references/… path SKILL.md names exists"

echo ""
echo "--- Report ---"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
[ "$FAIL" -eq 0 ]
