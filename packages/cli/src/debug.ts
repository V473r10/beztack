let debugMode = false;

export function isDebugMode(): boolean {
  return debugMode;
}

export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

export function parseDebugFlag(): boolean {
  const args = process.argv;
  return args.includes("--debug") || args.includes("-d");
}

export function debugLog(message: string): void {
  if (isDebugMode()) {
    process.stdout.write(`[DEBUG] ${message}\n`);
  }
}

export function debugOutput(
  label: string,
  stdout: string,
  stderr: string
): void {
  if (!isDebugMode()) {
    return;
  }

  if (stdout.trim()) {
    process.stdout.write(`[DEBUG] ${label} stdout:\n${stdout}\n`);
  }
  if (stderr.trim()) {
    process.stderr.write(`[DEBUG] ${label} stderr:\n${stderr}\n`);
  }
}
