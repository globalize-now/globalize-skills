import fs from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "../lib/frontmatter.mjs";

/** Map variant names to Cursor glob patterns. */
const VARIANT_GLOBS = {
  "nextjs-app-router": ["next.config.*"],
  "nextjs-pages-router": ["next.config.*"],
  "vite-swc": ["vite.config.*"],
  "vite-babel": ["vite.config.*", ".babelrc*"],
};

function mdcFrontmatter({ description, globs }) {
  const globStr = globs ? JSON.stringify(globs) : "";
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
  const dir = path.join(targetDir, ".cursor", "rules");
  fs.mkdirSync(dir, { recursive: true });

  const written = [];

  for (const [relativePath, content] of Object.entries(files)) {
    if (relativePath === "SKILL.md") {
      const { attributes, body } = parseFrontmatter(content);
      const header = mdcFrontmatter({
        description: attributes.description || "",
        globs: null,
      });
      const outPath = path.join(dir, `${name}.mdc`);
      fs.writeFileSync(outPath, header + "\n\n" + body);
      written.push(outPath);
    } else if (relativePath.startsWith("references/")) {
      const variant = path.basename(relativePath, ".md");
      const globs = VARIANT_GLOBS[variant] || [];
      const header = mdcFrontmatter({
        description: `${name} — ${variant} variant`,
        globs: globs.length > 0 ? globs : null,
      });
      const outPath = path.join(dir, `${name}-${variant}.mdc`);
      fs.writeFileSync(outPath, header + "\n\n" + content);
      written.push(outPath);
    }
  }

  return { dir, fileCount: written.length };
}
