// Client and auth
export { createApiClient, type ApiClient } from "./client.js";
export { resolveAuth, readConfigFile, writeConfigFile, deleteConfigFile, type AuthConfig } from "./auth.js";

// Orgs
export { listOrgs, deleteOrg } from "./commands/orgs.js";

// Projects
export {
  listProjects,
  createProject,
  updateProject,
  getProject,
  deleteProject,
  getProjectRefs,
  listProjectScorecards,
  getProjectBudget,
  rotateWebhookSecret,
} from "./commands/projects.js";

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
  discoverRepository,
  translateRepository,
} from "./commands/repositories.js";

// Patterns
export {
  listPatterns,
  createPattern,
  updatePattern,
  deletePattern,
  reorderPattern,
  bulkCreatePatterns,
} from "./commands/patterns.js";
export { FILE_FORMATS, type FileFormat } from "./file-formats.js";

// Glossary
export { listGlossary, createGlossaryEntry, deleteGlossaryEntry } from "./commands/glossary.js";

// Style guides
export {
  listStyleGuides,
  upsertStyleGuide,
  deleteStyleGuide,
  generateStyleGuide,
  applyStyleGuide,
  getStyleGuideQuota,
} from "./commands/style-guides.js";

// API keys
export { listApiKeys, createApiKey, revokeApiKey } from "./commands/api-keys.js";

// Members
export { listMembers, inviteMember, removeMember } from "./commands/members.js";

// Jobs
export {
  listJobs,
  getJob,
  startJob,
  retryJob,
  getJobStats,
  getQaReport,
  dismissQa,
  undismissQa,
  exportJob,
  exportJobManifest,
  listJobUnits,
  getJobUnit,
  listJobFiles,
  redeliverJob,
} from "./commands/jobs.js";

// Namespaces
export { listNamespaces, updateNamespace, deleteNamespace } from "./commands/namespaces.js";

// Translation memory
export {
  listTranslationMemory,
  deleteTranslationMemoryEntry,
  countTranslationMemory,
  freshCountTranslationMemory,
} from "./commands/translation-memory.js";

// Billing
export { getBalance, getLedger } from "./commands/billing.js";

// GitHub
export {
  startGithubInstall,
  pollGithubInstallStatus,
  listGithubInstallations,
  listGithubRepos,
  listGithubBranches,
  detectGithubRepo,
} from "./commands/github.js";

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
