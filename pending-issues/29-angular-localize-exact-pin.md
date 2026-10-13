# Angular Step 2's `ng add '@angular/localize@^<major>'` cannot install on a project that is not on the newest patch of its Angular major

**Draft written:** 2026-10-03 (library check). **Unfiled** — the repo PAT returns `401 Bad credentials`
(39 days stale), the cloud container's git proxy returns `403 … not in this session's authorized
repository set`, and there is no GitHub MCP server in this session at all. See § Filing.

**Type:** PR (implementable — two files, prose and one command; no behavioural code).
**Severity:** High for the new Angular path. It is **Step 2 of 11**, the first command the setup
runs, and on a real project it fails outright. The repo's own fixtures cannot see it.
**Trigger class:** (A) repo-event — the defect arrived with [#91](https://github.com/globalize-now/globalize-skills/pull/91),
merged into `main` as `48a676ae` on 2026-10-02T10:15:29Z, not from a registry move.

**Files:**

- `skills/globalize-guide/SKILL.md` — §1.2 detection table (`version` row), §2.0 install prose, Phase-2 checklist comment
- `skills/globalize-guide/references/languages/js-ts/frameworks/angular/angular-localize.setup.md` — Step 2 (command, spec note, *Already applied*, *Troubleshooting*)

**Patch:** `29-angular-localize-exact-pin.patch` — 2 files, **`+15/-7`**, `git apply --check` clean on
`main` `48a676ae`. **Shares no file with any of the seven other queued patches** (checked
mechanically, see § Collision). Opens **ready for review**, not draft: every claim below is executed.

---

## What #91 shipped

`#91` added the `angular-localize` stack (24th in the manifest, `supportLevel: "experimental"`),
an 880-line setup reference, a convert reference, a rules template, three Ionic fixtures and a new
per-library eval. Step 2 of the setup reference, and the orchestrator's §2.0 copy of it, both say:

```bash
npx ng add '@angular/localize@^<angular-major>' --skip-confirmation --use-at-runtime --project <project>
```

with `<angular-major>` = "the major of detection `version` (`22.2` → `^22`)". The troubleshooting
paragraph defends the caret explicitly: *"It is still a caret range."*

## Why that cannot work

`@angular/localize` does not declare its peers as ranges. It declares them as **exact versions**:

| `@angular/localize` | `peerDependencies` |
|---|---|
| `22.2.1` (latest) | `{"@angular/compiler": "22.2.1", "@angular/compiler-cli": "22.2.1"}` |
| `22.2.0` | `{"@angular/compiler": "22.2.0", "@angular/compiler-cli": "22.2.0"}` |
| `22.1.0` | `{"@angular/compiler": "22.1.0", "@angular/compiler-cli": "22.1.0"}` |
| `22.0.0` | `{"@angular/compiler": "22.0.0", "@angular/compiler-cli": "22.0.0"}` |
| `21.2.25`, `21.0.0`, `20.3.33`, `19.2.25`, `18.2.14`, `16.2.12` | same shape, exact, every time |

Read from the live packument, not from docs. The pattern is unbroken back to v16 — it is how
Angular ships, not a slip in one release.

So `^22` resolves to `22.2.1`, whose peer requirement is `@angular/compiler@22.2.1` **exactly**.
A project on any earlier 22 patch does not satisfy it.

### Measured, with a same-run control (npm 10.9.8, node 22.23.2)

Minimal fixture with `@angular/core`, `@angular/compiler` and `@angular/compiler-cli` pinned to
one version; `npm install --dry-run` for each spec:

| project `@angular/*` | spec | flags | result |
|---|---|---|---|
| `22.2.1` | `@angular/localize@^22` | — | **OK** — installs `22.2.1` |
| `22.2.0` | `@angular/localize@^22` | — | **ERESOLVE** — `peer @angular/compiler@"22.2.1"` |
| `22.1.0` | `@angular/localize@^22` | — | **ERESOLVE** — `peer @angular/compiler@"22.2.1"` |
| `22.0.0` | `@angular/localize@^22` | — | **ERESOLVE** — `peer @angular/compiler@"22.2.1"` |
| `22.0.0` | `@angular/localize@^22` | `--legacy-peer-deps` | "OK" — installs **`22.2.1`** against compiler `22.0.0` |
| `22.0.0` | `@angular/localize@22.0.0` | — | **OK** — installs `22.0.0` ← control |
| `21.2.25` | `@angular/localize@^21` | — | **OK** — installs `21.2.25` |
| `21.0.0` | `@angular/localize@^21` | — | **ERESOLVE** — `peer @angular/compiler@"21.2.25"` |
| `21.0.0` | `@angular/localize@21.0.0` | — | **OK** — installs `21.0.0` |

The caret succeeds in exactly one case per major: the project is on that major's newest patch.
The `--legacy-peer-deps` row is the trap the reference's own rationale is worried about, one level
finer than it looked: it installs a `22.2.1` tools package against a `22.0.0` compiler, and
`@angular/localize/tools` is what the Step 4 converter imports.

## The obvious fix is wrong, and that is the interesting half

