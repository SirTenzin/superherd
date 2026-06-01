import type { SupersetHostManifest } from "./manifest";
import { CliError } from "../errors";

export async function trpcQuery<T>(
  manifest: SupersetHostManifest,
  procedure: string,
  input: unknown = null,
): Promise<T> {
  const url = new URL(`/trpc/${procedure}`, manifest.endpoint);
  url.searchParams.set("input", JSON.stringify({ json: input }));

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${manifest.authToken}` },
  });

  return readTrpcResponse<T>(procedure, response);
}

export async function trpcMutation<T>(
  manifest: SupersetHostManifest,
  procedure: string,
  input: unknown,
): Promise<T> {
  const response = await fetch(new URL(`/trpc/${procedure}`, manifest.endpoint), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${manifest.authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ json: input }),
  });

  return readTrpcResponse<T>(procedure, response);
}

async function readTrpcResponse<T>(
  procedure: string,
  response: Response,
): Promise<T> {
  const text = await response.text();
  let payload: unknown;

  try {
    payload = JSON.parse(text);
  } catch {
    throw new CliError(`Superset ${procedure} returned non-JSON HTTP ${response.status}: ${text}`);
  }

  if (!response.ok) {
    throw new CliError(`Superset ${procedure} failed with HTTP ${response.status}: ${extractTrpcMessage(payload)}`);
  }

  if (isObject(payload) && "error" in payload) {
    throw new CliError(`Superset ${procedure} failed: ${extractTrpcMessage(payload)}`);
  }

  return unwrapTrpcData(payload) as T;
}

function unwrapTrpcData(payload: unknown): unknown {
  if (!isObject(payload)) return payload;
  const result = payload.result;
  if (!isObject(result)) return payload;
  const data = result.data;
  if (!isObject(data)) return data;
  return "json" in data ? data.json : data;
}

function extractTrpcMessage(payload: unknown): string {
  if (!isObject(payload)) return String(payload);
  const error = payload.error;
  if (!isObject(error)) return JSON.stringify(payload);
  const json = error.json;
  if (isObject(json) && typeof json.message === "string") return json.message;
  if (typeof error.message === "string") return error.message;
  return JSON.stringify(error);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
