export interface ParsedArgs {
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const flagName = arg.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith("--")) {
      flags[flagName] = next;
      i += 1;
      continue;
    }

    flags[flagName] = true;
  }

  return {
    positional,
    flags,
  };
}
