# @globalize-now/mcp-server

MCP server for the [Globalize](https://globalize.now) translation platform. Connects AI coding agents to the Globalize API so they can manage translation projects, languages, glossaries, style guides, and more.

## Installation

### Claude Code

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "globalize": {
      "command": "npx",
      "args": ["-y", "@globalize-now/mcp-server"]
    }
  }
}
```

Or for a specific project, add to `.claude/settings.json` in the project root.

### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "globalize": {
      "command": "npx",
      "args": ["-y", "@globalize-now/mcp-server"]
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "globalize": {
      "command": "npx",
      "args": ["-y", "@globalize-now/mcp-server"]
    }
  }
}
```

## Authentication

The server resolves your API key in this order:

1. **Environment variable** -- set `GLOBALIZE_API_KEY`
2. **Config file** -- reads from `~/.globalize/config.json`
3. **Interactive prompt** -- on first run, prompts you to create a key at [app.globalize.now/settings/api-keys](https://app.globalize.now/settings/api-keys) and paste it in. The key is saved to `~/.globalize/config.json` for future use.

To pass the key via environment variable in your MCP config:

```json
{
  "mcpServers": {
    "globalize": {
      "command": "npx",
      "args": ["-y", "@globalize-now/mcp-server"],
      "env": {
        "GLOBALIZE_API_KEY": "glb_..."
      }
    }
  }
}
```

## Tools

The server exposes 81 tools across 16 groups:

| Group | Tools | Description |
|-------|-------|-------------|
| **Organisations** | `list_orgs`, `delete_org` | Manage organisations |
| **Projects** | `list_projects`, `create_project`, `update_project`, `get_project`, `delete_project`, `get_project_refs`, `list_project_scorecards`, `get_project_budget`, `rotate_webhook_secret` | Manage translation projects |
| **Languages** | `list_languages`, `get_language` | Browse the language catalog |
| **Project Languages** | `list_project_languages`, `add_project_language`, `remove_project_language` | Configure languages on a project |
| **Repositories** | `list_repositories`, `create_repository`, `update_repository`, `delete_repository`, `detect_repository`, `list_repository_branches`, `discover_repository`, `translate_repository` | Connect and scan git repositories |
| **Patterns** | `list_patterns`, `create_pattern`, `update_pattern`, `delete_pattern`, `reorder_pattern`, `bulk_create_patterns` | Manage repository locale path patterns |
| **Glossary** | `list_glossary`, `create_glossary_entry`, `delete_glossary_entry` | Manage translation glossaries |
| **Style Guides** | `list_style_guides`, `upsert_style_guide`, `delete_style_guide`, `generate_style_guide`, `apply_style_guide`, `get_style_guide_quota` | Set translation style instructions |
| **API Keys** | `list_api_keys`, `create_api_key`, `revoke_api_key` | Manage API keys |
| **Members** | `list_members`, `invite_member`, `remove_member` | Manage organisation members |
| **GitHub** | `github_install`, `github_install_status`, `list_github_installations`, `list_github_repos`, `list_github_branches`, `detect_github_repo` | GitHub App installation and repositories |
| **GitLab** | `gitlab_install`, `gitlab_install_status`, `list_gitlab_connections`, `delete_gitlab_connection`, `list_gitlab_projects`, `list_gitlab_project_branches`, `detect_gitlab_project` | GitLab connection and repositories |
| **Jobs** | `list_jobs`, `get_job`, `start_job`, `retry_job`, `get_job_stats`, `get_qa_report`, `dismiss_qa`, `undismiss_qa`, `export_job`, `export_job_manifest`, `list_job_units`, `get_job_unit`, `list_job_files`, `redeliver_job` | Manage translation jobs |
| **Namespaces** | `list_namespaces`, `update_namespace`, `delete_namespace` | Manage project namespaces |
| **Translation Memory** | `list_translation_memory`, `delete_translation_memory_entry`, `count_translation_memory`, `fresh_count_translation_memory` | Browse and manage translation memory |
| **Billing** | `get_balance`, `get_ledger` | View billing balance and ledger |

## Development

Requires Node.js >= 18.

```bash
cd mcp-server
npm install
npm run build    # Compile TypeScript to dist/
npm run dev      # Watch mode (tsc --watch)
```

The MCP server consumes the typed API client from `@globalize-now/cli-client`; `npm run build` compiles the server's TypeScript to `dist/`. To refresh the underlying API types, regenerate the client in `../api-client` (`npm run generate`).

### Environment variables

| Variable | Description |
|----------|-------------|
| `GLOBALIZE_API_KEY` | API key (skips config file and interactive prompt) |
| `GLOBALIZE_API_URL` | Override API base URL (default: `https://api.globalize.now`) |
