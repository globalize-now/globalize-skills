import { listSkills, fetchSkill } from "../lib/registry.mjs";
import { detectAgents, AGENT_LABELS } from "../lib/detect.mjs";
import { resolveTargetDir, filterAgentsForScope } from "../lib/scope.mjs";
import { detectInstalledSkills } from "../lib/installed.mjs";
import { install as installClaude } from "../converters/claude.mjs";
import { install as installCodex } from "../converters/codex.mjs";
import { install as installCursor } from "../converters/cursor.mjs";

const CONVERTERS = {
  claude: installClaude,
  codex: installCodex,
  cursor: installCursor,
};

const HELP = `Usage: globalize-skills update [options]

Update all installed skills to the latest version. Auto-detects
installed skills and refreshes them from GitHub.

Examples:
  globalize-skills update
  globalize-skills update --target /path/to/project
  globalize-skills update --agent claude

Options:
  --agent <name>        Target agent: claude, codex, cursor, or all
                        (auto-detected by default)
  --repo <owner/repo>   Use a different GitHub repository
  --target <path>       Target directory (defaults to current directory)
  -h, --help            Show this help
`;

function parseArgs(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" && args[i + 1]) {
      flags.agent = args[++i];
    } else if (args[i] === "--repo" && args[i + 1]) {
      flags.repo = args[++i];
    } else if (args[i] === "--target" && args[i + 1]) {
      flags.target = args[++i];
    }
  }
  return flags;
}

export async function run(args = []) {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }

  const { agent, repo, target } = parseArgs(args);

  const targetDir = resolveTargetDir(target || "local");

  // Fetch available skills to build the name set and resolve paths
  const allSkills = await listSkills({ repo, noCache: true });
  const availableSkillNames = new Set(allSkills.map((s) => s.name));
  const skillMap = Object.fromEntries(allSkills.map((s) => [s.name, s]));

  // Detect what's installed
  const installed = detectInstalledSkills(targetDir, { availableSkillNames });

  if (installed.size === 0) {
    console.log("No installed skills found. Use `globalize-skills manage` to add skills.");
    return;
  }

  // Resolve agents
  const detectedAgents = agent === "all" ? ["claude", "codex", "cursor"] : agent ? [agent] : detectAgents(targetDir);
  const agents = filterAgentsForScope(detectedAgents, targetDir);

  if (agents.length === 0) {
    console.error("No supported agents for the selected scope.");
    return;
  }

  console.log(`Updating ${installed.size} skill(s) (fetching latest from GitHub)...\n`);

  for (const name of installed) {
    const skillInfo = skillMap[name];
    if (!skillInfo) {
      console.error(`  ⚠ Skipping ${name} — no longer available in registry`);
      continue;
    }

    const { files } = await fetchSkill(skillInfo.path, { repo, noCache: true });

    for (const agentName of agents) {
      const converter = CONVERTERS[agentName];
      const result = converter({ name, files, targetDir });
      console.log(`  Updated ${name} for ${AGENT_LABELS[agentName]} → ${result.dir}`);
    }
  }
}
