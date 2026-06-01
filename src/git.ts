import { spawnSync } from "node:child_process";
import { CliError, errorMessage } from "./errors";

export function getGitRoot(): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new CliError(`Failed to run git: ${errorMessage(result.error)}`);
  }

  if (result.status !== 0) {
    throw new CliError(
      "Current directory is not inside a git repository.",
      "Run superherd from a repo imported into Superset.",
    );
  }

  return result.stdout.trim();
}

export function assertLocalBranchExists(repoRoot: string, branch: string): void {
  const result = spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new CliError(`Failed to inspect git branch: ${errorMessage(result.error)}`);
  }

  if (result.status !== 0) {
    throw new CliError(
      `Local branch does not exist: ${branch}`,
      "Use `hs create <new-branch> --from <base> <name...>` to create a new branch from a base branch.",
    );
  }
}

export function assertBranchNotCheckedOut(repoRoot: string, branch: string): void {
  const worktreePath = checkedOutWorktreePath(repoRoot, branch);
  if (!worktreePath) return;

  throw new CliError(
    `Branch is already checked out in a worktree: ${branch}`,
    `Existing worktree: ${worktreePath}`,
  );
}

function checkedOutWorktreePath(repoRoot: string, branch: string): string | null {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error) {
    throw new CliError(`Failed to inspect git worktrees: ${errorMessage(result.error)}`);
  }

  if (result.status !== 0) {
    throw new CliError(`git worktree list failed: ${result.stderr || result.stdout}`);
  }

  let currentPath: string | null = null;
  for (const line of result.stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      currentPath = line.slice("worktree ".length);
      continue;
    }

    if (line === `branch refs/heads/${branch}`) {
      return currentPath;
    }
  }

  return null;
}
