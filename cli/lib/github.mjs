import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CACHE_DIR = path.join(os.tmpdir(), 'globalize-skills-cache');
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getCachePath(key) {
  return path.join(CACHE_DIR, key.replace(/[^a-zA-Z0-9-]/g, '_'));
}

function readCache(key) {
  const cachePath = getCachePath(key);
  try {
    const stat = fs.statSync(cachePath);
    if (Date.now() - stat.mtimeMs < CACHE_TTL) {
      return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    }
  } catch {
    // Cache miss
  }
  return null;
}

function writeCache(key, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(getCachePath(key), JSON.stringify(data));
}

/**
 * Fetch the full file tree of a GitHub repo at a given branch.
 * Returns an array of { path, type, url } objects.
 */
export async function fetchTree(repo, { branch = 'main', noCache = false } = {}) {
  const cacheKey = `tree-${repo}-${branch}`;
  if (!noCache) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  const url = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  const tree = data.tree.map(({ path, type }) => ({ path, type }));

  writeCache(cacheKey, tree);
  return tree;
}

/**
 * Fetch raw file content from a GitHub repo.
 */
export async function fetchFile(repo, filePath, { branch = 'main', noCache = false } = {}) {
  const cacheKey = `file-${repo}-${branch}-${filePath}`;
  if (!noCache) {
    const cached = readCache(cacheKey);
    if (cached) return cached;
  }

  const url = `https://raw.githubusercontent.com/${repo}/${branch}/${filePath}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${filePath}: ${res.status}`);
  }

  const content = await res.text();
  writeCache(cacheKey, content);
  return content;
}
