import { spawnSync } from "node:child_process";
import { CliError, errorMessage } from "../errors";

export interface HerdrWorkspaceCreated {
  workspace: { workspace_id: string };
  tab: { tab_id: string };
  root_pane: { pane_id: string };
}

export interface HerdrTabCreated {
  tab: { tab_id: string };
  root_pane: { pane_id: string };
}

export function createHerdrWorkspace(
  cwd: string,
  label: string,
): HerdrWorkspaceCreated {
  const response = runHerdrJson(["workspace", "create", "--cwd", cwd, "--label", label, "--focus"]);
  return response.result as HerdrWorkspaceCreated;
}

export function createHerdrTab(
  workspaceId: string,
  cwd: string,
  label: string,
  focus: boolean,
): HerdrTabCreated {
  const response = runHerdrJson([
    "tab",
    "create",
    "--workspace",
    workspaceId,
    "--cwd",
    cwd,
    "--label",
    label,
    focus ? "--focus" : "--no-focus",
  ]);
  return response.result as HerdrTabCreated;
}

export function renameHerdrTab(tabId: string, label: string): void {
  runHerdr(["tab", "rename", tabId, label]);
}

export function focusHerdrTab(tabId: string): void {
  runHerdr(["tab", "focus", tabId]);
}

export function runHerdrPaneCommand(paneId: string, command: string): void {
  runHerdr(["pane", "run", paneId, command]);
}

export function closeHerdrPane(paneId: string): void {
  runHerdr(["pane", "close", paneId]);
}

function runHerdrJson(args: string[]): Record<string, unknown> {
  const stdout = runHerdr(args);
  try {
    return JSON.parse(stdout) as Record<string, unknown>;
  } catch {
    throw new CliError(`Expected JSON from herdr ${args.join(" ")}, got: ${stdout}`);
  }
}

function runHerdr(args: string[]): string {
  const result = spawnSync("herdr", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new CliError(`Failed to run herdr: ${errorMessage(result.error)}`);
  }

  if (result.status !== 0) {
    throw new CliError(`herdr ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`);
  }

  return result.stdout.trim();
}
