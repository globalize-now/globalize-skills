import { listSkills, fetchPresets } from '../lib/registry.mjs';

export async function run(args = []) {
  const noCache = args.includes('--no-cache');
  const repo = args.find((_, i, a) => a[i - 1] === '--repo') || undefined;

  console.log('Fetching available skills...\n');

  const [skills, presets] = await Promise.all([
    listSkills({ repo, noCache }),
    fetchPresets({ repo, noCache }),
  ]);

  // Print presets
  const presetEntries = Object.entries(presets);
  if (presetEntries.length > 0) {
    console.log('Presets:');
    for (const [name, preset] of presetEntries) {
      console.log(`  ${name} — ${preset.description} (${preset.skills.join(', ')})`);
    }
    console.log();
  }

  // Print skills
  console.log('Skills:');
  for (const skill of skills) {
    const desc = skill.description.length > 80
      ? skill.description.slice(0, 77) + '...'
      : skill.description;
    console.log(`  ${skill.name} — ${desc}`);
  }
}
