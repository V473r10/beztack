const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY =
  MILLISECONDS_PER_SECOND *
  SECONDS_PER_MINUTE *
  MINUTES_PER_HOUR *
  HOURS_PER_DAY;

export type ProrationEstimate = {
  unusedCredit: number;
  proratedAmount: number;
  fullAmount: number;
  daysRemaining: number;
  totalDays: number;
};

/**
 * Client-side proration estimate for immediate UI feedback.
 *
 * Mirrors the server-side calculation in
 * `@beztack/mercadopago/helpers/proration.ts`.
 */
export function estimateProration(opts: {
  currentAmount: number;
  newAmount: number;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}): ProrationEstimate {
  const now = new Date();

  const totalMs =
    opts.currentPeriodEnd.getTime() - opts.currentPeriodStart.getTime();
  const remainingMs = opts.currentPeriodEnd.getTime() - now.getTime();

  const totalDays = Math.max(Math.ceil(totalMs / MILLISECONDS_PER_DAY), 1);
  const daysRemaining = Math.max(
    Math.ceil(remainingMs / MILLISECONDS_PER_DAY),
    0
  );

  const dailyCurrentRate = opts.currentAmount / totalDays;
  const unusedCredit = Math.round(dailyCurrentRate * daysRemaining);

  const proratedAmount = Math.max(opts.newAmount - unusedCredit, 0);

  return {
    unusedCredit,
    proratedAmount,
    fullAmount: opts.newAmount,
    daysRemaining,
    totalDays,
  };
}
