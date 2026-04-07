import { Command, Option } from "commander";
import type { ApiClient } from "../client.js";
import { extractError } from "../client.js";
import { output, outputError, type OutputOptions } from "../format.js";

type ClientFactory = () => Promise<ApiClient>;

export async function listMembers(client: ApiClient, orgId: string) {
  const { data, error, response } = await client.GET("/api/orgs/{orgId}/members", {
    params: { path: { orgId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function inviteMember(client: ApiClient, orgId: string, clerkUserId: string, role?: "admin" | "member") {
  const { data, error, response } = await client.POST("/api/orgs/{orgId}/members", {
    params: { path: { orgId } },
    body: { clerkUserId, role },
  });
  if (error) throw new Error(extractError(response, error));
  return data!;
}

export async function removeMember(client: ApiClient, orgId: string, membershipId: string) {
  const { data, error, response } = await client.DELETE("/api/orgs/{orgId}/members/{membershipId}", {
    params: { path: { orgId, membershipId } },
  });
  if (error) throw new Error(extractError(response, error));
  return data ?? { removed: true };
}

export function register(group: Command, getClient: ClientFactory): void {
  group
    .command("list")
    .description("List organisation members")
    .requiredOption("--org-id <id>", "Organisation UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await listMembers(client, cmdOpts.orgId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("invite")
    .description("Invite a member to an organisation")
    .requiredOption("--org-id <id>", "Organisation UUID")
    .requiredOption("--clerk-user-id <uid>", "Clerk user ID")
    .addOption(new Option("--role <role>", "Role (default: member)").choices(["admin", "member"]))
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await inviteMember(client, cmdOpts.orgId, cmdOpts.clerkUserId, cmdOpts.role), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });

  group
    .command("remove")
    .description("Remove a member from an organisation")
    .requiredOption("--org-id <id>", "Organisation UUID")
    .requiredOption("--membership-id <id>", "Membership UUID")
    .action(async (cmdOpts, cmd) => {
      const opts: OutputOptions = cmd.optsWithGlobals();
      try {
        const client = await getClient();
        output(await removeMember(client, cmdOpts.orgId, cmdOpts.membershipId), opts);
      } catch (e) {
        outputError((e as Error).message, opts);
      }
    });
}
