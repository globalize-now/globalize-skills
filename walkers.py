#!/usr/bin/env python3
"""Instruments for the daily library check.

Written 2026-09-25 because the gem walker was re-derived — and re-broken the
same way — on three consecutive runs (open item 38). Import it or run it; do
not rewrite it from memory.

  python3 library-checks/walkers.py <path-to-manifest.json> [<repo-root>]

Manifest shape, as of blob 5b6817513f70 (23 stacks):

  {"stacks": [
     {"variant": "...",
      "packages": {"runtime": ["@lingui/core@^6"], "dev": [...]},
      "gems":     {"_comment": "...",            <-- SIBLING of "packages",
                   "runtime": ["rails-i18n ~> 8.1"],   a dict of lists, and
                   "dev": ["i18n-tasks ~> 1.0"]}}]}    NOT under "packages"

Two traps this file exists to close:
  * `gems` is a sibling of `packages`, not a key inside it, and its specs are
    "<name> <range>" (space) not "<name>@<range>".
  * Buckets other than runtime/dev may appear; `_comment` is not a bucket.

ARGUMENT SHAPES -- READ THIS BEFORE EVERY CALL (open item 21).
Three runs in a row (2026-10-05/06/07) passed the wrong shape to a function
here. None of them raised: each returned plausible, entirely wrong output.
There is no single "the data" argument -- four different shapes are in play:

  npm_specs(manifest)          parsed manifest.json dict
  gem_specs(manifest)          parsed manifest.json dict
  reconcile(tracked, manifest, repo_root=None)
                               `tracked` = NAME SET (or any iterable of npm
                               names), NOT the packages dict's values
  install_sites(repo_root)     filesystem path
  module_sites(repo_root)      filesystem path
  dep_ranges(packages)         per-package SUMMARY dict:
                               {name: {latestVersion, deps, peerDeps, optDeps}}
                               NOT raw packuments -- a packument map returns
                               edges=0 silently
  resolved_edges(watch, packages, all_versions)
                               same SUMMARY dict + {dep: [version, ...]}

And the post-call assertion, because `edges > 0` was NOT enough on
2026-10-08: the summary dict was built over 38 packages (33 tracked + 5
level-3 extras) while the baseline covers the 33, so dep_ranges() returned a
healthy-looking 263/190 with 5 spurious `pkg_added`. Assert the KEY SET, not
the count:

  assert set(dep_ranges(pkgs)) == set(baseline["depRanges"])
"""
import json
import os
import re
import sys

SPEC_AT = re.compile(r"^(?P<name>@?[^@]+(?:/[^@]+)?)@(?P<range>.+)$")
SPEC_GEM = re.compile(r"^(?P<name>\S+)\s+(?P<range>.+)$")


def _buckets(block):
    """Yield every spec string in a {runtime: [...], dev: [...]} block."""
    if not isinstance(block, dict):
        return
    for key, items in block.items():
        if key.startswith("_") or not isinstance(items, list):
            continue
        for spec in items:
            if isinstance(spec, str) and spec.strip():
                yield spec.strip()


def npm_specs(manifest):
    """-> {name: {range: [variant, ...]}} for manifest `packages` blocks."""
    out = {}
    for stack in manifest["stacks"]:
        for spec in _buckets(stack.get("packages")):
            i = spec.rfind("@")
            name, rng = spec[:i], spec[i + 1:]
            out.setdefault(name, {}).setdefault(rng, []).append(stack["variant"])
    return out


def gem_specs(manifest):
    """-> {name: {range: [variant, ...]}} for manifest `gems` blocks.

    `gems` sits BESIDE `packages` in each stack. Specs are space-separated.
    """
    out = {}
    for stack in manifest["stacks"]:
        for spec in _buckets(stack.get("gems")):
            m = SPEC_GEM.match(spec)
            if not m:
                continue
            out.setdefault(m["name"], {}).setdefault(
                m["range"], []).append(stack["variant"])
    return out


