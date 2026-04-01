// Client and auth
export { createApiClient, type ApiClient } from './client.js';
export { resolveAuth, readConfigFile, writeConfigFile, deleteConfigFile, type AuthConfig } from './auth.js';

// Orgs
export { listOrgs, createOrg, deleteOrg } from './commands/orgs.js';

// Projects
export { listProjects, createProject, getProject, deleteProject } from './commands/projects.js';

// Languages
export { listLanguages, getLanguage } from './commands/languages.js';

// Project languages
export { listProjectLanguages, addProjectLanguage, removeProjectLanguage } from './commands/project-languages.js';

// Repositories
export { listRepositories, createRepository, deleteRepository, detectRepository } from './commands/repositories.js';

// Glossary
export { listGlossary, createGlossaryEntry, deleteGlossaryEntry } from './commands/glossary.js';

// Style guides
export { listStyleGuides, upsertStyleGuide, deleteStyleGuide } from './commands/style-guides.js';

// API keys
export { listApiKeys, createApiKey, revokeApiKey } from './commands/api-keys.js';

// Members
export { listMembers, inviteMember, removeMember } from './commands/members.js';
