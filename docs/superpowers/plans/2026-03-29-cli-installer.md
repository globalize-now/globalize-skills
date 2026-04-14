# CLI Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `npx globalize-skills` CLI that fetches skills from GitHub and installs them for Claude Code, Codex, and Cursor with format conversion.

**Architecture:** Thin Node.js CLI with three converters (one per agent platform), GitHub API integration for fetching skills, and an interactive wizard for the no-args flow. Pure ESM, no build step.

**Tech Stack:** Node.js 18+, @inquirer/prompts, node:test, GitHub REST API (unauthenticated)

**Spec:** `docs/superpowers/specs/2026-03-29-cli-installer-design.md`

---

## File Structure

```
cli/
  package.json
  bin.mjs                    # Entry point, argument routing
  lib/
    frontmatter.mjs          # Parse SKILL.md YAML frontmatter
    github.mjs               # Fetch files/trees from GitHub API
    registry.mjs             # Discover skills + presets from repo
    detect.mjs               # Auto-detect agent platforms in cwd
  converters/
    claude.mjs               # .claude/skills/<name>/
    codex.mjs                # .codex/skills/<name>.md
    cursor.mjs               # .cursor/rules/<name>.mdc
  commands/
    add.mjs                  # Fetch + convert + install
    list.mjs                 # Show available skills
    update.mjs               # Re-fetch and overwrite
    wizard.mjs               # Interactive no-args flow
  test/
    frontmatter.test.mjs
    converters/
      claude.test.mjs
      codex.test.mjs
      cursor.test.mjs
    detect.test.mjs
presets.json                 # (repo root, not in cli/)
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `cli/package.json`
- Create: `cli/bin.mjs`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "globalize-skills",
  "version": "0.1.0",
  "description": "Install globalization skills for AI coding agents",
  "type": "module",
  "bin": {
    "globalize-skills": "./bin.mjs"
  },
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "test": "node --test test/**/*.test.mjs test/**/**/*.test.mjs"
  },
  "dependencies": {
    "@inquirer/prompts": "^7"
  },
  "files": [
    "bin.mjs",
    "lib/",
    "converters/",
    "commands/"
  ],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Globalize-now/globalize-skills.git",
    "directory": "cli"
  }
}
```

- [ ] **Step 2: Create bin.mjs stub**

```javascript
#!/usr/bin/env node

const [command, ...args] = process.argv.slice(2);

const commands = {
  add: () => import('./commands/add.mjs'),
  list: () => import('./commands/list.mjs'),
  update: () => import('./commands/update.mjs'),
};

async function main() {
  if (!command || !commands[command]) {
    const { run } = await import('./commands/wizard.mjs');
    await run();
    return;
  }

  const { run } = await commands[command]();
  await run(args);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Install dependencies**

Run: `cd cli && npm install`

- [ ] **Step 4: Commit**

```bash
git add cli/package.json cli/bin.mjs cli/package-lock.json
git commit -m "feat(cli): scaffold project with package.json and bin entry point"
```

---

### Task 2: Frontmatter Parser

**Files:**
- Create: `cli/lib/frontmatter.mjs`
- Create: `cli/test/frontmatter.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseFrontmatter } from '../lib/frontmatter.mjs';

