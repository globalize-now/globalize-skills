import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolveAuth, createApiClient } from "@globalize-now/cli-client";
import { registerOrgTools } from "./tools/orgs.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerLanguageTools } from "./tools/languages.js";
import { registerProjectLanguageTools } from "./tools/project-languages.js";
import { registerRepositoryTools } from "./tools/repositories.js";
import { registerGlossaryTools } from "./tools/glossary.js";
import { registerStyleGuideTools } from "./tools/style-guides.js";
import { registerApiKeyTools } from "./tools/api-keys.js";
import { registerMemberTools } from "./tools/members.js";
import { registerPatternTools } from "./tools/patterns.js";
import { registerGitlabTools } from "./tools/gitlab.js";

const server = new McpServer({
  name: "globalize",
  version: "0.1.0",
});

const { apiKey, apiUrl } = await resolveAuth();
const client = createApiClient(apiKey, apiUrl);

registerOrgTools(server, client);
registerProjectTools(server, client);
registerLanguageTools(server, client);
registerProjectLanguageTools(server, client);
registerRepositoryTools(server, client);
registerGlossaryTools(server, client);
registerStyleGuideTools(server, client);
registerApiKeyTools(server, client);
registerMemberTools(server, client);
registerPatternTools(server, client);
registerGitlabTools(server, client);

const transport = new StdioServerTransport();
await server.connect(transport);
