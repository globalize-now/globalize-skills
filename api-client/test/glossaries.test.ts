import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "../src/commands/glossaries.js";
import { mockApi, runCli } from "./helpers.js";

const GLOSSARY = "55555555-5555-4555-8555-555555555555";
const ENTRY = "66666666-6666-4666-8666-666666666666";

const glossaries = (...args: string[]) => runCli(register, "glossaries", args);

const glossary = {
  id: GLOSSARY,
  orgId: "org-1",
  name: "Product terms",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-02T00:00:00.000Z",
  termCount: 1,
  locales: ["en", "fr"],
  attachedProjectCount: 0,
  workflowCount: 1,
  repositoryManaged: null,
};

const entry = {
  id: ENTRY,
  glossaryId: GLOSSARY,
  sourceLanguage: { id: null, locale: "en", name: "English" },
  sourceTerm: "sign in",
  description: "Authenticating into an account",
  forbiddenVariants: ["log in", "login"],
  doNotTranslate: false,
  targets: [{ targetLanguage: { id: null, locale: "fr", name: "French" }, targetTerm: "se connecter" }],
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("glossaries list", () => {
  it("prints the organisation's glossaries", async () => {
    const requests = mockApi([{ method: "GET", path: "/api/glossaries", body: [glossary] }]);
    const { json, exitCode } = await glossaries("list");
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: [glossary] });
    expect(requests).toHaveLength(1);
  });
});

describe("glossaries create, get, rename and delete", () => {
  it("create posts the name and prints the created glossary", async () => {
    const created = { id: GLOSSARY, orgId: "org-1", name: "Product terms", createdAt: "2026-11-01T00:00:00.000Z" };
    const requests = mockApi([{ method: "POST", path: "/api/glossaries", status: 201, body: created }]);
    const { json, exitCode } = await glossaries("create", "--name", "Product terms");
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: created });
    expect(requests[0].body).toEqual({ name: "Product terms" });
  });

  it("get prints the glossary with the Projects and Workflows using it", async () => {
    const detail = { ...glossary, projects: [], workflows: [{ id: "wf-1", name: "acme/web" }] };
    mockApi([{ method: "GET", path: `/api/glossaries/${GLOSSARY}`, body: detail }]);
    const { json, exitCode } = await glossaries("get", "--id", GLOSSARY);
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: detail });
  });

  it("rename patches the name", async () => {
    const renamed = { id: GLOSSARY, orgId: "org-1", name: "Terms", createdAt: "2026-11-01T00:00:00.000Z" };
    const requests = mockApi([{ method: "PATCH", path: `/api/glossaries/${GLOSSARY}`, body: renamed }]);
    const { json } = await glossaries("rename", "--id", GLOSSARY, "--name", "Terms");
    expect(json).toEqual({ data: renamed });
    expect(requests[0].body).toEqual({ name: "Terms" });
  });

  it("delete prints that it deleted", async () => {
    const requests = mockApi([{ method: "DELETE", path: `/api/glossaries/${GLOSSARY}`, status: 204, body: null }]);
    const { json, exitCode } = await glossaries("delete", "--id", GLOSSARY);
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: { deleted: true } });
    expect(requests).toHaveLength(1);
  });

  it("delete prints a member's 403 admin refusal with its code, not as an authentication failure", async () => {
    mockApi([
      {
        method: "DELETE",
        path: `/api/glossaries/${GLOSSARY}`,
        status: 403,
        body: { code: "FORBIDDEN", message: "Admin access required", statusCode: 403 },
      },
    ]);
    const { json, exitCode } = await glossaries("delete", "--id", GLOSSARY);
    expect(exitCode).toBe(1);
    expect(json).toEqual({ error: "FORBIDDEN: Admin access required", status: 403, code: "FORBIDDEN" });
  });
});

describe("glossaries entries", () => {
  const page = { data: [entry], pagination: { total: 1, limit: 50, hasMore: false } };

  it("prints the entries with their description, forbidden variants, do-not-translate and targets", async () => {
    const requests = mockApi([{ method: "GET", path: `/api/glossaries/${GLOSSARY}/entries`, body: page }]);
    const { json, exitCode } = await glossaries("entries", "--id", GLOSSARY);
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: page });
    expect(requests[0].query).toEqual({});
  });

  it("passes every filter and the page", async () => {
    const requests = mockApi([{ method: "GET", path: `/api/glossaries/${GLOSSARY}/entries`, body: page }]);
    await glossaries(
      "entries",
      "--id",
      GLOSSARY,
      "--query",
      "sign",
      "--spelling",
      "login",
      "--source-locale",
      "en",
      "--target-locale",
      "fr",
      "--limit",
      "10",
      "--cursor",
      "c1",
    );
    expect(requests[0].query).toEqual({
      q: "sign",
      spelling: "login",
      sourceLocale: "en",
      targetLocale: "fr",
      limit: "10",
      cursor: "c1",
    });
  });

  it("refuses a --limit that isn't a number without calling the API", async () => {
    const requests = mockApi([]);
    const { json, exitCode } = await glossaries("entries", "--id", GLOSSARY, "--limit", "ten");
    expect(exitCode).toBe(1);
    expect(json).toEqual({ error: "Invalid number for --limit: ten" });
    expect(requests).toHaveLength(0);
  });
});

