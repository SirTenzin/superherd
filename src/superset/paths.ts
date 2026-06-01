import { homedir } from "node:os";
import { resolve, join } from "node:path";
import type { SupersetProject, SupersetWorkspace } from "./types";

export function resolveWorktreePath(
  project: SupersetProject,
  workspace: SupersetWorkspace,
): string {
  if (workspace.worktreePath) return workspace.worktreePath;

  const branch = workspace.branch;
  const baseDir = project.worktreeBaseDir ?? join(homedir(), ".superset", "worktrees");
  return resolve(baseDir, project.id, branch);
}
