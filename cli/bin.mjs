#!/usr/bin/env node

const [command, ...args] = process.argv.slice(2);

const commands = {
  add: () => import("./commands/add.mjs"),
  manage: () => import("./commands/manage.mjs"),
  list: () => import("./commands/list.mjs"),
  update: () => import("./commands/update.mjs"),
};

const HELP = `Usage: globalize-skills [command] [options]

Install and manage globalization skills for AI coding agents
(Claude Code, Codex, Cursor).

Running without arguments starts an interactive session where you can
add and remove skills.

Commands:
  manage           Interactively add and remove skills (default)
  add <skills...>  Install one or more skills (or a preset)
  list             Show available skills and presets
  update           Update installed skills to the latest version

Options:
  -h, --help       Show this help

Run \`globalize-skills <command> --help\` for command-specific options.
`;

async function main() {
  if (command === "--help" || command === "-h" || command === "help") {
    process.stdout.write(HELP);
    return;
  }

  if (!command) {
    const { run } = await import("./commands/manage.mjs");
    await run();
    return;
  }

  if (!commands[command]) {
    process.stderr.write(`Unknown command: ${command}\n\n`);
    process.stderr.write(HELP);
    process.exit(1);
  }

  const { run } = await commands[command]();
  await run(args);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