# Repaired 2026-10-03 (open item 69). Two blind spots, both found by #91's
# angular-localize stack, whose only install line is
#   npx ng add '@angular/localize@^<angular-major>' --skip-confirmation ...
#   1. `ng add` / `ng update` were not install runners, and neither were
#      `bunx`, `pnpm dlx`, `yarn dlx` or `npm add`. (`npx` happened to save
#      this one line, so the line WAS a candidate -- the miss was in the spec.)
#   2. The spec's range had to start with a DIGIT, so a PLACEHOLDER range
#      (`^<angular-major>`, `{{version}}`) matched nothing and the line
#      yielded no package at all. `install_only_untracked` therefore reported
#      EMPTY on the morning a whole new library entered the repo.
# The quote requirement is deliberately KEPT: dropping it pulls in backticked
# prose like `swc_core@50.2.3` (a Rust crate, not an npm package) from the four
# SWC references. An instrument that cannot see the thing returns "clean".
INSTALL_LINE = re.compile(
    r"(?:npm\s+install|npm\s+i\b|npm\s+add|npx|pnpm\s+add|pnpm\s+dlx"
    r"|yarn\s+add|yarn\s+dlx|bun\s+add|bunx|ng\s+add|ng\s+update"
    r"|gem\s+install|bundle\s+add)")
QUOTED_SPEC = re.compile(
    r"['\"](@?[a-z0-9][\w.-]*(?:/[a-z0-9][\w.-]*)?)@"
    r"([\^~>=<]*(?:[\d][\w.\-|\s^~<>=]*|<[^>'\"]+>|\{\{[^}]+\}\}))['\"]")


def install_sites(repo_root, subdir="skills"):
    """Packages a reference tells the user to install, with file:line.

    Covers the two categories manifest reconciliation cannot see (see
    pending-issues/19-*): packages installed only by add-on prose, and
    anything else pinned at an install site. Returns
    {name: [(path, lineno, range), ...]}.
    """
    out = {}
    root = os.path.join(repo_root, subdir)
    for dirpath, _dirs, files in os.walk(root):
        for fn in files:
            if not fn.endswith(".md"):
                continue
            path = os.path.join(dirpath, fn)
            with open(path, encoding="utf-8", errors="replace") as fh:
                for lineno, line in enumerate(fh, 1):
                    if not INSTALL_LINE.search(line):
                        continue
                    for name, rng in QUOTED_SPEC.findall(line):
                        out.setdefault(name, []).append(
                            (os.path.relpath(path, repo_root), lineno, rng.strip()))
    return out


# --- open item 73 (built 2026-10-08) --------------------------------------
# Level 1 parses `npm install` lines only, so a package the skills load from a
# pinned CDN module URL is invisible to all three levels. @inlang/plugin-icu1
# published 1.1.1 on 2026-10-06 and reaches every ICU-JSON project through
# `.../@inlang/plugin-icu1@1/dist/index.js` in the settings the skill emits; the
# check saw nothing. The same holds for @globalize-now/paraglidejs-po-format@0.1
# -- this org's own package, on the DEFAULT catalog path. A pinned remote module
# URL in emitted config IS an install site: resolve its range against the
# packument and diff it like any other spec.
MODULE_URL = re.compile(
    r"https://(?:cdn\.jsdelivr\.net/npm|unpkg\.com|esm\.sh)/"
    r"(?P<name>@[^/@\s\"']+/[^/@\s\"']+|[^/@\s\"']+)"
    r"(?:@(?P<range>[^/\s\"']+))?"
    r"(?P<path>/[^\s\"')]*)?")


def module_sites(repo_root, subdir="skills"):
    """Packages the skills load from a pinned remote module URL.

    -> {name: [(path, lineno, range, url), ...]}. `range` is None for an
    UNPINNED url, which is itself a finding: an unpinned module floats to the
    next major on the user's machine with nothing in the repo recording it.
    Same return shape as install_sites() so the two can be unioned.
    """
    out = {}
    root = os.path.join(repo_root, subdir)
    for dirpath, _dirs, files in os.walk(root):
        for fn in sorted(files):
            if not fn.endswith(".md"):
                continue
            path = os.path.join(dirpath, fn)
            with open(path, encoding="utf-8", errors="replace") as fh:
                for lineno, line in enumerate(fh, 1):
                    for m in MODULE_URL.finditer(line):
                        out.setdefault(m.group("name"), []).append(
                            (os.path.relpath(path, repo_root), lineno,
                             m.group("range"), m.group(0)))
    return out


