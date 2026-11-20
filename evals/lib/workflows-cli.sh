# Sourced by verify-cli-use.sh and verify-globalize-connect.sh: one parser for a CLI command
# group's source file (`workflows`, `glossaries`, `assets`, …) and one extractor for the CLI
# invocations a skill's prose names, so both evals check skills against the CLI the same way.
# The caller defines pass() and fail().

# The commands and flags a command group's source file ($1, e.g.
# api-client/src/commands/workflows.ts) registers, one "command<TAB>" line per command and
# one "command<TAB>--flag" line per flag. In workflows.ts, commands under `runs` are
# "runs start", "runs list", …, and preview-setup and setup also take every option
# withSetupOptions adds. A flag is the first argument of `.option(`, `.requiredOption(` or
# `new Option(`, on its line or the next: a "--flag" inside a description or an error
# message is not one.
workflows_cli_table() {
  awk '
    function flag(line,   f) {
      f = ""
      if (match(line, /(Option|\.option)\("--[a-z][a-z-]*/)) f = substr(line, RSTART, RLENGTH)
      else if (pending && match(line, /^[[:space:]]*"--[a-z][a-z-]*/)) f = substr(line, RSTART, RLENGTH)
      pending = line ~ /(Option|\.option)\([[:space:]]*$/
      sub(/^[^"]*"/, "", f)
      return f
    }
    /^function withSetupOptions/ { insetup = 1 }
    insetup && /^}/ { insetup = 0 }
    insetup { f = flag($0); if (f != "") setup[f] = 1; next }
    /const runs = / { inruns = 1 }
    match($0, /\.command\("[a-z-]+"\)/) {
      name = substr($0, RSTART + 10, RLENGTH - 12)
      if (name == "runs") { cmd = ""; next }
      cmd = inruns ? "runs " name : name
      print cmd "\t"
      if (cmd == "preview-setup" || cmd == "setup") for (f in setup) print cmd "\t" f
    }
    cmd != "" { f = flag($0); if (f != "") print cmd "\t" f }
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

# Each `<group>` ($1) invocation in the files given names a command the CLI source file
# ($2, e.g. api-client/src/commands/glossaries.ts) registers and passes only flags that
# command defines. One pass per valid invocation, one fail per unknown command or flag.
check_cli_group() {
  local group="$1" cli_src="$2" table invs where inv sub flag bad found=0
  shift 2
  table="$(workflows_cli_table "$cli_src")"
  if [ -z "$table" ]; then
    fail "no $group commands parsed from $cli_src"
    return
  fi
  invs="$(cli_invocations "$group [a-z]" "$@")"
  while IFS=$'\t' read -r where inv; do
    [ -z "$inv" ] && continue
    found=1
    sub="$(printf '%s' "$inv" | awk '{ if ($2 == "runs") print $2 " " $3; else print $2 }')"
    if ! printf '%s\n' "$table" | grep -qxF -- "$sub	"; then
      fail "$where names '$group $sub', which the CLI does not register: $inv"
      continue
    fi
    bad=0
    while IFS= read -r flag; do
      [ -z "$flag" ] && continue
      [ "$flag" = "--json" ] && continue   # global output option
      if ! printf '%s\n' "$table" | grep -qxF -- "$sub	$flag"; then
        fail "$where passes $flag to '$group $sub', which the CLI does not define: $inv"
        bad=1
      fi
    done < <(printf '%s' "$inv" | grep -oE -- '--[a-z][a-z-]+' | sort -u)
    [ "$bad" -eq 0 ] && pass "$where: CLI defines '$inv'"
  done <<< "$invs"
  [ "$found" -eq 1 ] || fail "the skill names no '$group' command"
}

# check_cli_group for the `workflows` group; $1 is the workflows.ts path.
check_workflows_cli() {
  check_cli_group workflows "$@"
}
