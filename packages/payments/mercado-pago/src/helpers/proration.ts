const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY =
  MILLISECONDS_PER_SECOND *
  SECONDS_PER_MINUTE *
  MINUTES_PER_HOUR *
  HOURS_PER_DAY;

export type ProrationInput = {
  currentAmount: number;
  newAmount: number;
  periodStart: Date;
  periodEnd: Date;
  upgradeDate?: Date;
};

export type ProrationResult = {
  unusedCredit: number;
  proratedAmount: number;
  fullAmount: number;
  daysRemaining: number;
  totalDays: number;
  currency?: string;
};

/**
 * Calculate prorated amount for a mid-cycle subscription upgrade.
 *
 * The credit from the unused portion of the current plan is subtracted
 * from the cost of the new plan for the remaining days, producing the
 * amount the customer should pay for the first (partial) billing period.
 *
 * After the first period the subscription reverts to `newAmount`.
 */
export function calculateProration(input: ProrationInput): ProrationResult {
  const now = input.upgradeDate ?? new Date();

  const totalMs = input.periodEnd.getTime() - input.periodStart.getTime();
  const remainingMs = input.periodEnd.getTime() - now.getTime();

  const totalDays = Math.max(Math.ceil(totalMs / MILLISECONDS_PER_DAY), 1);
  const daysRemaining = Math.max(
    Math.ceil(remainingMs / MILLISECONDS_PER_DAY),
    0
  );

  const dailyCurrentRate = input.currentAmount / totalDays;
  const unusedCredit = Math.round(dailyCurrentRate * daysRemaining);

  const proratedAmount = Math.max(input.newAmount - unusedCredit, 0);

  return {
    unusedCredit,
    proratedAmount,
    fullAmount: input.newAmount,
    daysRemaining,
    totalDays,
  };
}