def reconcile(tracked, manifest, repo_root=None):
    """Three-way reconciliation. Returns a dict of findings, all sorted lists.

    `tracked` is the set of npm names in .last-versions.json["packages"].
    Category 3 (install_only) is the one manifest-only reconciliation misses.
    """
    npm = npm_specs(manifest)
    res = {
        "manifest_untracked": sorted(set(npm) - set(tracked)),
        "tracked_not_in_manifest": sorted(set(tracked) - set(npm)),
        "install_only_untracked": [],
    }
    if repo_root:
        sites = install_sites(repo_root)
        res["install_only_untracked"] = sorted(
            n for n in sites if n not in tracked and n not in npm)
        res["_install_sites"] = sites
        res["empty_stack_installs"] = empty_stack_installs(manifest, repo_root)
        # category 5 (open item 73): pinned remote module URLs
        mods = module_sites(repo_root)
        res["_module_sites"] = mods
        res["module_untracked"] = sorted(
            n for n in mods if n not in tracked)
        res["module_not_in_manifest"] = sorted(
            n for n in mods if n not in npm)
        res["module_unpinned"] = sorted(
            "%s @ %s:%d" % (n, p, ln)
            for n, hits in mods.items() for p, ln, rng, _u in hits
            if rng is None)
    return res


# --- category 4 (open item 69(b), built 2026-10-04) ----------------------
# Added because category 3 cannot see a package whose stack declares no
# packages at all. Rails, Android, Swift and Angular all legitimately
# declare {"runtime": [], "dev": []} -- so "empty is a finding" is wrong.
# "Empty AND the stack's own references contain install lines" is the hole
# #91 fell into (@angular/localize, draft 29) and is mechanically checkable.
# Fires on 2 of 6 empty-packages stacks on main 48a676ae, 0 false positives:
# angular-localize (1 site) and webext-native-messages (web-ext, 2 sites).
# A stack declaring `gems` is NOT empty (rails-yaml), hence the gems check.

def empty_stack_installs(manifest, repo_root, subdir="skills/globalize-guide"):
    """-> {variant: [(bucket, ref_path, name, lineno, range), ...]}

    Only stacks whose `packages` AND `gems` blocks are empty are considered;
    a variant with no install lines in its own references maps to [] and is
    reported as such, because "silent on the stacks that install nothing" is
    half of the evidence that this category is not overfitted.
    """
    out = {}
    base = os.path.join(repo_root, subdir)
    for stack in manifest.get("stacks", []):
        declared = []
        for block in ("packages", "gems"):
            for bucket, specs in (stack.get(block) or {}).items():
                if bucket.startswith("_"):
                    continue
                declared.extend(specs or [])
        if declared:
            continue
        hits = []
        for bucket, paths in (stack.get("references") or {}).items():
            if not isinstance(paths, list):
                continue
            for rel in paths:
                path = os.path.join(base, rel)
                if not os.path.exists(path):
                    hits.append((bucket, rel, "<MISSING REFERENCE>", 0, ""))
                    continue
                with open(path, encoding="utf-8", errors="replace") as fh:
                    for lineno, line in enumerate(fh, 1):
                        if not INSTALL_LINE.search(line):
                            continue
                        for name, rng in QUOTED_SPEC.findall(line):
                            hits.append((bucket, rel, name, lineno,
                                         rng.strip()))
        out[stack.get("variant")] = hits
    return out

