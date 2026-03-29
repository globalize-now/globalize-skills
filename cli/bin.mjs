#!/usr/bin/env node

const [command, ...args] = process.argv.slice(2);

const commands = {
  add: () => import('./commands/add.mjs'),
  list: () => import('./commands/list.mjs'),
  update: () => import('./commands/update.mjs'),
};

async function main() {
  if (!command || !commands[command]) {
    const { run } = await import('./commands/wizard.mjs');
    await run();
    return;
  }

  const { run } = await commands[command]();
  await run(args);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
