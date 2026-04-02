/**
 * Parse YAML frontmatter from a markdown string.
 * Handles simple `key: value` and YAML folded block scalars (`>-`).
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return { attributes: {}, body: content };
  }

  const raw = match[1];
  const body = content.slice(match[0].length).replace(/^\n+/, "");
  const attributes = {};

  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kvMatch = line.match(/^(\w+):\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1];
      let value = kvMatch[2];

      if (value === ">-" || value === "|" || value === ">") {
        // Collect indented continuation lines
        const parts = [];
        i++;
        while (i < lines.length && lines[i].match(/^\s+/)) {
          parts.push(lines[i].trim());
          i++;
        }
        value = parts.join(" ");
      } else {
        i++;
      }

      attributes[key] = value;
    } else {
      i++;
    }
  }

  return { attributes, body };
}
