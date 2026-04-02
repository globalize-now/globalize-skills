import { run as addRun } from "./add.mjs";

/**
 * Update is the same as add but always uses --no-cache to force fresh fetch.
 */
export async function run(args = []) {
  if (!args.includes("--no-cache")) {
    args.push("--no-cache");
  }
  console.log("Updating (fetching latest from GitHub)...\n");
  await addRun(args);
}
