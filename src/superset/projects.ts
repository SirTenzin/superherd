import { resolve } from "node:path";
import { CliError } from "../errors";
import type { SupersetProject } from "./types";

export function resolveProject(
  projects: SupersetProject[],
  repoRoot?: string,
  selector?: string,
): SupersetProject {
  if (selector) return resolveProjectSelector(projects, selector);

  if (!repoRoot) {
    throw new CliError("A git root is required when --project is not provided.");
  }

  const normalizedRoot = resolve(repoRoot);
  const matches = projects.filter((project) => resolve(project.repoPath) === normalizedRoot);

  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new CliError(`Multiple Superset projects match ${repoRoot}.`, "Re-run with --project <id>.");
  }

  throw new CliError(
    `No Superset project matches git root ${repoRoot}.`,
    "Import this repo into Superset first, or pass --project if it is already known.",
  );
}

function resolveProjectSelector(
  projects: SupersetProject[],
  selector: string,
): SupersetProject {
  const normalized = selector.toLowerCase();
  const matches = projects.filter((project) => {
    return (
      project.id === selector ||
      project.repoName?.toLowerCase() === normalized ||
      `${project.repoOwner ?? ""}/${project.repoName ?? ""}`.toLowerCase() === normalized
    );
  });

  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new CliError(`Multiple Superset projects match ${selector}.`, "Use the project id instead.");
  }

  throw new CliError(`No Superset project matches ${selector}.`);
}
