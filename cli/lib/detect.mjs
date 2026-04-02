import fs from "node:fs";
import path from "node:path";

const AGENT_SIGNALS = [
  { agent: "claude", check: (dir) => fs.existsSync(path.join(dir, ".claude")) },
  {
    agent: "codex",
    check: (dir) => fs.existsSync(path.join(dir, ".codex")) || fs.existsSync(path.join(dir, "AGENTS.md")),
  },
  { agent: "cursor", check: (dir) => fs.existsSync(path.join(dir, ".cursor")) },
];

/**
 * Detect which AI coding agents are configured in the given directory.
 * Returns at least ['claude'] as a default.
 */
export function detectAgents(dir) {
  const detected = AGENT_SIGNALS.filter(({ check }) => check(dir)).map(({ agent }) => agent);

  return detected.length > 0 ? detected : ["claude"];
}

export const ALL_AGENTS = ["claude", "codex", "cursor"];
