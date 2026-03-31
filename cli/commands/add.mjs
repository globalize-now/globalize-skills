import { listSkills, fetchSkill, fetchPresets } from '../lib/registry.mjs';
import { detectAgents, ALL_AGENTS } from '../lib/detect.mjs';
import { resolveTargetDir, filterAgentsForScope, promptScope } from '../lib/scope.mjs';
import { install as installClaude } from '../converters/claude.mjs';
import { install as installCodex } from '../converters/codex.mjs';
import { install as installCursor } from '../converters/cursor.mjs';

const CONVERTERS = {
  claude: installClaude,
  codex: installCodex,
  cursor: installCursor,
};

function parseArgs(args) {
  const flags = {};
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--agent' && args[i + 1]) {
      flags.agent = args[++i];
    } else if (args[i] === '--preset' && args[i + 1]) {
      flags.preset = args[++i];
    } else if (args[i] === '--repo' && args[i + 1]) {
      flags.repo = args[++i];
    } else if (args[i] === '--target' && args[i + 1]) {
      flags.target = args[++i];
    } else if (args[i] === '--no-cache') {
      flags.noCache = true;
    } else if (!args[i].startsWith('--')) {
      positional.push(args[i]);
    }
  }

  return { ...flags, skills: positional };
}

export async function run(args = []) {
  const { skills: skillNames, preset, agent, repo, noCache, target } = parseArgs(args);

  const targetDir = target !== undefined
    ? resolveTargetDir(target)
    : await promptScope();

  // Resolve which skills to install
  let toInstall = [...skillNames];
  if (preset) {
    const presets = await fetchPresets({ repo, noCache });
    if (!presets[preset]) {
      console.error(`Unknown preset: ${preset}`);
      process.exit(1);
    }
    toInstall.push(...presets[preset].skills);
  }

  if (toInstall.length === 0) {
    console.error('No skills specified. Use: globalize-skills add <skill> or --preset <name>');
    process.exit(1);
  }

  // Resolve agent targets
  const detectedAgents = agent === 'all'
    ? ALL_AGENTS
    : agent
      ? [agent]
      : detectAgents(targetDir);

  const agents = filterAgentsForScope(detectedAgents, targetDir);

  if (agents.length === 0) {
    console.error('No supported agents for the selected scope.');
    process.exit(1);
  }

  // Fetch available skills to resolve paths
  const allSkills = await listSkills({ repo, noCache });
  const skillMap = Object.fromEntries(allSkills.map((s) => [s.name, s]));

  for (const name of toInstall) {
    const skillInfo = skillMap[name];
    if (!skillInfo) {
      console.error(`Unknown skill: ${name}`);
      continue;
    }

    const { files } = await fetchSkill(skillInfo.path, { repo, noCache });

    for (const agentName of agents) {
      const converter = CONVERTERS[agentName];
      const result = converter({ name, files, targetDir });
      console.log(`  Installed ${name} for ${agentName} → ${result.dir}`);
    }
  }
}
