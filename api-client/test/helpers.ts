import { Command } from "commander";
import { vi } from "vitest";
import { createApiClient, type ApiClient } from "../src/client.js";

export interface RecordedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Headers;
  body: unknown;
}

type Route = { method: string; path: string; status?: number; body: unknown };

/**
 * Stubs `fetch` with a table of canned answers, keyed by method and path, and
 * records every request. An unrouted request answers 599 so a test fails loudly.
 */
export function mockApi(routes: Route[]) {
  const requests: RecordedRequest[] = [];
  vi.stubGlobal("fetch", async (input: Request) => {
    const url = new URL(input.url);
    const text = await input.text();
    requests.push({
      method: input.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: input.headers,
      body: text ? JSON.parse(text) : undefined,
    });
    const route = routes.find((r) => r.method === input.method && r.path === url.pathname);
    if (!route) return new Response(JSON.stringify({ unrouted: `${input.method} ${url.pathname}` }), { status: 599 });
    return new Response(JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  return requests;
}

/**
 * Runs one CLI command as `cli.ts` wires it (a group registered with a lazy
 * client), with `--json`, and answers what it printed and the exit code.
 */
export async function runCli(
  register: (group: Command, getClient: () => Promise<ApiClient>) => void,
  groupName: string,
  args: string[],
) {
  const program = new Command().exitOverride().option("--json", "Force JSON output");
  register(program.command(groupName), async () => createApiClient("glb_test", "https://api.test"));

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
  process.exitCode = undefined;
  try {
    await program.parseAsync(["node", "cli", "--json", groupName, ...args]);
  } finally {
    out.mockRestore();
    err.mockRestore();
  }
  const exitCode = process.exitCode ?? 0;
  process.exitCode = undefined;
  return { stdout, stderr, exitCode, json: stdout ? JSON.parse(stdout) : undefined };
}
