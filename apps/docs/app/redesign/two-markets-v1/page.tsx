import type { Metadata } from "next";
import { Big_Shoulders, Hanken_Grotesk } from "next/font/google";
import Link from "next/link";
import { CopyCommand } from "../_shared/copy-command";
import { links } from "../_shared/links";
import { MarketHero } from "./market-hero";
import styles from "./two-markets.module.css";

const display = Big_Shoulders({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-markets-display",
});

const body = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-markets-body",
});

export const metadata: Metadata = {
  title: "Beztack - One codebase, two ways to get paid",
  description:
    "A TypeScript starter for B2B SaaS that charges in Latin America with Mercado Pago and worldwide with Polar, with sign-in, teams, two languages and tests already built.",
};

const CONSTANTS = [
  {
    word: "Sign-in",
    text: "Email and password with Better Auth, authenticator-app codes, and passwords from known breaches refused.",
  },
  {
    word: "Teams",
    text: "Organizations with teams, invitations and roles. Bill each person or each organization.",
  },
  {
    word: "Admin",
    text: "An admin area with users, analytics, failed plan changes to retry and tiers granted without a charge.",
  },
  {
    word: "Language",
    text: "The app in English and in Spanish written with vos. Money and dates follow the reader's language.",
  },
  {
    word: "Agents",
    text: "AGENTS.md, a domain glossary, seven recorded design decisions and the whole docs site as llms-full.txt.",
  },
  {
    word: "Tests",
    text: "127 test files across the API, the app and the packages, a smoke test against the live site and a health check.",
  },
  {
    word: "Email",
    text: "Five React Email templates sent with Resend: welcome, password reset, invitation, subscription and a sample.",
  },
] as const;

const TIMELINE = [
  {
    when: "Before anything changes",
    title: "Preview",
    text: "The API returns the days left, the credit for them, the new price and the first payment.",
  },
  {
    when: "After the first payment",
    title: "Upgrade",
    text: "The membership moves only when the provider confirms the payment.",
  },
  {
    when: "At the next renewal",
    title: "Downgrade",
    text: "It waits in a ledger. Rows are never deleted, so you can see who asked and when.",
  },
  {
    when: "After five failed tries",
    title: "Retry",
    text: "The change is marked failed and shows up for an admin, who can send it back to the queue.",
  },
] as const;

export default function TwoMarketsLanding() {
  return (
    <div className={`${styles.page} ${display.variable} ${body.variable}`}>
      <MarketHero />

      <main>
        <section aria-labelledby="constants-title" className={styles.section}>
          <div className={styles.split}>
            <h2 className={styles.h2} id="constants-title">
              Three lines change. The rest stays put.
            </h2>
            <p className={styles.sectionLede}>
              Switching providers is a change to your environment file. Everything a customer
              touches after they pay works the same way in both markets.
            </p>
          </div>

          <dl className={styles.constants}>
            {CONSTANTS.map((row) => (
              <div className={styles.constantRow} key={row.word}>
                <dt className={styles.constantWord}>{row.word}</dt>
                <dd className={styles.constantText}>{row.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="timeline-title" className={styles.timelineSection}>
          <div className={styles.section}>
            <div className={styles.split}>
              <h2 className={styles.h2} id="timeline-title">
                A plan change, start to finish.
              </h2>
              <p className={styles.sectionLede}>
                This is the part that takes a month to get right. It runs on one adapter interface,
                so the same rules apply to both providers.
              </p>
            </div>

            <ol className={styles.timeline}>
              {TIMELINE.map((step) => (
                <li className={styles.step} key={step.title}>
                  <span className={styles.stepWhen}>{step.when}</span>
                  <span aria-hidden="true" className={styles.stepDot} />
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </li>
              ))}
            </ol>

            <div className={styles.honest}>
              <p>
                <strong>Monthly to yearly?</strong> Polar can move a subscription to another
                cadence. Mercado Pago cannot change an existing subscription's frequency, so the API
                refuses the request instead of guessing. The adapter declares it, and the API reads
                the flag, never the provider name.
              </p>
              <Link className={styles.textLink} href={links.planChanges}>
                Read how plan changes work
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="start-title" className={styles.start}>
          <div className={styles.startInner}>
            <h2 className={styles.startTitle} id="start-title">
              Pick your market later. Start today.
            </h2>
            <CopyCommand
              className={styles.startCommand}
              labelClassName={styles.startCopy}
              prefix={<span className={styles.startPrompt}>$ </span>}
            />
            <div className={styles.startLinks}>
              <Link href={links.quickStart}>Quick start</Link>
              <a href={links.demo} rel="noopener noreferrer" target="_blank">
                Live demo
              </a>
              <a href={links.repo} rel="noopener noreferrer" target="_blank">
                GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Beztack is MIT licensed.</span>
        <span>Not built yet: Stripe, OAuth, magic links, passkeys, template sync.</span>
      </footer>
    </div>
  );
}
