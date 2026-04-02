import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { install } from "../../converters/claude.mjs";

describe("claude converter", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "globalize-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("installs SKILL.md and references to .claude/skills/<name>/", () => {
    const files = {
      "SKILL.md": "---\nname: lingui-setup\n---\n\n# Setup",
      "references/vite-swc.md": "# Vite SWC guide",
      "references/nextjs-app-router.md": "# Next.js guide",
    };

    install({ name: "lingui-setup", files, targetDir: tmpDir });

    const skillDir = path.join(tmpDir, ".claude", "skills", "lingui-setup");
    assert.ok(fs.existsSync(path.join(skillDir, "SKILL.md")));
    assert.ok(fs.existsSync(path.join(skillDir, "references", "vite-swc.md")));
    assert.ok(fs.existsSync(path.join(skillDir, "references", "nextjs-app-router.md")));

    const content = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
    assert.ok(content.includes("# Setup"));
  });
});
