import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { invalidateProductsCache, readThroughProductsCache } from "./products-cache";

const TTL_MS = 30_000;

function loader(body: string, ttlMs = TTL_MS) {
  return vi.fn(() => Promise.resolve({ body, ttlMs }));
}

describe("products cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    invalidateProductsCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves a second read within the TTL without loading again", async () => {
    const load = loader("first");

    expect(await readThroughProductsCache(load)).toBe("first");
    expect(await readThroughProductsCache(load)).toBe("first");

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads again once the TTL has passed", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ body: "first", ttlMs: TTL_MS })
      .mockResolvedValueOnce({ body: "second", ttlMs: TTL_MS });

    await readThroughProductsCache(load);
    vi.advanceTimersByTime(TTL_MS + 1);

    expect(await readThroughProductsCache(load)).toBe("second");
  });

  it("shares one load between concurrent reads", async () => {
    let finish: (value: { body: string; ttlMs: number }) => void = () => undefined;
    const load = vi.fn(
      () =>
        new Promise<{ body: string; ttlMs: number }>((resolve) => {
          finish = resolve;
        }),
    );

    const reads = Promise.all([
      readThroughProductsCache(load),
      readThroughProductsCache(load),
      readThroughProductsCache(load),
    ]);
    finish({ body: "shared", ttlMs: TTL_MS });

    expect(await reads).toEqual(["shared", "shared", "shared"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("loads again after an invalidation", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ body: "before", ttlMs: TTL_MS })
      .mockResolvedValueOnce({ body: "after", ttlMs: TTL_MS });

    await readThroughProductsCache(load);
    invalidateProductsCache();

    expect(await readThroughProductsCache(load)).toBe("after");
  });

  it("does not store a load that was in flight when the cache was invalidated", async () => {
    let finish: (value: { body: string; ttlMs: number }) => void = () => undefined;
    const slow = vi.fn(
      () =>
        new Promise<{ body: string; ttlMs: number }>((resolve) => {
          finish = resolve;
        }),
    );
    const fresh = loader("fresh");

    const stale = readThroughProductsCache(slow);
    invalidateProductsCache();
    finish({ body: "stale", ttlMs: TTL_MS });
    await stale;

    expect(await readThroughProductsCache(fresh)).toBe("fresh");
  });

  it("does not cache a failed load", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ body: "recovered", ttlMs: TTL_MS });

    await expect(readThroughProductsCache(load)).rejects.toThrow("boom");

    expect(await readThroughProductsCache(load)).toBe("recovered");
  });

  it("keeps each result for the TTL its loader asked for", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ body: "short", ttlMs: 5000 })
      .mockResolvedValueOnce({ body: "again", ttlMs: TTL_MS });

    await readThroughProductsCache(load);
    vi.advanceTimersByTime(5001);

    expect(await readThroughProductsCache(load)).toBe("again");
  });
});
