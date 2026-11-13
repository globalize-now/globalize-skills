#!/bin/bash
set -uo pipefail

# Usage: ./evals/verify-lovable-mirror.sh
#
# Static check (no model, no network) of the workflow that mirrors
# skills/lovable-i18n/SKILL.md to the root of globalize-now/lovable-i18n, the repository
# Lovable imports from (it imports reliably only from a repository root). Needs Ruby
# (stdlib YAML), which ubuntu-latest ships.
#
# Checks:
#   1. Triggers: push to main touching only skills/lovable-i18n/SKILL.md, plus
#      workflow_dispatch for a backfill. No pull_request, schedule or other trigger.
#   2. It can't loop or write here: GITHUB_TOKEN is contents: read at most, the job runs
#      only on main in globalize-now/globalize-skills, the monorepo checkout keeps no
#      credentials, and the only push is to the lovable-i18n checkout.
#   3. Two runs can't race: a fixed concurrency group that queues rather than cancels.
#   4. The write credential is a GitHub App installation token narrowed to the one
#      repository and contents: write, from the named variable and secret.
#   5. It overwrites SKILL.md at the lovable-i18n root, commits only when it changed,
#      and pushes the default branch without force.
#   6. Every action is pinned to a major tag or a full SHA.
#   7. README.md's Lovable note and lovable-i18n table row say the monorepo copy is
#      canonical, mirrored automatically to globalize-now/lovable-i18n, which takes no
#      direct edits.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

WF="$REPO_ROOT/.github/workflows/mirror-lovable-i18n.yml"
README="$REPO_ROOT/README.md"
SRC_PATH="skills/lovable-i18n/SKILL.md"
TARGET_REPO="globalize-now/lovable-i18n"
APP_ID_VAR="LOVABLE_I18N_MIRROR_APP_CLIENT_ID"
APP_KEY_SECRET="LOVABLE_I18N_MIRROR_APP_PRIVATE_KEY"

PASS=0
FAIL=0
pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
check() { if eval "$2"; then pass "$1"; else fail "$1"; fi; }
has() { printf '%s' "$1" | grep -qF -- "$2"; }

if [ ! -f "$WF" ]; then
  fail "workflow ${WF#"$REPO_ROOT"/} exists"
  WF=/dev/null
fi

# Ruby evaluates $1 against the parsed workflow (bound to `w`) and prints the result.
# YAML 1.1 reads the `on:` key as `true`, so `on` normalises it.
q() {
  ruby -ryaml -rjson -e '
    w = YAML.safe_load(File.read(ARGV[0])) || {}
    on = w["on"] || w[true] || {}
    on = { on => nil } if on.is_a?(String)
    on = on.map { |k| [k, nil] }.to_h if on.is_a?(Array)
    jobs = w["jobs"] || {}
    steps = jobs.values.flat_map { |j| j["steps"] || [] }
    r = eval(ARGV[1])
    puts(r.is_a?(String) ? r : r.to_json)
  ' "$WF" "$1"
}

# Every check below reads the parsed workflow, and several are negations ("no force push"),
# which an empty parse would pass. So no Ruby, a workflow that doesn't parse, or one with no
# run: steps stops the check here, loudly.
if ! command -v ruby > /dev/null; then
  fail "ruby is not installed (this check parses the workflow with Ruby's stdlib YAML)"
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi
if ! PARSE_ERR="$(q 'w.class' 2>&1 > /dev/null)" || [ -n "$PARSE_ERR" ]; then
  fail "${WF#"$REPO_ROOT"/} does not parse: ${PARSE_ERR%%$'\n'*}"
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi

# All run: scripts, joined.
RUNS="$(q 'steps.map { |s| s["run"] }.compact.join("\n")')"
if [ -z "$RUNS" ]; then
  fail "${WF#"$REPO_ROOT"/} has no run: steps to check"
  echo "Results: $PASS passed, $FAIL failed"
  exit 1
fi

