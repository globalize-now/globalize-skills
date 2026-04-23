# i18n-guide end-to-end evaluation — 2026-04-22

Evaluation run of `globalize-skills` (branch `feat/vue-skills`) against all 27 example projects in `/Users/arturs/Projects/globalize/example-websites/typescript/`.

## Method

1. Copied each example to `/tmp/i18n-skill-eval/<name>/` (excluding `node_modules`, `.next`, etc.).
2. Installed all current skills under `.claude/skills/` of each copy: `i18n-guide`, `lingui-setup`, `lingui-convert`, `lingui-code`, `next-intl-setup`, `next-intl-convert`, `vue-setup`, `vue-code`, `css-i18n`.
3. Spawned 27 parallel general-purpose subagents, each:
   - Followed `i18n-guide/SKILL.md` as if triggered.
   - Followed whichever setup skill it routed to, **unguided mode**, locales `en` + `es`.
   - Ran real `npm install` / edits.
   - Followed the convert skill where one exists (`lingui-convert`, `next-intl-convert`).
   - Reported in a fixed schema.
4. Subagents did not invoke skills via the Skill tool (not registered in their scope) — they read the installed `SKILL.md` files and followed them literally. This is closer to real use than dry-running the prose.

Per-example reports: [per-example/](per-example/)

## Results at a glance

| Status | Examples |
|---|---|
| **STOP correctly (unsupported stack)** | angular, astro, express, fastify, hono, lit, nestjs, qwik-city, solid, solid-start, svelte, sveltekit, trpc |
| **STOP at setup (custom build pipeline)** | gatsby, react-email |
| **Silent misroute → setup STOP** | react-native-expo |
| **Setup + convert success** | nextjs-14, nextjs-15, nextjs-16, react-router, tanstack-router, vue (setup only) |
| **Setup or convert partial/failed** | nextjs-pages-router, nuxt, remix, tanstack-start, vite-react |

Full summary with findings in [findings.md](findings.md).
