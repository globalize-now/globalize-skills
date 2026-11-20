import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "../src/commands/assets.js";
import { mockApi, runCli } from "./helpers.js";

const ASSET = "77777777-7777-4777-8777-777777777777";

const assets = (...args: string[]) => runCli(register, "assets", args);

const asset = {
  id: ASSET,
  orgId: "org-1",
  type: "style_guide",
  scope: "per_locale",
  origin: "written",
  name: "Voice",
  createdAt: "2026-11-01T00:00:00.000Z",
};
const listed = {
  ...asset,
  updatedAt: "2026-11-02T00:00:00.000Z",
  locales: ["fr"],
  textLength: null,
  projectCount: 0,
  workflowCount: 1,
  repositoryManaged: null,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assets list", () => {
  it("prints every style guide and context", async () => {
    const requests = mockApi([{ method: "GET", path: "/api/assets", body: [listed] }]);
    const { json, exitCode } = await assets("list");
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: [listed] });
    expect(requests[0].query).toEqual({});
  });

  it.each(["style_guide", "context"])("filters by --type %s", async (type) => {
    const requests = mockApi([{ method: "GET", path: "/api/assets", body: [] }]);
    await assets("list", "--type", type);
    expect(requests[0].query).toEqual({ type });
  });

  it("refuses another --type without calling the API", async () => {
    const requests = mockApi([]);
    await expect(assets("list", "--type", "reference")).rejects.toThrow(/Allowed choices are style_guide, context/);
    expect(requests).toHaveLength(0);
  });
});

describe("assets create, get, rename and delete", () => {
  it("create posts the name, type and scope, and prints the Asset", async () => {
    const requests = mockApi([{ method: "POST", path: "/api/assets", status: 201, body: asset }]);
    const { json, exitCode } = await assets(
      "create",
      "--name",
      "Voice",
      "--type",
      "style_guide",
      "--scope",
      "per_locale",
    );
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: asset });
    expect(requests[0].body).toEqual({ name: "Voice", type: "style_guide", scope: "per_locale" });
  });

  it("create refuses an unknown --scope without calling the API", async () => {
    const requests = mockApi([]);
    await expect(assets("create", "--name", "Voice", "--type", "context", "--scope", "locale")).rejects.toThrow(
      /Allowed choices are global, per_locale/,
    );
    expect(requests).toHaveLength(0);
  });

  it("get prints the Asset with its texts and what uses it", async () => {
    const detail = { ...listed, projects: [], workflows: [], texts: [{ locale: "fr", text: "Tu", updatedAt: "x" }] };
    mockApi([{ method: "GET", path: `/api/assets/${ASSET}`, body: detail }]);
    const { json } = await assets("get", "--id", ASSET);
    expect(json).toEqual({ data: detail });
  });

  it("rename patches the name", async () => {
    const requests = mockApi([{ method: "PATCH", path: `/api/assets/${ASSET}`, body: { ...asset, name: "Tone" } }]);
    const { json } = await assets("rename", "--id", ASSET, "--name", "Tone");
    expect(json).toEqual({ data: { ...asset, name: "Tone" } });
    expect(requests[0].body).toEqual({ name: "Tone" });
  });

  it("delete prints that it deleted", async () => {
    mockApi([{ method: "DELETE", path: `/api/assets/${ASSET}`, status: 204, body: null }]);
    const { json, exitCode } = await assets("delete", "--id", ASSET);
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: { deleted: true } });
  });

  it("delete prints a member's 403 admin refusal with its code", async () => {
    mockApi([
      {
        method: "DELETE",
        path: `/api/assets/${ASSET}`,
        status: 403,
        body: { code: "FORBIDDEN", message: "Admin access required", statusCode: 403 },
      },
    ]);
    const { json, exitCode } = await assets("delete", "--id", ASSET);
    expect(exitCode).toBe(1);
    expect(json).toEqual({ error: "FORBIDDEN: Admin access required", status: 403, code: "FORBIDDEN" });
  });
});

describe("assets set-text", () => {
  const textsPath = `/api/assets/${ASSET}/texts`;
  const written = { locale: "fr", text: "Tutoyez.", updatedAt: "2026-11-03T00:00:00.000Z" };

  it("puts a per-locale text from --text, and prints it", async () => {
    const requests = mockApi([{ method: "PUT", path: textsPath, body: written }]);
    const { json, exitCode } = await assets("set-text", "--id", ASSET, "--locale", "fr", "--text", "Tutoyez.");
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: written });
    expect(requests[0].body).toEqual({ locale: "fr", text: "Tutoyez." });
  });

  it("puts a global text with no locale, read from --file, and invalidates the TM when asked", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "assets-test-")), "context.md");
    writeFileSync(file, "An app for booking climbing gyms.\n");
    const requests = mockApi([{ method: "PUT", path: textsPath, body: { ...written, locale: null } }]);
    await assets("set-text", "--id", ASSET, "--file", file, "--invalidate-tm");
    expect(requests[0].body).toEqual({ text: "An app for booking climbing gyms.\n", invalidateTm: true });
  });

  it.each([[[]], [["--text", "a", "--file", "b"]]])("needs exactly one of --text and --file (%j)", async (args) => {
    const requests = mockApi([]);
    const { json, exitCode } = await assets("set-text", "--id", ASSET, ...args);
    expect(exitCode).toBe(1);
    expect(json.error).toBe("Pass exactly one of --text and --file");
    expect(requests).toHaveLength(0);
  });

  it("prints the server's refusal of a per-locale Asset without a locale", async () => {
    mockApi([
      {
        method: "PUT",
        path: textsPath,
        status: 400,
        body: { code: "BAD_REQUEST", message: "A per-locale Asset's text needs a locale", statusCode: 400 },
      },
    ]);
    const { json, exitCode } = await assets("set-text", "--id", ASSET, "--text", "x");
    expect(exitCode).toBe(1);
    expect(json).toMatchObject({ status: 400, code: "BAD_REQUEST" });
  });
});

describe("assets delete-text", () => {
  it("deletes a locale's text", async () => {
    const requests = mockApi([{ method: "DELETE", path: `/api/assets/${ASSET}/texts`, status: 204, body: null }]);
    const { json, exitCode } = await assets("delete-text", "--id", ASSET, "--locale", "fr");
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: { deleted: true } });
    expect(requests[0].query).toEqual({ locale: "fr" });
  });

  it("deletes a global Asset's text with no locale", async () => {
    const requests = mockApi([{ method: "DELETE", path: `/api/assets/${ASSET}/texts`, status: 204, body: null }]);
    await assets("delete-text", "--id", ASSET);
    expect(requests[0].query).toEqual({});
  });
});