echo "--- 1. triggers: push to main on $SRC_PATH, plus workflow_dispatch ---"
check "triggers are exactly push and workflow_dispatch" \
  '[ "$(q "on.keys.map(&:to_s).sort")" = "[\"push\",\"workflow_dispatch\"]" ]'
check "push runs on main only" \
  '[ "$(q "(on[\"push\"] || {})[\"branches\"]")" = "[\"main\"]" ]'
check "push runs only when $SRC_PATH changes" \
  '[ "$(q "(on[\"push\"] || {})[\"paths\"]")" = "[\"$SRC_PATH\"]" ]'

echo "--- 2. can't loop or write to this repository ---"
check "workflow-level permissions are contents: read at most" \
  '[ "$(q "w[\"permissions\"]")" = "{\"contents\":\"read\"}" ] || [ "$(q "w[\"permissions\"]")" = "{}" ]'
check "no job widens GITHUB_TOKEN permissions" \
  '[ "$(q "jobs.values.any? { |j| j.key?(\"permissions\") && !(j[\"permissions\"] == {} || j[\"permissions\"] == {\"contents\" => \"read\"}) }")" = "false" ]'
check "every job is gated to main in globalize-now/globalize-skills (forks and dispatches from other refs skip)" \
  '[ "$(q "!jobs.empty? && jobs.values.all? { |j| i = j[\"if\"].to_s; i.include?(\"github.repository == '"'"'globalize-now/globalize-skills'"'"'\") && i.include?(\"github.ref == '"'"'refs/heads/main'"'"'\") }")" = "true" ]'
check "the monorepo checkout keeps no credentials" \
  '[ "$(q "c = steps.select { |s| s[\"uses\"].to_s.start_with?(\"actions/checkout@\") && !(s[\"with\"] || {}).key?(\"repository\") }; !c.empty? && c.all? { |s| (s[\"with\"] || {})[\"persist-credentials\"] == false }")" = "true" ]'
check "exactly one git push, run inside the lovable-i18n checkout" \
  '[ "$(q "steps.select { |s| s[\"run\"].to_s =~ /git\b.*\bpush\b/ }.map { |s| s[\"working-directory\"] }")" = "[\"lovable-i18n\"]" ]'

echo "--- 3. concurrency: one mirror at a time, queued ---"
check "a fixed concurrency group" \
  '[ "$(q "c = w[\"concurrency\"]; c.is_a?(Hash) && c[\"group\"].to_s != \"\" && !c[\"group\"].to_s.include?(\"github.sha\") && !c[\"group\"].to_s.include?(\"github.run\")")" = "true" ]'
check "cancel-in-progress is false (a running push finishes, the newest pending one runs next)" \
  '[ "$(q "(w[\"concurrency\"] || {})[\"cancel-in-progress\"]")" = "false" ]'

echo "--- 4. write credential: GitHub App token for $TARGET_REPO only ---"
TOKEN_STEP='steps.find { |s| s["uses"].to_s.start_with?("actions/create-github-app-token@") } || {}'
check "mints a token with actions/create-github-app-token" \
  '[ "$(q "($TOKEN_STEP)[\"id\"].to_s")" != "" ]'
check "token is scoped to owner globalize-now, repository lovable-i18n" \
  '[ "$(q "x = ($TOKEN_STEP)[\"with\"] || {}; [x[\"owner\"], x[\"repositories\"]]")" = "[\"globalize-now\",\"lovable-i18n\"]" ]'
check "token permissions are contents: write and nothing else" \
  '[ "$(q "(($TOKEN_STEP)[\"with\"] || {}).select { |k, _| k.start_with?(\"permission-\") }")" = "{\"permission-contents\":\"write\"}" ]'
check "client id from vars.$APP_ID_VAR, private key from secrets.$APP_KEY_SECRET" \
  '[ "$(q "x = ($TOKEN_STEP)[\"with\"] || {}; [x[\"client-id\"], x[\"private-key\"]]")" = "[\"\${{ vars.$APP_ID_VAR }}\",\"\${{ secrets.$APP_KEY_SECRET }}\"]" ]'
