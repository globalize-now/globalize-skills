import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "../src/commands/workflows.js";
import { mockApi, runCli } from "./helpers.js";

const WF = "11111111-1111-4111-8111-111111111111";
const RUN = "22222222-2222-4222-8222-222222222222";
const TM = "33333333-3333-4333-8333-333333333333";

const workflows = (...args: string[]) => runCli(register, "workflows", args);

function definition(inputType: "github" | "contentful", declared: string[]) {
  return {
    input: { id: "in-1", type: inputType, config: {} },
    targetLanguages: { declared, discovery: false },
    steps: [{ id: "s-1" }],
    outputs: [{ id: "o-1" }],
    assets: { source: "repository" },
  };
}

function workflowDetail(inputType: "github" | "contentful", number: number, declared: string[]) {
  return {
    id: WF,
    name: "acme/web",
    currentVersion: { id: "v", number, definition: definition(inputType, declared) },
  };
}

/** A run the API reports: completed, its GitHub Output failed to deliver. */
const completedUndeliveredRun = {
  id: RUN,
  workflowId: WF,
  number: 4,
  status: "completed",
  version: { id: "v", number: 2 },
  trigger: { kind: "manual", branch: "main", commit: "abc", delivery: "pr", requestedBy: null },
  failure: null,
  lanes: [
    {
      locale: "fr",
      status: "completed",
      steps: [
        {
          actions: [
            { type: "translate", progress: { done: 10, total: 12, failed: 2 } },
            { type: "qa", progress: { done: 99, total: 99, failed: 0 } },
          ],
        },
        { actions: [{ type: "translate", progress: { done: 3, total: 3, failed: 0 } }] },
      ],
    },
  ],
  outputs: [
    {
      id: "o-1",
      type: "github",
      attempts: 1,
      outcome: { status: "failed", trigger: "initial", branch: "main", method: "pr", error: "boom" },
    },
  ],
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:05:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("workflows preview-setup", () => {
  it("posts the repository and every override, and prints the preview", async () => {
    const preview = { ready: true, previewHash: "h1", name: "acme/web" };
    const requests = mockApi([{ method: "POST", path: "/api/workflows/setup/preview", body: preview }]);

    const patterns = [
      { pattern: "_locales/{locale}/messages.json", format: "chrome-messages", pathLocales: { "pt-BR": "pt_BR" } },
    ];
    const { json, exitCode } = await workflows(
      "preview-setup",
      "--installation-id",
      "42",
      "--repository",
      "acme/web",
      "--branches",
      "main, develop",
      "--patterns",
      JSON.stringify(patterns),
      "--source-language",
      "en",
      "--target-languages",
      "fr,de",
      "--name",
      "Web",
      "--translation-memory-id",
      TM,
      "--import",
      "reviewed",
    );

    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: preview });
    expect(requests).toHaveLength(1);
    expect(requests[0].body).toEqual({
      installationId: 42,
      repository: "acme/web",
      branches: ["main", "develop"],
      patterns,
      sourceLanguage: "en",
      targetLanguages: ["fr", "de"],
      name: "Web",
      translationMemoryId: TM,
      import: "reviewed",
    });
  });

  it("sends only what was given", async () => {
    const requests = mockApi([
      { method: "POST", path: "/api/workflows/setup/preview", body: { ready: false, needs: [] } },
    ]);
    await workflows("preview-setup", "--installation-id", "42", "--repository", "acme/web");
    expect(requests[0].body).toEqual({ installationId: 42, repository: "acme/web" });
  });

  it("refuses --patterns that isn't a JSON array, sending nothing", async () => {
    const requests = mockApi([]);
    const { json, exitCode } = await workflows(
      "preview-setup",
      "--installation-id",
      "42",
      "--repository",
      "acme/web",
      "--patterns",
      '{"pattern":"x"}',
    );
    expect(exitCode).toBe(1);
    expect(json.error).toMatch(/--patterns must be a JSON array/);
    expect(requests).toHaveLength(0);
  });

  it("prints a 409 REPOSITORY_HELD_BY_PROJECT with its code and details", async () => {
    const refusal = {
      code: "REPOSITORY_HELD_BY_PROJECT",
      message: "Project Web translates acme/web: continue with the Project tools",
      statusCode: 409,
      details: { projectId: "p-1", projectName: "Web", repositoryId: "r-1" },
    };
    mockApi([{ method: "POST", path: "/api/workflows/setup/preview", status: 409, body: refusal }]);
    const { json, exitCode } = await workflows("preview-setup", "--installation-id", "42", "--repository", "acme/web");
    expect(exitCode).toBe(1);
    expect(json).toEqual({
      error: `Error: ${JSON.stringify(refusal)}`,
      status: 409,
      code: "REPOSITORY_HELD_BY_PROJECT",
      details: refusal.details,
    });
  });
});

