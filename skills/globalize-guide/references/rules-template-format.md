# Coding-rules template format

Passive coding rules are delivered as a **generated artifact**, not a shipped file. Each library ships a `rules.template.md` covering every configuration that library supports; setup renders it down to the one configuration the project actually has, substitutes the project's real paths and locales, and writes the result to `.claude/globalize-rules.md` in the target project. `CLAUDE.md` imports that generated file.

This matters because the generated file is loaded into **every** session's context forever. A branch that doesn't apply is pure cost, and a path or locale asserted as fact but resolved differently by setup is worse than cost — it's a rule the agent will follow into a bug.

This file is the whole spec. A subagent rendering a template reads this and the template, nothing else.

---

## Template anatomy

```
---
template: lingui
templateVersion: 1
conditions: [router, catalogFormat]
values: [catalogPath, sourceLocale, targetLocales]
budget: { "router == \"app\"": 230, "default": 200 }
---

# LinguiJS Coding Rules

...body with conditional blocks and placeholders...
```

**Frontmatter is the template's contract**, and it is what `evals/verify-rules-template.sh` checks against the body:

| Key | Meaning |
|---|---|
| `template` | Library id. Appears in the generated file's header. |
| `templateVersion` | Bump when the rendering contract changes, not on prose edits. Lets a future run detect a stale generated file. |
| `conditions` | Every key the body branches on. A body condition on an undeclared key is an error. |
| `values` | Every key the body substitutes. A `<<name>>` not declared here is an error, and a declared key never used is also an error — the values file is a resolution cost, so nothing goes in it speculatively. |
| `budget` | Max line count of the rendered output, keyed by condition expression, with a `default`. The renderer self-checks against this. |

The frontmatter is **stripped** during rendering — it never reaches the generated file.

---

## Conditional blocks

```
<!-- if: router == "app" -->
Server components: verify `setI18n(i18n)` is called upstream in this request.
<!-- else -->
Every component reads from `<I18nProvider>` context.
<!-- /if -->
```

Grammar, deliberately minimal:

- One key, one operator, one double-quoted string literal: `<!-- if: key == "value" -->` or `<!-- if: key != "value" -->`.
- `<!-- else -->` is optional. `<!-- /if -->` is required.
- **No nesting. No `&&`, `||`, or `elif`.** A block needing two conditions is written twice, once per combination.

The grammar is trivial on purpose. Rendering is performed by a subagent, not a parser, and every construct that requires tracking state across lines is a construct it can get wrong on a 400-line file. Duplicating a block is cheap; a mis-rendered rules file is not.

Markers live on their own line and are HTML comments, so a template still renders as readable markdown while being edited — the same technique `SKILL.md` already uses for its conditional plan sections.

---

## Placeholders

```
Catalogs live at `<<catalogPath>>`. Source locale: `<<sourceLocale>>`.
```

`<<name>>` — replaced with the value of `name` from `.globalize/rules-values.json`.

**Why `<< >>` and not `{{ }}`.** These templates are full of code samples, and every other obvious delimiter already means something inside one: `{{ }}` is Vue template interpolation (`vue-i18n`), `{ }` is ICU MessageFormat and JS destructuring, `${ }` is a JS template literal, `%{ }` is Rails interpolation, `%@` and `%1$s` are Swift and Android format specifiers. `<< >>` collides with nothing in any shipped rules file. Do not change it for one library's convenience.

A placeholder whose value is a list (`targetLocales`) renders comma-separated: `de, fr, ja`.

---

## Rendering

Performed by the core `generate_coding_rules` step after core setup, when the config files setup wrote are on disk and their real values can be read. That step always runs — it is not gated on a `SKILL.md §1.10` selection, because Phase 3's wrap subagents read the generated file as their authoring contract.

1. Read `.globalize/manifest-snapshot.json` → `references.rulesTemplate`. **Every** stack entry carries one — there is no `references.code` and no generic-`code.md` track any more. If the key is missing, the installed skill is stale or damaged: stop and tell the user to reinstall rather than inventing a fallback.
2. Resolve every key in `conditions`. Write them to `.globalize/rules-values.json`.
3. Eliminate branches: delete every false branch, **and every marker line** — `<!-- if: -->`, `<!-- else -->`, `<!-- /if -->` all disappear whether their branch was kept or not.
4. Resolve **only the values still referenced** in what survived, and add them to `.globalize/rules-values.json`.

   Branch elimination comes first on purpose. `i18nNavigationPath` has no value on a project without prefix routing, and `getI18nInstance` has no path on a Vite project — those placeholders live inside branches that are already gone. Resolving up front would demand values that do not exist and trip the fail-closed rule on a perfectly healthy project.
5. Finish the body:
   - Replace every surviving `<<name>>` with its resolved value.
   - Strip the frontmatter.
   - **Copy everything retained verbatim.** Do not rewrite, summarize, reflow, re-order, or improve the prose. The template is the reviewed artifact; the generated file is a mechanical projection of it. If a sentence reads badly in the output, fix the template and re-render — never fix it in the output.
6. Prepend the header (below) and write to `.claude/globalize-rules.md`.
7. Self-check the output. All of these must hold:
   - zero occurrences of `<!-- if:`, `<!-- else -->`, `<!-- /if -->`
   - zero occurrences of `<<`
   - header present on line 1
   - line count ≤ the applicable `budget`
