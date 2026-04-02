import { select, checkbox, Separator } from "@inquirer/prompts";
import { listSkills, fetchSkill, fetchPresets } from "../lib/registry.mjs";
import { detectAgents, ALL_AGENTS } from "../lib/detect.mjs";
import { promptScope, filterAgentsForScope } from "../lib/scope.mjs";
import { install as installClaude } from "../converters/claude.mjs";
import { install as installCodex } from "../converters/codex.mjs";
import { install as installCursor } from "../converters/cursor.mjs";

const CONVERTERS = {
  claude: installClaude,
  codex: installCodex,
  cursor: installCursor,
};

const AGENT_LABELS = {
  claude: "Claude Code",
  codex: "Codex",
  cursor: "Cursor",
};

export async function run() {
  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "Add skills", value: "add" },
      { name: "Update installed skills", value: "update" },
      { name: "List available skills", value: "list" },
    ],
  });

  if (action === "list") {
    const { run: listRun } = await import("./list.mjs");
    await listRun();
    return;
  }

  const noCache = action === "update";
  const [skills, presets] = await Promise.all([listSkills({ noCache }), fetchPresets({ noCache })]);

  // Build choices: presets first, then individual skills
  const choices = [];

  const presetEntries = Object.entries(presets);
  if (presetEntries.length > 0) {
    choices.push(new Separator("── Presets ──"));
    for (const [name, preset] of presetEntries) {
      choices.push({
        name: `${name} — ${preset.description}`,
        value: `preset:${name}`,
      });
    }
    choices.push(new Separator("── Individual skills ──"));
  }

  for (const skill of skills) {
    const desc = skill.description.length > 60 ? skill.description.slice(0, 57) + "..." : skill.description;
    choices.push({
      name: `${skill.name} — ${desc}`,
      value: `skill:${skill.name}`,
    });
  }

  const selected = await checkbox({
    message: "Which skills?",
    choices,
    required: true,
  });

  // Resolve selections to skill names
  const skillNames = new Set();
  for (const item of selected) {
    if (item.startsWith("preset:")) {
      const presetName = item.slice("preset:".length);
      for (const s of presets[presetName].skills) {
        skillNames.add(s);
      }
    } else {
      skillNames.add(item.slice("skill:".length));
    }
  }

  // Agent selection (detect based on current project, before scope is known)
  const detected = detectAgents(process.cwd());
  const detectedLabel = detected.map((a) => AGENT_LABELS[a]).join(", ");

  const agentChoice = await select({
    message: `Install for which agents? (detected: ${detectedLabel})`,
    choices: [
      { name: `All detected (${detectedLabel})`, value: "detected" },
      ...ALL_AGENTS.map((a) => ({ name: `${AGENT_LABELS[a]} only`, value: a })),
      { name: "All agents", value: "all" },
    ],
  });

  const selectedAgents = agentChoice === "detected" ? detected : agentChoice === "all" ? ALL_AGENTS : [agentChoice];

  // Scope selection
  const targetDir = await promptScope();
  const agents = filterAgentsForScope(selectedAgents, targetDir);

  if (agents.length === 0) {
    console.error("\nNo supported agents for the selected scope. Aborting.");
    return;
  }

  // Install
  const skillMap = Object.fromEntries(skills.map((s) => [s.name, s]));
  console.log();

  for (const name of skillNames) {
    const skillInfo = skillMap[name];
    if (!skillInfo) {
      console.error(`Unknown skill: ${name}`);
      continue;
    }

    const { files } = await fetchSkill(skillInfo.path, { noCache });

    for (const agentName of agents) {
      const converter = CONVERTERS[agentName];
      const result = converter({ name, files, targetDir });
      console.log(`  Installed ${name} for ${AGENT_LABELS[agentName]} → ${result.dir}`);
    }
  }
}
