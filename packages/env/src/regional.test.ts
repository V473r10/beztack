import { describe, expect, it } from "vitest";
import { CURRENCY_CODE_SCHEMA, LOCALE_SCHEMA } from "./regional";

describe("CURRENCY_CODE_SCHEMA", () => {
  it.each(["USD", "UYU", "JPY", "KWD", "EUR"])("accepts %s", (code) => {
    expect(CURRENCY_CODE_SCHEMA.safeParse(code).success).toBe(true);
  });

  it.each(["usd", "US", "DOLLAR", "", "ZZZ"])("rejects %j", (code) => {
    expect(CURRENCY_CODE_SCHEMA.safeParse(code).success).toBe(false);
  });
});

describe("LOCALE_SCHEMA", () => {
  it.each(["en", "en-US", "es-UY", "pt-BR", "ja-JP"])("accepts %s", (locale) => {
    expect(LOCALE_SCHEMA.safeParse(locale).success).toBe(true);
  });

  it.each(["", "not a locale", "en_US", "123"])("rejects %j", (locale) => {
    expect(LOCALE_SCHEMA.safeParse(locale).success).toBe(false);
  });
});
