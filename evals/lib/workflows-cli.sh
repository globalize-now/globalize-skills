# Sourced by verify-cli-use.sh and verify-globalize-connect.sh: one parser for the CLI's
# `workflows` commands and one extractor for the CLI invocations a skill's prose names, so
# both evals check skills against the CLI the same way. The caller defines pass() and fail().

# The commands and flags api-client/src/commands/workflows.ts ($1) registers, one
# "command<TAB>" line per command and one "command<TAB>--flag" line per flag. Commands under
# `runs` are "runs start", "runs list", …; preview-setup and setup also take every option
# withSetupOptions adds.
workflows_cli_table() {
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
  ' "$1" | sort -u
}

# Every invocation of the command $1 (an ERE such as 'workflows [a-z]') in the files given,
# one "file:line<TAB>invocation" record each, the invocation running from the command to the
# end of its shell segment. Sources:
#   - lines inside ``` fences, indented or not, with backslash continuations joined (a fenced
#     line quoting commands in backticks is read for its code spans instead);
#   - Markdown table rows whose first cell names the command (the row's other cells are its
#     flags);
#   - inline code spans everywhere else.
# A segment ends at `|`, `||`, `&&` or `;`, so `… | jq --raw-output` lends the command no
# flag and a second command after `&&` is checked on its own.
cli_invocations() {
  local cmd="$1" file
  shift
  for file in "$@"; do
    [ -f "$file" ] || continue
    awk -v file="$(basename "$(dirname "$file")")/$(basename "$file")" '
      function emit(text, where) { print where "\t" text }
      function spans(s, where) { while (match(s, /`[^`]*`/)) { emit(substr(s, RSTART + 1, RLENGTH - 2), where); s = substr(s, RSTART + RLENGTH) } }
      /^[[:space:]]*```/ { fence = !fence; buf = ""; start = 0; next }
      fence && index($0, "`") { spans($0, file ":" NR); next }
      fence {
        line = $0
        if (sub(/\\[[:space:]]*$/, " ", line)) { buf = buf line; if (!start) start = NR; next }
        emit(buf line, file ":" (start ? start : NR)); buf = ""; start = 0; next
      }
      /^\|[[:space:]]*`/ { row = substr($0, 2); gsub(/\|/, " ", row); gsub(/`/, " ", row); emit("@row " row, file ":" NR); next }
      { spans($0, file ":" NR) }
    ' "$file"
  done | awk -F '\t' -v cmd="$cmd" '
    BEGIN { re = "(^|[[:space:]])" cmd }
    {
      where = $1; text = $2
      gsub(/[[:space:]]+/, " ", text)
      if (text ~ /^@row /) { text = substr(text, 6); sub(/^[[:space:]]+/, "", text); if (text ~ ("^" cmd)) print where "\t" text; next }
      gsub(/\|\||&&|;|\|/, "\n", text)
      n = split(text, seg, "\n")
      for (i = 1; i <= n; i++) {
        if (match(seg[i], re)) {
          inv = substr(seg[i], RSTART); sub(/^[[:space:]]+/, "", inv); sub(/[[:space:]]+$/, "", inv)
          print where "\t" inv
        }
      }
    }
  ' | sort -t "$(printf '\t')" -k2,2 -u
}

# Each `workflows` invocation in the files given names a command the CLI ($1, the
# workflows.ts path) registers and passes only flags that command defines. One pass per
# valid invocation, one fail per unknown command or flag.
check_workflows_cli() {
  local cli_src="$1" table invs where inv sub flag bad found=0
  shift
  table="$(workflows_cli_table "$cli_src")"
  if [ -z "$table" ]; then
    fail "no workflows commands parsed from $cli_src"
    return
  fi
  invs="$(cli_invocations 'workflows [a-z]' "$@")"
  while IFS=$'\t' read -r where inv; do
    [ -z "$inv" ] && continue
    found=1
    sub="$(printf '%s' "$inv" | awk '{ if ($2 == "runs") print $2 " " $3; else print $2 }')"
    if ! printf '%s\n' "$table" | grep -qxF -- "$sub	"; then
      fail "$where names 'workflows $sub', which the CLI does not register: $inv"
      continue
    fi
    bad=0
    while IFS= read -r flag; do
      [ -z "$flag" ] && continue
      [ "$flag" = "--json" ] && continue   # global output option
      if ! printf '%s\n' "$table" | grep -qxF -- "$sub	$flag"; then
        fail "$where passes $flag to 'workflows $sub', which the CLI does not define: $inv"
        bad=1
      fi
    done < <(printf '%s' "$inv" | grep -oE -- '--[a-z][a-z-]+' | sort -u)
    [ "$bad" -eq 0 ] && pass "$where: CLI defines '$inv'"
  done <<< "$invs"
  [ "$found" -eq 1 ] || fail "the skill names no 'workflows' command"
}
