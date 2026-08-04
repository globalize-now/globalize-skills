#!/bin/bash
set -uo pipefail

# Usage: verify-rules-template.sh                    # static mode (default)
#        verify-rules-template.sh --project <path>   # post-render mode
#
# Static mode lints every skills/**/rules.template.md in this repo against the
# contract in skills/globalize-guide/references/rules-template-format.md:
# frontmatter keys, balanced and non-nested conditional markers, conditions and
# values declared-vs-used in both directions, and the << >> placeholder
# delimiter. Zero templates found is a failure, not a pass.
#
# Post-render mode lints a target project after the coding-rules add-on ran:
# .claude/globalize-rules.md exists, carries the generated header on line 1, has
# no surviving markers or placeholders, and is imported from CLAUDE.md exactly
# once. Reports the rendered line count and the resolved rules-values.json keys.
#
# Exit codes: 0 = all checks passed, 1 = failures found, 2 = usage/environment error.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PASS=0
FAIL=0
WARN=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }
warn() { echo "  WARN: $1"; WARN=$((WARN + 1)); }
info() { echo "  INFO: $1"; }

usage() {
  echo "Usage: verify-rules-template.sh [--project <path>]"
  echo "  (no args)          lint every skills/**/rules.template.md in this repo"
  echo "  --project <path>   lint a rendered .claude/globalize-rules.md in <path>"
}

# ─── Argument handling ───

MODE="static"
PROJECT_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --project)
      MODE="project"
      PROJECT_DIR="${2:-}"
      if [ -z "$PROJECT_DIR" ]; then
        echo "ERROR: --project requires a path"
        usage
        exit 2
      fi
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: unknown argument '$1'"
      usage
      exit 2
      ;;
  esac
done

# ─── Small helpers (bash 3.2 compatible — no associative arrays) ───

trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  printf '%s' "$s"
}

# in_list <needle> <space-separated haystack>
in_list() {
  case " $2 " in
    *" $1 "*) return 0 ;;
    *) return 1 ;;
  esac
}

# uniq_words <space-separated words> -> deduped, original order
uniq_words() {
  local w out=""
  for w in $1; do
    case " $out " in
      *" $w "*) ;;
      *) out="$out $w" ;;
    esac
  done
  printf '%s' "${out# }"
}

# ─── Template grammar ───
# Kept in variables so bash's =~ sees them unquoted.

MARKER_IF_LOOSE='^<!--[[:space:]]*if[[:space:]]*:'
MARKER_IF_STRICT='^<!-- if: ([a-zA-Z][a-zA-Z0-9_]*) (==|!=) "([^"]*)" -->$'
MARKER_ELSE_LOOSE='^<!--[[:space:]]*else[[:space:]]*-->$'
MARKER_CLOSE_LOOSE='^<!--[[:space:]]*(/if|endif)[[:space:]]*-->$'
HEADER_RE='^<!-- globalize-rules v[0-9]+ \| template=[A-Za-z0-9._-]+ \| variant=[A-Za-z0-9._-]+( \|[^>]*)? -->$'

# ─── Static mode: template linter ───

# Globals reset per file (bash 3.2 has no local arrays worth the ceremony here).
FM_LINES=()
BODY_LINES=()
BODY_NO=()