check "no other secret is read" \
  '[ "$(grep -oE "secrets\.[A-Z0-9_]+" "$WF" | sort -u | tr "\n" " ")" = "secrets.$APP_KEY_SECRET " ]'
check "workflow header documents vars.$APP_ID_VAR and secrets.$APP_KEY_SECRET" \
  '[ "$(awk "/^[^#]/ { exit } { print }" "$WF" | grep -cE "$APP_ID_VAR|$APP_KEY_SECRET")" -ge 2 ]'

echo "--- 5. overwrite SKILL.md at the root, commit only if changed, push default branch ---"
check "checks out $TARGET_REPO into lovable-i18n/ with the App token, at its default branch" \
  '[ "$(q "steps.select { |s| (s[\"with\"] || {})[\"repository\"] == \"$TARGET_REPO\" }.map { |s| x = s[\"with\"]; [x[\"path\"], x[\"token\"].to_s.include?(\"steps.\"), x.key?(\"ref\")] }")" = "[[\"lovable-i18n\",true,false]]" ]'
check "copies $SRC_PATH over lovable-i18n/SKILL.md" \
  'printf "%s" "$RUNS" | grep -qE "^\s*cp $SRC_PATH lovable-i18n/SKILL.md\s*$"'
check "copies nothing else into lovable-i18n/" \
  '[ "$(printf "%s" "$RUNS" | grep -cE "(cp|rsync|mv) .*lovable-i18n/")" = "1" ]'
# `git diff --quiet` compares tracked files only, so on the first mirror (no SKILL.md in
# lovable-i18n yet) it reports nothing to commit. The change test must see an untracked file:
# stage SKILL.md, then `git diff --cached --quiet`, or read `git status --porcelain`.
check "commits only when SKILL.md changed, a first (untracked) SKILL.md included" \
  'printf "%s\n" "$RUNS" | awk "
     /git add( --)? SKILL.md/ { added = 1 }
     /git diff --cached --quiet( --)? SKILL.md/ && added { ok = 1 }
     /git status --porcelain( --)? SKILL.md/ { ok = 1 }
     END { exit !ok }"'
check "never tests for a change with a working-tree-only git diff" \
  '! printf "%s" "$RUNS" | grep -qE "git diff --quiet"'
check "stages only SKILL.md" \
  '[ "$(printf "%s" "$RUNS" | grep -oE "git add [^;&|]*" | sort -u)" = "git add SKILL.md" ]'
check "pushes without force" \
  '! printf "%s" "$RUNS" | grep -qE "git push.*(--force|-f\b|\+)"'

echo "--- 6. actions pinned ---"
check "every uses: is pinned to a major tag (@vN) or a full SHA" \
  '[ "$(q "u = steps.map { |s| s[\"uses\"] }.compact; u.empty? ? [\"no steps\"] : u.reject { |u| u =~ /@(v\d+|[0-9a-f]{40})$/ }")" = "[]" ]'

echo "--- 7. README: monorepo copy is canonical and mirrored ---"
LOVABLE_NOTE="$(awk '/^### Lovable$/ { f = 1; next } f && /^#/ { exit } f' "$README" | tr '\n' ' ')"
TABLE_ROW="$(grep -E '^\| `lovable-i18n` \|' "$README")"
for spot in LOVABLE_NOTE TABLE_ROW; do
  text="${!spot}"
  lc="$(printf '%s' "$text" | tr '[:upper:]' '[:lower:]')"
  check "$spot names the monorepo copy canonical" 'has "$lc" "canonical"'
  check "$spot says it is mirrored automatically to $TARGET_REPO" \
    'has "$lc" "mirrored automatically" && has "$text" "github.com/$TARGET_REPO"'
  check "$spot says $TARGET_REPO takes no direct edits" 'has "$lc" "no direct edits"'
  check "$spot no longer calls this copy frozen or the standalone repo the source" \
    '! printf "%s" "$lc" | grep -qE "no longer updated|backwards compatibility|maintained source|now maintained at"'
done

echo
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
