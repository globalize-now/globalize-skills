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

The server exposes 28 tools across 9 groups:

| Group | Tools | Description |
|-------|-------|-------------|
| **Organisations** | `list_orgs`, `create_org`, `delete_org` | Manage organisations |
| **Projects** | `list_projects`, `create_project`, `get_project`, `delete_project` | Manage translation projects |
| **Languages** | `list_languages`, `get_language` | Browse the language catalog |
| **Project Languages** | `list_project_languages`, `add_project_language`, `remove_project_language` | Configure languages on a project |
| **Repositories** | `list_repositories`, `create_repository`, `delete_repository`, `detect_repository` | Connect and scan git repositories |
| **Glossary** | `list_glossary`, `create_glossary_entry`, `delete_glossary_entry` | Manage translation glossaries |
| **Style Guides** | `list_style_guides`, `upsert_style_guide`, `delete_style_guide` | Set translation style instructions |
| **API Keys** | `list_api_keys`, `create_api_key`, `revoke_api_key` | Manage API keys |
| **Members** | `list_members`, `invite_member`, `remove_member` | Manage organisation members |

## Development

Requires Node.js >= 18.

```bash
cd mcp-server
npm install
npm run build    # Generate API types + compile TypeScript
npm run dev      # Generate from staging API + watch mode
```

The build generates TypeScript types from the Globalize OpenAPI spec, then compiles to JavaScript in `dist/`.

### Environment variables

| Variable | Description |
|----------|-------------|
| `GLOBALIZE_API_KEY` | API key (skips config file and interactive prompt) |
| `GLOBALIZE_API_URL` | Override API base URL (default: `https://api.globalize.now`) |
