"use client";

import { useReducedMotion } from "motion/react";
import { AnimateNumber } from "motion-plus/react";
import { useId, useState } from "react";
import { type Market, useMarket } from "./market-context";
import styles from "./two-markets.module.css";

const PERIOD_DAYS = 30;

type PlanId = "starter" | "pro" | "team";

const PLAN_IDS: PlanId[] = ["starter", "pro", "team"];

const PLAN_NAMES: Record<PlanId, string> = {
  starter: "Starter",
  pro: "Pro",
  team: "Team",
};

type Locale = {
  lang: string;
  intl: string;
  currency: string;
  /** Example prices in minor units, the way the API stores them. */
  prices: Record<PlanId, number>;
  provider: string;
  title: string;
  example: string;
  current: string;
  next: string;
  days: string;
  daysLeft: (days: number) => string;
  receiptTitle: string;
  rowDays: string;
  rowCredit: string;
  rowNew: string;
  rowFirst: string;
  formula: string;
  providerNote: string;
  downgradeTitle: string;
  downgradeText: string;
  ledgerStatus: string;
  samePlan: string;
  switchTo: string;
};

const LOCALES: Record<Market, Locale> = {
  latam: {
    lang: "es",
    intl: "es-UY",
    currency: "UYU",
    prices: { starter: 59000, pro: 129000, team: 299000 },
    provider: "Mercado Pago",
    title: "Probá el prorrateo",
    example: "Números de ejemplo",
    current: "Plan actual",
    next: "Plan nuevo",
    days: "Días que quedan del período",
    daysLeft: (days) => `Quedan ${days} de ${PERIOD_DAYS} días`,
    receiptTitle: "Vista previa del cambio",
    rowDays: "Días restantes",
    rowCredit: "Crédito por esos días",
    rowNew: "Precio del plan nuevo",
    rowFirst: "Primer pago",
    formula:
      "Crédito = precio actual × días restantes ÷ días del período. Primer pago = precio nuevo − crédito, con mínimo 0.",
    providerNote:
      "En Mercado Pago el upgrade es una suscripción nueva que se paga en un redirect. Pasar de mensual a anual todavía no se puede.",
    downgradeTitle: "No se cobra nada ahora",
    downgradeText: "Bajar de plan queda en el ledger y se activa al renovar. La fila no se borra.",
    ledgerStatus: "pending",
    samePlan: "Elegí un plan nuevo distinto del actual para ver la vista previa.",
    switchTo: "I sell worldwide",
  },
  world: {
    lang: "en",
    intl: "en-US",
    currency: "USD",
    prices: { starter: 1200, pro: 2900, team: 6900 },
    provider: "Polar",
    title: "Play with proration",
    example: "Example numbers",
    current: "Current plan",
    next: "New plan",
    days: "Days left in the period",
    daysLeft: (days) => `${days} of ${PERIOD_DAYS} days left`,
    receiptTitle: "Plan change preview",
    rowDays: "Days left",
    rowCredit: "Credit for those days",
    rowNew: "New plan price",
    rowFirst: "First payment",
    formula:
      "Credit = current price × days left ÷ days in the period. First payment = new price − credit, minimum 0.",
    providerNote: "Polar charges the difference on the existing subscription.",
    downgradeTitle: "Nothing is charged now",
    downgradeText: "A downgrade waits in the ledger and is applied at renewal. The row is kept.",
    ledgerStatus: "pending",
    samePlan: "Pick a new plan that differs from the current one to see the preview.",
    switchTo: "Vendo en Latinoamérica",
  },
};

type Preview = {
  kind: "upgrade" | "downgrade" | "same";
  credit: number;
  newPrice: number;
  firstPayment: number;
};

/** Credit = current price × days left ÷ days in the period. First payment = new price − credit, at least 0. */
export function previewPlanChange(
  currentPrice: number,
  newPrice: number,
  daysLeft: number,
): Preview {
  if (newPrice === currentPrice) {
    return { kind: "same", credit: 0, newPrice, firstPayment: 0 };
  }
  if (newPrice < currentPrice) {
    return { kind: "downgrade", credit: 0, newPrice, firstPayment: 0 };
  }
  const credit = Math.round((currentPrice * daysLeft) / PERIOD_DAYS);
  return { kind: "upgrade", credit, newPrice, firstPayment: Math.max(0, newPrice - credit) };
}

function money(locale: Locale, minor: number): string {
  return new Intl.NumberFormat(locale.intl, {
    style: "currency",
    currency: locale.currency,
  }).format(minor / 100);
}

/** An amount that rolls to its new value. AnimateNumber formats it with Intl, like money(). */
function Amount({
  locale,
  minor,
  negative = false,
}: {
  locale: Locale;
  minor: number;
  negative?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <>
      <span className={styles.srOnly}>{`${negative ? "\u2212" : ""}${money(locale, minor)}`}</span>
      <AnimateNumber
        aria-hidden="true"
        format={{ style: "currency", currency: locale.currency }}
        locales={locale.intl}
        prefix={negative ? "\u2212" : undefined}
        transition={
          reduceMotion
            ? { duration: 0 }
            : {
                layout: { type: "spring", visualDuration: 0.45, bounce: 0.15 },
                y: { type: "spring", visualDuration: 0.45, bounce: 0.25 },
                opacity: { duration: 0.2, ease: "linear" },
              }
        }
      >
        {minor / 100}
      </AnimateNumber>
    </>
  );
}

