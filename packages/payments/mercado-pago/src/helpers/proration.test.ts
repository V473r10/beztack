import { describe, expect, it } from "vitest";
import { calculateProration } from "./proration.js";

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const FULL_MONTH_DAYS = 30;
const HALF_MONTH_DAYS = 15;
const LAST_DAY_REMAINING = 1;
const SECOND_TO_LAST_DAY = 29;
const TEN_DAYS = 10;
const TWENTY_DAYS = 20;
const FEBRUARY_DAYS = 28;
const FOURTEEN_DAYS = 14;
const THIRTY_ONE_DAY_MONTH = 31;
const SIXTEEN_DAYS = 16;
const BASIC_PLAN_AMOUNT = 3000;
const PRO_PLAN_AMOUNT = 6000;
const PREMIUM_PLAN_AMOUNT = 10_000;
const DISCOUNTED_PLAN_AMOUNT = 3000;
const STANDARD_PLAN_CREDIT = 1500;
const MID_CYCLE_PRORATED_AMOUNT = 4500;
const LAST_DAY_UNUSED_CREDIT = 100;
const LAST_DAY_PRORATED_AMOUNT = 5900;
const FREE_PLAN_AMOUNT = 0;
const STARTER_PLAN_AMOUNT = 5000;
const THIRTY_ONE_DAY_CURRENT_AMOUNT = 3100;
const THIRTY_ONE_DAY_NEW_AMOUNT = 6200;
const THIRTY_ONE_DAY_UNUSED_CREDIT = 1600;
const THIRTY_ONE_DAY_PRORATED_AMOUNT = 4600;
const FEBRUARY_CURRENT_AMOUNT = 2800;
const FEBRUARY_NEW_AMOUNT = 5600;
const FEBRUARY_UNUSED_CREDIT = 1400;
const FEBRUARY_PRORATED_AMOUNT = 4200;
const MILLISECONDS_PER_DAY =
  MILLISECONDS_PER_SECOND *
  SECONDS_PER_MINUTE *
  MINUTES_PER_HOUR *
  HOURS_PER_DAY;

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * MILLISECONDS_PER_DAY);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * MILLISECONDS_PER_DAY);
}

