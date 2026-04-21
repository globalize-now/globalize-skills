import { select, checkbox, Separator } from "@inquirer/prompts";
import { listSkills, fetchSkill, fetchPresets } from "../lib/registry.mjs";
import { detectAgents, ALL_AGENTS, AGENT_LABELS } from "../lib/detect.mjs";
import { promptScope, filterAgentsForScope } from "../lib/scope.mjs";
import { detectInstalledSkills, uninstallSkill } from "../lib/installed.mjs";
import { install as installClaude } from "../converters/claude.mjs";
import { install as installCodex } from "../converters/codex.mjs";
import { install as installCursor } from "../converters/cursor.mjs";

const CONVERTERS = {
  claude: installClaude,
  codex: installCodex,
  cursor: installCursor,
};

const HELP = `Usage: globalize-skills manage

Interactively add and remove skills. Detects what's already installed
and pre-checks those in the selection list. Deselecting a skill
removes it.

This is the default command — running \`globalize-skills\` with no
arguments opens the same interactive session.

Options:
  -h, --help   Show this help
`;

export async function run(args = []) {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }
  const [skills, presets] = await Promise.all([listSkills({ noCache: false }), fetchPresets({ noCache: false })]);

  const availableSkillNames = new Set(skills.map((s) => s.name));

  // Scope selection first so we can detect installed skills in target dir
  const targetDir = await promptScope();

  const installedSkills = detectInstalledSkills(targetDir, { availableSkillNames });

  // Build choices: presets first, then individual skills
  const choices = [];
  const isFirstTime = installedSkills.size === 0;

  const presetEntries = Object.entries(presets);
  if (presetEntries.length > 0) {
    choices.push(new Separator("── Presets ──"));
    for (const [name, preset] of presetEntries) {
      const allInstalled = preset.skills.every((s) => installedSkills.has(s));
      choices.push({
        name: `${name} — ${preset.description}`,
        value: `preset:${name}`,
        checked: allInstalled || (isFirstTime && name === "i18n-guide"),
      });
    }
    choices.push(new Separator("── Individual skills ──"));
  }

  for (const skill of skills) {
    const desc = skill.description.length > 60 ? skill.description.slice(0, 57) + "..." : skill.description;
    choices.push({
      name: `${skill.name} — ${desc}`,
      value: `skill:${skill.name}`,
      checked: installedSkills.has(skill.name) || (isFirstTime && skill.name === "i18n-guide"),
    });
  }

  const selected = await checkbox({
    message: "Which skills? (pre-checked = already installed)",
    choices,
  });

  // Resolve selections to skill names
  const selectedSkillNames = new Set();
  for (const item of selected) {
    if (item.startsWith("preset:")) {
      const presetName = item.slice("preset:".length);
      for (const s of presets[presetName].skills) {
        selectedSkillNames.add(s);
      }
    } else {
      selectedSkillNames.add(item.slice("skill:".length));
    }
  }

  // Diff: what to install vs uninstall vs skip
  const toInstall = [...selectedSkillNames].filter((name) => !installedSkills.has(name));
  const toUninstall = [...installedSkills].filter((name) => !selectedSkillNames.has(name));

  if (toInstall.length === 0 && toUninstall.length === 0) {
    console.log("\nNothing to change.");
    return;
  }

  // Agent selection
  const detected = detectAgents(targetDir);
  const detectedLabel = detected.map((a) => AGENT_LABELS[a]).join(", ") || "none";

  const agentChoice = await select({
    message: `Apply changes for which agents? (detected: ${detectedLabel})`,
    choices: [
      { name: `All detected (${detectedLabel})`, value: "detected" },
      ...ALL_AGENTS.map((a) => ({ name: `${AGENT_LABELS[a]} only`, value: a })),
      { name: "All agents", value: "all" },
    ],
  });

  const selectedAgents = agentChoice === "detected" ? detected : agentChoice === "all" ? ALL_AGENTS : [agentChoice];
  const agents = filterAgentsForScope(selectedAgents, targetDir);

  if (agents.length === 0) {
    console.error("\nNo supported agents for the selected scope. Aborting.");
    return;
  }

  const skillMap = Object.fromEntries(skills.map((s) => [s.name, s]));
  console.log();

  // Install newly selected skills
  for (const name of toInstall) {
    const skillInfo = skillMap[name];
    if (!skillInfo) {
      console.error(`Unknown skill: ${name}`);
      continue;
    }

    const { files } = await fetchSkill(skillInfo.path, { noCache: false });

    for (const agentName of agents) {
      const converter = CONVERTERS[agentName];
      const result = converter({ name, files, targetDir });
      console.log(`  + Installed ${name} for ${AGENT_LABELS[agentName]} → ${result.dir}`);
    }
  }

  // Uninstall deselected skills
  for (const name of toUninstall) {
    uninstallSkill(name, targetDir, agents);
    const agentLabels = agents.map((a) => AGENT_LABELS[a]).join(", ");
    console.log(`  - Removed ${name} for ${agentLabels}`);
  }
}
