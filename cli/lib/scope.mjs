import os from 'node:os';
import path from 'node:path';
import { select } from '@inquirer/prompts';

export const GLOBAL_SUPPORT = {
  claude: true,
  codex: false,
  cursor: false,
};

export function resolveTargetDir(target) {
  if (target === 'global') return os.homedir();
  if (target === 'local') return process.cwd();
  return path.resolve(target);
}

export function filterAgentsForScope(agents, targetDir) {
  if (targetDir !== os.homedir()) return agents;
  return agents.filter((agent) => {
    if (!GLOBAL_SUPPORT[agent]) {
      console.warn(`  ⚠ Skipping ${agent} — global install not supported`);
      return false;
    }
    return true;
  });
}

export async function promptScope() {
  const choice = await select({
    message: 'Install scope:',
    choices: [
      { name: `Global  — available in all projects (${os.homedir()})`, value: 'global' },
      { name: `Local   — this project only (${process.cwd()})`, value: 'local' },
    ],
  });
  return resolveTargetDir(choice);
}