describe("calculateProration", () => {
  it("calculates proration for mid-cycle upgrade", () => {
    const result = calculateProration({
      currentAmount: BASIC_PLAN_AMOUNT,
      newAmount: PRO_PLAN_AMOUNT,
      periodStart: daysAgo(HALF_MONTH_DAYS),
      periodEnd: daysFromNow(HALF_MONTH_DAYS),
    });

    expect(result.totalDays).toBe(FULL_MONTH_DAYS);
    expect(result.daysRemaining).toBe(HALF_MONTH_DAYS);
    expect(result.unusedCredit).toBe(STANDARD_PLAN_CREDIT);
    expect(result.proratedAmount).toBe(MID_CYCLE_PRORATED_AMOUNT);
    expect(result.fullAmount).toBe(PRO_PLAN_AMOUNT);
  });

  it("returns zero prorated amount when credit exceeds new price", () => {
    const result = calculateProration({
      currentAmount: PREMIUM_PLAN_AMOUNT,
      newAmount: DISCOUNTED_PLAN_AMOUNT,
      periodStart: daysAgo(LAST_DAY_REMAINING),
      periodEnd: daysFromNow(SECOND_TO_LAST_DAY),
    });

    expect(result.proratedAmount).toBe(0);
    expect(result.unusedCredit).toBeGreaterThan(result.fullAmount);
  });

  it("handles same-day upgrade (0 days remaining)", () => {
    const result = calculateProration({
      currentAmount: BASIC_PLAN_AMOUNT,
      newAmount: PRO_PLAN_AMOUNT,
      periodStart: daysAgo(FULL_MONTH_DAYS),
      periodEnd: new Date(),
    });

    expect(result.daysRemaining).toBe(0);
    expect(result.unusedCredit).toBe(0);
    expect(result.proratedAmount).toBe(PRO_PLAN_AMOUNT);
  });

  it("handles last-day upgrade (1 day remaining)", () => {
    const result = calculateProration({
      currentAmount: BASIC_PLAN_AMOUNT,
      newAmount: PRO_PLAN_AMOUNT,
      periodStart: daysAgo(SECOND_TO_LAST_DAY),
      periodEnd: daysFromNow(LAST_DAY_REMAINING),
    });

    expect(result.daysRemaining).toBe(LAST_DAY_REMAINING);
    expect(result.totalDays).toBe(FULL_MONTH_DAYS);
    expect(result.unusedCredit).toBe(LAST_DAY_UNUSED_CREDIT);
    expect(result.proratedAmount).toBe(LAST_DAY_PRORATED_AMOUNT);
  });

  it("handles upgrade on the first day (all days remaining)", () => {
    const result = calculateProration({
      currentAmount: BASIC_PLAN_AMOUNT,
      newAmount: PRO_PLAN_AMOUNT,
      periodStart: new Date(),
      periodEnd: daysFromNow(FULL_MONTH_DAYS),
    });

    expect(result.daysRemaining).toBe(FULL_MONTH_DAYS);
    expect(result.unusedCredit).toBe(BASIC_PLAN_AMOUNT);
    expect(result.proratedAmount).toBe(BASIC_PLAN_AMOUNT);
  });

  it("uses custom upgradeDate when provided", () => {
    const periodStart = new Date("2025-01-01");
    const periodEnd = new Date("2025-01-31");
    const upgradeDate = new Date("2025-01-16");

    const result = calculateProration({
      currentAmount: BASIC_PLAN_AMOUNT,
      newAmount: PRO_PLAN_AMOUNT,
      periodStart,
      periodEnd,
      upgradeDate,
    });

    expect(result.totalDays).toBe(FULL_MONTH_DAYS);
    expect(result.daysRemaining).toBe(HALF_MONTH_DAYS);
    expect(result.unusedCredit).toBe(STANDARD_PLAN_CREDIT);
    expect(result.proratedAmount).toBe(MID_CYCLE_PRORATED_AMOUNT);
  });

  it("handles free to paid upgrade (no credit)", () => {
    const result = calculateProration({
      currentAmount: FREE_PLAN_AMOUNT,
      newAmount: STARTER_PLAN_AMOUNT,
      periodStart: daysAgo(TEN_DAYS),
      periodEnd: daysFromNow(TWENTY_DAYS),
    });

    expect(result.unusedCredit).toBe(0);
    expect(result.proratedAmount).toBe(STARTER_PLAN_AMOUNT);
    expect(result.fullAmount).toBe(STARTER_PLAN_AMOUNT);
  });

  it("handles 31-day month", () => {
    const periodStart = new Date("2025-01-01");
    const periodEnd = new Date("2025-02-01");
    const upgradeDate = new Date("2025-01-16");

    const result = calculateProration({
      currentAmount: THIRTY_ONE_DAY_CURRENT_AMOUNT,
      newAmount: THIRTY_ONE_DAY_NEW_AMOUNT,
      periodStart,
      periodEnd,
      upgradeDate,
    });

    expect(result.totalDays).toBe(THIRTY_ONE_DAY_MONTH);
    expect(result.daysRemaining).toBe(SIXTEEN_DAYS);
    // dailyRate = 3100 / 31 = 100
    // unusedCredit = 100 * 16 = 1600
    expect(result.unusedCredit).toBe(THIRTY_ONE_DAY_UNUSED_CREDIT);
    expect(result.proratedAmount).toBe(THIRTY_ONE_DAY_PRORATED_AMOUNT);
  });

  it("handles February (28-day month)", () => {
    const periodStart = new Date("2025-02-01");
    const periodEnd = new Date("2025-03-01");
    const upgradeDate = new Date("2025-02-15");

    const result = calculateProration({
      currentAmount: FEBRUARY_CURRENT_AMOUNT,
      newAmount: FEBRUARY_NEW_AMOUNT,
      periodStart,
      periodEnd,
      upgradeDate,
    });

    expect(result.totalDays).toBe(FEBRUARY_DAYS);
    expect(result.daysRemaining).toBe(FOURTEEN_DAYS);
    // dailyRate = 2800 / 28 = 100
    // unusedCredit = 100 * 14 = 1400
    expect(result.unusedCredit).toBe(FEBRUARY_UNUSED_CREDIT);
    expect(result.proratedAmount).toBe(FEBRUARY_PRORATED_AMOUNT);
  });
});