function PlanChoice({
  name,
  legend,
  value,
  onChange,
  locale,
}: {
  name: string;
  legend: string;
  value: PlanId;
  onChange: (plan: PlanId) => void;
  locale: Locale;
}) {
  return (
    <fieldset className={styles.playField}>
      <legend>{legend}</legend>
      <div className={styles.playChoices}>
        {PLAN_IDS.map((plan) => (
          <label className={styles.playChoice} key={plan}>
            <input
              checked={value === plan}
              name={name}
              onChange={() => onChange(plan)}
              type="radio"
              value={plan}
            />
            <span>
              <strong>{PLAN_NAMES[plan]}</strong>
              <small>{money(locale, locale.prices[plan])}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A playable preview of the proration the API returns. It follows the market picked in the hero. */
export function ProrationPlayground() {
  const { market, setMarket } = useMarket();
  const locale = LOCALES[market];
  const id = useId();
  const [current, setCurrent] = useState<PlanId>("pro");
  const [next, setNext] = useState<PlanId>("team");
  const [days, setDays] = useState(18);

  const preview = previewPlanChange(locale.prices[current], locale.prices[next], days);
  const otherMarket: Market = market === "latam" ? "world" : "latam";

  return (
    <div className={styles.play} data-market={market} lang={locale.lang}>
      <div className={styles.playControls}>
        <div className={styles.playHead}>
          <h3 className={styles.playTitle}>{locale.title}</h3>
          <div className={styles.playHeadTools}>
            <span className={styles.playSample}>{locale.example}</span>
            <button
              className={styles.playSwitch}
              lang={LOCALES[otherMarket].lang}
              onClick={() => setMarket(otherMarket)}
              type="button"
            >
              {locale.switchTo}
            </button>
          </div>
        </div>

        <PlanChoice
          legend={locale.current}
          locale={locale}
          name={`${id}-current`}
          onChange={setCurrent}
          value={current}
        />
        <PlanChoice
          legend={locale.next}
          locale={locale}
          name={`${id}-next`}
          onChange={setNext}
          value={next}
        />

        <div className={styles.playField}>
          <label className={styles.playLabel} htmlFor={`${id}-days`}>
            {locale.days}
          </label>
          <div className={styles.playSlider}>
            <div aria-hidden="true" className={styles.playDays}>
              {Array.from({ length: PERIOD_DAYS }, (_, index) => (
                <span data-left={index < days} key={index} />
              ))}
            </div>
            <input
              className={styles.playRange}
              id={`${id}-days`}
              max={PERIOD_DAYS}
              min={1}
              onChange={(event) => setDays(Number(event.target.value))}
              type="range"
              value={days}
            />
          </div>
          <span className={styles.playDaysText}>{locale.daysLeft(days)}</span>
        </div>
      </div>

      <div className={styles.playReceiptWrap}>
        <div className={styles.playReceipt} key={market}>
          <div className={styles.playReceiptHead}>
            <span>{locale.receiptTitle}</span>
            <span className={styles.playProvider}>{locale.provider}</span>
          </div>
          <p className={styles.playChange}>
            {PLAN_NAMES[current]} <span aria-hidden="true">{"\u2192"}</span>
            <span className={styles.srOnly}> to </span> {PLAN_NAMES[next]}
          </p>

          {preview.kind === "upgrade" ? (
            <dl className={styles.playRows}>
              <div>
                <dt>{locale.rowDays}</dt>
                <dd>
                  <AnimateNumber transition={{ duration: 0.25 }}>{days}</AnimateNumber>
                </dd>
              </div>
              <div>
                <dt>{locale.rowCredit}</dt>
                <dd>
                  <Amount locale={locale} minor={preview.credit} negative />
                </dd>
              </div>
              <div>
                <dt>{locale.rowNew}</dt>
                <dd>
                  <Amount locale={locale} minor={preview.newPrice} />
                </dd>
              </div>
              <div className={styles.playTotal}>
                <dt>{locale.rowFirst}</dt>
                <dd aria-atomic="true" aria-live="polite">
                  <Amount locale={locale} minor={preview.firstPayment} />
                </dd>
              </div>
            </dl>
          ) : (
            <div aria-atomic="true" aria-live="polite" className={styles.playLedger}>
              {preview.kind === "downgrade" ? (
                <>
                  <p className={styles.playLedgerTitle}>{locale.downgradeTitle}</p>
                  <p>{locale.downgradeText}</p>
                  <pre aria-label="pending_plan_change">
                    {`pending_plan_change\n ${current}-${next}  ${locale.ledgerStatus}`}
                  </pre>
                </>
              ) : (
                <p>{locale.samePlan}</p>
              )}
            </div>
          )}

          <p className={styles.playNote}>{locale.providerNote}</p>
          <p className={styles.playFormula}>{locale.formula}</p>
        </div>
      </div>
    </div>
  );
}
