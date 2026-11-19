"use client";

import { useReducedMotion } from "motion/react";
import { AnimateNumber } from "motion-plus/react";
import styles from "./two-markets.module.css";

/** One transition for every number on the page, so they all move the same way. */
export function useNumberTransition(instant = false) {
  const reduceMotion = useReducedMotion();
  return reduceMotion || instant
    ? { duration: 0 }
    : {
        layout: { type: "spring" as const, visualDuration: 0.45, bounce: 0.15 },
        y: { type: "spring" as const, visualDuration: 0.45, bounce: 0.25 },
        opacity: { duration: 0.2, ease: "linear" as const },
      };
}

/** A plain number (not money) that rolls with the same transition as the amounts. */
export function Count({ value, instant = false }: { value: number; instant?: boolean }) {
  return <AnimateNumber transition={useNumberTransition(instant)}>{value}</AnimateNumber>;
}

/**
 * A money amount that rolls to its new value. AnimateNumber formats it with Intl, so the digits,
 * the currency symbol and the separators follow the locale. Screen readers get the plain text.
 */
export function Amount({
  value,
  currency,
  locale,
  fractionDigits,
  negative = false,
  instant = false,
}: {
  /** Amount in the currency's major unit, for example 12.9 for $12.90. */
  value: number;
  currency: string;
  locale: string;
  /** Pass 0 to drop the cents. By default the currency decides. */
  fractionDigits?: number;
  negative?: boolean;
  /** Skip the roll for this change, for example when the value is reset out of sight. */
  instant?: boolean;
}) {
  const transition = useNumberTransition(instant);
  const format = {
    style: "currency" as const,
    currency,
    ...(fractionDigits === undefined
      ? {}
      : { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }),
  };
  const plain = `${negative ? "\u2212" : ""}${new Intl.NumberFormat(locale, format).format(value)}`;
  return (
    <>
      <span className={styles.srOnly}>{plain}</span>
      <AnimateNumber
        aria-hidden="true"
        format={format}
        locales={locale}
        prefix={negative ? "\u2212" : undefined}
        transition={transition}
      >
        {value}
      </AnimateNumber>
    </>
  );
}
