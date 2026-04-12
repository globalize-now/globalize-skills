// Client and auth
export { createApiClient, type ApiClient } from "./client.js";
export { resolveAuth, readConfigFile, writeConfigFile, deleteConfigFile, type AuthConfig } from "./auth.js";

// Orgs
export { listOrgs, createOrg, deleteOrg } from "./commands/orgs.js";

// Projects
export { listProjects, createProject, getProject, deleteProject } from "./commands/projects.js";

// Languages
export { listLanguages, getLanguage } from "./commands/languages.js";

// Project languages
export { listProjectLanguages, addProjectLanguage, removeProjectLanguage } from "./commands/project-languages.js";

// Repositories
export {
  listRepositories,
  createRepository,
  updateRepository,
  deleteRepository,
  detectRepository,
  listRepositoryBranches,
} from "./commands/repositories.js";

// Patterns
export {
  listPatterns,
  createPattern,
  updatePattern,
  deletePattern,
  reorderPattern,
} from "./commands/patterns.js";

// Glossary
export { listGlossary, createGlossaryEntry, deleteGlossaryEntry } from "./commands/glossary.js";

// Style guides
export { listStyleGuides, upsertStyleGuide, deleteStyleGuide } from "./commands/style-guides.js";

// API keys
export { listApiKeys, createApiKey, revokeApiKey } from "./commands/api-keys.js";

// Members
export { listMembers, inviteMember, removeMember } from "./commands/members.js";

// GitHub
export { startGithubInstall, pollGithubInstallStatus } from "./commands/github.js";

// GitLab
export {
  startGitlabInstall,
  pollGitlabInstallStatus,
  listGitlabConnections,
  deleteGitlabConnection,
  listGitlabProjects,
  listGitlabProjectBranches,
  detectGitlabProject,
} from "./commands/gitlab.js";
