---
name: globalize-now-account-setup
description: >-
  Install the Globalize CLI, authenticate, and verify your organization. Use this
  skill when the user asks to set up Globalize, install the Globalize CLI, sign in
  or authenticate with Globalize, or connect their Globalize account. Also use when
  the user mentions @globalize-now/cli-client or globalise-now-cli and needs to get
  signed in. This skill handles installation and authentication only — to create a
  translation project and connect a repository, use globalize-now-project-setup. For
  managing existing projects (glossaries, style guides, team members), use
  globalize-now-cli-use.
---

# Globalize Account Setup

The Globalize CLI (`@globalize-now/cli-client`) lets AI agents manage translation projects, languages, glossaries, style guides, and repository connections on the [Globalize](https://globalize.now) platform.

This skill gets the CLI installed and your account authenticated. Once you're signed in, run `globalize-now-project-setup` to create a translation project and connect your repository.

Follow these steps in order.

---

## Setup Mode

After Step 1 (detection) completes without blockers, ask the user:

> **How would you like to proceed?**
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
## Account Setup Complete

### What was done
- [x] Step 1: Detect Environment — {Node version, existing auth yes/no}
- [x] Step 2: Install CLI — {npx or global}
- [x] Step 3: Authenticate — {auth method}
- [x] Step 4: Verify — {org name}

### Next steps
- Run `globalize-now-project-setup` to create a translation project and connect this repo.
```

---

## Step 1: Detect the Environment

Check the following before proceeding:

| Signal | How to detect |
|--------|--------------|
| **Node.js** | `node --version` exits 0 and version >= 18. Required for the CLI. |
| **Existing auth** | `~/.globalize/config.json` exists with an `apiKey` field, or `GLOBALIZE_API_KEY` env var is set. |

### Detection outcomes

If Node.js is missing or older than 18: **HARD STOP** — the CLI requires Node.js >= 18. Ask the user to install or upgrade Node before continuing.

If authentication is already configured (`~/.globalize/config.json` with an `apiKey`, or `GLOBALIZE_API_KEY` set), skip the login flow and go straight to **Step 4: Verify** to confirm the credentials work.

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

Start the device authorization flow in non-blocking mode:

```bash
npx @globalize-now/cli-client auth login --no-wait --json
```

This returns the device code info without waiting for approval:

```json
{
  "data": {
    "user_code": "ABCD-1234",
    "verification_uri_complete": "https://...",
    "device_code": "...",
    "code_verifier": "...",
    "expires_in": 900,
    "interval": 5
  }
}
```

Present the `verification_uri_complete` URL and `user_code` to the user and ask them to open the URL in their browser and approve.

Once the user confirms they have approved, complete the authentication:

```bash
npx @globalize-now/cli-client auth complete \
  --device-code <DEVICE_CODE> \
  --code-verifier <CODE_VERIFIER> \
  --json
```

On success this saves the API key to `~/.globalize/config.json` and returns:

```json
{
  "data": {
    "org": "...",
    "status": "authenticated"
  }
}
```

If the user hasn't approved yet, the command will poll until they do or the code expires.

> **Note:** In an interactive terminal, `auth login` (without `--no-wait`) runs the full flow automatically — it opens the browser, waits for approval, and saves the key. Use `--no-wait` + `auth complete` when running as an agent.

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

---

## Next step

CLI installed and signed in. To create a translation project, connect this repo, and set catalog file patterns, run the **`globalize-now-project-setup`** skill.