describe("glossaries add-term", () => {
  const entriesPath = `/api/glossaries/${GLOSSARY}/entries`;

  it("posts the term, its description, forbidden variants and each target, and prints the entry", async () => {
    const requests = mockApi([{ method: "POST", path: entriesPath, status: 201, body: entry }]);
    const { json, exitCode } = await glossaries(
      "add-term",
      "--id",
      GLOSSARY,
      "--source-term",
      "sign in",
      "--source-locale",
      "en",
      "--description",
      "Authenticating into an account",
      "--forbid",
      "log in",
      "--forbid",
      "login",
      "--target",
      "fr=se connecter",
      "--target",
      "de=anmelden",
    );
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: entry });
    expect(requests[0].body).toEqual({
      sourceTerm: "sign in",
      sourceLocale: "en",
      description: "Authenticating into an account",
      forbiddenVariants: ["log in", "login"],
      targets: { fr: "se connecter", de: "anmelden" },
    });
  });

  it("refuses a target locale given twice without calling the API", async () => {
    const requests = mockApi([]);
    const { json, exitCode } = await glossaries(
      "add-term",
      "--id",
      GLOSSARY,
      "--source-term",
      "sign in",
      "--source-locale",
      "en",
      "--target",
      "fr=se connecter",
      "--target",
      " fr=s'identifier",
    );
    expect(exitCode).toBe(1);
    expect(json.error).toBe("--target names fr twice");
    expect(requests).toHaveLength(0);
  });

  it("keeps an = inside a target term", async () => {
    const requests = mockApi([{ method: "POST", path: entriesPath, status: 201, body: entry }]);
    await glossaries(
      "add-term",
      "--id",
      GLOSSARY,
      "--source-term",
      "a=b",
      "--source-locale",
      "en",
      "--target",
      "fr=a=b",
    );
    expect(requests[0].body).toEqual({ sourceTerm: "a=b", sourceLocale: "en", targets: { fr: "a=b" } });
  });

  it("adds a do-not-translate entry with no targets", async () => {
    const requests = mockApi([{ method: "POST", path: entriesPath, status: 201, body: entry }]);
    await glossaries(
      "add-term",
      "--id",
      GLOSSARY,
      "--source-term",
      "Globalize",
      "--source-locale",
      "en",
      "--do-not-translate",
    );
    expect(requests[0].body).toEqual({ sourceTerm: "Globalize", sourceLocale: "en", doNotTranslate: true });
  });

  it.each(["fr", "=se connecter", "fr="])("refuses --target %s without calling the API", async (target) => {
    const requests = mockApi([]);
    const { json, exitCode } = await glossaries(
      "add-term",
      "--id",
      GLOSSARY,
      "--source-term",
      "sign in",
      "--source-locale",
      "en",
      "--target",
      target,
    );
    expect(exitCode).toBe(1);
    expect(json.error).toBe(`--target takes <locale>=<term>, got: ${target}`);
    expect(requests).toHaveLength(0);
  });

  it("prints a 409 GLOSSARY_ENTRY_EXISTS with the existing entry in details", async () => {
    const details = { entryId: ENTRY };
    mockApi([
      {
        method: "POST",
        path: entriesPath,
        status: 409,
        body: { code: "GLOSSARY_ENTRY_EXISTS", message: "The glossary already holds it", statusCode: 409, details },
      },
    ]);
    const { json, exitCode } = await glossaries(
      "add-term",
      "--id",
      GLOSSARY,
      "--source-term",
      "sign in",
      "--source-locale",
      "en",
    );
    expect(exitCode).toBe(1);
    expect(json).toMatchObject({ status: 409, code: "GLOSSARY_ENTRY_EXISTS", details });
  });
});

