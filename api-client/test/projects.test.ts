import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "../src/commands/projects.js";
import { mockApi, runCli } from "./helpers.js";

const PROJECT = "44444444-4444-4444-8444-444444444444";

const projects = (...args: string[]) => runCli(register, "projects", args);

const createdProject = { id: PROJECT, name: "My App", sourceLanguage: "en", targetLanguages: ["fr", "de"] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("projects create", () => {
  it("steers to Workflow setup on stderr, still creates the Project, and keeps --json stdout unchanged", async () => {
    const requests = mockApi([{ method: "POST", path: "/api/projects", status: 201, body: createdProject }]);

    const { stdout, stderr, exitCode, json } = await projects(
      "create",
      "--name",
      "My App",
      "--source-language",
      "en",
      "--target-languages",
      "fr,de",
    );

    expect(stderr).toContain("workflows setup");
    expect(stderr).toMatch(/GitHub repository with no Project/);
    expect(stderr).toContain("npx skills update");

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/api/projects",
      body: { name: "My App", sourceLanguage: "en", targetLanguages: ["fr", "de"] },
    });

    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: createdProject });
    expect(stdout).not.toContain("workflows setup");
    expect(stdout).not.toContain("npx skills update");
  });
});

describe("other projects commands", () => {
  it.each([
    { args: ["list"], method: "GET", path: "/api/projects", body: [createdProject] },
    { args: ["get", "--id", PROJECT], method: "GET", path: `/api/projects/${PROJECT}`, body: createdProject },
    {
      args: ["update", "--id", PROJECT, "--name", "Renamed"],
      method: "PATCH",
      path: `/api/projects/${PROJECT}`,
      body: createdProject,
    },
    { args: ["delete", "--id", PROJECT], method: "DELETE", path: `/api/projects/${PROJECT}`, body: { deleted: true } },
  ])("$args.0 writes nothing to stderr", async ({ args, method, path, body }) => {
    mockApi([{ method, path, body }]);

    const { stderr, exitCode } = await projects(...args);

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
  });
});
