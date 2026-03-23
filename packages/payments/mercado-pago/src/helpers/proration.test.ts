import { describe, expect, it } from "vitest";
import { calculateProration } from "./proration.js";

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * MILLISECONDS_PER_DAY);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MILLISECONDS_PER_DAY);
}

describe("calculateProration", () => {
  it("calculates proration for mid-cycle upgrade", () => {
    const result = calculateProration({
      currentAmount: 3000,
      newAmount: 6000,
      periodStart: daysAgo(15),
      periodEnd: daysFromNow(15),
    });

    expect(result.totalDays).toBe(30);
    expect(result.daysRemaining).toBe(15);
    expect(result.unusedCredit).toBe(1500);
    expect(result.proratedAmount).toBe(4500);
    expect(result.fullAmount).toBe(6000);
  });

  it("returns zero prorated amount when credit exceeds new price", () => {
    const result = calculateProration({
      currentAmount: 10_000,
      newAmount: 3000,
      periodStart: daysAgo(1),
      periodEnd: daysFromNow(29),
    });

    expect(result.proratedAmount).toBe(0);
    expect(result.unusedCredit).toBeGreaterThan(result.fullAmount);
  });

  it("handles same-day upgrade (0 days remaining)", () => {
    const result = calculateProration({
      currentAmount: 3000,
      newAmount: 6000,
      periodStart: daysAgo(30),
      periodEnd: new Date(),
    });

    expect(result.daysRemaining).toBe(0);
    expect(result.unusedCredit).toBe(0);
    expect(result.proratedAmount).toBe(6000);
  });

  it("handles last-day upgrade (1 day remaining)", () => {
    const result = calculateProration({
      currentAmount: 3000,
      newAmount: 6000,
      periodStart: daysAgo(29),
      periodEnd: daysFromNow(1),
    });

    expect(result.daysRemaining).toBe(1);
    expect(result.totalDays).toBe(30);
    expect(result.unusedCredit).toBe(100);
    expect(result.proratedAmount).toBe(5900);
  });

  it("handles upgrade on the first day (all days remaining)", () => {
    const result = calculateProration({
      currentAmount: 3000,
      newAmount: 6000,
      periodStart: new Date(),
      periodEnd: daysFromNow(30),
    });

    expect(result.daysRemaining).toBe(30);
    expect(result.unusedCredit).toBe(3000);
    expect(result.proratedAmount).toBe(3000);
  });

  it("uses custom upgradeDate when provided", () => {
    const periodStart = new Date("2025-01-01");
    const periodEnd = new Date("2025-01-31");
    const upgradeDate = new Date("2025-01-16");

    const result = calculateProration({
      currentAmount: 3000,
      newAmount: 6000,
      periodStart,
      periodEnd,
      upgradeDate,
    });

    expect(result.totalDays).toBe(30);
    expect(result.daysRemaining).toBe(15);
    expect(result.unusedCredit).toBe(1500);
    expect(result.proratedAmount).toBe(4500);
  });

  it("handles free to paid upgrade (no credit)", () => {
    const result = calculateProration({
      currentAmount: 0,
      newAmount: 5000,
      periodStart: daysAgo(10),
      periodEnd: daysFromNow(20),
    });

    expect(result.unusedCredit).toBe(0);
    expect(result.proratedAmount).toBe(5000);
    expect(result.fullAmount).toBe(5000);
  });

  it("handles 31-day month", () => {
    const periodStart = new Date("2025-01-01");
    const periodEnd = new Date("2025-02-01");
    const upgradeDate = new Date("2025-01-16");

    const result = calculateProration({
      currentAmount: 3100,
      newAmount: 6200,
      periodStart,
      periodEnd,
      upgradeDate,
    });

    expect(result.totalDays).toBe(31);
    expect(result.daysRemaining).toBe(16);
    // dailyRate = 3100 / 31 = 100
    // unusedCredit = 100 * 16 = 1600
    expect(result.unusedCredit).toBe(1600);
    expect(result.proratedAmount).toBe(4600);
  });

  it("handles February (28-day month)", () => {
    const periodStart = new Date("2025-02-01");
    const periodEnd = new Date("2025-03-01");
    const upgradeDate = new Date("2025-02-15");

    const result = calculateProration({
      currentAmount: 2800,
      newAmount: 5600,
      periodStart,
      periodEnd,
      upgradeDate,
    });

    expect(result.totalDays).toBe(28);
    expect(result.daysRemaining).toBe(14);
    // dailyRate = 2800 / 28 = 100
    // unusedCredit = 100 * 14 = 1400
    expect(result.unusedCredit).toBe(1400);
    expect(result.proratedAmount).toBe(4200);
  });
});