describe('parseFrontmatter', () => {
  it('parses simple key-value frontmatter', () => {
    const input = `---
name: lingui-setup
description: Set up LinguiJS
---

# Body content`;

    const result = parseFrontmatter(input);
    assert.equal(result.attributes.name, 'lingui-setup');
    assert.equal(result.attributes.description, 'Set up LinguiJS');
    assert.ok(result.body.includes('# Body content'));
  });

  it('parses multi-line folded description (>-)', () => {
    const input = `---
name: lingui-convert
description: >-
  Wrap hardcoded UI strings with LinguiJS macros and detect
  localization gaps in any React-based project.
---

Body here`;

    const result = parseFrontmatter(input);
    assert.equal(result.attributes.name, 'lingui-convert');
    assert.equal(
      result.attributes.description,
      'Wrap hardcoded UI strings with LinguiJS macros and detect localization gaps in any React-based project.'
    );
  });

  it('returns empty attributes for content without frontmatter', () => {
    const input = '# Just a heading\n\nSome content';
    const result = parseFrontmatter(input);
    assert.deepEqual(result.attributes, {});
    assert.equal(result.body, input);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && node --test test/frontmatter.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement frontmatter parser**

```javascript
// cli/lib/frontmatter.mjs

/**
 * Parse YAML frontmatter from a markdown string.
 * Handles simple `key: value` and YAML folded block scalars (`>-`).
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { attributes: {}, body: content };
  }

  const raw = match[1];
  const body = content.slice(match[0].length).replace(/^\n+/, '');
  const attributes = {};

  const lines = raw.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kvMatch = line.match(/^(\w+):\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value = kvMatch[2];

      if (value === '>-' || value === '|' || value === '>') {
        // Collect indented continuation lines
        const parts = [];
        i++;
        while (i < lines.length && lines[i].match(/^\s+/)) {
          parts.push(lines[i].trim());
          i++;
        }
        value = parts.join(' ');
      } else {
        i++;
      }

      attributes[key] = value;
    } else {
      i++;
    }
  }

  return { attributes, body };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && node --test test/frontmatter.test.mjs`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add cli/lib/frontmatter.mjs cli/test/frontmatter.test.mjs
git commit -m "feat(cli): add frontmatter parser for SKILL.md files"
```

---

### Task 3: Claude Converter

**Files:**
- Create: `cli/converters/claude.mjs`
- Create: `cli/test/converters/claude.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { install } from '../converters/claude.mjs';

describe('claude converter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globalize-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('installs SKILL.md and references to .claude/skills/<name>/', () => {
    const files = {
      'SKILL.md': '---\nname: lingui-setup\n---\n\n# Setup',
      'references/vite-swc.md': '# Vite SWC guide',
      'references/nextjs-app-router.md': '# Next.js guide',
    };

    install({ name: 'lingui-setup', files, targetDir: tmpDir });

    const skillDir = path.join(tmpDir, '.claude', 'skills', 'lingui-setup');
    assert.ok(fs.existsSync(path.join(skillDir, 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(skillDir, 'references', 'vite-swc.md')));
    assert.ok(fs.existsSync(path.join(skillDir, 'references', 'nextjs-app-router.md')));

    const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8');
    assert.ok(content.includes('# Setup'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && node --test test/converters/claude.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Claude converter**

```javascript
// cli/converters/claude.mjs
import fs from 'node:fs';
import path from 'node:path';

/**
 * Install skill files to .claude/skills/<name>/ (pass-through, no conversion).
 */
export function install({ name, files, targetDir }) {
  const skillDir = path.join(targetDir, '.claude', 'skills', name);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(skillDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  return { dir: skillDir, fileCount: Object.keys(files).length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && node --test test/converters/claude.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/converters/claude.mjs cli/test/converters/claude.test.mjs
git commit -m "feat(cli): add Claude Code converter (pass-through)"
```

---

### Task 4: Codex Converter

**Files:**
- Create: `cli/converters/codex.mjs`
- Create: `cli/test/converters/codex.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { install } from '../converters/codex.mjs';

describe('codex converter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globalize-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates main skill file in .codex/skills/', () => {
    const files = {
      'SKILL.md': '---\nname: lingui-setup\ndescription: Set up LinguiJS\n---\n\n# Setup\n\nInstructions here.',
    };

    install({ name: 'lingui-setup', files, targetDir: tmpDir });

    const mainFile = path.join(tmpDir, '.codex', 'skills', 'lingui-setup.md');
    assert.ok(fs.existsSync(mainFile));

    const content = fs.readFileSync(mainFile, 'utf8');
    assert.ok(content.startsWith('<!-- Installed by globalize-skills -->'));
    assert.ok(content.includes('# Setup'));
    // Frontmatter should be stripped
    assert.ok(!content.includes('---'));
  });

  it('creates separate files for each reference', () => {
    const files = {
      'SKILL.md': '---\nname: lingui-setup\n---\n\n# Setup',
      'references/vite-swc.md': '# Vite SWC\n\nSWC instructions.',
      'references/nextjs-app-router.md': '# Next.js App Router\n\nNext.js instructions.',
    };

    install({ name: 'lingui-setup', files, targetDir: tmpDir });

    const dir = path.join(tmpDir, '.codex', 'skills');
    assert.ok(fs.existsSync(path.join(dir, 'lingui-setup.md')));
    assert.ok(fs.existsSync(path.join(dir, 'lingui-setup-vite-swc.md')));
    assert.ok(fs.existsSync(path.join(dir, 'lingui-setup-nextjs-app-router.md')));

    const ref = fs.readFileSync(path.join(dir, 'lingui-setup-vite-swc.md'), 'utf8');
    assert.ok(ref.startsWith('<!-- Installed by globalize-skills -->'));
    assert.ok(ref.includes('SWC instructions'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && node --test test/converters/codex.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Codex converter**

```javascript
// cli/converters/codex.mjs
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '../lib/frontmatter.mjs';

const HEADER = '<!-- Installed by globalize-skills -->\n\n';

/**
 * Install skill to .codex/skills/<name>.md with separate files per reference.
 * Strips SKILL.md frontmatter.
 */
export function install({ name, files, targetDir }) {
  const dir = path.join(targetDir, '.codex', 'skills');
  fs.mkdirSync(dir, { recursive: true });

  const written = [];

  for (const [relativePath, content] of Object.entries(files)) {
    if (relativePath === 'SKILL.md') {
      const { body } = parseFrontmatter(content);
      const outPath = path.join(dir, `${name}.md`);
      fs.writeFileSync(outPath, HEADER + body);
      written.push(outPath);
    } else if (relativePath.startsWith('references/')) {
      const variant = path.basename(relativePath, '.md');
      const outPath = path.join(dir, `${name}-${variant}.md`);
      fs.writeFileSync(outPath, HEADER + content);
      written.push(outPath);
    }
  }

  return { dir, fileCount: written.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && node --test test/converters/codex.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/converters/codex.mjs cli/test/converters/codex.test.mjs
git commit -m "feat(cli): add Codex converter (strip frontmatter, split references)"
```

---

### Task 5: Cursor Converter

**Files:**
- Create: `cli/converters/cursor.mjs`
- Create: `cli/test/converters/cursor.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { install } from '../converters/cursor.mjs';

describe('cursor converter', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globalize-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('creates .mdc file with MDC frontmatter', () => {
    const files = {
      'SKILL.md': '---\nname: lingui-setup\ndescription: Set up LinguiJS\n---\n\n# Setup\n\nInstructions.',
    };

    install({ name: 'lingui-setup', files, targetDir: tmpDir });

    const outPath = path.join(tmpDir, '.cursor', 'rules', 'lingui-setup.mdc');
    assert.ok(fs.existsSync(outPath));

    const content = fs.readFileSync(outPath, 'utf8');
    assert.ok(content.includes('description: Set up LinguiJS'));
    assert.ok(content.includes('alwaysApply: false'));
    assert.ok(content.includes('# Setup'));
  });

  it('creates variant .mdc files with globs', () => {
    const files = {
      'SKILL.md': '---\nname: lingui-setup\ndescription: Set up LinguiJS\n---\n\n# Setup',
      'references/nextjs-app-router.md': '# Next.js guide',
      'references/vite-swc.md': '# Vite SWC guide',
      'references/vite-babel.md': '# Vite Babel guide',
    };

    install({ name: 'lingui-setup', files, targetDir: tmpDir });

    const dir = path.join(tmpDir, '.cursor', 'rules');

    // Check Next.js variant has next.config glob
    const nextjs = fs.readFileSync(path.join(dir, 'lingui-setup-nextjs-app-router.mdc'), 'utf8');
    assert.ok(nextjs.includes('globs: ["next.config.*"]'));

    // Check Vite SWC variant has vite.config glob
    const viteSWC = fs.readFileSync(path.join(dir, 'lingui-setup-vite-swc.mdc'), 'utf8');
    assert.ok(viteSWC.includes('globs: ["vite.config.*"]'));

    // Check Vite Babel variant has both vite.config and .babelrc globs
    const viteBabel = fs.readFileSync(path.join(dir, 'lingui-setup-vite-babel.mdc'), 'utf8');
    assert.ok(viteBabel.includes('vite.config.*'));
    assert.ok(viteBabel.includes('.babelrc*'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && node --test test/converters/cursor.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement Cursor converter**

```javascript
// cli/converters/cursor.mjs
import fs from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from '../lib/frontmatter.mjs';

/** Map variant names to Cursor glob patterns. */
const VARIANT_GLOBS = {
  'nextjs-app-router': ['next.config.*'],
  'nextjs-pages-router': ['next.config.*'],
  'vite-swc': ['vite.config.*'],
  'vite-babel': ['vite.config.*', '.babelrc*'],
};

function mdcFrontmatter({ description, globs }) {
  const globStr = globs ? JSON.stringify(globs) : '';
  return `---
description: ${description}
globs: ${globStr}
alwaysApply: false
---`;
}

/**
 * Install skill to .cursor/rules/<name>.mdc with variant files.
 * Converts SKILL.md frontmatter to MDC format.
 */
export function install({ name, files, targetDir }) {
  const dir = path.join(targetDir, '.cursor', 'rules');
  fs.mkdirSync(dir, { recursive: true });

  const written = [];

  for (const [relativePath, content] of Object.entries(files)) {
    if (relativePath === 'SKILL.md') {
      const { attributes, body } = parseFrontmatter(content);
      const header = mdcFrontmatter({
        description: attributes.description || '',
        globs: null,
      });
      const outPath = path.join(dir, `${name}.mdc`);
      fs.writeFileSync(outPath, header + '\n\n' + body);
      written.push(outPath);
    } else if (relativePath.startsWith('references/')) {
      const variant = path.basename(relativePath, '.md');
      const globs = VARIANT_GLOBS[variant] || [];
      const header = mdcFrontmatter({
        description: `${name} — ${variant} variant`,
        globs: globs.length > 0 ? globs : null,
      });
      const outPath = path.join(dir, `${name}-${variant}.mdc`);
      fs.writeFileSync(outPath, header + '\n\n' + content);
      written.push(outPath);
    }
  }

  return { dir, fileCount: written.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && node --test test/converters/cursor.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/converters/cursor.mjs cli/test/converters/cursor.test.mjs
git commit -m "feat(cli): add Cursor converter (MDC frontmatter, variant globs)"
```

---

### Task 6: Agent Detector

**Files:**
- Create: `cli/lib/detect.mjs`
- Create: `cli/test/detect.test.mjs`

- [ ] **Step 1: Write the failing test**

```javascript
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { detectAgents } from '../lib/detect.mjs';

describe('detectAgents', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'globalize-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('detects Claude Code from .claude/ directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.claude'));
    const agents = detectAgents(tmpDir);
    assert.ok(agents.includes('claude'));
  });

  it('detects Codex from .codex/ directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.codex'));
    const agents = detectAgents(tmpDir);
    assert.ok(agents.includes('codex'));
  });

  it('detects Codex from AGENTS.md file', () => {
    fs.writeFileSync(path.join(tmpDir, 'AGENTS.md'), '# Agents');
    const agents = detectAgents(tmpDir);
    assert.ok(agents.includes('codex'));
  });

  it('detects Cursor from .cursor/ directory', () => {
    fs.mkdirSync(path.join(tmpDir, '.cursor'));
    const agents = detectAgents(tmpDir);
    assert.ok(agents.includes('cursor'));
  });

  it('detects multiple agents', () => {
    fs.mkdirSync(path.join(tmpDir, '.claude'));
    fs.mkdirSync(path.join(tmpDir, '.cursor'));
    const agents = detectAgents(tmpDir);
    assert.deepEqual(agents.sort(), ['claude', 'cursor']);
  });

  it('defaults to claude when nothing detected', () => {
    const agents = detectAgents(tmpDir);
    assert.deepEqual(agents, ['claude']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd cli && node --test test/detect.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement agent detector**

```javascript
// cli/lib/detect.mjs
import fs from 'node:fs';
import path from 'node:path';

const AGENT_SIGNALS = [
  { agent: 'claude', check: (dir) => fs.existsSync(path.join(dir, '.claude')) },
  {
    agent: 'codex',
    check: (dir) =>
      fs.existsSync(path.join(dir, '.codex')) ||
      fs.existsSync(path.join(dir, 'AGENTS.md')),
  },
  { agent: 'cursor', check: (dir) => fs.existsSync(path.join(dir, '.cursor')) },
];

/**
 * Detect which AI coding agents are configured in the given directory.
 * Returns at least ['claude'] as a default.
 */
export function detectAgents(dir) {
  const detected = AGENT_SIGNALS
    .filter(({ check }) => check(dir))
    .map(({ agent }) => agent);

  return detected.length > 0 ? detected : ['claude'];
}

export const ALL_AGENTS = ['claude', 'codex', 'cursor'];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd cli && node --test test/detect.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add cli/lib/detect.mjs cli/test/detect.test.mjs
git commit -m "feat(cli): add agent platform auto-detection"
```

---

### Task 7: GitHub Fetcher & Registry

**Files:**
- Create: `cli/lib/github.mjs`
- Create: `cli/lib/registry.mjs`

These modules hit the network, so they are tested manually rather than with unit tests.

- [ ] **Step 1: Implement GitHub fetcher**

```javascript
// cli/lib/github.mjs
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CACHE_DIR = path.join(os.tmpdir(), 'globalize-skills-cache');
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCachePath(key) {
  return path.join(CACHE_DIR, key.replace(/[^a-zA-Z0-9-]/g, '_'));
}

function readCache(key) {
  const cachePath = getCachePath(key);
  try {
    const stat = fs.statSync(cachePath);
    if (Date.now() - stat.mtimeMs < CACHE_TTL) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch {
    // Cache miss
  }
  return null;
}

function writeCache(key, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(getCachePath(key), JSON.stringify(data));
}

/**
 * Fetch the full file tree of a GitHub repo at a given branch.
 * Returns an array of { path, type, url } objects.
 */
export async function fetchTree(repo, { branch = 'main', noCache = false } = {}) {
  const cacheKey = `tree-${repo}-${branch}`;
  if (!noCache) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  const url = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const tree = data.tree.map(({ path, type }) => ({ path, type }));

  writeCache(cacheKey, tree);
  return tree;
}

/**
 * Fetch raw file content from a GitHub repo.
 */
export async function fetchFile(repo, filePath, { branch = 'main', noCache = false } = {}) {
  const cacheKey = `file-${repo}-${branch}-${filePath}`;
  if (!noCache) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${filePath}: ${res.status}`);
  }

  const content = await res.text();
  writeCache(cacheKey, content);
  return content;
}
```

- [ ] **Step 2: Implement registry**

```javascript
// cli/lib/registry.mjs
import { fetchTree, fetchFile } from './github.mjs';
import { parseFrontmatter } from './frontmatter.mjs';

const DEFAULT_REPO = 'Globalize-now/globalize-skills';

/**
 * Discover all available skills from the repo.
 * Returns array of { name, description, path } objects.
 */
export async function listSkills({ repo = DEFAULT_REPO, noCache = false } = {}) {
  const tree = await fetchTree(repo, { noCache });

  // Find all SKILL.md files under skills/
  const skillPaths = tree
    .filter(({ path, type }) => type === 'blob' && path.match(/^skills\/[^/]+\/[^/]+\/SKILL\.md$/))
    .map(({ path }) => path);

  const skills = await Promise.all(
    skillPaths.map(async (filePath) => {
      const content = await fetchFile(repo, filePath, { noCache });
      const { attributes } = parseFrontmatter(content);
      const pathParts = filePath.split('/');
      return {
        name: attributes.name || `${pathParts[1]}-${pathParts[2]}`,
        description: attributes.description || '',
        path: filePath.replace('/SKILL.md', ''),
      };
    })
  );

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch all files for a skill (SKILL.md + references/).
 * Returns a { name, files } object where files is { relativePath: content }.
 */
export async function fetchSkill(skillPath, { repo = DEFAULT_REPO, noCache = false } = {}) {
  const tree = await fetchTree(repo, { noCache });

  const skillFiles = tree
    .filter(({ path, type }) => type === 'blob' && path.startsWith(skillPath + '/'))
    .map(({ path }) => path);

  const files = {};
  await Promise.all(
    skillFiles.map(async (filePath) => {
      const content = await fetchFile(repo, filePath, { noCache });
      const relativePath = filePath.slice(skillPath.length + 1);
      files[relativePath] = content;
    })
  );

  const { attributes } = parseFrontmatter(files['SKILL.md'] || '');
  return { name: attributes.name || '', files };
}

/**
 * Fetch presets from repo root.
 */
export async function fetchPresets({ repo = DEFAULT_REPO, noCache = false } = {}) {
  try {
    const content = await fetchFile(repo, 'presets.json', { noCache });
    return JSON.parse(content);
  } catch {
    return {};
  }
}
```

- [ ] **Step 3: Manual smoke test**

Run: `cd cli && node -e "import('./lib/registry.mjs').then(m => m.listSkills()).then(s => console.log(JSON.stringify(s, null, 2)))"`
Expected: JSON array with 3 lingui skills

- [ ] **Step 4: Commit**

```bash
git add cli/lib/github.mjs cli/lib/registry.mjs
git commit -m "feat(cli): add GitHub fetcher and skill registry"
```

---

### Task 8: List Command

**Files:**
- Create: `cli/commands/list.mjs`

- [ ] **Step 1: Implement list command**

```javascript
// cli/commands/list.mjs
import { listSkills, fetchPresets } from '../lib/registry.mjs';

export async function run(args = []) {
  const noCache = args.includes('--no-cache');
  const repo = args.find((_, i, a) => a[i - 1] === '--repo') || undefined;

  console.log('Fetching available skills...\n');

  const [skills, presets] = await Promise.all([
    listSkills({ repo, noCache }),
    fetchPresets({ repo, noCache }),
  ]);

  // Print presets
  const presetEntries = Object.entries(presets);
  if (presetEntries.length > 0) {
    console.log('Presets:');
    for (const [name, preset] of presetEntries) {
      console.log(`  ${name} — ${preset.description} (${preset.skills.join(', ')})`);
    }
    console.log();
  }

  // Print skills
  console.log('Skills:');
  for (const skill of skills) {
    const desc = skill.description.length > 80
      ? skill.description.slice(0, 77) + '...'
      : skill.description;
    console.log(`  ${skill.name} — ${desc}`);
  }
}
```

- [ ] **Step 2: Smoke test**

Run: `cd cli && node bin.mjs list`
Expected: Prints presets (if presets.json exists) and 3 lingui skills with descriptions

- [ ] **Step 3: Commit**

```bash
git add cli/commands/list.mjs
git commit -m "feat(cli): add list command"
```

---

### Task 9: Add Command

**Files:**
- Create: `cli/commands/add.mjs`

- [ ] **Step 1: Implement add command**

```javascript
// cli/commands/add.mjs
import { listSkills, fetchSkill, fetchPresets } from '../lib/registry.mjs';
import { detectAgents, ALL_AGENTS } from '../lib/detect.mjs';
import { install as installClaude } from '../converters/claude.mjs';
import { install as installCodex } from '../converters/codex.mjs';
import { install as installCursor } from '../converters/cursor.mjs';

const CONVERTERS = {
  claude: installClaude,
  codex: installCodex,
  cursor: installCursor,
};

function parseArgs(args) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' && args[i + 1]) {
      flags.agent = args[++i];
    } else if (args[i] === '--preset' && args[i + 1]) {
      flags.preset = args[++i];
    } else if (args[i] === '--repo' && args[i + 1]) {
      flags.repo = args[++i];
    } else if (args[i] === '--no-cache') {
      flags.noCache = true;
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
    }
  }

  return { ...flags, skills: positional };
}

export async function run(args = []) {
  const { skills: skillNames, preset, agent, repo, noCache } = parseArgs(args);
  const targetDir = process.cwd();

  // Resolve which skills to install
  let toInstall = [...skillNames];
  if (preset) {
    const presets = await fetchPresets({ repo, noCache });
    if (!presets[preset]) {
      console.error(`Unknown preset: ${preset}`);
      process.exit(1);
    }
    toInstall.push(...presets[preset].skills);
  }

  if (toInstall.length === 0) {
    console.error('No skills specified. Use: globalize-skills add <skill> or --preset <name>');
    process.exit(1);
  }

  // Resolve agent targets
  const agents = agent === 'all'
    ? ALL_AGENTS
    : agent
      ? [agent]
      : detectAgents(targetDir);

  // Fetch available skills to resolve paths
  const allSkills = await listSkills({ repo, noCache });
  const skillMap = Object.fromEntries(allSkills.map((s) => [s.name, s]));

  for (const name of toInstall) {
    const skillInfo = skillMap[name];
    if (!skillInfo) {
      console.error(`Unknown skill: ${name}`);
      continue;
    }

    const { files } = await fetchSkill(skillInfo.path, { repo, noCache });

    for (const agentName of agents) {
      const converter = CONVERTERS[agentName];
      const result = converter({ name, files, targetDir });
      console.log(`  Installed ${name} for ${agentName} → ${result.dir}`);
    }
  }
}
```

- [ ] **Step 2: Smoke test**

Run from any project directory:
```bash
cd /tmp && mkdir test-project && cd test-project && mkdir .claude
node /Users/arturs/Projects/globalize/globalization-skills/cli/bin.mjs add lingui-setup --agent claude
ls -la .claude/skills/lingui-setup/
```
Expected: SKILL.md and references/ directory present

- [ ] **Step 3: Commit**

```bash
git add cli/commands/add.mjs
git commit -m "feat(cli): add command for installing skills"
```

---

### Task 10: Update Command

**Files:**
- Create: `cli/commands/update.mjs`

- [ ] **Step 1: Implement update command**

```javascript
// cli/commands/update.mjs
import { run as addRun } from './add.mjs';

/**
 * Update is the same as add but always uses --no-cache to force fresh fetch.
 */
export async function run(args = []) {
  if (!args.includes('--no-cache')) {
    args.push('--no-cache');
  }
  console.log('Updating (fetching latest from GitHub)...\n');
  await addRun(args);
}
```

- [ ] **Step 2: Commit**

```bash
git add cli/commands/update.mjs
git commit -m "feat(cli): add update command (re-fetch with no cache)"
```

---

### Task 11: Interactive Wizard

**Files:**
- Create: `cli/commands/wizard.mjs`

- [ ] **Step 1: Implement wizard**

```javascript
// cli/commands/wizard.mjs
import { select, checkbox, Separator } from '@inquirer/prompts';
import { listSkills, fetchSkill, fetchPresets } from '../lib/registry.mjs';
import { detectAgents, ALL_AGENTS } from '../lib/detect.mjs';
import { install as installClaude } from '../converters/claude.mjs';
import { install as installCodex } from '../converters/codex.mjs';
import { install as installCursor } from '../converters/cursor.mjs';

const CONVERTERS = {
  claude: installClaude,
  codex: installCodex,
  cursor: installCursor,
};

const AGENT_LABELS = {
  claude: 'Claude Code',
  codex: 'Codex',
  cursor: 'Cursor',
};

export async function run() {
  const action = await select({
    message: 'What would you like to do?',
    choices: [
      { name: 'Add skills', value: 'add' },
      { name: 'Update installed skills', value: 'update' },
      { name: 'List available skills', value: 'list' },
    ],
  });

  if (action === 'list') {
    const { run: listRun } = await import('./list.mjs');
    await listRun();
    return;
  }

  const noCache = action === 'update';
  const [skills, presets] = await Promise.all([
    listSkills({ noCache }),
    fetchPresets({ noCache }),
  ]);

  // Build choices: presets first, then individual skills
  const choices = [];

  const presetEntries = Object.entries(presets);
  if (presetEntries.length > 0) {
    choices.push(new Separator('── Presets ──'));
    for (const [name, preset] of presetEntries) {
      choices.push({
        name: `${name} — ${preset.description}`,
        value: `preset:${name}`,
      });
    }
    choices.push(new Separator('── Individual skills ──'));
  }

  for (const skill of skills) {
    const desc = skill.description.length > 60
      ? skill.description.slice(0, 57) + '...'
      : skill.description;
    choices.push({
      name: `${skill.name} — ${desc}`,
      value: `skill:${skill.name}`,
    });
  }

  const selected = await checkbox({
    message: 'Which skills?',
    choices,
    required: true,
  });

  // Resolve selections to skill names
  const skillNames = new Set();
  for (const item of selected) {
    if (item.startsWith('preset:')) {
      const presetName = item.slice('preset:'.length);
      for (const s of presets[presetName].skills) {
        skillNames.add(s);
      }
    } else {
      skillNames.add(item.slice('skill:'.length));
    }
  }

  // Agent selection
  const targetDir = process.cwd();
  const detected = detectAgents(targetDir);
  const detectedLabel = detected.map((a) => AGENT_LABELS[a]).join(', ');

  const agentChoice = await select({
    message: `Install for which agents? (detected: ${detectedLabel})`,
    choices: [
      { name: `All detected (${detectedLabel})`, value: 'detected' },
      ...ALL_AGENTS.map((a) => ({ name: `${AGENT_LABELS[a]} only`, value: a })),
      { name: 'All agents', value: 'all' },
    ],
  });

  const agents = agentChoice === 'detected'
    ? detected
    : agentChoice === 'all'
      ? ALL_AGENTS
      : [agentChoice];

  // Install
  const skillMap = Object.fromEntries(skills.map((s) => [s.name, s]));
  console.log();

  for (const name of skillNames) {
    const skillInfo = skillMap[name];
    if (!skillInfo) {
      console.error(`Unknown skill: ${name}`);
      continue;
    }

    const { files } = await fetchSkill(skillInfo.path, { noCache });

    for (const agentName of agents) {
      const converter = CONVERTERS[agentName];
      const result = converter({ name, files, targetDir });
      console.log(`  Installed ${name} for ${AGENT_LABELS[agentName]} → ${result.dir}`);
    }
  }
}
```

- [ ] **Step 2: Smoke test**

Run: `cd cli && node bin.mjs`
Expected: Interactive wizard launches, prompts for action, skills, and agents

- [ ] **Step 3: Commit**

```bash
git add cli/commands/wizard.mjs
git commit -m "feat(cli): add interactive wizard for no-args flow"
```

---

### Task 12: Presets File & README Update

**Files:**
- Create: `presets.json` (repo root)
- Modify: `README.md`

- [ ] **Step 1: Create presets.json**

```json
{
  "lingui": {
    "description": "All LinguiJS skills (setup, convert, code)",
    "skills": ["lingui-setup", "lingui-convert", "lingui-code"]
  }
}
```

- [ ] **Step 2: Update README.md**

Add an installation section near the top of the README, replacing the current manual `cp` instructions:

```markdown
## Installation

### Interactive (recommended)

```bash
npx globalize-skills
```

### Direct install

```bash
# Install a single skill (auto-detects Claude Code, Codex, Cursor)
npx globalize-skills add lingui-setup

# Install all LinguiJS skills
npx globalize-skills add --preset lingui

# Target a specific agent
npx globalize-skills add lingui-setup --agent cursor

# List available skills
npx globalize-skills list

# Update to latest version
npx globalize-skills update lingui-setup
```
```

- [ ] **Step 3: Commit**

```bash
git add presets.json README.md
git commit -m "feat: add presets.json and update README with CLI install instructions"
```

---

### Task 13: End-to-End Verification

- [ ] **Step 1: Run all unit tests**

Run: `cd cli && npm test`
Expected: All tests pass (frontmatter, claude, codex, cursor converters, detect)

- [ ] **Step 2: Test list command**

Run: `cd cli && node bin.mjs list`
Expected: Shows lingui preset and 3 skills with descriptions

- [ ] **Step 3: Test add for all agents**

```bash
cd /tmp && rm -rf e2e-test && mkdir e2e-test && cd e2e-test
mkdir .claude .codex .cursor
node /Users/arturs/Projects/globalize/globalization-skills/cli/bin.mjs add --preset lingui --agent all
```

Verify:
- `.claude/skills/lingui-setup/SKILL.md` exists with frontmatter intact
- `.claude/skills/lingui-setup/references/` contains variant files
- `.codex/skills/lingui-setup.md` exists, no frontmatter, has header comment
- `.codex/skills/lingui-setup-vite-swc.md` exists as separate file
- `.cursor/rules/lingui-setup.mdc` exists with MDC frontmatter
- `.cursor/rules/lingui-setup-nextjs-app-router.mdc` has `globs: ["next.config.*"]`
- All 3 skills installed for all 3 agents (9 main files + reference files)

- [ ] **Step 4: Test interactive wizard**

Run: `cd /tmp/e2e-test && node /Users/arturs/Projects/globalize/globalization-skills/cli/bin.mjs`
Expected: Wizard launches, walks through action → skill selection → agent selection → installs

- [ ] **Step 5: Test update command**

Run: `cd /tmp/e2e-test && node /Users/arturs/Projects/globalize/globalization-skills/cli/bin.mjs update lingui-setup`
Expected: Re-fetches from GitHub (no cache), overwrites existing files