Dropping the version — `ng add @angular/localize` — looks right, because the Angular CLI has a
"Searching for compatible package version" task that exists for exactly this. **It is worse.**

From the published CLI (`@angular/cli@22.2.1`, `src/commands/add/cli.js` L192), the task's gate is:

```js
enabled: packageIdentifier.type === 'range' && packageIdentifier.rawSpec === '*',
```

Executed against `npm-package-arg` — the same library the CLI uses — this is what each spec form
produces:

| spec as written | `type` | `rawSpec` | compatible-version search |
|---|---|---|---|
| `@angular/localize` | `range` | `"*"` | **ENABLED** |
| `@angular/localize@^22` | `range` | `"^22"` | disabled |
| `@angular/localize@22.0.0` | `version` | `"22.0.0"` | disabled |
| `@angular/localize@latest` | `tag` | `"latest"` | disabled |

So the caret in the reference **turns off** the feature. And when the search *is* enabled, its
algorithm (L303–L360, `#getMajorVersions` + `#findCompatibleVersion`) tries `latest`, and on a peer
conflict sweeps **the newest release of each major, newest first**. Simulating that published
algorithm over the live packument:

| project `@angular/*` | bare `ng add` would install | why |
|---|---|---|
| `22.2.1` | `22.2.1` | `latest` accepted |
| `22.0.0` | **`9.1.13`** | `latest` rejected, major sweep |
| `21.0.0` | **`9.1.13`** | `latest` rejected, major sweep |
| `20.1.0` | **`9.1.13`** | `latest` rejected, major sweep |

Because every major's *newest* release carries an exact peer pin, no major's newest release matches
a project on an older patch — and the sweep never looks at `22.0.0`, which would have matched,
because it only examines `22.2.1` for major 22. It walks down to **`@angular/localize@9.1.13`**,
verified from the packument to be the last release with **no `peerDependencies` at all**;
`getPeerDependencyConflicts()` returns `false` for a manifest with no peers, so the sweep accepts
it and stops. A 2020 major gets installed and *its* `ng-add` schematic runs.

The caret fails loudly. The bare name fails silently and six majors deep. Neither is acceptable,
which is why the patch pins exactly.

## What the patch does

```bash
npx ng add "@angular/localize@$(node -p 'require("@angular/compiler/package.json").version')" --skip-confirmation --use-at-runtime --project <project>
```

- Pins the **installed `@angular/compiler`** version, which is what the peer is declared against —
  not `@angular/core`, though in a lockstep project they are equal. `@angular/compiler` is a plain
  dependency in both of #91's own Angular fixtures, so it is always resolvable from the project root.
- Executed end to end: in a project at `22.0.0`, `node -p` returns `22.0.0` and the resulting
  `npm install --dry-run` adds `@angular/localize 22.0.0`.
- Quoting: double quotes are required for the substitution, and the construct is POSIX — verified
  under `bash` and `dash`. It carries no `^`, so the zsh `EXTENDED_GLOB` hazard that `SKILL.md` §2.0's
  single-quote rule exists for does not apply; the patch says so at the site. (zsh itself is not
  installed in this sandbox, so that half is reasoned from the absence of `^`, not executed.)
- Replaces the *Troubleshooting — the computed pin* paragraph with *why an exact version, and why
  neither a caret nor a bare name*, carrying the `ERESOLVE` text and the `9.1.13` result, so the next
  reader does not re-derive this.
- Tightens *Already applied* from "same major as `@angular/core`" to "same version as
  `@angular/compiler`" — under the old wording a project with a matching major and a stale patch is
  reported already-applied, and the converter then runs on a mismatched tools package.
- Fixes one clause that the change makes stale: §1.2's `version` row claimed "the setup's `ng add`
  pin read it". It no longer does. The row is left at `major.minor` deliberately — see § Maintainer's call.

## Why the eval suite cannot catch this, and why no eval change is needed

Per open item 68, `evals/` was grepped for assertions on the shape this patch changes:
`grep -rn "angular/localize\|ng add" evals/` → **1 hit, a comment line** in
`evals/library-checks/angular-localize.sh`. Nothing asserts an install spec. **No eval edit is
required** — unlike draft 28, where the sibling arm had to be fixed before the patch could ship.

The deeper reason the suite is blind here: `#91`'s three Angular fixtures declare `^22.2.0` and
their `package-lock.json` files are **one-line placeholders**. A fresh install therefore resolves to
`22.2.1`, the one case where the caret works. The defect needs a real lockfile holding an older
patch — i.e. a real project — so no fixture-based eval can reach it.

### Evals run

Three of the suite's verifiers run without a `<workdir> <fixture>` pair; all three were run against
`main` `48a676ae` with and without the patch, and are identical:

| eval | pre-patch | post-patch |
|---|---|---|
| `evals/verify-manifest.sh` | 6 passed / 0 failed / 0 warn | **6 / 0 / 0** |
| `evals/verify-format-helpers.sh` | 99 / 0 / 0 | **99 / 0 / 0** |
| `evals/verify-rules-template.sh` | 114 / 0 / 0 | **114 / 0 / 0** |

