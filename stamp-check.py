#!/usr/bin/env python3
"""Open item 87's second half: make a version STAMP's age mechanically visible.

    python3 library-checks/stamp-check.py <repo-root> [<baseline.json>] \
            [<packuments.json>]

WHY THIS EXISTS. A stamped claim ("verified against the linter's rule directory
at `v0.10.4`") asserts that a measurement was taken AT a version. It creates a
standing maintenance obligation, and until 2026-10-13 nothing in this check
could see that obligation come due. Both Herb stamps in the Rails skill went
stale for eighteen days behind a gem leg that was itself wrong; draft 33's and
draft 34's stamps were stale while their measurements still held. Item 87 asked
for either item 75's placeholder form or "a grep of skills/ for the stamped
versions of tracked packages as part of (B)". This is the grep, and it is a
grep plus two discriminators, because the plain grep does not work.

WHAT IT IS NOT. It is not a range check and must never become one. An install
spec (`@lingui/core@^6`, or an exact pin on an `npm install` line) is what the
skill tells a user to install, and levels 1-3 already watch those. A FLOOR claim
("backward-compatible SINCE `@swc/core` 1.15.0", "`@vitejs/plugin-react@6.0.0`
DROPPED the babel option") names the version at which something CHANGED; it is
permanently true and does not age. Only a STAMP ages.

THE TWO DISCRIMINATORS, both measured rather than guessed:

  1. STAMP vs FLOOR, by verb. "verified against / as of / measured on" ages;
     "since / dropped / requires / >= / fails on" does not. A line matching
     both, or neither, is reported as BOTH/OTHER and counted -- never silently
     dropped, so the recall gap stays visible.

  2. WHICH package a bare version belongs to, by version containment.
     Nearest-name attribution is wrong and fails SILENTLY. On
     rails.convert.md:91 -- "...the intended replacement for `erb_lint`. As of
     `v0.10.4` (2026-09-10), Herb's rule set covers..." -- `erb_lint` ends 10
     chars before the version and `Herb` starts 16 after it, so nearest-token
     hands the stamp to erb_lint, whose latest is 0.9.0, concludes 0.10.4 is
     NEWER than latest, and drops a stale stamp as a non-finding. That is a
     false negative on one of the two stamps item 87 was written about.
     A stamp of `0.10.4` is a stamp of whichever package PUBLISHED 0.10.4.
     erb_lint's 46 RubyGems releases (0.0.4 .. 0.9.0) contain no 0.10.4; herb's
     do. Attribute by containment; a tie is 'ambiguous' and an unknown version
     list is 'unresolvable' -- both reported, neither guessed.

Bare names match case-INSENSITIVELY on word boundaries, because prose
capitalises a project while the registry does not, and gem names also match
through their npmTwins alias (open item 86).

VALIDATION, 2026-10-13, on `main` 48a676ae: 11 stale stamps, ZERO false
positives on inspection of all 11, and 5 of the 11 are already queued drafts
written by hand weeks earlier -- the two Herb stamps (draft 37, 2026-10-12) and
the three web-ext stamps (draft 22, 2026-09-27). Two known answers, both hit.

DO NOT bump a stamp this reports without re-running the measurement it records.
The number is not the claim; the measurement is. Advancing the version without
redoing the measurement converts a stale-but-honest claim into a fresh-looking
false one, which is strictly worse than leaving it stale.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import walkers

WINDOW = int(os.environ.get('STAMP_WINDOW', '120'))
SKIP_RANGE = re.compile(r"[\^~<>*]|\{\{|<[a-z-]+>")
# <pkg>@<exact x.y[.z]>
PKG_AT = re.compile(r"(?P<name>@[a-z0-9][\w.-]*/[\w.-]+|\b[a-z0-9][\w.-]*)@(?P<ver>\d+\.\d+(?:\.\d+)?)\b")
# bare v<x.y.z> / <x.y.z>, only counted when a tracked name is on the same line
BARE_V = re.compile(r"\bv?(?P<ver>\d+\.\d+\.\d+)\b")

def _parts(v):
    p = [int(x) for x in v.split('.')[:3]]
    return tuple(p) + (0,) * (3 - len(p))

def _name_matches(name, line, aliases):
    """-> [(start, end)] for every mention of `name` (or an alias) in `line`.

    Scoped npm names (@scope/pkg) match exactly. Bare names match
    case-INSENSITIVELY on word boundaries, because prose capitalises a project
    while the registry does not: `rails.convert.md:91` stamps "Herb ... As of
    v0.10.4" and a case-sensitive search for `herb` finds nothing, attributes
    the version to the nearest OTHER name on the line (`erb_lint`, latest
    0.9.0), concludes 0.10.4 is NEWER than latest, and drops a genuinely stale
    stamp as a non-finding. That false negative hit both of the stamps open
    item 87 was written about (2026-10-13).
    """
    spans = []
    pats = [name] + aliases.get(name, [])
    for p in pats:
        if p.startswith('@'):
            for m in re.finditer(re.escape(p), line):
                spans.append((m.start(), m.end()))
        else:
            for m in re.finditer(r'\b' + re.escape(p) + r'\b', line, re.I):
                spans.append((m.start(), m.end()))
    return spans


# --- attribution (2026-10-13) --------------------------------------------
# Nearest-name attribution is WRONG and fails silently. On rails.convert.md:91
#   "...the intended replacement for `erb_lint`. As of `v0.10.4` (2026-09-10),
#    Herb's rule set covers a11y..."
# `erb_lint` ends 11 chars before the version and `Herb` starts 16 after it, so
# nearest-token hands the stamp to erb_lint, whose latest is 0.9.0 -- making the
# stamp look NEWER than latest and dropping it as a non-finding. That is a false
# negative on one of the two stamps item 87 was written about.
#
# The discriminator is measurable, not grammatical: a stamp of `0.10.4` is a
# stamp of whichever package ACTUALLY PUBLISHED 0.10.4. erb_lint's full
# RubyGems version list (46 releases, 0.0.4 .. 0.9.0) contains no 0.10.4; herb's
# does. Attribute by version containment; report a tie as ambiguous rather than
# guessing, and report a name with no version list as unresolvable rather than
# as clean.

def attribute(ver, candidates, version_lists):
    """-> (name, 'unique'|'ambiguous'|'unresolvable'|'none')"""
    confirmed = [n for n in candidates
                 if n in version_lists and ver in version_lists[n]]
    if len(confirmed) == 1:
        return confirmed[0], 'unique'
    if len(confirmed) > 1:
        return None, 'ambiguous'
    unknown = [n for n in candidates if n not in version_lists]
    if unknown:
        return None, 'unresolvable'
    return None, 'none'


def stamp_sites(repo_root, tracked, gems, subdir="skills", aliases=None,
                version_lists=None):
    """-> [(path, lineno, name, stamped, kind, line)]

    kind: 'spec-at' (<name>@<ver> in prose) or 'adjacent' (bare version on a
    line that names a tracked package/gem and a verification verb).
    """
    out = []
    aliases = aliases or {}
    version_lists = version_lists or {}
    names = set(tracked) | set(gems)
    base = os.path.join(repo_root, subdir)
    for root, _dirs, files in os.walk(base):
        for fn in files:
            if not fn.endswith(('.md','.json')):
                continue
            path = os.path.join(root, fn)
            rel = os.path.relpath(path, repo_root)
            with open(path, encoding='utf-8', errors='replace') as fh:
                for lineno, line in enumerate(fh, 1):
                    is_install = bool(walkers.INSTALL_LINE.search(line))
                    for m in PKG_AT.finditer(line):
                        nm, ver = m.group('name'), m.group('ver')
                        if nm not in names:
                            continue
                        if is_install:
                            continue          # install spec, not a stamp
                        out.append((rel, lineno, nm, ver, 'spec-at', line.rstrip()))
                    if is_install:
                        continue
                    spans = {n: _name_matches(n, line, aliases) for n in names}
                    present = [n for n in names if spans[n]]
                    if not present:
                        continue
                    if not re.search(r"verif|as of|checked|measured|tested|confirm|resolves to|at `?v?\d", line, re.I):
                        continue
                    for m in BARE_V.finditer(line):
                        ver = m.group('ver')
                        if any(ver == o[3] and o[4] == 'spec-at' and o[1] == lineno
                               and o[0] == rel for o in out):
                            continue
                        # attribute to the NEAREST tracked name on the line, and
                        # only when it is close enough to plausibly be its stamp.
                        # Without this, one host-floor line naming five packages
                        # produced five "stamps" of the same version (2026-10-13).
                        # names mentioned within 60 chars of this version
                        near = []
                        for n in present:
                            for a, bnd in spans[n]:
                                if min(abs(a - m.end()),
                                       abs(m.start() - bnd)) <= WINDOW:
                                    near.append(n)
                                    break
                        if not near:
                            continue
                        who, how = attribute(ver, near, version_lists)
                        if how != 'unique':
                            out.append((rel, lineno, '|'.join(sorted(near)),
                                        ver, 'adjacent-' + how, line.rstrip()))
                            continue
                        out.append((rel, lineno, who, ver, 'adjacent',
                                    line.rstrip()))
    return out



STAMP = re.compile(
    r"verified\s+(against|on|by|end[ -]to[ -]end)"
    r"|as\s+of\s+[`v\d]"
    r"|re[- ]?verified"
    r"|(measured|checked|tested|confirmed|re-measured)\s+(against|on|at)"
    r"|the\s+version\s+[^)]*resolves\s+to"
    r"|resolves\s+to\)"
    r"|last\s+verified"
    r"|current\s+as\s+of", re.I)
FLOOR = re.compile(
    r"\bsince\b|\bdropped\b|\brequires?\b|\bintroduc|\badded\s+in\b|\brenamed\b"
    r"|\bremoved\s+(in|at)\b|\bfrom\s+[`v]?\d[\d.]*\s+(on|onward)"
    r"|[>≥]=?\s*[`v]?\d|\bor\s+newer\b|\bor\s+later\b|\btoo\s+new\b"
    r"|\bfails?\s+on\b|\bdo\s+not\s+pin\b|\bbroke\b|\bregress", re.I)

def classify(line):
    s, f = bool(STAMP.search(line)), bool(FLOOR.search(line))
    if s and not f: return 'STAMP'
    if f and not s: return 'FLOOR'
    if s and f:     return 'BOTH'
    return 'OTHER'



def report(repo_root, baseline, packuments, out=sys.stdout):
    """-> (stale, summary). Prints the human report as a side effect."""
    p = lambda *a: print(*a, file=out)
    tracked = sorted(baseline['distTags'])
    gems = sorted(baseline['rubygems'])
    cur = {n: packuments[n]['dist-tags'].get('latest') for n in tracked}
    cur.update(baseline['rubygems'])
    vl = {n: sorted(packuments[n]['versions']) for n in tracked}
    for g, v in (baseline.get('npmTwins') or {}).items():
        if isinstance(v, dict) and v.get('npm') in packuments:
            vl[g] = sorted(packuments[v['npm']]['versions'])
    vl.update(baseline.get('gemVersionLists') or {})
    aliases = {g: [v['npm']] for g, v in (baseline.get('npmTwins') or {}).items()
               if isinstance(v, dict) and v.get('npm')}
    rows = stamp_sites(repo_root, tracked, gems, aliases=aliases,
                       version_lists=vl)
    kinds = {}
    for r in rows:
        kinds[r[4]] = kinds.get(r[4], 0) + 1
    p('version mentions found: %d  (window %d chars)' % (len(rows), WINDOW))
    for k in sorted(kinds):
        p('   %-22s %4d' % (k, kinds[k]))
    p('version lists available for %d of %d names'
      % (len(vl), len(tracked) + len(gems)))
    for r in rows:
        if r[4] == 'adjacent-ambiguous':
            p('   AMBIGUOUS %s:%d  %s  version %s'
              % (r[0], r[1], r[2], r[3]))
    attributed = [r for r in rows if r[4] in ('adjacent', 'spec-at')]

    def parts(v):
        q = [int(x) for x in v.split('.')[:3]]
        return tuple(q) + (0,) * (3 - len(q))

    classes, stale, failed = {}, [], []
    for rel, ln, nm, ver, kind, line in attributed:
        k = classify(line)
        classes[k] = classes.get(k, 0) + 1
        try:
            older = parts(ver) < parts(cur[nm].split('-')[0])
        except Exception as exc:
            failed.append((rel, ln, nm, ver, repr(exc)))
            continue
        if k == 'STAMP' and older:
            stale.append((rel, ln, nm, ver, cur[nm], line))
    p('classification of %d attributed mentions: %s'
      % (len(attributed), ', '.join('%s %d' % (k, classes[k])
                                    for k in sorted(classes))))
    # LOUD, never silent: a swallowed exception here reported "0 stale" on
    # 2026-10-13 from an instrument whose comparison raised on every row.
    for f in failed:
        p('   COMPARISON FAILED %s' % (f,))
    assert not failed, 'the stamp comparison raised; see the 2026-10-13 report'
    p('')
    p('STALE STAMPS: %d' % len(stale))
    seen = set()
    for i, (rel, ln, nm, ver, now, line) in enumerate(stale, 1):
        p('%2d. %s:%d' % (i, rel, ln))
        p('    %s stamped %s -> latest %s' % (nm, ver, now))
        p('    | %s' % line.strip()[:200])
    return stale, {'mentions': len(rows), 'kinds': kinds,
                   'attributed': len(attributed), 'classes': classes,
                   'stale': len(stale)}


if __name__ == '__main__':
    repo = sys.argv[1] if len(sys.argv) > 1 else '.'
    bl = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), '.last-versions.json')
    pkf = sys.argv[3] if len(sys.argv) > 3 else 'packuments.json'
    report(repo, json.load(open(bl)), json.load(open(pkf)))
