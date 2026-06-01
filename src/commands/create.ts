import { existsSync } from "node:fs";
import { basename } from "node:path";
import type { Command } from "commander";
import { CliError } from "../errors";
import { assertBranchNotCheckedOut, assertLocalBranchExists, getGitRoot } from "../git";
import {
  closeHerdrPane,
  createHerdrTab,
  createHerdrWorkspace,
  focusHerdrTab,
  renameHerdrTab,
  runHerdrPaneCommand,
} from "../herdr/cli";
import { createLogger } from "../log";
import { readLatestSupersetManifest } from "../superset/manifest";
import type { SupersetHostManifest } from "../superset/manifest";
import { identifyWorkspace } from "../superset/identify";
import { resolveProject } from "../superset/projects";
import { trpcMutation, trpcQuery } from "../superset/trpc";
import type { CreateWorkspaceResult, SupersetProject } from "../superset/types";
import { resolveWorktreePath } from "../superset/paths";

interface CreateOptions {
  project?: string;
  dryRun?: boolean;
  verbose?: boolean;
  setupTerminals?: boolean;
  shellTab?: boolean;
  from?: string;
  eject?: boolean;
}

export function registerCreateCommand(program: Command): void {
  program
    .command("create")
    .description("Create a Superset worktree and open it in Herdr")
    .argument("<branch>", "branch name to create or reuse")
    .argument("<name...>", "workspace name")
    .option("--project <id-or-name>", "Superset project id, repo name, or owner/name")
    .option("--from <branch>", "base branch/ref to create the new branch from")
    .option("--dry-run", "print what would happen without creating anything")
    .option("--verbose", "print extra progress details")
    .option("--no-setup-terminals", "do not open Superset setup terminals in Herdr")
    .option("--no-shell-tab", "do not create a final local shell tab")
    .option("--eject", "close the Herdr pane that invoked this command after success")
    .action((branch: string, nameParts: string[], options: CreateOptions) =>
      createWorkspace(branch, nameParts.join(" "), options),
    );

  program
    .command("inherit")
    .description("Open an existing unchecked-out branch as a Superset worktree in Herdr")
    .argument("<branch>", "existing local branch to check out into a worktree")
    .argument("<name...>", "workspace name")
    .option("--project <id-or-name>", "Superset project id, repo name, or owner/name")
    .option("--dry-run", "print what would happen without creating anything")
    .option("--verbose", "print extra progress details")
    .option("--no-setup-terminals", "do not open Superset setup terminals in Herdr")
    .option("--no-shell-tab", "do not create a final local shell tab")
    .option("--eject", "close the Herdr pane that invoked this command after success")
    .action((branch: string, nameParts: string[], options: CreateOptions) =>
      createWorkspace(branch, nameParts.join(" "), { ...options, inherit: true }),
    );
}

async function createWorkspace(
  branch: string,
  name: string,
  options: CreateOptions & { inherit?: boolean },
): Promise<void> {
  const logger = createLogger(Boolean(options.verbose));
  const { path: manifestPath, manifest } = readLatestSupersetManifest();
  logger.verbose(`using Superset manifest ${manifestPath}`);

  const projects = await trpcQuery<SupersetProject[]>(manifest, "project.list");
  const { project, repoRoot } = await resolveCreateProject(manifest, projects, options.project);
  logger.verbose(`using Superset project ${project.id} (${project.repoPath})`);

  if (options.inherit) {
    assertLocalBranchExists(repoRoot, branch);
    assertBranchNotCheckedOut(repoRoot, branch);
  }

  if (options.dryRun) {
    logger.info(`would ${options.inherit ? "inherit" : "create"} Superset workspace "${name}" on branch "${branch}"`);
    logger.info(`would use project ${project.id} at ${project.repoPath}`);
    if (options.from) logger.info(`would base new branch on ${options.from}`);
    return;
  }

  const created = await trpcMutation<CreateWorkspaceResult>(manifest, "workspaces.create", {
    projectId: project.id,
    branch,
    name,
    ...(options.from ? { baseBranch: options.from } : {}),
  });
  const worktreePath = resolveWorktreePath(project, created.workspace);

  if (!existsSync(worktreePath)) {
    throw new CliError(`Superset worktree path does not exist: ${worktreePath}`);
  }

  logger.info(`${created.alreadyExists ? "reused" : "created"} Superset workspace ${created.workspace.id}`);
  logger.info(`opening Herdr workspace at ${worktreePath}`);

  const herdrWorkspace = createHerdrWorkspace(worktreePath, name);
  const herdrWorkspaceId = herdrWorkspace.workspace.workspace_id;
  let targetTabId = herdrWorkspace.tab.tab_id;
  let targetPaneId = herdrWorkspace.root_pane.pane_id;

  const terminals = options.setupTerminals === false ? [] : created.terminals;
  for (const [index, terminal] of terminals.entries()) {
    const label = terminal.label ?? `Superset ${index + 1}`;
    if (index === 0) {
      renameHerdrTab(targetTabId, label);
    } else {
      const tab = createHerdrTab(herdrWorkspaceId, worktreePath, label, false);
      targetTabId = tab.tab.tab_id;
      targetPaneId = tab.root_pane.pane_id;
    }

    const command = makeAttachCommand(created.workspace.id, terminal.terminalId);
    runHerdrPaneCommand(targetPaneId, command);
  }

  if (options.shellTab !== false) {
    const shellLabel = basename(worktreePath) || "shell";
    const shellTab = terminals.length === 0
      ? herdrWorkspace.tab
      : createHerdrTab(herdrWorkspaceId, worktreePath, shellLabel, true).tab;
    if (terminals.length === 0) renameHerdrTab(shellTab.tab_id, shellLabel);
    focusHerdrTab(shellTab.tab_id);
    logger.info(`focused local shell tab ${shellTab.tab_id}`);
  }

  if (options.eject) {
    ejectCurrentPane(logger);
  }
}

async function resolveCreateProject(
  manifest: SupersetHostManifest,
  projects: SupersetProject[],
  selector?: string,
): Promise<{ project: SupersetProject; repoRoot: string }> {
  if (selector) {
    const project = resolveProject(projects, undefined, selector);
    return { project, repoRoot: project.repoPath };
  }

  const identified = await identifyWorkspace(manifest, process.cwd());
  if (identified?.project) {
    return { project: identified.project, repoRoot: identified.project.repoPath };
  }

  const repoRoot = getGitRoot();
  const project = resolveProject(projects, repoRoot);
  return { project, repoRoot };
}

function ejectCurrentPane(logger: ReturnType<typeof createLogger>): void {
  const paneId = process.env.HERDR_PANE_ID;
  if (!paneId) {
    logger.info("--eject requested, but HERDR_PANE_ID is not set; leaving this shell open");
    return;
  }

  closeHerdrPane(paneId);
}

function makeAttachCommand(workspaceId: string, terminalId: string): string {
  return `hs attach-terminal --workspace ${shellQuote(workspaceId)} --terminal ${shellQuote(terminalId)}`;
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:=@+-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}
