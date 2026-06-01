#!/usr/bin/env bun

import { Command } from "commander";
import { registerAttachTerminalCommand } from "./commands/attach-terminal";
import { registerCreateCommand } from "./commands/create";
import { registerIdentifyCommand } from "./commands/identify";
import { registerTeardownCommand } from "./commands/teardown";
import { CliError, errorMessage } from "./errors";

const program = new Command();

program
  .name("superherd")
  .description("Bridge Superset workspaces into Herdr")
  .version("0.1.0");

registerCreateCommand(program);
registerIdentifyCommand(program);
registerTeardownCommand(program);
registerAttachTerminalCommand(program);

program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (error) {
  if ((error as { code?: string }).code === "commander.helpDisplayed") {
    process.exit(0);
  }

  if (error instanceof CliError) {
    process.stderr.write(`superherd: ${error.message}\n`);
    if (error.hint) process.stderr.write(`${error.hint}\n`);
    process.exit(1);
  }

  process.stderr.write(`superherd: ${errorMessage(error)}\n`);
  process.exit(1);
}