describe("workflows setup", () => {
  it("posts the same body plus the previewHash", async () => {
    const setUp = { workflow: { id: WF, name: "acme/web" } };
    const requests = mockApi([{ method: "POST", path: "/api/workflows/setup", status: 201, body: setUp }]);
    const { json, exitCode } = await workflows(
      "setup",
      "--installation-id",
      "42",
      "--repository",
      "acme/web",
      "--target-languages",
      "fr",
      "--preview-hash",
      "h1",
    );
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: setUp });
    expect(requests[0].body).toEqual({
      installationId: 42,
      repository: "acme/web",
      targetLanguages: ["fr"],
      previewHash: "h1",
    });
  });

  it("prints a stale preview's code", async () => {
    mockApi([
      {
        method: "POST",
        path: "/api/workflows/setup",
        status: 409,
        body: { code: "WORKFLOW_PREVIEW_STALE", message: "Changed since the preview", statusCode: 409 },
      },
    ]);
    const { json } = await workflows(
      "setup",
      "--installation-id",
      "42",
      "--repository",
      "acme/web",
      "--preview-hash",
      "h1",
    );
    expect(json.code).toBe("WORKFLOW_PREVIEW_STALE");
  });

  it("requires --preview-hash", async () => {
    mockApi([]);
    await expect(workflows("setup", "--installation-id", "42", "--repository", "acme/web")).rejects.toThrow(
      /--preview-hash/,
    );
  });
});

describe("workflows list / get", () => {
  it("lists Workflows", async () => {
    const list = [{ id: WF, name: "acme/web" }];
    const requests = mockApi([{ method: "GET", path: "/api/workflows", body: list }]);
    const { json } = await workflows("list");
    expect(json).toEqual({ data: list });
    expect(requests[0].method).toBe("GET");
  });

  it("gets one Workflow", async () => {
    const detail = workflowDetail("github", 3, ["fr"]);
    mockApi([{ method: "GET", path: `/api/workflows/${WF}`, body: detail }]);
    const { json } = await workflows("get", "--id", WF);
    expect(json).toEqual({ data: detail });
  });
});

describe("workflows languages", () => {
  it("publishes the current version's definition with only the declared targets changed, passing baseVersion", async () => {
    const published = { published: true, workflow: { id: WF } };
    const requests = mockApi([
      { method: "GET", path: `/api/workflows/${WF}`, body: workflowDetail("github", 3, ["fr"]) },
      { method: "PUT", path: `/api/workflows/${WF}/definition`, body: published },
    ]);
    const { json, exitCode } = await workflows("languages", "--id", WF, "--target-languages", "fr,de,ja");
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: published });
    const put = requests.find((r) => r.method === "PUT")!;
    expect(put.query).toEqual({ baseVersion: "3" });
    expect(put.body).toEqual({
      ...definition("github", []),
      targetLanguages: { declared: ["fr", "de", "ja"], discovery: false },
    });
  });

  it("starts from --base-version when given", async () => {
    const requests = mockApi([
      {
        method: "GET",
        path: `/api/workflows/${WF}/versions/2`,
        body: { id: "v2", number: 2, definition: definition("github", ["fr"]) },
      },
      { method: "PUT", path: `/api/workflows/${WF}/definition`, body: { published: true } },
    ]);
    await workflows("languages", "--id", WF, "--target-languages", "de", "--base-version", "2");
    expect(requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      `GET /api/workflows/${WF}/versions/2`,
      `PUT /api/workflows/${WF}/definition`,
    ]);
    expect(requests[1].query).toEqual({ baseVersion: "2" });
  });

  it("prints a stale base version's code", async () => {
    mockApi([
      { method: "GET", path: `/api/workflows/${WF}`, body: workflowDetail("github", 3, ["fr"]) },
      {
        method: "PUT",
        path: `/api/workflows/${WF}/definition`,
        status: 409,
        body: { code: "WORKFLOW_BASE_VERSION_STALE", message: "Version 4 was published since", statusCode: 409 },
      },
    ]);
    const { json, exitCode } = await workflows("languages", "--id", WF, "--target-languages", "de");
    expect(exitCode).toBe(1);
    expect(json.code).toBe("WORKFLOW_BASE_VERSION_STALE");
  });
});

