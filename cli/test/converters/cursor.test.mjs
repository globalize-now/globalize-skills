import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { install } from "../../converters/cursor.mjs";

describe("cursor converter", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "globalize-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("creates .mdc file with MDC frontmatter", () => {
    const files = {
      "SKILL.md": "---\nname: lingui-setup\ndescription: Set up LinguiJS\n---\n\n# Setup\n\nInstructions.",
    };

    install({ name: "lingui-setup", files, targetDir: tmpDir });

    const outPath = path.join(tmpDir, ".cursor", "rules", "lingui-setup.mdc");
    assert.ok(fs.existsSync(outPath));

    const content = fs.readFileSync(outPath, "utf8");
    assert.ok(content.includes("description: Set up LinguiJS"));
    assert.ok(content.includes("alwaysApply: false"));
    assert.ok(content.includes("# Setup"));
  });

  it("creates variant .mdc files with globs", () => {
    const files = {
      "SKILL.md": "---\nname: lingui-setup\ndescription: Set up LinguiJS\n---\n\n# Setup",
      "references/nextjs-app-router.md": "# Next.js guide",
      "references/vite-swc.md": "# Vite SWC guide",
      "references/vite-babel.md": "# Vite Babel guide",
    };

    install({ name: "lingui-setup", files, targetDir: tmpDir });

    const dir = path.join(tmpDir, ".cursor", "rules");

    // Check Next.js variant has next.config glob
    const nextjs = fs.readFileSync(path.join(dir, "lingui-setup-nextjs-app-router.mdc"), "utf8");
    assert.ok(nextjs.includes('globs: ["next.config.*"]'));

    // Check Vite SWC variant has vite.config glob
    const viteSWC = fs.readFileSync(path.join(dir, "lingui-setup-vite-swc.mdc"), "utf8");
    assert.ok(viteSWC.includes('globs: ["vite.config.*"]'));

    // Check Vite Babel variant has both vite.config and .babelrc globs
    const viteBabel = fs.readFileSync(path.join(dir, "lingui-setup-vite-babel.mdc"), "utf8");
    assert.ok(viteBabel.includes("vite.config.*"));
    assert.ok(viteBabel.includes(".babelrc*"));
  });
});
