import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { detectAgents } from "../lib/detect.mjs";

describe("detectAgents", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "globalize-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("detects Claude Code from .claude/ directory", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude"));
    const agents = detectAgents(tmpDir);
    assert.ok(agents.includes("claude"));
  });

  it("detects Codex from .codex/ directory", () => {
    fs.mkdirSync(path.join(tmpDir, ".codex"));
    const agents = detectAgents(tmpDir);
    assert.ok(agents.includes("codex"));
  });

  it("detects Codex from AGENTS.md file", () => {
    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "# Agents");
    const agents = detectAgents(tmpDir);
    assert.ok(agents.includes("codex"));
  });

  it("detects Cursor from .cursor/ directory", () => {
    fs.mkdirSync(path.join(tmpDir, ".cursor"));
    const agents = detectAgents(tmpDir);
    assert.ok(agents.includes("cursor"));
  });

  it("detects multiple agents", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude"));
    fs.mkdirSync(path.join(tmpDir, ".cursor"));
    const agents = detectAgents(tmpDir);
    assert.deepEqual(agents.sort(), ["claude", "cursor"]);
  });

  it("defaults to claude when nothing detected", () => {
    const agents = detectAgents(tmpDir);
    assert.deepEqual(agents, ["claude"]);
  });
});
