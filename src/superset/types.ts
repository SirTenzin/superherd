export interface SupersetProject {
  id: string;
  repoPath: string;
  repoOwner?: string | null;
  repoName?: string | null;
  repoUrl?: string | null;
  worktreeBaseDir?: string | null;
}

export interface SupersetWorkspace {
  id: string;
  name: string;
  branch: string;
  projectId: string;
  worktreePath?: string | null;
}

export interface SupersetTerminalDescriptor {
  terminalId: string;
  label?: string;
}

export interface CreateWorkspaceResult {
  workspace: SupersetWorkspace;
  terminals: SupersetTerminalDescriptor[];
  agents: unknown[];
  alreadyExists: boolean;
  txid: number | null;
}

export interface SupersetCloudWorkspaceSummary {
  id: string;
  projectId: string;
  branch: string;
  hostId: string;
}

export interface SupersetLocalWorkspace {
  id: string;
  projectId: string;
  branch: string;
  worktreePath: string;
  worktreeExists: boolean;
}
