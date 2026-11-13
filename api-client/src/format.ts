import chalk, { chalkStderr } from "chalk";
import Table from "cli-table3";
import { ApiError } from "./client.js";

export interface OutputOptions {
  json?: boolean;
}

function isJsonMode(opts: OutputOptions): boolean {
  if (opts.json) return true;
  return !process.stdout.isTTY;
}

export function output(data: unknown, opts: OutputOptions): void {
  if (isJsonMode(opts)) {
    process.stdout.write(JSON.stringify({ data }, null, 2) + "\n");
  } else {
    if (Array.isArray(data)) {
      printTable(data);
    } else if (typeof data === "object" && data !== null) {
      printKeyValue(data as Record<string, unknown>);
    } else {
      console.log(data);
    }
  }
}

/**
 * Notices go to stderr so they reach a human without polluting the JSON on
 * stdout that agents and scripts parse. Their colour follows stderr's own
 * terminal detection (`chalkStderr`; `chalk` keys off stdout), so a piped
 * stderr carries no ANSI codes.
 */
export function notice(message: string): void {
  process.stderr.write(chalkStderr.yellow(message) + "\n");
}

export function warnDeprecated(message: string): void {
  notice(`Deprecated: ${message}`);
}

/**
 * Prints a failure and sets a non-zero exit code. Takes a message or what a
 * command caught: an `ApiError` also carries its status, code and details into
 * JSON output, so an agent can act on a refusal (`details` names the Project
 * holding a repository, the Gates needing an admin, …) without parsing text.
 */
export function outputError(failure: unknown, opts: OutputOptions): void {
  const message = typeof failure === "string" ? failure : failure instanceof Error ? failure.message : String(failure);
  if (isJsonMode(opts)) {
    const body =
      failure instanceof ApiError
        ? {
            error: message,
            status: failure.status,
            ...(failure.code === undefined ? {} : { code: failure.code }),
            ...(failure.details === undefined ? {} : { details: failure.details }),
          }
        : { error: message };
    process.stdout.write(JSON.stringify(body) + "\n");
  } else {
    process.stderr.write(chalkStderr.red(`Error: ${message}`) + "\n");
  }
  process.exitCode = 1;
}

function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) {
    console.log(chalk.dim("No results."));
    return;
  }
  const keys = Object.keys(rows[0]);
  const table = new Table({
    head: keys.map((k) => chalk.bold(k)),
    style: { head: [] },
  });
  for (const row of rows) {
    table.push(keys.map((k) => formatCell(row[k])));
  }
  console.log(table.toString());
}

function printKeyValue(obj: Record<string, unknown>): void {
  const table = new Table({ style: { head: [] } });
  for (const [key, value] of Object.entries(obj)) {
    table.push({ [chalk.bold(key)]: formatCell(value) });
  }
  console.log(table.toString());
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return chalk.dim("—");
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
