#!/bin/bash
set -uo pipefail

# Usage: ./evals/verify-cli-use.sh
#
# Static check (no model, no network) that globalize-now-cli-use leads with Workflow setup
# and has no Project path: Projects are deprecated. Each check is a tripwire for one behaviour,
# named in its message.
#
# Checks:
#   1. The description triggers on setting up translation for a repository and on
#      Workflows, and no longer on creating a translation project.
#   2. Step 2 is "Set up a Workflow and start a translation" and names every Workflow
#      command it needs; the Command Reference has a row for each.
#   3. Every `workflows` command and `--flag` the skill names (SKILL.md and references/)
#      exists in the CLI's api-client/src/commands/workflows.ts.
#   4. No Project path is left: the skill (SKILL.md and references/) runs no Project-keyed
#      command, the old Project reference is gone, and a REPOSITORY_HELD_BY_PROJECT
#      refusal stops with a pointer to move the Project to a Workflow.
#   5. The CLI bin keeps its real name, `globalise-now-cli`, and every references/ path
#      SKILL.md names exists.
#   6. Glossaries and style guides lead with the org groups, `glossaries` and `assets`, and
#      need no Project: Steps 3 and 4 name their commands, take locales, and say which
#      repository file a Workflow with repository assets reads instead. The Command
#      Reference has a row for every command of both groups and marks `glossary` and
#      `style-guides` deprecated, and the skill runs neither. Every `glossaries` and
#      `assets` command and flag the skill names exists in the CLI.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SKILL_DIR="$REPO_ROOT/skills/globalize-now-cli-use"
SKILL="$SKILL_DIR/SKILL.md"
OLD_PROJECT_REF="references/project-held-repository.md"
CLI_WORKFLOWS="$REPO_ROOT/api-client/src/commands/workflows.ts"
CLI_COMMANDS="$REPO_ROOT/api-client/src/commands"

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

# shellcheck source=lib/workflows-cli.sh
. "$SCRIPT_DIR/lib/workflows-cli.sh"

echo "--- 1. description: repository translation and Workflows, not a translation project ---"
# The description's text, whether it sits on the `description:` line itself or in a
# folded block (`>-`, `|`) under it.
DESC="$(awk '/^---$/ { n++; next } n == 1' "$SKILL" \
  | awk '/^description:/ { f = 1; sub(/^description:[[:space:]]*([>|][-+]?)?[[:space:]]*/, ""); print; next } f && /^[a-z]+:/ { exit } f' \
  | tr '\n' ' ' | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
DESC_LC="$(printf '%s' "$DESC" | tr '[:upper:]' '[:lower:]')"
if [ -z "$DESC" ]; then
  fail "SKILL.md frontmatter has no description text"
