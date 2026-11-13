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