8. **Optional (`install_coding_rules`, only if selected in `SKILL.md §1.10`)** — append `@.claude/globalize-rules.md` to the project's `CLAUDE.md`. Steps 1–7 do not depend on it; skipping it leaves the generated file on disk, unimported.

### Generated-file header

```
<!-- globalize-rules v1 | template=lingui | variant=nextjs-app-router-lingui | generated by globalize-guide -->
<!-- Generated file. Re-running globalize-guide overwrites it. Put your own project rules in CLAUDE.md. -->
```

`v1` is the template's `templateVersion`. `variant` is the matched manifest variant. The header is what makes the file re-generatable and lets a later run recognise output from an older template.

### Fail closed

If **any** surviving condition or value cannot be resolved, or the step-7 self-check fails: **never write a partial file.** Delete anything already written to `.claude/globalize-rules.md`, then:

- **Guided mode** — ask the user for the specific value. These are answerable questions ("Where do this project's catalogs live?", "Which locale is the source?"), and a one-line answer is a far better outcome than either a wrong rules file or none. Resolve, re-render, re-check. Only if the user can't answer, or the self-check still fails, stop the step and report which key or check failed.
- **Unguided mode** — do not block the run. Skip the step entirely and record `⚠ coding rules not generated (<key> unresolved) — no rules file installed` in the end-of-run summary.

Either way a **core step did not complete**. Surface it: report `generate_coding_rules` as failed and tell the orchestrator that Phase 3 has no `.claude/globalize-rules.md` to wrap against, rather than proceeding into convert as if it did.

There is deliberately **no fall back to a generic rules file**. Every library's shipped `code.md` was deleted when it moved to a template, precisely so there is only one source of truth for its rules. Keeping stale duplicates on disk purely as a fallback would reintroduce the drift this format exists to remove.

Installing no rules is recoverable — the user re-runs the step. Installing rules that assert the wrong catalog path is not: the agent follows them into a bug on every future edit, and nothing signals that it happened.

---

## Authoring a template

- **Branch only on things that change the rule.** `compiler == "swc"` vs `"babel"` changes setup, not how anyone writes a `<Trans>` — it is not a condition. `router == "app"` changes which component patterns are legal — it is.
- **When a block genuinely depends on two axes, resolve them into one composite key** rather than reaching for nesting. next-intl needed "App Router *and* Next 15+" for the Promise-shaped route `params`. Expressed as `router` × `nextMajor` that is a conjunction the grammar has no way to write. Expressed as a single `paramsShape` key resolved to `"promise"` / `"sync"` / `"none"`, it is two sibling blocks — and on the Pages Router both are false, so nothing renders:

  ```
  <!-- if: paramsShape == "promise" -->
  ...Next 15 Promise params...
  <!-- /if -->
  <!-- if: paramsShape == "sync" -->
  ...Next 13–14 plain-object params...
  <!-- /if -->
  ```

  The tempting alternative — emitting the block unconditionally with a "skip this if your project has no `app/` directory" self-guard — is exactly the failure this format exists to remove. A guard the reader must evaluate is still a branch that doesn't apply, still in context on every edit, still costing tokens. Push the conjunction into the resolution step, where it is answered once, instead of into the rules file, where it is re-answered forever.
- **Substitute anything setup resolves per project**: catalog paths, source and target locales, the dynamic route segment, whether imports use an alias or a relative path. If a template states one of these as a bare fact, it will be wrong for some project.
- **Write imperatively.** This is a rules file the agent obeys, not documentation it studies. Prefer "Name placeholders with `ph()`" over three sentences on why positional `{0}` is unhelpful. Rationale earns its place only where an agent would otherwise reasonably do the wrong thing.
- **Every rule that applies stays.** Leanness comes from cutting branches that don't apply and prose that doesn't change behaviour — never from dropping a rule that does. There is no on-demand second tier to move things to.
- **Check the budget before committing.** Render the worst-case combination by hand and count.
- **The rendered file must be self-contained.** Never write a path into `.claude/skills/globalize-guide/…`, and never point at another reference file in this skill. Everything the agent needs at edit time is inline in the generated file, or it doesn't ship.

## Self-containment is a hard requirement

`.claude/globalize-rules.md` lives **outside** the skill, and `CLAUDE.md` imports it as `@.claude/globalize-rules.md` — not as a path into `.claude/skills/`. That is deliberate: **the user can delete the `globalize-guide` skill entirely once setup is done and the coding rules keep working.**

Setup is a one-time, 20k-line, twenty-stack orchestrator. There is no reason for it to sit in the repo forever, and every reason for the rules to. The old mechanism coupled them: `CLAUDE.md` held `@.claude/skills/globalize-guide/references/.../code.md`, so removing the skill broke the import and every future session opened with a dangling `@` reference.

Two rules follow, and `evals/verify-rules-template.sh` enforces both:

- A template body must not contain `.claude/skills/` or a `references/…` path.
- A rule that would need the reader to open another file isn't a rule yet — inline it or cut it.

Referring to a *separate* skill by name is fine (`css-i18n`), provided the actionable rule is stated inline and the pointer is only extra depth. That survives deleting `globalize-guide`.
