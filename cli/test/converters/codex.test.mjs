import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { install } from '../../converters/codex.mjs';

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