# fm_value <key> — prints the raw scalar after "key:" from the frontmatter
fm_value() {
  local k="$1" l
  [ ${#FM_LINES[@]} -eq 0 ] && return 1
  for l in "${FM_LINES[@]}"; do
    case "$l" in
      "$k":*)
        trim "${l#"$k":}"
        return 0
        ;;
    esac
  done
  return 1
}

# fm_list <key> — prints one list item per line. Accepts flow style
# (`values: [a, b]`) and block style (`values:` then `  - a`).
fm_list() {
  local k="$1" l rest item raw="" inside=0
  [ ${#FM_LINES[@]} -eq 0 ] && return 0
  for l in "${FM_LINES[@]}"; do
    if [ $inside -eq 1 ]; then
      if [[ "$l" =~ ^[[:space:]]+-[[:space:]]*(.*)$ ]]; then
        raw="$raw,${BASH_REMATCH[1]}"
        continue
      fi
      inside=0
    fi
    if [[ "$l" =~ ^${k}:[[:space:]]*(.*)$ ]]; then
      rest="${BASH_REMATCH[1]}"
      if [[ "$rest" =~ ^\[(.*)\]$ ]]; then
        raw="${BASH_REMATCH[1]}"
        break
      elif [ -z "$rest" ]; then
        inside=1
      else
        raw="$rest"
        break
      fi
    fi
  done
  local OLD_IFS="$IFS"
  set -f          # word-split on commas without glob-expanding the items
  IFS=','
  set -- $raw
  IFS="$OLD_IFS"
  set +f
  [ $# -eq 0 ] && return 0
  for item in "$@"; do
    item="$(trim "$item")"
    item="${item%\"}"; item="${item#\"}"
    item="${item%\'}"; item="${item#\'}"
    [ -n "$item" ] && printf '%s\n' "$item"
  done
  return 0
}

lint_template() {
  local file="$1"
  local rel="${file#"$REPO_ROOT"/}"
  # Short, still-unique label for per-check messages (template ids are unique).
  local tag
  tag="$(basename "$(dirname "$file")")/$(basename "$file")"

  echo ""
  echo "--- Template: $rel ---"

  # ── Frontmatter ──

  local first_line=""
  IFS= read -r first_line < "$file"
  if [ "$(trim "$first_line")" != "---" ]; then
    fail "$tag: no YAML frontmatter (line 1 is not '---')"
    return
  fi

  FM_LINES=()
  BODY_LINES=()
  BODY_NO=()

  local n=0 state="frontmatter" line
  while IFS= read -r line || [ -n "$line" ]; do
    n=$((n + 1))
    [ $n -eq 1 ] && continue
    if [ "$state" = "frontmatter" ]; then
      if [ "$(trim "$line")" = "---" ]; then
        state="body"
        continue
      fi
      FM_LINES+=("$line")
    else
      BODY_LINES+=("$line")
      BODY_NO+=("$n")
    fi
  done < "$file"

  if [ "$state" != "body" ]; then
    fail "$tag: YAML frontmatter is never closed (no second '---')"
    return
  fi
  pass "$tag: YAML frontmatter present and closed"

  local key val missing=0
  for key in template templateVersion conditions values budget; do
    if val="$(fm_value "$key")"; then
      if [ -z "$val" ] && [ "$key" != "conditions" ] && [ "$key" != "values" ]; then
        fail "$tag: frontmatter key '$key' has an empty value"
        missing=1
      fi
    else
      fail "$tag: frontmatter is missing required key '$key'"
      missing=1
    fi
  done
  [ $missing -eq 0 ] && pass "$tag: frontmatter declares template, templateVersion, conditions, values, budget"

  local tversion
  tversion="$(fm_value templateVersion)" || tversion=""
  if [ -n "$tversion" ] && ! [[ "$tversion" =~ ^[0-9]+$ ]]; then
    warn "$tag: templateVersion '$tversion' is not an integer (the generated header renders it as v<n>)"
  fi

  local budget
  budget="$(fm_value budget)" || budget=""
  if [ -n "$budget" ] && [[ "$budget" != *default* ]]; then
    warn "$tag: budget has no 'default' entry — the renderer has nothing to fall back on"
  fi

  local declared_conditions="" declared_values="" item
  while IFS= read -r item; do
    [ -z "$item" ] && continue
    declared_conditions="$declared_conditions $item"
  done < <(fm_list conditions)
  while IFS= read -r item; do
    [ -z "$item" ] && continue
    declared_values="$declared_values $item"
  done < <(fm_list values)
  declared_conditions="$(trim "$declared_conditions")"
  declared_values="$(trim "$declared_values")"

  # ── Body scan ──
  #
  # Fenced code blocks are tracked so HTML comments and Vue-style {{ }} inside
  # code samples are not mistaken for template syntax. Fence tracking is a plain
  # toggle on any line starting with ``` or ~~~ — it does not model differing
  # fence lengths or nested fences. That is enough for these templates, and an
  # unbalanced fence is reported as a failure below so a confused toggle can
  # never silently swallow markers.

  local fence=0 depth=0 if_count=0 else_count=0 close_count=0
  local if_open_line=0 else_seen=0
  local used_conditions="" used_values=""
  local selfref=0 hits=""
  local i lineno t occ name total_lt valid_lt

  for (( i = 0; i < ${#BODY_LINES[@]}; i++ )); do
    line="${BODY_LINES[$i]}"
    lineno="${BODY_NO[$i]}"
    t="$(trim "$line")"

    # Self-containment. The generated file outlives the skill — the user can
    # delete globalize-guide once setup is done and the rules keep working — so
    # nothing in the body may point back into it. Scanned inside code fences
    # too: a sample containing such a path renders into the generated file just
    # the same. Only paths into globalize-guide are banned; naming a separate
    # skill (`css-i18n`) or a target-project path (`src/i18n/request.ts`) is
    # fine. Frontmatter is exempt — it is stripped at render time.
    hits=""
    case "$line" in *'.claude/skills'*) hits="$hits .claude/skills" ;; esac
    case "$line" in *'references/'*) hits="$hits references/" ;; esac
    case "$line" in *'globalize-guide'*) hits="$hits globalize-guide" ;; esac
    if [ -n "$hits" ]; then
      selfref=$((selfref + 1))
      fail "$tag:$lineno: skill-internal reference (${hits# }) — the generated file must keep working after the user deletes globalize-guide (see 'Self-containment is a hard requirement' in rules-template-format.md): $t"
    fi

    case "$t" in
      '```'*|'~~~'*)
        fence=$((1 - fence))
        continue
        ;;
    esac

    # Placeholders: scanned everywhere, including code fences — rendering
    # substitutes <<name>> wherever it appears.
    case "$line" in
      *'<<'*)
        total_lt=$(printf '%s\n' "$line" | grep -o '<<' | wc -l | tr -d ' ')
        valid_lt=0
        while IFS= read -r occ; do
          [ -z "$occ" ] && continue
          name="${occ#<<}"
          name="${name%>>}"
          used_values="$used_values $name"
          valid_lt=$((valid_lt + 1))
        done < <(printf '%s\n' "$line" | grep -oE '<<[A-Za-z][A-Za-z0-9_]*>>')
        if [ "$total_lt" -ne "$valid_lt" ]; then
          fail "$tag:$lineno: malformed '<<' — every '<<' must be a <<placeholderName>>: $t"
        fi
        ;;
    esac

    # Wrong delimiter. Outside a fence any {{ ident }} is a leftover; inside a
    # fence {{ }} is legitimate Vue interpolation, so only flag it when it names
    # a declared value.
    case "$line" in
      *'{{'*)
        while IFS= read -r occ; do
          [ -z "$occ" ] && continue
          name="$(printf '%s' "$occ" | tr -d '{} ')"
          if [ $fence -eq 0 ]; then
            fail "$tag:$lineno: '$occ' uses {{ }} — placeholders are << >> ({{ }} collides with Vue interpolation)"
          elif in_list "$name" "$declared_values"; then
            fail "$tag:$lineno: '$occ' in a code fence names declared value '$name' — placeholders are << >>"
          fi
        done < <(printf '%s\n' "$line" | grep -oE '\{\{[[:space:]]*[A-Za-z][A-Za-z0-9_]*[[:space:]]*\}\}')
        ;;
    esac

    # Conditional markers.
    case "$line" in
      *'<!--'*) ;;
      *) continue ;;
    esac

    if [ $fence -eq 1 ]; then
      case "$line" in
        *'<!-- if:'*|*'<!-- else -->'*|*'<!-- /if -->'*)
          warn "$tag:$lineno: conditional marker inside a fenced code block — read as sample text, not a marker"
          ;;
      esac
      continue
    fi

    if [[ "$t" =~ $MARKER_IF_LOOSE ]]; then
      if_count=$((if_count + 1))
      if [[ "$t" =~ $MARKER_IF_STRICT ]]; then
        used_conditions="$used_conditions ${BASH_REMATCH[1]}"
      else
        fail "$tag:$lineno: malformed if marker (expected '<!-- if: key == \"value\" -->'): $t"
      fi
      if [ $depth -gt 0 ]; then
        fail "$tag:$lineno: nested <!-- if: --> — the block opened at line $if_open_line is still open; nesting is not allowed"
      fi
      depth=$((depth + 1))
      if_open_line=$lineno
      else_seen=0
    elif [[ "$t" =~ $MARKER_ELSE_LOOSE ]]; then
      else_count=$((else_count + 1))
      if [ "$t" != '<!-- else -->' ]; then
        fail "$tag:$lineno: malformed else marker (expected exactly '<!-- else -->'): $t"
      fi
      if [ $depth -eq 0 ]; then
        fail "$tag:$lineno: orphan <!-- else --> — no open <!-- if: --> block"
      elif [ $else_seen -eq 1 ]; then
        fail "$tag:$lineno: second <!-- else --> in the block opened at line $if_open_line"
      else
        else_seen=1
      fi
    elif [[ "$t" =~ $MARKER_CLOSE_LOOSE ]]; then
      close_count=$((close_count + 1))
      if [ "$t" != '<!-- /if -->' ]; then
        fail "$tag:$lineno: malformed close marker (expected exactly '<!-- /if -->'): $t"
      fi
      if [ $depth -eq 0 ]; then
        fail "$tag:$lineno: orphan <!-- /if --> — no open <!-- if: --> block"
      else
        depth=$((depth - 1))
        else_seen=0
      fi
    else
      case "$t" in
        *'<!-- if:'*|*'<!-- else -->'*|*'<!-- /if -->'*)
          fail "$tag:$lineno: conditional marker must be alone on its own line: $t"
          ;;
      esac
    fi
  done

  if [ $fence -ne 0 ]; then
    fail "$tag: unclosed code fence — marker detection after the last fence is unreliable"
  fi

  if [ $selfref -eq 0 ]; then
    pass "$tag: self-contained — no '.claude/skills', 'references/' or 'globalize-guide' reference in the body"
  fi

  if [ $if_count -eq $close_count ]; then
    pass "$tag: markers balanced ($if_count if / $else_count else / $close_count /if)"
  else
    fail "$tag: unbalanced markers — $if_count '<!-- if:' vs $close_count '<!-- /if -->'"
  fi

  if [ $depth -ne 0 ]; then
    fail "$tag: $depth <!-- if: --> block(s) left open at EOF; last opened at line $if_open_line"
  fi

  # ── Conditions: used ⊆ declared, and declared used ──

  used_conditions="$(uniq_words "$used_conditions")"
  used_values="$(uniq_words "$used_values")"

  for key in $used_conditions; do
    if in_list "$key" "$declared_conditions"; then
      pass "$tag: condition '$key' is declared in frontmatter"
    else
      fail "$tag: body branches on '$key' but conditions: [$declared_conditions] does not declare it"
    fi
  done

  for key in $declared_conditions; do
    if ! in_list "$key" "$used_conditions"; then
      warn "$tag: condition '$key' is declared but the body never branches on it"
    fi
  done

  # ── Values: used ⊆ declared, and declared used (both directions are errors) ──

  for key in $used_values; do
    if in_list "$key" "$declared_values"; then
      pass "$tag: placeholder <<$key>> is declared in frontmatter"
    else
      fail "$tag: body uses <<$key>> but values: [$declared_values] does not declare it"
    fi
  done

  for key in $declared_values; do
    if ! in_list "$key" "$used_values"; then
      fail "$tag: value '$key' is declared but never used in the body — remove it (every declared key costs a resolution step)"
    fi
  done
}

