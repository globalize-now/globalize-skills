import fs from "node:fs";
import path from "node:path";

const CODEX_HEADER = "<!-- Installed by globalize-skills -->";

function readdirSafe(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function detectClaude(targetDir) {
  const dir = path.join(targetDir, ".claude", "skills");
  return readdirSafe(dir).filter((name) =>
    fs.existsSync(path.join(dir, name, "SKILL.md"))
  );
}

function detectCodex(targetDir, availableSkillNames) {
  const dir = path.join(targetDir, ".codex", "skills");
  const names = new Set();
  for (const file of readdirSafe(dir)) {
    if (!file.endsWith(".md")) continue;
    const fullPath = path.join(dir, file);
    let content;
    try {
      content = fs.readFileSync(fullPath, "utf8");
    } catch {
      continue;
    }
    if (!content.startsWith(CODEX_HEADER)) continue;
    const base = file.slice(0, -3);
    if (availableSkillNames.has(base)) {
      names.add(base);
    } else {
      const matched = [...availableSkillNames].find(
        (skill) => base === skill || base.startsWith(skill + "-")
      );
      if (matched) names.add(matched);
    }
  }
  return [...names];
}

function detectCursor(targetDir, availableSkillNames) {
  const dir = path.join(targetDir, ".cursor", "rules");
  const names = new Set();
  for (const file of readdirSafe(dir)) {
    if (!file.endsWith(".mdc")) continue;
    const base = file.slice(0, -4);
    if (availableSkillNames.has(base)) {
      names.add(base);
    } else {
      const matched = [...availableSkillNames].find(
        (skill) => base.startsWith(skill + "-")
      );
      if (matched) names.add(matched);
    }
  }
  return [...names];
}

export function detectInstalledSkills(targetDir, { availableSkillNames }) {
  const skillSet = availableSkillNames instanceof Set ? availableSkillNames : new Set(availableSkillNames);
  return new Set([
    ...detectClaude(targetDir),
    ...detectCodex(targetDir, skillSet),
    ...detectCursor(targetDir, skillSet),
  ]);
}

export function uninstallClaude(name, targetDir) {
  const dir = path.join(targetDir, ".claude", "skills", name);
  fs.rmSync(dir, { recursive: true, force: true });
}

export function uninstallCodex(name, targetDir) {
  const dir = path.join(targetDir, ".codex", "skills");
  for (const file of readdirSafe(dir)) {
    if (file === `${name}.md` || (file.startsWith(`${name}-`) && file.endsWith(".md"))) {
      fs.rmSync(path.join(dir, file), { force: true });
    }
  }
}

export function uninstallCursor(name, targetDir) {
  const dir = path.join(targetDir, ".cursor", "rules");
  for (const file of readdirSafe(dir)) {
    if (file === `${name}.mdc` || (file.startsWith(`${name}-`) && file.endsWith(".mdc"))) {
      fs.rmSync(path.join(dir, file), { force: true });
    }
  }
}

const UNINSTALLERS = { claude: uninstallClaude, codex: uninstallCodex, cursor: uninstallCursor };

export function uninstallSkill(name, targetDir, agents) {
  for (const agent of agents) {
    UNINSTALLERS[agent]?.(name, targetDir);
  }
}
