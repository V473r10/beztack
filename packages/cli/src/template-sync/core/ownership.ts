import type { OwnershipStrategy } from "./types.js";

interface Rule {
  pattern: string;
  strategy: OwnershipStrategy;
}

export function resolveOwnership(
  path: string,
  strategyByPath: Record<string, OwnershipStrategy>,
): OwnershipStrategy {
  const rules = Object.entries(strategyByPath).map(([pattern, strategy]) => ({
    pattern,
    strategy,
  }));

  const matched = rules
    .filter((rule) => matchesGlob(path, rule.pattern))
    .sort((a, b) => scoreRule(b) - scoreRule(a));

  return matched[0]?.strategy ?? "mixed";
}

function scoreRule(rule: Rule): number {
  const wildcardPenalty = (rule.pattern.match(/\*/g) || []).length * 10;
  return rule.pattern.length - wildcardPenalty;
}

function matchesGlob(path: string, pattern: string): boolean {
  const pathSegments = normalize(path).split("/");
  const patternSegments = normalize(pattern).split("/");
  return matchSegments(pathSegments, patternSegments);
}

function matchSegments(pathSegments: string[], patternSegments: string[]): boolean {
  if (patternSegments.length === 0) {
    return pathSegments.length === 0;
  }

  const [head, ...tail] = patternSegments;

  if (head === "**") {
    if (matchSegments(pathSegments, tail)) {
      return true;
    }

    if (pathSegments.length === 0) {
      return false;
    }

    return matchSegments(pathSegments.slice(1), patternSegments);
  }

  if (pathSegments.length === 0) {
    return false;
  }

  if (!matchSegment(pathSegments[0], head)) {
    return false;
  }

  return matchSegments(pathSegments.slice(1), tail);
}

function matchSegment(pathSegment: string, patternSegment: string): boolean {
  if (patternSegment === "*") {
    return true;
  }

  if (!patternSegment.includes("*")) {
    return pathSegment === patternSegment;
  }

  const escaped = patternSegment.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexPattern = `^${escaped.replaceAll("*", ".*")}$`;
  return new RegExp(regexPattern).test(pathSegment);
}

function normalize(value: string): string {
  return value.replaceAll("\\", "/");
}
