import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { refusal } from "../access/permissions";
import type { Capability, RoleSlug } from "../access/permissions";
import {
  countOpenIssues,
  createEnvironment,
  createProject,
  listAllEnvironments,
  listEnvironments,
  listOpenIssues,
  listProjects,
  removeProject,
  updateEnvironment,
  updateProject
} from "./projectsApi";
import type { EnvironmentRecord, ProjectRecord } from "./projectsApi";

export function useProjects(workspaceId: string | undefined) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryFn: () => listProjects(workspaceId ?? ""),
    queryKey: ["projects", workspaceId]
  });
}

export function useEnvironments(projectId: string | undefined) {
  return useQuery({
    enabled: Boolean(projectId),
    queryFn: () => listEnvironments(projectId ?? ""),
    queryKey: ["environments", projectId]
  });
}

export function useOpenIssueCount(projectId: string | undefined) {
  return useQuery({
    enabled: Boolean(projectId),
    queryFn: () => countOpenIssues(projectId ?? ""),
    queryKey: ["open-issue-count", projectId],
    staleTime: 0
  });
}

/** Environment and open-issue counts per project, read once for the whole list. */
export function useProjectRollup(workspaceId: string | undefined) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const [environments, openIssues] = await Promise.all([
        listAllEnvironments(workspaceId ?? ""),
        listOpenIssues()
      ]);
      const environmentCount = new Map<string, number>();
      const openIssueCount = new Map<string, number>();
      for (const environment of environments) {
        const key = String(environment.projectId ?? "");
        environmentCount.set(key, (environmentCount.get(key) ?? 0) + 1);
      }
      for (const issue of openIssues) {
        const key = String(issue.projectId ?? "");
        openIssueCount.set(key, (openIssueCount.get(key) ?? 0) + 1);
      }
      return { environmentCount, openIssueCount };
    },
    queryKey: ["project-rollup", workspaceId]
  });
}

export function useProjectMutations(workspaceId: string | undefined, role?: RoleSlug) {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project-rollup"] });
  };

  // The gateway lets any signed-in member write, so the permission table is
  // enforced again here: a Viewer posting a project is refused in the data
  // layer, not only hidden in the interface.
  const guard = (capability: Capability) => {
    const denied = refusal(role, capability);
    if (denied) throw denied;
  };

  return {
    create: useMutation({
      mutationFn: async (input: Parameters<typeof createProject>[0]) => {
        guard("manageProjects");
        await createProject(input);
      },
      onSuccess: invalidate
    }),
    remove: useMutation({
      mutationFn: async (itemId: string) => {
        guard("removeProjects");
        await removeProject(itemId);
      },
      onSuccess: invalidate
    }),
    update: useMutation({
      mutationFn: async ({ input, itemId }: { input: Partial<ProjectRecord>; itemId: string }) => {
        guard("manageProjects");
        await updateProject(itemId, input);
      },
      onSuccess: invalidate
    })
  };
}

export type EnvironmentDraft = {
  allowedHosts: string[];
  allowedPaths: string[];
  baseUrl: string;
  browserDefault: string;
  buildLabel: string;
  itemId?: string;
  name: string;
  projectId: string;
  type: string;
  workspaceId: string;
};

export function useEnvironmentMutations(projectId: string | undefined, role?: RoleSlug) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["environments", projectId] });

  return {
    invalidate,
    save: useMutation({
      mutationFn: async (draft: EnvironmentDraft) => {
        const denied = refusal(role, "manageProjects");
        if (denied) throw denied;
        const { itemId, ...rest } = draft;
        if (itemId) {
          await updateEnvironment(itemId, rest);
          return;
        }
        await createEnvironment(rest);
      },
      onSuccess: invalidate
    })
  };
}
