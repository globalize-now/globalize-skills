import { Command, Option } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";
import type { paths } from "../api-types.js";

type LedgerQuery = NonNullable<paths["/api/billing/ledger"]["get"]["parameters"]["query"]>;

type ClientFactory = () => Promise<ApiClient>;

export async function getBalance(client: ApiClient) {
  const { data, error, response } = await client.GET("/api/billing/balance");
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function getLedger(client: ApiClient, query: LedgerQuery) {
  const { data, error, response } = await client.GET("/api/billing/ledger", {
    params: { query },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("balance")
    .description("Get organisation credit balance")
    .action(async (_opts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await getBalance(client), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("ledger")
    .description("List credit ledger entries")
    .addOption(
      new Option("--type <type>", "Filter by entry type").choices([
        "purchase",
        "grant",
        "usage",
        "refund",
        "adjustment",
        "subscription_grant",
        "subscription_expiry",
      ]),
    )
    .addOption(new Option("--grouped <grouped>", "Group entries by job").choices(["true", "false"]))
    .option("--limit <n>", "Maximum number of entries to return", (v) => parseInt(v, 10))
    .option("--cursor <cursor>", "Pagination cursor")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        const query: LedgerQuery = {};
        if (cmdOpts.type !== undefined) query.type = cmdOpts.type;
        if (cmdOpts.grouped !== undefined) query.grouped = cmdOpts.grouped;
        if (cmdOpts.limit !== undefined) query.limit = cmdOpts.limit;
        if (cmdOpts.cursor !== undefined) query.cursor = cmdOpts.cursor;
        output(await getLedger(client, query), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