describe("workflows runs", () => {
  it("start delivers a GitHub Workflow by pull request unless told otherwise", async () => {
    const requests = mockApi([
      { method: "GET", path: `/api/workflows/${WF}`, body: workflowDetail("github", 2, ["fr"]) },
      { method: "POST", path: `/api/workflows/${WF}/runs`, status: 201, body: completedUndeliveredRun },
    ]);
    const { json, exitCode } = await workflows("runs", "start", "--workflow-id", WF);
    expect(exitCode).toBe(0);
    expect(requests.find((r) => r.method === "POST")!.body).toEqual({ delivery: "pr" });
    expect(json.data.id).toBe(RUN);
  });

  it("start passes --delivery push and --branch without reading the Workflow", async () => {
    const requests = mockApi([
      { method: "POST", path: `/api/workflows/${WF}/runs`, status: 201, body: completedUndeliveredRun },
    ]);
    await workflows("runs", "start", "--workflow-id", WF, "--delivery", "push", "--branch", "develop");
    expect(requests).toHaveLength(1);
    expect(requests[0].body).toEqual({ branch: "develop", delivery: "push" });
  });

  it("start sends no delivery for a Contentful Workflow", async () => {
    const requests = mockApi([
      { method: "GET", path: `/api/workflows/${WF}`, body: workflowDetail("contentful", 1, ["fr"]) },
      { method: "POST", path: `/api/workflows/${WF}/runs`, status: 201, body: completedUndeliveredRun },
    ]);
    await workflows("runs", "start", "--workflow-id", WF);
    expect(requests.find((r) => r.method === "POST")!.body).toEqual({});
  });

  it("start prints a 402 out of credit with its code", async () => {
    mockApi([
      {
        method: "POST",
        path: `/api/workflows/${WF}/runs`,
        status: 402,
        body: { code: "INSUFFICIENT_CREDITS", message: "Out of credits", statusCode: 402 },
      },
    ]);
    const { json, exitCode } = await workflows("runs", "start", "--workflow-id", WF, "--delivery", "pr");
    expect(exitCode).toBe(1);
    expect(json).toMatchObject({ status: 402, code: "INSUFFICIENT_CREDITS" });
  });

  it("get reports a completed run whose Output failed as completed, with no pull request", async () => {
    mockApi([{ method: "GET", path: `/api/workflow-runs/${RUN}`, body: completedUndeliveredRun }]);
    const { json } = await workflows("runs", "get", "--id", RUN);
    expect(json.data).toEqual({
      id: RUN,
      workflowId: WF,
      number: 4,
      status: "completed",
      versionNumber: 2,
      trigger: { kind: "manual", branch: "main", commit: "abc", delivery: "pr" },
      failure: null,
      languages: [{ locale: "fr", status: "completed", done: 13, total: 15, failed: 2 }],
      outputs: [{ id: "o-1", type: "github", outcome: completedUndeliveredRun.outputs[0].outcome }],
      pullRequestUrl: null,
      createdAt: "2026-11-01T00:00:00.000Z",
      updatedAt: "2026-11-01T00:05:00.000Z",
    });
  });

  it("get reports the pull request a delivered GitHub Output opened", async () => {
    const delivered = {
      ...completedUndeliveredRun,
      outputs: [
        {
          id: "o-1",
          type: "github",
          attempts: 1,
          outcome: {
            status: "delivered",
            trigger: "initial",
            branch: "main",
            method: "pr",
            noChanges: false,
            pullRequest: { number: 7, url: "https://github.com/acme/web/pull/7", outcome: "created" },
          },
        },
      ],
    };
    mockApi([{ method: "GET", path: `/api/workflow-runs/${RUN}`, body: delivered }]);
    const { json } = await workflows("runs", "get", "--id", RUN);
    expect(json.data.pullRequestUrl).toBe("https://github.com/acme/web/pull/7");
  });

  it("get --full prints the run as the API answered", async () => {
    mockApi([{ method: "GET", path: `/api/workflow-runs/${RUN}`, body: completedUndeliveredRun }]);
    const { json } = await workflows("runs", "get", "--id", RUN, "--full");
    expect(json.data).toEqual(completedUndeliveredRun);
  });

  it("list summarises each run and keeps the pagination", async () => {
    const pagination = { total: 9, limit: 1, hasMore: true, cursor: "c2" };
    const requests = mockApi([
      { method: "GET", path: `/api/workflows/${WF}/runs`, body: { data: [completedUndeliveredRun], pagination } },
    ]);
    const { json } = await workflows("runs", "list", "--workflow-id", WF, "--limit", "1", "--cursor", "c1");
    expect(requests[0].query).toEqual({ limit: "1", cursor: "c1" });
    expect(json.data.pagination).toEqual(pagination);
    expect(json.data.data[0]).toMatchObject({ id: RUN, status: "completed", pullRequestUrl: null });
  });
});
