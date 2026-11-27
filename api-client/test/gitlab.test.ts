import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "../src/commands/gitlab.js";
import { mockApi, runCli } from "./helpers.js";

const CONNECTION = "44444444-4444-4444-8444-444444444444";

const gitlab = (...args: string[]) => runCli(register, "gitlab", args);

const connection = {
  id: CONNECTION,
  username: "jane",
  gitlabUserId: 7,
  status: "active",
  createdAt: "2026-11-01T00:00:00.000Z",
};

const repository = {
  id: 1234,
  name: "web",
  pathWithNamespace: "acme/platform/web",
  defaultBranch: "main",
  httpUrlToRepo: "https://gitlab.com/acme/platform/web.git",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gitlab connections", () => {
  it("list prints the organisation's connections", async () => {
    const requests = mockApi([{ method: "GET", path: "/api/gitlab/connections", body: [connection] }]);
    const { json, exitCode } = await gitlab("connections", "list");
    expect(exitCode).toBe(0);
    expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual(["GET /api/gitlab/connections"]);
    expect(json.data).toEqual([connection]);
  });

  it("lists when given no subcommand, as before it took subcommands", async () => {
    mockApi([{ method: "GET", path: "/api/gitlab/connections", body: [connection] }]);
    const { json, exitCode } = await gitlab("connections");
    expect(exitCode).toBe(0);
    expect(json.data).toEqual([connection]);
  });

  it("connect --no-wait prints the URL to authorise and the nonce, without polling", async () => {
    const started = { installUrl: "https://gitlab.com/oauth/authorize?x", nonce: "n-1", expiresIn: 600 };
    const requests = mockApi([{ method: "POST", path: "/api/gitlab/cli-install", body: started }]);
    const { json, exitCode } = await gitlab("connections", "connect", "--no-wait");
    expect(exitCode).toBe(0);
    expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual(["POST /api/gitlab/cli-install"]);
    expect(json.data).toEqual(started);
  });

  it("install-status polls the nonce once", async () => {
    const completed = { status: "completed", connectionId: CONNECTION, username: "jane" };
    const requests = mockApi([{ method: "GET", path: "/api/gitlab/cli-install/status", body: completed }]);
    const { json } = await gitlab("install-status", "--nonce", "n-1");
    expect(requests[0].query).toEqual({ nonce: "n-1" });
    expect(json.data).toEqual(completed);
  });
});

describe("gitlab repositories list", () => {
  it("lists the connection's repositories", async () => {
    const requests = mockApi([
      { method: "GET", path: `/api/gitlab/connections/${CONNECTION}/projects`, body: [repository] },
    ]);
    const { json, exitCode } = await gitlab("repositories", "list", "--connection-id", CONNECTION);
    expect(exitCode).toBe(0);
    expect(requests[0].query).toEqual({});
    expect(json.data).toEqual([repository]);
  });

  it("passes --search to the API", async () => {
    const requests = mockApi([
      { method: "GET", path: `/api/gitlab/connections/${CONNECTION}/projects`, body: [repository] },
    ]);
    await gitlab("repositories", "list", "--connection-id", CONNECTION, "--search", "platform/web");
    expect(requests[0].query).toEqual({ search: "platform/web" });
  });

  it("prints a refusal with its code", async () => {
    const refusal = { code: "NOT_FOUND", message: "GitLab connection not found", statusCode: 404 };
    mockApi([{ method: "GET", path: `/api/gitlab/connections/${CONNECTION}/projects`, status: 404, body: refusal }]);
    const { json, exitCode } = await gitlab("repositories", "list", "--connection-id", CONNECTION);
    expect(exitCode).toBe(1);
    expect(json.code).toBe("NOT_FOUND");
  });
});

describe("gitlab branches", () => {
  it("refuses a non-numeric project id, sending nothing", async () => {
    const requests = mockApi([]);
    const { json, exitCode } = await gitlab("branches", "--connection-id", CONNECTION, "--project-id", "acme/web");
    expect(exitCode).toBe(1);
    expect(json.error).toMatch(/Invalid GitLab project id/);
    expect(requests).toHaveLength(0);
  });
});