`bash -n` clean on all 10 `evals/*.sh` and all 4 `evals/library-checks/*.sh`.
`verify-setup.sh`, `verify-orchestration.sh`, `verify-hard-stop.sh`, `verify-string-wrapping.sh` and
`library-checks/angular-localize.sh` all exit 1 with a usage message — each needs a live project —
so the behavioural half is unrun here, as in every run since the suite gained that requirement
(open item 21's second form). The patch touches no code those five execute.

## Collision check (item 52 / item 63)

Seven PRs open. Changed-file lists read from the API for the four `library-check/*` ones:

| PR | touches `SKILL.md`? | touches the Angular files? | verdict |
|---|---|---|---|
| #64 `library-check/install-constraint-gate` | **yes**, `+33/-1` | no | see below |
| #63 `library-check/vite-swc-lingui-host-floor` | no | no | disjoint |
| #69 `library-check/swc-abi-direction-sweep` | no | no | disjoint |
| #67 `library-check/next-intl-po-layout` | no | no | disjoint |
| #78, #77 (README), #21 (agent) | no | no | disjoint |

**#64 was exercised, not inferred.** Its branch (`c6959aa`, 2026-08-26) was cloned and this patch
applied on top: it fails — but **only because the branch predates #91 entirely**. `grep` for the
Angular `ng add` text on #64's branch returns 0 hits, and
`skills/.../angular/angular-localize.setup.md` does not exist there. #64 is five weeks stale and
needs a rebase against `main` regardless of this draft. On `main` the two hunk sets are disjoint:
#64's last `SKILL.md` anchor is the *"Lingui (v6+) requires Node ≥ 22.19"* blockquote at **L522**,
this patch's first changed line in that region is **L533**, and `git apply` uses 3 lines of context.
Whichever lands second takes a trivial merge; neither rewrites the other's sentence.

## Maintainer's call

**Should detection's `version` carry the full version instead of `major.minor`?** The patch reads
the installed `@angular/compiler` at install time rather than threading a third field through
detection, which keeps the change to two files and works even when detection ran against a
`package.json` range with no lockfile (where a patch number would be a guess). The cost is that
§2.0's command now depends on `node_modules` being populated — true at that point in the run, since
§2.0 is the install step and the project already has Angular installed, but it is a dependency the
old form did not have. The alternative is a `coreVersion` detection field; that is a bigger diff
through §1.2, §1.5a (see #64) and the progress schema, and it would still need a fallback for the
no-lockfile case. Stated here rather than decided.

**Second, smaller:** the Step-2 table row at L27 of the setup reference is labelled
`` `ng add @angular/localize` `` — the bare form, which this draft shows is the dangerous one. It is a
step *label*, not a command, and the patch leaves it alone to keep the diff tight. If you would
rather it not be copy-pasteable, say so and it becomes a one-line hunk.

## Filing

Three transports tried this run, all refuse to write:

| transport | read | write |
|---|---|---|
| repo PAT (`library-checks/.github-token`) | **401** | **401 `Bad credentials`** — file mtime `2026-08-25T17:27:18Z`, **39 days** |
| cloud container git proxy (`GH_TOKEN`, len 14) | **403** `GitHub access to this repository is not enabled for this session. Use add_repo…` | `git push` → **403** *"not in this session's authorized repository set"*; `POST /git/refs` → **403** *"Write access to this GitHub API path is not permitted through this proxy."* |
| GitHub MCP server | **absent from this session entirely** (it read fine on 2026-10-02) | n/a |

Control, same run: the same unauthenticated REST calls return **200** — every read in this draft
(packuments, tarballs, compares, PR file lists, two `--depth 1` clones) went through unauthenticated
HTTPS without trouble. `add_repo` is named by the proxy's own error but is not a tool in this
session, so it cannot be called from here.

Section 5 of the task applies: the draft is written, nothing was filed.

---

## Freshness note, 2026-10-09 (added by the daily check — no write path, nothing filed)

**`@angular/localize` published `22.2.2` on 2026-10-08T17:51:51.616Z**, and its peers moved with it: `@angular/compiler` and `@angular/compiler-cli` both `22.2.1` → **`22.2.2`**, exact as ever (measured on the live packument; level 3 recorded it as two `range_moved` edges). `next` also moved, `22.3.0-next.0` → `22.3.0-next.1`.

**The defect shape is unchanged and this is a fresh instance of it** — an exact peer pin that advances with every patch release is exactly what this draft is about. `git apply --check` is still **clean** on `main` `48a676ae`.

**But the patch now carries stale numbers.** Its prose names `` `^22` → `22.2.1` `` and quotes `peer @angular/compiler@"22.2.1"` in the ERESOLVE example. Both read `22.2.2` as of yesterday, and will read `22.2.3` on the next Angular patch.

**Deliberately not regenerated.** Chasing the number daily is churn, and the version is illustrative, not load-bearing — the claim is "the peer is exact", which is true at every version. The better fix, if a human is touching this anyway: **write the example with a placeholder** (`^22` → the newest `22.x`, whose peer is that same version exactly) so the text stops aging. Recorded as open item **75**: a draft about a moving pin should not quote the pin's current value.
