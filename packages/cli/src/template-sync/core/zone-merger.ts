const ZONE_START = "// @beztack-zone:start";
const ZONE_END = "// @beztack-zone:end";

export interface MergeResult {
  content: string;
  conflicts: string[];
}

export function mergeWithProtectedZones(
  currentContent: string,
  templateContent: string,
): MergeResult {
  const protectedBlocks = extractZones(currentContent);
  if (protectedBlocks.size === 0) {
    return {
      content: templateContent,
      conflicts: [],
    };
  }

  let merged = templateContent;
  const conflicts: string[] = [];

  for (const [zoneName, block] of protectedBlocks) {
    const templateBlock = extractZoneByName(templateContent, zoneName);
    if (!templateBlock) {
      conflicts.push(
        `Protected zone '${zoneName}' no longer exists in template output.`,
      );
      continue;
    }

    merged = merged.replace(templateBlock, block);
  }

  return {
    content: merged,
    conflicts,
  };
}

function extractZones(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = content.split("\n");

  let currentZoneName: string | undefined;
  let currentBlockLines: string[] = [];

  for (const line of lines) {
    const startMatch = line.trim().startsWith(ZONE_START)
      ? line.trim().slice(ZONE_START.length).trim()
      : "";

    if (startMatch.length > 0) {
      currentZoneName = startMatch;
      currentBlockLines = [line];
      continue;
    }

    if (currentZoneName) {
      currentBlockLines.push(line);
      const endMatch = line.trim().startsWith(ZONE_END)
        ? line.trim().slice(ZONE_END.length).trim()
        : "";
      if (endMatch === currentZoneName) {
        map.set(currentZoneName, currentBlockLines.join("\n"));
        currentZoneName = undefined;
        currentBlockLines = [];
      }
    }
  }

  return map;
}

function extractZoneByName(content: string, zoneName: string): string | undefined {
  const lines = content.split("\n");
  const buffer: string[] = [];
  let inside = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inside && trimmed === `${ZONE_START} ${zoneName}`) {
      inside = true;
      buffer.push(line);
      continue;
    }

    if (inside) {
      buffer.push(line);
      if (trimmed === `${ZONE_END} ${zoneName}`) {
        return buffer.join("\n");
      }
    }
  }

  return undefined;
}