# --- level-2 dependency instrument (open item 62, 2026-09-30) ------------
# Added because the level-2 claim was carried as a COUNT of edges and dep
# names, which held identical for five consecutive runs (2026-09-26..-30)
# while next-intl@4.14.8 moved five of its ten dependency RANGES -- the very
# change that re-resolved @swc/core onto a broken release. A count cannot see
# a range move. Level 2 records names AND ranges from here on.

def dep_ranges(packages, include_optional=False):
    """-> {pkg: {"<dep> (<bucket>)": "<range>"}} for the `latest` of each pkg.

    `packages` is the per-package summary dict this task builds from the
    packuments: each value carries `deps`, `peerDeps`, `optDeps` and
    `latestVersion`. Buckets are kept distinct in the key because the
    dependencies-vs-peerDependencies distinction is load-bearing (it is the
    whole of drafts 24 and 25), so a dep that MOVES bucket must show up as
    one removal plus one addition, not as an unchanged edge.
    """
    buckets = [("deps", "dep"), ("peerDeps", "peer")]
    if include_optional:
        buckets.append(("optDeps", "opt"))
    out = {}
    for name, v in packages.items():
        m = {}
        for key, tag in buckets:
            for dep, rng in (v.get(key) or {}).items():
                m["%s (%s)" % (dep, tag)] = rng
        out[name] = m
    return out


def dep_range_stats(ranges):
    """-> (edges, distinct dep names) for a dep_ranges() map."""
    edges = sum(len(m) for m in ranges.values())
    names = {k.rsplit(" (", 1)[0] for m in ranges.values() for k in m}
    return edges, len(names)


def diff_dep_ranges(old, new):
    """Compare two dep_ranges() maps. Returns a dict of sorted findings.

    `changed` is the category a count-based instrument is blind to: same dep,
    same bucket, different range. Report it even when `edges` is unchanged --
    that combination is exactly what open item 62 records.
    """
    res = {"pkg_added": sorted(set(new) - set(old)),
           "pkg_removed": sorted(set(old) - set(new)),
           "added": [], "removed": [], "changed": []}
    for pkg in sorted(set(old) & set(new)):
        o, n = old[pkg], new[pkg]
        for k in sorted(set(n) - set(o)):
            res["added"].append((pkg, k, n[k]))
        for k in sorted(set(o) - set(n)):
            res["removed"].append((pkg, k, o[k]))
        for k in sorted(set(o) & set(n)):
            if o[k] != n[k]:
                res["changed"].append((pkg, k, o[k], n[k]))
    return res


# --- level-3 resolution instrument (open item 65, 2026-10-01) -------------
# Added because level 2 (declared ranges, item 62) reported "zero changed" on
# 2026-10-01 while the single most consequential edge in the tracked set moved:
# next-intl's "@swc/core": "~1.16.0" has read the same since 2026-08-27, and
# what it INSTALLS went 1.16.2 -> 1.16.12 (09-29) -> 1.16.13 (09-30), the last
# two being releases that do not load at all on some machines. Level 1 watches
# manifest specs; level 2 watches declared ranges; neither watches what a
# declared range RESOLVES to. A fixed range is not a fixed resolution.

PRERELEASE = re.compile(r"[-+]")


def _parts(version):
    return tuple(int(x) for x in version.split(".")[:3])


def stable_versions(all_versions):
    """-> sorted list of non-prerelease x.y.z versions, ascending."""
    out = []
    for v in all_versions:
        if PRERELEASE.search(v):
            continue
        try:
            out.append((_parts(v), v))
        except ValueError:
            continue
    return [v for _, v in sorted(out)]


