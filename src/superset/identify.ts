import { resolve, sep } from "node:path";
import { CliError } from "../errors";
import type { SupersetHostManifest } from "./manifest";
import { resolveWorktreePath } from "./paths";
import { trpcQuery } from "./trpc";
import type {
  SupersetCloudWorkspaceSummary,
  SupersetLocalWorkspace,
  SupersetProject,
  SupersetWorkspace,
} from "./types";

export interface IdentifiedWorkspace {
  workspaceId: string;
  projectId: string;
  branch: string;
  worktreePath: string;
  cwd: string;
  project?: SupersetProject;
  worktreeExists?: boolean;
}

export async function identifyWorkspace(
  manifest: SupersetHostManifest,
  cwd: string,
): Promise<IdentifiedWorkspace | null> {
  const [projects, cloudWorkspaces] = await Promise.all([
    trpcQuery<SupersetProject[]>(manifest, "project.list"),
    trpcQuery<SupersetCloudWorkspaceSummary[]>(manifest, "workspace.cloudList"),
  ]);

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const normalizedCwd = resolve(cwd);
  const candidates = cloudWorkspaces
    .map((workspace) => {
      const project = projectById.get(workspace.projectId);
      if (!project) return null;
      const fallbackPath = resolveWorktreePath(project, workspace as SupersetWorkspace);
      return { workspace, project, fallbackPath };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .filter((candidate) => pathContains(candidate.fallbackPath, normalizedCwd))
    .sort((a, b) => b.fallbackPath.length - a.fallbackPath.length);

  for (const candidate of candidates) {
    const local = await tryGetLocalWorkspace(manifest, candidate.workspace.id);
    if (!local) continue;
    if (!pathContains(local.worktreePath, normalizedCwd)) continue;
    return {
      workspaceId: local.id,
      projectId: local.projectId,
      branch: local.branch,
      worktreePath: local.worktreePath,
      cwd: normalizedCwd,
      project: candidate.project,
      worktreeExists: local.worktreeExists,
    };
  }

  return null;
}

export function requireIdentifiedWorkspace(
  identified: IdentifiedWorkspace | null,
): IdentifiedWorkspace {
  if (identified) return identified;
  throw new CliError(
    "Current directory is not inside a local Superset workspace.",
    "Run this from a Superset worktree created by superherd/Superset.",
  );
}

async function tryGetLocalWorkspace(
  manifest: SupersetHostManifest,
  workspaceId: string,
): Promise<SupersetLocalWorkspace | null> {
  try {
    return await trpcQuery<SupersetLocalWorkspace>(manifest, "workspace.get", { id: workspaceId });
  } catch {
    return null;
  }
}

function pathContains(root: string, child: string): boolean {
  const normalizedRoot = resolve(root);
  const normalizedChild = resolve(child);
  return normalizedChild === normalizedRoot || normalizedChild.startsWith(normalizedRoot + sep);
}
