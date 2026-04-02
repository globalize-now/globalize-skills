import chalk from "chalk";
import Table from "cli-table3";

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

export function outputError(message: string, opts: OutputOptions): void {
  if (isJsonMode(opts)) {
    process.stdout.write(JSON.stringify({ error: message }) + "\n");
  } else {
    process.stderr.write(chalk.red(`Error: ${message}`) + "\n");
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
