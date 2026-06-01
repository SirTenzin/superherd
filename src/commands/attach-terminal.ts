import type { Command } from "commander";
import { readLatestSupersetManifest } from "../superset/manifest";

interface AttachOptions {
  workspace: string;
  terminal: string;
}

export function registerAttachTerminalCommand(program: Command): void {
  program
    .command("attach-terminal")
    .description("Attach stdio to a Superset terminal session")
    .requiredOption("--workspace <id>", "Superset workspace id")
    .requiredOption("--terminal <id>", "Superset terminal id")
    .action((options: AttachOptions) => attachTerminal(options));
}

function attachTerminal(options: AttachOptions): void {
  const { manifest } = readLatestSupersetManifest();
  const ws = new WebSocket(toTerminalWsUrl(manifest.endpoint, options.terminal, options.workspace, manifest.authToken));
  ws.binaryType = "arraybuffer";
  const forwardInput = makeInputForwarder(ws);

  const sendResize = () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: "resize",
      cols: process.stdout.columns || 120,
      rows: process.stdout.rows || 32,
    }));
  };

  ws.addEventListener("open", () => {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    sendResize();
  });

  ws.addEventListener("message", (event) => {
    if (event.data instanceof ArrayBuffer) {
      process.stdout.write(Buffer.from(event.data));
      return;
    }

    if (event.data instanceof Blob) {
      event.data.arrayBuffer().then((buffer) => process.stdout.write(Buffer.from(buffer)));
      return;
    }

    const message = safeJsonParse(String(event.data));
    if (message?.type === "error") {
      process.stderr.write(`[superherd] terminal error: ${message.message ?? "unknown error"}\n`);
    }
  });

  ws.addEventListener("close", (event) => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.exit(event.code === 1000 ? 0 : 1);
  });

  ws.addEventListener("error", () => {
    process.stderr.write("[superherd] terminal websocket error\n");
  });

  process.stdin.on("data", forwardInput);
  process.stdout.on("resize", sendResize);
}

function toTerminalWsUrl(
  endpoint: string,
  terminalId: string,
  workspaceId: string,
  token: string,
): string {
  const base = endpoint.replace(/^http:/, "ws:").replace(/^https:/, "wss:").replace(/\/$/, "");
  const params = new URLSearchParams({ workspaceId, token });
  return `${base}/terminal/${encodeURIComponent(terminalId)}?${params.toString()}`;
}

function makeInputForwarder(ws: WebSocket): (chunk: Buffer) => void {
  let lineStart = true;
  let pendingExit = "";

  const sendInput = (data: string) => {
    if (ws.readyState !== WebSocket.OPEN || data.length === 0) return;
    ws.send(JSON.stringify({ type: "input", data }));
  };

  return (chunk) => {
    const text = chunk.toString("utf8");

    for (const char of text) {
      if (lineStart && pendingExit.length < 4) {
        const candidate = pendingExit + char;
        if ("exit".startsWith(candidate)) {
          pendingExit = candidate;
          if (pendingExit === "exit") lineStart = false;
          continue;
        }
      }

      if (pendingExit === "exit" && (char === "\r" || char === "\n")) {
        pendingExit = "";
        lineStart = true;
        ws.close(1000, "local-exit-command");
        return;
      }

      if (pendingExit.length > 0) {
        sendInput(pendingExit);
        pendingExit = "";
      }

      sendInput(char);
      lineStart = char === "\r" || char === "\n";
    }
  };
}

function safeJsonParse(value: string): Record<string, unknown> | null {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}
