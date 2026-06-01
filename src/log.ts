export interface Logger {
  verbose(message: string): void;
  info(message: string): void;
}

export function createLogger(verbose: boolean): Logger {
  return {
    verbose(message) {
      if (verbose) process.stderr.write(`[superherd] ${message}\n`);
    },
    info(message) {
      process.stderr.write(`[superherd] ${message}\n`);
    },
  };
}
