import type { Command } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "../src/client.js";
import { createProgram } from "../src/program.js";
import { mockApi } from "./helpers.js";

const PROJECT = "44444444-4444-4444-8444-444444444444";

function exitOverrideAll(command: Command): void {
  command.exitOverride();
  for (const sub of command.commands) exitOverrideAll(sub);
}

/** Runs the whole CLI as `cli.ts` builds it, and answers what it printed. */
async function run(...args: string[]) {
  const program = createProgram(async () => createApiClient("glb_test", "https://api.test"));
  exitOverrideAll(program);
  let stdout = "";
  let stderr = "";
  const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  const err = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
  let thrown: unknown;
  try {
    await program.parseAsync(["node", "cli", ...args]);
  } catch (e) {
    thrown = e;
  } finally {
    out.mockRestore();
    err.mockRestore();
    process.exitCode = undefined;
  }
  return { stdout, stderr, thrown };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("deprecated Project-scoped groups", () => {
  it("glossary --help says to use glossaries", async () => {
    const { stdout } = await run("glossary", "--help");
    // The group's own description, under its usage line.
    expect(stdout).toMatch(/^Usage: .*\n\n\(deprecated: use `glossaries`\)/);
  });

  it("style-guides --help says to use assets", async () => {
    const { stdout } = await run("style-guides", "--help");
    expect(stdout).toMatch(/^Usage: .*\n\n\(deprecated: use `assets`\)/);
  });

  it.each([
    ["glossary", ["list", "create", "bulk", "preview", "delete"]],
    ["style-guides", ["list", "upsert", "delete", "generate", "apply", "quota"]],
  ])("every %s command says it's deprecated in its help", async (group, commands) => {
    for (const command of commands) {
      const { stdout } = await run(group, command, "--help");
      expect(stdout, `${group} ${command}`).toContain("(deprecated: use `");
    }
  });

  it("the top-level help marks them and lists glossaries and assets", async () => {
    const { stdout } = await run("--help");
    expect(stdout).toMatch(/glossary\s+\(deprecated: use `glossaries`\)/);
    expect(stdout).toMatch(/style-guides\s+\(deprecated: use `assets`\)/);
    expect(stdout).toMatch(/\n\s+glossaries\s/);
    expect(stdout).toMatch(/\n\s+assets\s/);
  });
});

describe("glossary and glossaries", () => {
  it("each name runs its own group", async () => {
    const requests = mockApi([
      { method: "GET", path: "/api/glossaries", body: [] },
      { method: "GET", path: `/api/projects/${PROJECT}/glossary`, body: [] },
    ]);
    await run("--json", "glossaries", "list");
    await run("--json", "glossary", "list", "--project-id", PROJECT);
    expect(requests.map((r) => r.path)).toEqual(["/api/glossaries", `/api/projects/${PROJECT}/glossary`]);
  });

  it("a prefix of either is an unknown command, not a match", async () => {
    const requests = mockApi([]);
    const { thrown } = await run("--json", "gloss", "list");
    expect(thrown).toMatchObject({ code: "commander.unknownCommand" });
    expect(requests).toHaveLength(0);
  });
});