describe("glossaries edit-entry", () => {
  const entryPath = `/api/glossaries/${GLOSSARY}/entries/${ENTRY}`;
  const edit = (...args: string[]) => glossaries("edit-entry", "--id", GLOSSARY, "--entry-id", ENTRY, ...args);

  it("patches only what was given, and prints the entry", async () => {
    const requests = mockApi([{ method: "PATCH", path: entryPath, body: entry }]);
    const { json, exitCode } = await edit("--source-term", "sign in");
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: entry });
    expect(requests[0].body).toEqual({ sourceTerm: "sign in" });
  });

  it("sets the description, replaces the forbidden variants, and sets and removes targets", async () => {
    const requests = mockApi([{ method: "PATCH", path: entryPath, body: entry }]);
    await edit(
      "--description",
      "Authenticating",
      "--forbid",
      "login",
      "--target",
      "fr=se connecter",
      "--remove-target",
      "de",
      "--remove-target",
      "es",
    );
    expect(requests[0].body).toEqual({
      description: "Authenticating",
      forbiddenVariants: ["login"],
      targets: { fr: "se connecter", de: null, es: null },
    });
  });

  it("clears the description and the forbidden variants", async () => {
    const requests = mockApi([{ method: "PATCH", path: entryPath, body: entry }]);
    await edit("--clear-description", "--clear-forbidden");
    expect(requests[0].body).toEqual({ description: null, forbiddenVariants: [] });
  });

  it("turns do-not-translate on, and off", async () => {
    const requests = mockApi([{ method: "PATCH", path: entryPath, body: entry }]);
    await edit("--do-not-translate");
    await edit("--translate", "--target", "fr=se connecter");
    expect(requests[0].body).toEqual({ doNotTranslate: true });
    expect(requests[1].body).toEqual({ doNotTranslate: false, targets: { fr: "se connecter" } });
  });

  it.each([
    ["--description", "x", "--clear-description"],
    ["--forbid", "x", "--clear-forbidden"],
    ["--do-not-translate", "--translate"],
  ])("refuses %s with its opposite without calling the API", async (...args) => {
    const requests = mockApi([]);
    await expect(edit(...args)).rejects.toThrow(/cannot be used with/);
    expect(requests).toHaveLength(0);
  });

  it("refuses an edit naming no change without calling the API", async () => {
    const requests = mockApi([]);
    const { json, exitCode } = await edit();
    expect(exitCode).toBe(1);
    expect(json.error).toMatch(/^Nothing to change: pass at least one of --source-term, /);
    expect(requests).toHaveLength(0);
  });

  it("refuses a target locale given twice without calling the API", async () => {
    const requests = mockApi([]);
    const { json, exitCode } = await edit("--target", "fr=se connecter", "--target", "fr=s'identifier");
    expect(exitCode).toBe(1);
    expect(json.error).toBe("--target names fr twice");
    expect(requests).toHaveLength(0);
  });

  it("refuses a locale both set and removed without calling the API", async () => {
    const requests = mockApi([]);
    const { json, exitCode } = await edit("--target", "fr=se connecter", "--remove-target", "fr");
    expect(exitCode).toBe(1);
    expect(json.error).toBe("--target and --remove-target both name fr");
    expect(requests).toHaveLength(0);
  });

  it("prints a 409 GLOSSARY_SPELLING_TAKEN naming the entry that claims it", async () => {
    const details = { entryId: "other", sourceTerm: "log in" };
    mockApi([
      {
        method: "PATCH",
        path: entryPath,
        status: 409,
        body: { code: "GLOSSARY_SPELLING_TAKEN", message: "Taken", statusCode: 409, details },
      },
    ]);
    const { json, exitCode } = await edit("--forbid", "log in");
    expect(exitCode).toBe(1);
    expect(json).toMatchObject({ status: 409, code: "GLOSSARY_SPELLING_TAKEN", details });
  });
});

describe("glossaries delete-entry", () => {
  it("deletes the whole entry", async () => {
    const requests = mockApi([
      { method: "DELETE", path: `/api/glossaries/${GLOSSARY}/entries/${ENTRY}`, status: 204, body: null },
    ]);
    const { json, exitCode } = await glossaries("delete-entry", "--id", GLOSSARY, "--entry-id", ENTRY);
    expect(exitCode).toBe(0);
    expect(json).toEqual({ data: { deleted: true } });
    expect(requests).toHaveLength(1);
  });

  it("prints a 404 for an unknown entry, such as an old pair id", async () => {
    mockApi([
      {
        method: "DELETE",
        path: `/api/glossaries/${GLOSSARY}/entries/${ENTRY}`,
        status: 404,
        body: { code: "NOT_FOUND", message: "Glossary entry not found", statusCode: 404 },
      },
    ]);
    const { json, exitCode } = await glossaries("delete-entry", "--id", GLOSSARY, "--entry-id", ENTRY);
    expect(exitCode).toBe(1);
    expect(json).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
