import type { Command } from "commander";
import { readLatestSupersetManifest } from "../superset/manifest";
import { identifyWorkspace } from "../superset/identify";

interface IdentifyOptions {
  json?: boolean;
}

export function registerIdentifyCommand(program: Command): void {
  program
    .command("identify")
    .description("Detect whether the current directory is inside a Superset workspace")
    .option("--json", "print machine-readable JSON")
    .action((options: IdentifyOptions) => identify(options));
}

async function identify(options: IdentifyOptions): Promise<void> {
  const { manifest } = readLatestSupersetManifest();
  const identified = await identifyWorkspace(manifest, process.cwd());

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ok: Boolean(identified), workspace: identified }, null, 2)}\n`);
    return;
  }

  if (!identified) {
    process.stdout.write("Not inside a Superset workspace.\n");
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`Superset workspace: ${identified.workspaceId}\n`);
  process.stdout.write(`Project: ${identified.project?.repoName ?? identified.projectId}\n`);
  process.stdout.write(`Branch: ${identified.branch}\n`);
  process.stdout.write(`Path: ${identified.worktreePath}\n`);
}
