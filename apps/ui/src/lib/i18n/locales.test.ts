import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import en from "./locales/en.json";
import es from "./locales/es.json";

const SRC_DIR = path.resolve(__dirname, "../..");

/** Plural forms i18next resolves from a base key (`items` -> `items_one`, `items_other`). */
const PLURAL_SUFFIXES = ["_zero", "_one", "_two", "_few", "_many", "_other"];

function flatten(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") {
    return [prefix];
  }
  return Object.entries(node).flatMap(([key, value]) =>
    flatten(value, prefix ? `${prefix}.${key}` : key),
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    const isSource = /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name);
    return isSource ? [full] : [];
  });
}

const enKeys = new Set(flatten(en));
const esKeys = new Set(flatten(es));
const topLevelNamespaces = new Set(Object.keys(en));

function hasKey(keys: Set<string>, key: string): boolean {
  return keys.has(key) || PLURAL_SUFFIXES.some((suffix) => keys.has(`${key}${suffix}`));
}

// `t("a.b")`, `i18n.t("a.b")`, `<Trans i18nKey="a.b">` (static keys only).
const TRANSLATE_CALL = /(?<![\w$])(?:i18n(?:next)?\.)?t\(\s*(["'`])([^"'`$\\]+)\1/g;
const I18N_KEY_PROP = /i18nKey=\{?\s*(["'`])([^"'`$\\]+)\1/g;
// Keys kept in data and translated later (`title: "sidebar.nav.billing"`).
const KEY_SHAPED_LITERAL = /(["'`])([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_-]+)+)\1/g;

function usedKeys(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const record = (key: string, file: string) => {
    used.set(key, [...(used.get(key) ?? []), path.relative(SRC_DIR, file)]);
  };

  for (const file of sourceFiles(SRC_DIR)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(TRANSLATE_CALL)) {
      record(match[2], file);
    }
    for (const match of text.matchAll(I18N_KEY_PROP)) {
      record(match[2], file);
    }
    for (const match of text.matchAll(KEY_SHAPED_LITERAL)) {
      const key = match[2];
      if (topLevelNamespaces.has(key.split(".")[0])) {
        record(key, file);
      }
    }
  }
  return used;
}

describe("locale files", () => {
  it("en.json and es.json define the same keys", () => {
    const onlyEn = [...enKeys].filter((key) => !esKeys.has(key));
    const onlyEs = [...esKeys].filter((key) => !enKeys.has(key));

    expect({ onlyEn, onlyEs }).toEqual({ onlyEn: [], onlyEs: [] });
  });

  it("every static key used in apps/ui/src exists in en.json and es.json", () => {
    const missing: Record<string, string[]> = {};
    for (const [key, files] of usedKeys()) {
      const inEn = hasKey(enKeys, key);
      const inEs = hasKey(esKeys, key);
      if (!(inEn && inEs)) {
        const where = [inEn ? "" : "en.json", inEs ? "" : "es.json"].filter(Boolean).join(", ");
        missing[`${key} (missing in ${where})`] = [...new Set(files)];
      }
    }

    expect(missing).toEqual({});
  });

  it("finds the keys the code uses (guards the scanner itself)", () => {
    const used = usedKeys();

    expect(used.has("sidebar.userMenu.language")).toBe(true);
    expect(used.has("sidebar.nav.billing")).toBe(true);
  });
});

/**
 * Keys built at run time (`t(`home.plan.status.${status}`)`) are invisible to the static scan above,
 * so a missing status or tier shows its raw English code. Each family is listed here with the
 * values the code can produce; the lists that live in code are read from it.
 */
function unionMembers(file: string, typeName: string): string[] {
  const text = readFileSync(path.resolve(SRC_DIR, "../../..", file), "utf8");
  const body = new RegExp(`export type ${typeName} =([^;]+);`).exec(text)?.[1] ?? "";
  return [...body.matchAll(/"([A-Za-z_]+)"/g)].map((match) => match[1]);
}

function dynamicFamilies(): Record<string, string[]> {
  const subscriptionStatuses = unionMembers("packages/payments/core/src/types.ts", "SubscriptionStatus");
  const tierIds = [
    ...readFileSync(path.resolve(SRC_DIR, "../../../packages/db/src/plan-catalog.ts"), "utf8").matchAll(
      /canonicalTierId: "([a-z]+)"/g,
    ),
  ].map((match) => match[1]);
  const homeText = readFileSync(path.resolve(SRC_DIR, "app/home/home.tsx"), "utf8");
  const homeStatuses = [
    ...(/KNOWN_STATUSES = \[([^\]]+)\]/.exec(homeText)?.[1] ?? "").matchAll(/"([a-z_]+)"/g),
  ].map((match) => match[1]);

  return {
    // Polar statuses (the union) plus the two Mercado Pago spellings.
    "billing.welcome.status": [...subscriptionStatuses, "authorized", "cancelled"],
    "home.plan.status": [...homeStatuses, "free", "canceling"],
    "membership.tiers": tierIds,
    "billing.cadenceUnit": ["monthly", "yearly"],
    "organizations.roles": ["owner", "admin", "member"],
    "organizations.roleDescriptions": ["owner", "admin", "member"],
    "invitation.roles": ["owner", "admin", "member"],
  };
}

describe("keys built at run time", () => {
  it("reads the lists from code (guards the scanner itself)", () => {
    const families = dynamicFamilies();

    expect(families["billing.welcome.status"]).toEqual(
      expect.arrayContaining(["active", "past_due", "trialing", "canceled", "cancelled"]),
    );
    expect(families["membership.tiers"]).toEqual(
      expect.arrayContaining(["free", "basic", "pro", "ultimate"]),
    );
    expect(families["home.plan.status"]).toEqual(expect.arrayContaining(["past_due", "free"]));
  });

  it("every value of each family resolves in en.json and es.json", () => {
    const missing: string[] = [];
    for (const [family, values] of Object.entries(dynamicFamilies())) {
      for (const value of values) {
        const key = `${family}.${value}`;
        if (!hasKey(enKeys, key)) {
          missing.push(`${key} (en.json)`);
        }
        if (!hasKey(esKeys, key)) {
          missing.push(`${key} (es.json)`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});

/** Text inside the parentheses that open at `start - 1`, honouring nested brackets and quoted strings. */
function readBracketed(text: string, start: number): string {
  let depth = 1;
  let quote: string | null = null;
  let index = start;
  for (; index < text.length && depth > 0; index++) {
    const char = text[index];
    if (quote) {
      if (char === "\\") {
        index++;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if ("([{".includes(char)) {
      depth++;
    } else if (")]}".includes(char)) {
      depth--;
    }
  }
  return text.slice(start, index - 1);
}

/** The first top-level argument of a call, given the text after its opening parenthesis. */
function firstArgument(callText: string): string {
  const args = readBracketed(callText, 0);
  let depth = 0;
  let quote: string | null = null;
  for (let index = 0; index < args.length; index++) {
    const char = args[index];
    if (quote) {
      if (char === "\\") {
        index++;
      } else if (char === quote) {
        quote = null;
      }
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if ("([{".includes(char)) {
      depth++;
    } else if (")]}".includes(char)) {
      depth--;
    } else if (char === "," && depth === 0) {
      return args.slice(0, index);
    }
  }
  return args;
}

/** Removes every `t(...)` / `translate(...)` call, whose literals are translation keys or defaults. */
function withoutTranslateCalls(text: string): string {
  const call = /(?<![\w$.])(?:t|translate)\(/;
  let rest = text;
  for (let match = call.exec(rest); match; match = call.exec(rest)) {
    const open = match.index + match[0].length;
    rest = rest.slice(0, match.index) + rest.slice(open + readBracketed(rest, open).length + 1);
  }
  return rest;
}

const TOAST_CALL = /\btoast\.(?:success|error|info|warning|message)\(/g;

describe("toasts", () => {
  // Admin pages are not translated (the spec covers the demo path: customer-facing screens).
  it("never show a hardcoded string outside app/admin (go through t())", () => {
    const hardcoded: string[] = [];
    for (const file of sourceFiles(SRC_DIR)) {
      const relative = path.relative(SRC_DIR, file).split(path.sep).join("/");
      if (relative.startsWith("app/admin/")) {
        continue;
      }
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(TOAST_CALL)) {
        const first = withoutTranslateCalls(
          firstArgument(text.slice(match.index + match[0].length)),
        );
        if (/["'`]/.test(first)) {
          hardcoded.push(`${relative}: ${first.trim().replace(/\s+/g, " ").slice(0, 80)}`);
        }
      }
    }
    expect(hardcoded).toEqual([]);
  });

  it("finds toast calls (guards the scanner itself)", () => {
    const sample = 'toast.success(a ? "x, y" : t("k", "d"), { description: "z" });';
    const start = sample.indexOf("(") + 1;
    expect(firstArgument(sample.slice(start))).toBe('a ? "x, y" : t("k", "d")');
    expect(withoutTranslateCalls('a ? "x" : t("k", "d")')).toBe('a ? "x" : ');
    expect(withoutTranslateCalls('t("k") + translate("j")')).toBe(" + ");
  });
});

