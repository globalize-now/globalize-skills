import tty from "node:tty";
import { describe, expect, it, vi } from "vitest";

// chalk decides colour support once, when it is first imported, from `tty.isatty`
// and the environment. Fake a terminal on stdout with stderr piped (an agent
// capturing stderr while a human watches stdout, or `2>log`) before anything in
// this file imports chalk, so every import below sees it.
vi.spyOn(tty, "isatty").mockImplementation((fd: number) => fd === 1);
vi.stubEnv("TERM", "xterm-256color");
for (const name of ["FORCE_COLOR", "CI", "NO_COLOR"]) vi.stubEnv(name, undefined);

const ESC = "\x1b";

describe("notices on a piped stderr", () => {
  it("carry no ANSI codes when stdout is a terminal and stderr is not", async () => {
    const { default: chalk } = await import("chalk");
    // The scenario is only meaningful while stdout itself would be coloured.
    expect(chalk.level).toBeGreaterThan(0);

    const { register } = await import("../src/commands/projects.js");
    const { mockApi, runCli } = await import("./helpers.js");
    mockApi([{ method: "POST", path: "/api/projects", status: 201, body: { id: "p" } }]);

    const { stderr } = await runCli(register, "projects", [
      "create",
      "--name",
      "My App",
      "--source-language",
      "en",
      "--target-languages",
      "fr",
    ]);

    expect(stderr).toContain("workflows setup");
    expect(stderr).not.toContain(ESC);
  });
});
