import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import type { Command } from "commander";
import { CliError, errorMessage } from "../errors";
import { identifyWorkspace, requireIdentifiedWorkspace } from "../superset/identify";
import { readLatestSupersetManifest } from "../superset/manifest";

interface TeardownOptions {
  dryRun?: boolean;
}

export function registerTeardownCommand(program: Command): void {
  program
    .command("teardown")
    .description("Delete the Superset workspace for the current directory")
    .option("--dry-run", "print the delete command without running it")
    .action((options: TeardownOptions) => teardown(options));
}

async function teardown(options: TeardownOptions): Promise<void> {
  const { manifest } = readLatestSupersetManifest();
  const workspace = requireIdentifiedWorkspace(
    await identifyWorkspace(manifest, process.cwd()),
  );
  const args = ["ws", "delete", workspace.workspaceId];

  if (options.dryRun) {
    process.stdout.write(`superset ${args.join(" ")}\n`);
    return;
  }

  const result = spawnSync("superset", args, {
    cwd: homedir(),
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (result.error) {
    throw new CliError(`Failed to run superset: ${errorMessage(result.error)}`);
  }

  if (result.status !== 0) {
    throw new CliError(`superset ${args.join(" ")} failed (${result.status}): ${result.stderr || result.stdout}`);
  }

  process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}
