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
