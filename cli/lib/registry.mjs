import { fetchTree, fetchFile } from "./github.mjs";
import { parseFrontmatter } from "./frontmatter.mjs";

const DEFAULT_REPO = "Globalize-now/globalize-skills";

/**
 * Discover all available skills from the repo.
 * Returns array of { name, description, path } objects.
 */
export async function listSkills({ repo = DEFAULT_REPO, noCache = false } = {}) {
  const tree = await fetchTree(repo, { noCache });

  // Find all SKILL.md files under skills/
  const skillPaths = tree
    .filter(({ path, type }) => type === "blob" && path.match(/^skills\/[^/]+\/[^/]+\/SKILL\.md$/))
    .map(({ path }) => path);

  const skills = await Promise.all(
    skillPaths.map(async (filePath) => {
      const content = await fetchFile(repo, filePath, { noCache });
      const { attributes } = parseFrontmatter(content);
      const pathParts = filePath.split("/");
      return {
        name: attributes.name || `${pathParts[1]}-${pathParts[2]}`,
        description: attributes.description || "",
        path: filePath.replace("/SKILL.md", ""),
      };
    }),
  );

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Fetch all files for a skill (SKILL.md + references/).
 * Returns a { name, files } object where files is { relativePath: content }.
 */
export async function fetchSkill(skillPath, { repo = DEFAULT_REPO, noCache = false } = {}) {
  const tree = await fetchTree(repo, { noCache });

  const skillFiles = tree
    .filter(({ path, type }) => type === "blob" && path.startsWith(skillPath + "/"))
    .map(({ path }) => path);

  const files = {};
  await Promise.all(
    skillFiles.map(async (filePath) => {
      const content = await fetchFile(repo, filePath, { noCache });
      const relativePath = filePath.slice(skillPath.length + 1);
      files[relativePath] = content;
    }),
  );

  const { attributes } = parseFrontmatter(files["SKILL.md"] || "");
  return { name: attributes.name || "", files };
}

/**
 * Fetch presets from repo root.
 */
export async function fetchPresets({ repo = DEFAULT_REPO, noCache = false } = {}) {
  try {
    const content = await fetchFile(repo, "presets.json", { noCache });
    return JSON.parse(content);
  } catch {
    return {};
  }
}
