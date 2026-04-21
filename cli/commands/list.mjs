import { listSkills, fetchPresets } from "../lib/registry.mjs";

const HELP = `Usage: globalize-skills list [options]

Show available skills and presets.

Options:
  --repo <owner/repo>   Use a different GitHub repository
  --no-cache            Skip local cache and fetch fresh from GitHub
  -h, --help            Show this help
`;

export async function run(args = []) {
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(HELP);
    return;
  }

  const noCache = args.includes("--no-cache");
  const repo = args.find((_, i, a) => a[i - 1] === "--repo") || undefined;

  console.log("Fetching available skills...\n");

  const [skills, presets] = await Promise.all([listSkills({ repo, noCache }), fetchPresets({ repo, noCache })]);

  // Print presets
  const presetEntries = Object.entries(presets);
  if (presetEntries.length > 0) {
    console.log("Presets:");
    for (const [name, preset] of presetEntries) {
      console.log(`  ${name} — ${preset.description} (${preset.skills.join(", ")})`);
    }
    console.log();
  }

  // Print skills
  console.log("Skills:");
  for (const skill of skills) {
    const desc = skill.description.length > 80 ? skill.description.slice(0, 77) + "..." : skill.description;
    console.log(`  ${skill.name} — ${desc}`);
  }
}