run_static_mode() {
  local search_root="$REPO_ROOT/skills"

  echo "--- Static: rules.template.md linting ---"
  echo "  Search root: $search_root"

  if [ ! -d "$search_root" ]; then
    fail "skills/ directory not found at $search_root — wrong repo root?"
    return
  fi

  local templates=()
  local f
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    templates+=("$f")
  done < <(find "$search_root" -type f -name '*rules.template.md' | LC_ALL=C sort)

  if [ ${#templates[@]} -eq 0 ]; then
    fail "no rules.template.md found under $search_root — nothing to lint (a linter that passes on zero inputs guards nothing)"
    return
  fi

  echo "  Templates found: ${#templates[@]}"
  for f in "${templates[@]}"; do
    lint_template "$f"
  done
}

# ─── Post-render mode ───

run_project_mode() {
  local proj="$1"

  echo "--- Post-render: $proj ---"

  if [ ! -d "$proj" ]; then
    echo "ERROR: project directory not found: $proj"
    exit 2
  fi

  local rules="$proj/.claude/globalize-rules.md"

  if [ ! -f "$rules" ]; then
    fail ".claude/globalize-rules.md missing at $rules — the core generate_coding_rules step did not produce it (fail-closed, or it was skipped). Phase 3 wrap subagents read this file, so conversion has no authoring contract without it."
    return
  fi
  pass ".claude/globalize-rules.md exists"

  local header=""
  IFS= read -r header < "$rules"
  local tpl=""
  if [[ "$header" =~ $HEADER_RE ]]; then
    pass "line 1 is the generated header: $header"
  else
    fail "line 1 is not the generated header (expected '<!-- globalize-rules v<n> | template=<id> | variant=<id> ... -->'), got: $header"
  fi

  # Exactly one header. A renderer that prepends the header twice (or re-renders on top of
  # an existing file instead of overwriting) still passes the line-1 check above, so check
  # the count too — this was a real near-miss during end-to-end testing.
  local hcount
  hcount=$(grep -c '^<!-- globalize-rules v' "$rules" || true)
  if [ "$hcount" -eq 1 ]; then
    pass "exactly one generated header line"
  else
    fail "expected exactly 1 generated header line, found $hcount — the renderer prepended more than once, or re-rendered on top of an existing file instead of overwriting it"
  fi
  if [[ "$header" =~ template=([A-Za-z0-9._-]+) ]]; then
    tpl="${BASH_REMATCH[1]}"
  fi

  local m c
  for m in '<!-- if:' '<!-- else -->' '<!-- /if -->' '<<'; do
    c=$(grep -oF -- "$m" "$rules" | wc -l | tr -d ' ')
    if [ "$c" -eq 0 ]; then
      pass "zero occurrences of '$m' in the rendered file"
    else
      fail "$c occurrence(s) of '$m' survived rendering in $rules"
      grep -nF -- "$m" "$rules" | head -5 | sed 's/^/        /'
    fi
  done

  local claude="$proj/CLAUDE.md"
  if [ ! -f "$claude" ]; then
    fail "CLAUDE.md missing at $claude — nothing imports the generated rules file"
  else
    c=$(grep -oF -- '@.claude/globalize-rules.md' "$claude" | wc -l | tr -d ' ')
    if [ "$c" -eq 1 ]; then
      pass "CLAUDE.md imports @.claude/globalize-rules.md exactly once"
    elif [ "$c" -eq 0 ]; then
      fail "CLAUDE.md has no '@.claude/globalize-rules.md' import"
    else
      fail "CLAUDE.md has $c '@.claude/globalize-rules.md' imports (expected exactly 1)"
    fi
  fi

  local lines
  lines=$(wc -l < "$rules" | tr -d ' ')
  info "rendered line count: $lines"

  # Informational budget cross-check: compare against the largest budget the
  # source template declares. The applicable budget depends on the resolved
  # conditions, so only an unambiguous overrun is worth reporting.
  if [ -n "$tpl" ]; then
    local tfile
    tfile=$(find "$REPO_ROOT/skills" -type f \( -path "*/$tpl/rules.template.md" -o -name "$tpl.rules.template.md" \) | head -1)
    if [ -n "$tfile" ]; then
      local maxbudget
      maxbudget=$(grep -m1 '^budget:' "$tfile" | grep -oE '[0-9]+' | LC_ALL=C sort -n | tail -1)
      if [ -n "$maxbudget" ]; then
        if [ "$lines" -le "$maxbudget" ]; then
          info "within the largest budget declared by template '$tpl' ($maxbudget lines)"
        else
          warn "rendered $lines lines, above every budget declared by template '$tpl' (max $maxbudget)"
        fi
      fi
    fi
  fi

  local vals="$proj/.globalize/rules-values.json"
  if [ ! -f "$vals" ]; then
    warn ".globalize/rules-values.json not found — cannot show which keys were resolved"
  elif ! command -v jq >/dev/null 2>&1; then
    warn "jq not installed — skipping the rules-values.json report"
  elif ! jq -e . "$vals" >/dev/null 2>&1; then
    fail ".globalize/rules-values.json is not valid JSON"
  else
    pass ".globalize/rules-values.json is valid JSON"
    echo "  Resolved keys (eyeball these against the rendered file):"
    jq -r 'to_entries[] | "    \(.key) = \(if (.value | type) == "array" then (.value | join(", ")) else (.value | tostring) end)"' "$vals"
  fi
}

# ─── Run ───

if [ "$MODE" = "project" ]; then
  run_project_mode "$PROJECT_DIR"
else
  run_static_mode
fi

# ─── Verification Report ───

echo ""
echo "--- Verification Report ---"
echo "  Passed:   $PASS"
echo "  Failed:   $FAIL"
echo "  Warnings: $WARN"

if [ $FAIL -gt 0 ]; then
  exit 1
else
  exit 0
fi
