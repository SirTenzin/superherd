import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CliError } from "../errors";

export interface SupersetHostManifest {
  pid: number;
  endpoint: string;
  authToken: string;
  startedAt: number;
  organizationId: string;
}

export interface SupersetManifestMatch {
  path: string;
  manifest: SupersetHostManifest;
}

export function readLatestSupersetManifest(): SupersetManifestMatch {
  const hostDir = join(homedir(), ".superset", "host");
  if (!existsSync(hostDir)) {
    throw new CliError(
      `No Superset host directory found at ${hostDir}.`,
      "Start Superset first, then try again.",
    );
  }

  const manifests = readdirSync(hostDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(hostDir, entry.name, "manifest.json"))
    .filter((path) => existsSync(path))
    .map((path) => ({ path, manifest: readManifestFile(path) }))
    .filter((match) => match.manifest.endpoint && match.manifest.authToken)
    .sort((a, b) => (b.manifest.startedAt ?? 0) - (a.manifest.startedAt ?? 0));

  if (manifests.length === 0) {
    throw new CliError(
      `No usable Superset host manifests found under ${hostDir}.`,
      "Start Superset first, then try again.",
    );
  }

  return manifests[0]!;
}

function readManifestFile(path: string): SupersetHostManifest {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as SupersetHostManifest;
  } catch (error) {
    throw new CliError(`Failed to read Superset manifest at ${path}: ${error}`);
  }
}