def resolve_range(all_versions, rng):
    """Highest stable version satisfying `rng`. None if nothing satisfies.

    Deliberately narrow: handles the forms that actually occur in this repo's
    manifest and in the tracked packages' dependency blocks -- `^x.y.z`,
    `~x.y.z`, `^x`, `~x.y`, a bare `x` / `x.y` / `x.y.z`, and `*`. Anything
    else returns None rather than guessing, so an unhandled form shows up as a
    gap in the report instead of a wrong number.
    """
    versions = stable_versions(all_versions)
    if not versions:
        return None
    rng = rng.strip()
    if rng in ("*", "", "latest", "x"):
        return versions[-1]
    op = ""
    if rng[0] in "^~":
        op, rng = rng[0], rng[1:]
    if not re.fullmatch(r"\d+(\.\d+){0,2}", rng):
        return None
    want = [int(x) for x in rng.split(".")]
    lo = tuple(want + [0] * (3 - len(want)))
    if op == "^":
        hi = (lo[0] + 1, 0, 0) if lo[0] else (
            (0, lo[1] + 1, 0) if lo[1] else (0, 0, lo[2] + 1))
    elif op == "~":
        hi = (lo[0], lo[1] + 1, 0) if len(want) >= 2 else (lo[0] + 1, 0, 0)
    elif len(want) == 3:
        hi = (lo[0], lo[1], lo[2] + 1)
    elif len(want) == 2:
        hi = (lo[0], lo[1] + 1, 0)
    else:
        hi = (lo[0] + 1, 0, 0)
    best = None
    for v in versions:
        pv = _parts(v)
        if lo <= pv < hi:
            best = v
    return best


def resolved_edges(watch, packages, all_versions):
    """-> {"<pkg> -> <dep> (<bucket>)": {"range":…, "resolved":…}}

    `watch` is a list of (pkg, dep) pairs whose transitive resolution is known
    to be load-bearing -- not every edge, because resolving all 225 needs a
    packument per dep name. `packages` is the per-package summary dict (same
    shape dep_ranges() takes). `all_versions` is {dep: [version, ...]}.
    """
    out = {}
    for pkg, dep in watch:
        v = packages.get(pkg) or {}
        for key, tag in (("deps", "dep"), ("peerDeps", "peer"),
                         ("optDeps", "opt")):
            rng = (v.get(key) or {}).get(dep)
            if rng is None:
                continue
            out["%s -> %s (%s)" % (pkg, dep, tag)] = {
                "range": rng,
                "resolved": resolve_range(all_versions.get(dep, []), rng),
            }
    return out


def diff_resolved_edges(old, new):
    """Compare two resolved_edges() maps.

    `resolution_moved` is the category items 62 and 65 together exist for:
    the declared range is byte-identical and the installed version is not.
    """
    res = {"added": sorted(set(new) - set(old)),
           "removed": sorted(set(old) - set(new)),
           "range_moved": [], "resolution_moved": []}
    for k in sorted(set(old) & set(new)):
        o, n = old[k], new[k]
        if o.get("range") != n.get("range"):
            res["range_moved"].append((k, o.get("range"), n.get("range")))
        if o.get("resolved") != n.get("resolved"):
            res["resolution_moved"].append(
                (k, o.get("resolved"), n.get("resolved"), n.get("range")))
    return res


def _main():
    manifest = json.load(open(sys.argv[1], encoding="utf-8"))
    repo_root = sys.argv[2] if len(sys.argv) > 2 else None
    npm, gems = npm_specs(manifest), gem_specs(manifest)
    print("npm names: %d, specs: %d"
          % (len(npm), sum(len(r) for r in npm.values())))
    print("gem names: %d, specs: %d"
          % (len(gems), sum(len(r) for r in gems.values())))
    for name in sorted(gems):
        for rng, variants in gems[name].items():
            print("   %s %s  (%d stacks)" % (name, rng, len(variants)))
    if repo_root:
        sites = install_sites(repo_root)
        print("install sites: %d names" % len(sites))
        for name in sorted(sites):
            path, lineno, rng = sites[name][0]
            print("   %-28s @%-8s %d site(s), e.g. %s:%d"
                  % (name, rng, len(sites[name]), path, lineno))
        mods = module_sites(repo_root)
        print("module sites (item 73): %d names" % len(mods))
        for name in sorted(mods):
            path, lineno, rng, url = mods[name][0]
            print("   %-40s @%-6s %d site(s), %s:%d"
                  % (name, rng if rng else "UNPINNED", len(mods[name]),
                     path, lineno))


if __name__ == "__main__":
    _main()
