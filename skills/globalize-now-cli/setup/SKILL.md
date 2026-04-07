---
name: globalize-now-cli-setup
description: >-
  Set up the Globalize CLI for managing translation projects. Use this skill when the user
  asks to set up Globalize, install the Globalize CLI, authenticate with Globalize, or
  connect their project to the Globalize translation platform. Also use when the user
  mentions @globalize-now/cli-client or globalise-now-cli. This skill handles installation
  and authentication. It does NOT cover using the CLI to manage projects, languages, or
  other resources — that's handled by globalize-now-cli-use.
---

# Globalize CLI Setup

The Globalize CLI (`@globalize-now/cli-client`) lets AI agents manage translation projects, languages, glossaries, style guides, and repository connections on the [Globalize](https://globalize.now) platform.

Follow these steps in order.

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed with the setup?**
> 1. **Guided** — I'll explain each step before and after.
> 2. **Unguided** — I'll run all steps without pausing and show a full summary at the end.

### Guided mode rules

- **Before each step**: briefly explain what will happen and why.
- **After each step**: summarize what changed (files installed, config created, commands run).

### Unguided mode rules

- Execute all steps without pausing for per-step explanations.
- Hard stops (e.g., Node.js not found) still halt execution — these are never skipped.
- At the end, produce a summary:

```
## Setup Complete

### What was done
- [x] Step N: {step name} — {one-line description}

### Next steps
- {recommendations}
```

#### Required choices in unguided mode

No required choices. Proceed immediately after mode selection.

---

## Step 1: Detect the Environment

Check the following before proceeding:

| Signal | How to detect |
|--------|--------------|
| **Node.js** | `node --version` exits 0 and version >= 18. Required for the CLI. |
| **Existing auth** | `~/.globalize/config.json` exists with an `apiKey` field, or `GLOBALIZE_API_KEY` env var is set. |
| **Package manager** | `package-lock.json` → npm. `yarn.lock` → yarn. `pnpm-lock.yaml` → pnpm. `bun.lock` → bun. |

If authentication is already configured, skip to Step 3 to verify.

If no blockers were found, proceed to the **Setup Mode** prompt before continuing to Step 2.

---

## Step 2: Install

No global install is needed. Run commands directly with npx:

```bash
npx @globalize-now/cli-client <command>
```

Or install globally if the user prefers:

```bash
npm install -g @globalize-now/cli-client
```

The binary name is `globalise-now-cli`.

---

## Step 3: Authenticate

The CLI resolves credentials in this order:

1. **`GLOBALIZE_API_KEY` environment variable** — best for CI/CD
2. **`~/.globalize/config.json` config file** — best for local development
3. **Interactive login** — browser-based device authorization flow

### If already authenticated

Check with:

```bash
npx @globalize-now/cli-client auth status --json
```

If this returns a valid `source` and `key`, authentication is already configured. Skip to Step 4.

### If not authenticated

Run the login command:

```bash
npx @globalize-now/cli-client auth login
```

This starts a device authorization flow:
1. The CLI prints a **user code** and a **verification URL**
2. In an interactive terminal, it opens the URL in the browser automatically
3. In a non-interactive terminal (e.g. agent), it prints the URL for the user to visit
4. The user approves in the browser, and the CLI automatically saves the API key to `~/.globalize/config.json`

Show the verification URL to the user and ask them to approve in the browser. Once approved, the CLI saves the key automatically.

---

## Step 4: Verify

Run both commands to confirm everything works:

```bash
npx @globalize-now/cli-client auth status --json
```

This should return JSON with `source`, `key` (prefix), and `api` (URL).

Then verify API connectivity:

```bash
npx @globalize-now/cli-client orgs list --json
```

This should return the user's organisations. If it fails with an auth error, revisit Step 3.
