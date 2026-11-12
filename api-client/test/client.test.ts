import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { register as registerOrgs } from "../src/commands/orgs.js";
import { register as registerWorkflows } from "../src/commands/workflows.js";
import { mockApi, runCli } from "./helpers.js";

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("User-Agent", () => {
  it("is globalize-cli-client/<package version> on every request", async () => {
    const requests = mockApi([
      { method: "GET", path: "/api/workflows", body: [] },
      { method: "GET", path: "/api/orgs", body: [] },
    ]);
    await runCli(registerWorkflows, "workflows", ["list"]);
    await runCli(registerOrgs, "orgs", ["list"]);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.headers.get("user-agent")).toBe(`globalize-cli-client/${version}`);
      expect(request.headers.get("authorization")).toBe("Bearer glb_test");
    }
    // The API records it only when it matches this.
    expect(`globalize-cli-client/${version}`).toMatch(/^globalize-cli-client\/\d+\.\d+\.\d+[\w.+-]{0,64}$/);
  });
});

describe("error messages", () => {
  const list = () => runCli(registerWorkflows, "workflows", ["list"]);

  it("prints a 403 WORKFLOW_GATE_ADMIN_REQUIRED with its code, message and details", async () => {
    const details = { gates: [{ stepIndex: 1 }] };
    mockApi([
      {
        method: "GET",
        path: "/api/workflows",
        status: 403,
        body: {
          code: "WORKFLOW_GATE_ADMIN_REQUIRED",
          message: "Changing a published Gate takes an admin",
          statusCode: 403,
          details,
        },
      },
    ]);
    const { json, exitCode } = await list();
    expect(exitCode).toBe(1);
    expect(json).toEqual({
      error: `WORKFLOW_GATE_ADMIN_REQUIRED: Changing a published Gate takes an admin ${JSON.stringify({ details })}`,
      status: 403,
      code: "WORKFLOW_GATE_ADMIN_REQUIRED",
      details,
    });
  });

  it("prints a 403 FEATURE_REQUIRED with its code", async () => {
    mockApi([
      {
        method: "GET",
        path: "/api/workflows",
        status: 403,
        body: { code: "FEATURE_REQUIRED", message: "Workflows need the workflows feature", statusCode: 403 },
      },
    ]);
    const { json } = await list();
    expect(json.error).toBe("FEATURE_REQUIRED: Workflows need the workflows feature");
  });

  it("still says Authentication failed for a 401", async () => {
    mockApi([
      {
        method: "GET",
        path: "/api/workflows",
        status: 401,
        body: { code: "UNAUTHORIZED", message: "Invalid API key", statusCode: 401 },
      },
    ]);
    const { json } = await list();
    expect(json.error).toMatch(/^Authentication failed/);
  });

  it.each(["FORBIDDEN", "ORG_ACCESS_DENIED"])("says Authentication failed for a 403 %s", async (code) => {
    mockApi([{ method: "GET", path: "/api/workflows", status: 403, body: { code, message: "No", statusCode: 403 } }]);
    const { json } = await list();
    expect(json.error).toMatch(/^Authentication failed/);
  });
});
