"use client";

import Link from "next/link";
import { CopyCommand } from "../_shared/copy-command";
import { links } from "../_shared/links";
import { Amount } from "./amount";
import { type Market, useMarket } from "./market-context";
import styles from "./two-markets.module.css";

type MarketCopy = {
  lang: string;
  toggle: string;
  title: string;
  lede: string;
  plan: string;
  cadence: string;
  provider: string;
  priceNote: string;
  priceNoteCode: string;
  copy: string;
  copied: string;
  secondary: string;
  license: string;
  env: Array<[string, string]>;
  price: { amount: number; currency: string; locale: string };
};

const COPY: Record<Market, MarketCopy> = {
  latam: {
    lang: "es",
    toggle: "Vendo en Latinoamérica",
    title: "Un starter de SaaS que cobra en pesos.",
    lede: "Para SaaS B2B, en TypeScript. Mercado Pago cobra en moneda local. Subís de plan con vista previa del prorrateo y bajás al renovar. Tras cinco intentos fallidos, un admin reintenta el cambio.",
    plan: "Plan Pro",
    cadence: "por mes",
    provider: "Mercado Pago",
    priceNote: "Ejemplo. El formato sale de",
    priceNoteCode: "DEFAULT_LOCALE",
    copy: "Copiar",
    copied: "Copiado",
    secondary: "Probá la demo",
    license: "MIT. Gratis.",
    env: [
      ["PAYMENT_PROVIDER", "mercadopago"],
      ["DEFAULT_CURRENCY", "UYU"],
      ["DEFAULT_LOCALE", "es-UY"],
    ],
    price: { amount: 1290, currency: "UYU", locale: "es-UY" },
  },
  world: {
    lang: "en",
    toggle: "I sell worldwide",
    title: "A SaaS starter that gets paid in dollars.",
    lede: "For B2B SaaS, in TypeScript. Polar is the merchant of record. The same plan-change rules and proration preview run on both providers; where one can't do something, the API says so.",
    plan: "Pro plan",
    cadence: "per month",
    provider: "Polar",
    priceNote: "Example. The format comes from",
    priceNoteCode: "DEFAULT_LOCALE",
    copy: "Copy",
    copied: "Copied",
    secondary: "Try the live demo",
    license: "MIT. Free.",
    env: [
      ["PAYMENT_PROVIDER", "polar"],
      ["DEFAULT_CURRENCY", "USD"],
      ["DEFAULT_LOCALE", "en-US"],
    ],
    price: { amount: 29, currency: "USD", locale: "en-US" },
  },
};

const MARKETS: Market[] = ["latam", "world"];

/** The hero: one switch flips the language, the price format and the payment provider. */
export function MarketHero() {
  const { market, setMarket, switched } = useMarket();
  const copy = COPY[market];

  return (
    <header className={styles.hero} data-market={market}>
      <nav aria-label="Main" className={styles.nav}>
        <Link className={styles.wordmark} href="/redesign/two-markets">
          Beztack
        </Link>
        <div className={styles.navLinks}>
          <Link href={links.docs}>Docs</Link>
          <Link href={links.quickStart}>Quick start</Link>
          <a href={links.demo} rel="noopener noreferrer" target="_blank">
            Demo
          </a>
          <a href={links.repo} rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
        </div>
      </nav>

      <div className={styles.heroBody}>
        <div className={styles.switch} role="radiogroup" aria-label="Where do you sell?">
          {MARKETS.map((option) => (
            <button
              aria-checked={market === option}
              className={styles.switchOption}
              key={option}
              lang={COPY[option].lang}
              onClick={() => setMarket(option)}
              role="radio"
              type="button"
            >
              {COPY[option].toggle}
            </button>
          ))}
        </div>

        <div className={styles.heroGrid} lang={copy.lang}>
          <div className={`${styles.heroCopy} ${switched ? styles.heroSwap : ""}`} key={market}>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.lede}>{copy.lede}</p>
            <div className={styles.actions}>
              <CopyCommand
                className={styles.btnCopy}
                copiedLabel={copy.copied}
                label={copy.copy}
                labelClassName={styles.btnCopyLabel}
                prefix={<span className={styles.btnCopyPrompt}>$ </span>}
              />
              <a
                className={styles.btnLine}
                href={links.demo}
                rel="noopener noreferrer"
                target="_blank"
              >
                {copy.secondary}
              </a>
            </div>
            <p className={styles.license}>{copy.license}</p>
          </div>

          <div className={styles.priceSide}>
            <div className={styles.priceCard}>
              <div className={styles.priceTop}>
                <span>{copy.plan}</span>
                <span className={styles.providerChip}>{copy.provider}</span>
              </div>
              <div className={styles.price}>
                <Amount
                  currency={copy.price.currency}
                  fractionDigits={0}
                  locale={copy.price.locale}
                  value={copy.price.amount}
                />
              </div>
              <p className={styles.cadence}>{copy.cadence}</p>
              <p className={styles.priceNote}>
                {copy.priceNote} <code>{copy.priceNoteCode}</code>.
              </p>
            </div>
            <pre aria-label="apps/api/.env" className={styles.env}>
              <span className={styles.envFile}>apps/api/.env</span>
              {copy.env.map(([key, value]) => (
                <span className={styles.envLine} key={key}>
                  <span className={styles.envKey}>{key}</span>=
                  <span className={styles.envValue}>"{value}"</span>
                </span>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </header>
  );
}