elif printf '%s' "$DESC_LC" | grep -qE 'translation project|create a (translation )?project'; then
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
check_workflows_cli "$CLI_WORKFLOWS" "$SKILL" "$SKILL_DIR"/references/*.md

echo ""
echo "--- 4. no Project path ---"
if [ -e "$SKILL_DIR/$OLD_PROJECT_REF" ]; then
  fail "$OLD_PROJECT_REF is back — Projects are deprecated"
else
  pass "$OLD_PROJECT_REF is gone"
fi
if grep -qF -- "$OLD_PROJECT_REF" "$SKILL"; then
  fail "SKILL.md still points at $OLD_PROJECT_REF"
else
  pass "SKILL.md no longer points at $OLD_PROJECT_REF"
fi
# The CLI's Project-keyed groups, run through the CLI or named as a command in inline code.
# Naming a bare group in prose (to call it deprecated) is fine, and so is
# `gitlab repositories list`, which is a different command.
for group in projects project-languages repositories patterns namespaces; do
  invs="$(grep -nE "(cli-client|globalise-now-cli) $group [a-z]|\`$group [a-z]|^\| \`$group " "$SKILL" "$SKILL_DIR"/references/*.md 2>/dev/null || true)"
  if [ -z "$invs" ]; then
    pass "the skill runs no '$group' command"
  else
    fail "the skill still runs '$group': $(printf '%s' "$invs" | sed "s|$SKILL_DIR/||" | cut -c1-120 | tr '\n' ';')"
  fi
done
ROWS="$(grep -E '^\| `(projects|project-languages|repositories|patterns|namespaces) ' "$SKILL" || true)"
if [ -z "$ROWS" ]; then
  pass "the Command Reference has no Project-keyed rows"
else
  fail "the Command Reference still has Project-keyed rows: $(printf '%s' "$ROWS" | cut -c1-60 | tr '\n' ';')"
fi
HELD="$(grep -F 'REPOSITORY_HELD_BY_PROJECT' "$SKILL" || true)"
if [ -z "$HELD" ]; then
  fail "SKILL.md no longer handles a REPOSITORY_HELD_BY_PROJECT refusal"
elif has "$HELD" 'stop' && has "$HELD" 'Workflow' && ! printf '%s' "$HELD" | grep -qiE 'continue on (that|the) Project'; then
  pass "a REPOSITORY_HELD_BY_PROJECT refusal stops and points at moving the Project to a Workflow"
else
  fail "a REPOSITORY_HELD_BY_PROJECT refusal doesn't stop with a pointer to a Workflow: $(printf '%s' "$HELD" | cut -c1-160 | tr '\n' ';')"
fi

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
echo "--- 6. glossaries and style guides lead with the org groups ---"
STEP3_HEADING='## Step 3: Glossaries'
STEP4_HEADING='## Step 4: Style guides and contexts'
STEP3="$(section "$SKILL" "$STEP3_HEADING")"
STEP4="$(section "$SKILL" "$STEP4_HEADING")"
for pair in "STEP3|$STEP3_HEADING" "STEP4|$STEP4_HEADING"; do
  var="${pair%%|*}"; heading="${pair#*|}"
  text="${!var}"
  if [ -z "$text" ]; then fail "SKILL.md has no '$heading'"; continue; fi
  pass "SKILL.md has '$heading'"
  # Org commands take locales: no Project, no project language UUIDs.
  for marker in '--project-id' 'project-languages' '--language-id' '--source-language-id'; do
    if has "$text" "$marker"; then fail "'$heading' still needs a Project ('$marker')"; else pass "'$heading' needs no '$marker'"; fi
  done
done
for cmd in 'glossaries list' 'glossaries entries' 'glossaries add-term' 'glossaries edit-entry' 'glossaries delete-entry' 'workflows get'; do
  if printf '%s' "$STEP3" | grep -qE -- "$cmd( |\`|\$)"; then pass "Step 3 names '$cmd'"; else fail "Step 3 does not name '$cmd'"; fi
done
for cmd in 'assets list' 'assets get' 'assets set-text' 'assets delete-text' 'workflows get'; do
  if printf '%s' "$STEP4" | grep -qE -- "$cmd( |\`|\$)"; then pass "Step 4 names '$cmd'"; else fail "Step 4 does not name '$cmd'"; fi
done
# The reserved asset paths of globalize.now's core linguistic-assets/reserved-path.ts.
for marker in 'docs/glossary.tbx' 'docs/glossary.csv'; do
  if has "$STEP3" "$marker"; then pass "Step 3 names the repository file '$marker'"; else fail "Step 3 does not name the repository file '$marker'"; fi
done
for marker in 'docs/style-guides/<locale>.md' 'docs/context.md'; do
  if has "$STEP4" "$marker"; then pass "Step 4 names the repository file '$marker'"; else fail "Step 4 does not name the repository file '$marker'"; fi
done
for text_var in STEP3 STEP4; do
  if has "${!text_var}" "assets.source"; then pass "${text_var/STEP/Step } says how to tell a Workflow reads repository assets ('assets.source')"; else fail "${text_var/STEP/Step } does not say how to tell a Workflow reads repository assets ('assets.source')"; fi
done
# A Workflow names its glossary in the definition's top-level `glossaryId` (globalize.now
# core workflows/definition.ts); the translate Action's config no longer takes one.
if has "$STEP3" "definition.glossaryId"; then pass "Step 3 reads the Workflow's glossary from 'definition.glossaryId'"; else fail "Step 3 does not read the Workflow's glossary from 'definition.glossaryId'"; fi
ACTION_GLOSSARY="$(grep -rniE 'glossaryId' "$SKILL_DIR" | grep -iE 'translate.{0,3}action|config' || true)"
if [ -z "$ACTION_GLOSSARY" ]; then
  pass "no line of the skill looks for 'glossaryId' in the translate Action's config"
else
  fail "the skill looks for 'glossaryId' in the translate Action's config, now the definition's top level: $(printf '%s' "$ACTION_GLOSSARY" | sed "s|$SKILL_DIR/||" | cut -c1-160 | tr '\n' ';')"
fi
ORG_CMDS='glossaries list
glossaries create
glossaries get
glossaries rename
glossaries delete
glossaries entries
glossaries add-term
glossaries edit-entry
glossaries delete-entry
assets list
assets create
assets get
assets rename
assets delete
assets set-text
assets delete-text'
while IFS= read -r cmd; do
  if printf '%s\n' "$REFERENCE" | grep -qF -- "| \`$cmd\` |"; then
    pass "Command Reference has a row for '$cmd'"
  else
    fail "Command Reference has no row for '$cmd'"
  fi
done <<< "$ORG_CMDS"
for group in glossary style-guides; do
  if printf '%s\n' "$REFERENCE" | grep -F -- "\`$group\`" | grep -qi 'deprecated'; then
    pass "Command Reference marks '$group' deprecated"
  else
    fail "Command Reference does not mark '$group' deprecated"
  fi
done
# The deprecated Project-keyed glossary and style guide commands: never run.
for group in glossary style-guides; do
  invs="$(cli_invocations "$group [a-z]" "$SKILL" "$SKILL_DIR"/references/*.md)"
  if [ -z "$invs" ]; then
    pass "the skill runs no '$group' command"
  else
    fail "the skill still runs the deprecated '$group': $(printf '%s' "$invs" | cut -f2 | tr '\n' ';')"
  fi
done
if grep -qF 'Legacy organisation' "$SKILL"; then
  fail "SKILL.md still has a Legacy-organisation Project path"
else
  pass "SKILL.md has no Legacy-organisation Project path"
fi
for group in glossaries assets; do
  check_cli_group "$group" "$CLI_COMMANDS/$group.ts" "$SKILL" "$SKILL_DIR"/references/*.md
done

echo ""
echo "--- Report ---"
echo "  Passed: $PASS"
echo "  Failed: $FAIL"
[ "$FAIL" -eq 0 ]
