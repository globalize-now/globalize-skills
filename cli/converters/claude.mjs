import fs from "node:fs";
import path from "node:path";

/**
 * Install skill files to .claude/skills/<name>/ (pass-through, no conversion).
 */
export function install({ name, files, targetDir }) {
  const skillDir = path.join(targetDir, ".claude", "skills", name);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(skillDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  return { dir: skillDir, fileCount: Object.keys(files).length };
}
