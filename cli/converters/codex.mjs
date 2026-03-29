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
