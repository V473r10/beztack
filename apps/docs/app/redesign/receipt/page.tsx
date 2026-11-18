import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import { CopyCommand } from "../_shared/copy-command";
import { CREATE_COMMAND, links } from "../_shared/links";
import styles from "./receipt.module.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["wdth", "opsz"],
  variable: "--font-receipt-display",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-receipt-mono",
});

export const metadata: Metadata = {
  title: "Beztack - Your SaaS, itemized",
  description:
    "A TypeScript starter for B2B SaaS: Mercado Pago and Polar billing, sign-in with 2FA, organizations, two languages and docs your coding agents can read.",
};

type ReceiptLine = { label: string; amount: string };
type Department = { name: string; lines: ReceiptLine[] };

const RECEIPT: Department[] = [
  {
    name: "Billing",
    lines: [
      { label: "Mercado Pago subscriptions", amount: "incl" },
      { label: "Polar, merchant of record", amount: "incl" },
      { label: "Plan changes + proration", amount: "incl" },
      { label: "Pending change ledger", amount: "incl" },
    ],
  },
  {
    name: "Sign-in",
    lines: [
      { label: "Email + password, 2FA", amount: "incl" },
      { label: "Leaked password check", amount: "incl" },
    ],
  },
  {
    name: "Teams",
    lines: [
      { label: "Orgs, teams, invitations", amount: "incl" },
      { label: "Admin: users, analytics", amount: "incl" },
    ],
  },
  {
    name: "Languages",
    lines: [{ label: "English + Spanish", amount: "incl" }],
  },
  {
    name: "For your agents",
    lines: [
      { label: "AGENTS.md + glossary", amount: "incl" },
      { label: "7 design decisions", amount: "incl" },
    ],
  },
  {
    name: "Quality",
    lines: [{ label: "127 test files", amount: "incl" }],
  },
];

const BACKORDER = [
  ["Stripe and other providers", "Not yet"],
  ["OAuth, magic link, passkeys", "Not yet"],
  ["Template updates as pull requests", "Designed, not built"],
  ["Dockerfile, Cloudflare config", "Not yet"],
] as const;

function Receipt() {
  return (
    <div className={styles.printer}>
      <div aria-hidden="true" className={styles.slot} />
      <div className={styles.feed}>
        <section aria-label="What the starter includes" className={styles.receipt}>
          <header className={styles.receiptHead}>
            <strong>BEZTACK</strong>
            <span>TypeScript SaaS starter</span>
          </header>
          <div className={styles.receiptMeta}>
            <span>Order 0001</span>
            <span>Qty 1 monorepo</span>
          </div>

          {RECEIPT.map((dept) => (
            <div key={dept.name}>
              <p className={styles.dept}>{dept.name}</p>
              {dept.lines.map((line) => (
                <p className={styles.line} key={line.label}>
                  <span>{line.label}</span>
                  <span aria-hidden="true" className={styles.leader} />
                  <span className={styles.amount}>{line.amount}</span>
                </p>
              ))}
            </div>
          ))}

          <div className={styles.totals}>
            <p className={styles.line}>
              <span>License</span>
              <span aria-hidden="true" className={styles.leader} />
              <span>MIT</span>
            </p>
            <p className={`${styles.line} ${styles.grand}`}>
              <span>Total</span>
              <span aria-hidden="true" className={styles.leader} />
              <span>$0.00</span>
            </p>
          </div>

          <div aria-hidden="true" className={styles.barcode} />
          <p className={styles.thanks}>Keep this receipt. It is the code.</p>

          <span aria-hidden="true" className={styles.stamp}>
            YOURS TO KEEP
          </span>
        </section>
      </div>
    </div>
  );
}

function ProrationTicket() {
  return (
    <figure
      aria-label="Example of a proration preview"
      className={`${styles.ticket} ${styles.mono}`}
    >
      <div className={styles.ticketHead}>
        <strong>Upgrade preview</strong>
        <span>Starter to Pro, monthly</span>
      </div>
      <div className={styles.ticketRow}>
        <span>Days left in period</span>
        <b>12</b>
      </div>
      <div className={styles.ticketRow}>
        <span>Credit for unused days</span>
        <b>-US$ 7.60</b>
      </div>
      <div className={styles.ticketRow}>
        <span>Pro, full price</span>
        <b>US$ 49.00</b>
      </div>
      <div className={styles.ticketTotal}>
        <span>First payment</span>
        <span>US$ 41.40</span>
      </div>
      <figcaption className={styles.ticketNote}>
        Example numbers. The API returns these four values before the customer accepts, and nothing
        changes until they do.
      </figcaption>
    </figure>
  );
}

export default function ReceiptLanding() {
  return (
    <div className={`${styles.page} ${display.variable} ${mono.variable}`}>
      <div className={styles.top}>
        <nav aria-label="Main" className={styles.nav}>
          <Link className={styles.wordmark} href="/redesign/receipt">
            Beztack
          </Link>
          <div className={styles.navLinks}>
            <Link href={links.docs}>Docs</Link>
            <a href={links.demo} rel="noopener noreferrer" target="_blank">
              Live demo
            </a>
            <a href={links.repo} rel="noopener noreferrer" target="_blank">
              GitHub
            </a>
          </div>
        </nav>

        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <h1 className={styles.title}>Your SaaS, itemized.</h1>
            <p className={styles.lede}>
              Billing that works in Latin America and worldwide, sign-in with 2FA, teams, two
              languages and docs your coding agents can read. Already built, already tested, and
              yours under MIT.
            </p>
            <div className={styles.actions}>
              <Link className={styles.btnPrimary} href={links.quickStart}>
                Read the quick start
              </Link>
              <a
                className={styles.btnGhost}
                href={links.demo}
                rel="noopener noreferrer"
                target="_blank"
              >
                Open the live demo
              </a>
            </div>
            <CopyCommand
              className={`${styles.command} ${styles.mono}`}
              labelClassName={styles.copyTag}
              prefix={<span className={styles.prompt}>$ </span>}
            />
          </div>
          <Receipt />
        </header>
      </div>

      <main>
        <section aria-labelledby="items-title" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2} id="items-title">
              Every line on the receipt, explained.
            </h2>
            <p className={styles.sectionLede}>
              The parts most starters leave for later are the parts that take a month: changing
              plans mid-cycle, a second payment provider, teams, a second language. Here they are
              done.
            </p>
          </div>

          <div className={styles.items}>
            <article className={styles.itemWide}>
              <div>
                <div className={styles.figure}>2 providers, 1 interface</div>
                <h3 className={styles.itemTitle}>Charge in pesos or in dollars</h3>
                <p className={styles.itemText}>
                  Mercado Pago bills in local currency across Latin America. Polar sells worldwide
                  as merchant of record and handles the tax. One environment variable picks the
                  provider, and the API never branches on its name.
                </p>
                <ul className={styles.itemList}>
                  <li>Upgrades, downgrades and monthly to yearly changes</li>
                  <li>Downgrades wait in a ledger and apply at renewal</li>
                  <li>A change that keeps failing goes to an admin to retry</li>
                  <li>Admins can grant a tier without charging anyone</li>
                  <li>Prices stored as whole cents with their currency code</li>
                </ul>
                <Link className={styles.itemLink} href={links.planChanges}>
                  How plan changes work
                </Link>
              </div>
              <ProrationTicket />
            </article>

            <article className={styles.item}>
              <div className={styles.figure}>2FA</div>
              <h3 className={styles.itemTitle}>Sign-in that says no</h3>
              <p className={styles.itemText}>
                Better Auth with email and password and authenticator-app codes. Passwords found in
                known breaches are refused, at sign-up and on every reset.
              </p>
              <Link className={styles.itemLink} href={links.auth}>
                Sign-in docs
              </Link>
            </article>

            <article className={styles.item}>
              <div className={styles.figure}>1 org each</div>
              <h3 className={styles.itemTitle}>Teams from day one</h3>
              <p className={styles.itemText}>
                Organizations with teams, invitations by email and roles. Bill each person or each
                organization. By default, every new user gets an organization of their own.
              </p>
            </article>

            <article className={styles.item}>
              <div className={styles.figure}>en / es</div>
              <h3 className={styles.itemTitle}>Two languages, written by people</h3>
              <p className={styles.itemText}>
                The app ships in English and in Spanish written with vos. Money and dates follow the
                reader's language. A test fails if a Spanish string slips into tú.
              </p>
            </article>

            <article className={styles.item}>
              <div className={styles.figure}>7 ADRs</div>
              <h3 className={styles.itemTitle}>Docs your agents can read</h3>
              <p className={styles.itemText}>
                AGENTS.md, a domain glossary and seven recorded design decisions. The docs site also
                serves everything as one plain text file.
              </p>
              <Link className={styles.itemLink} href={links.llms}>
                Open llms-full.txt
              </Link>
            </article>

            <article className={styles.item}>
              <div className={styles.figure}>127</div>
              <h3 className={styles.itemTitle}>Test files, plus a live check</h3>
              <p className={styles.itemText}>
                Unit and route tests across the API, the app and the packages. A smoke test checks
                the deployed site, and /api/health checks the database.
              </p>
            </article>

            <article className={styles.item}>
              <div className={styles.figure}>3 apps</div>
              <h3 className={styles.itemTitle}>One monorepo</h3>
              <p className={styles.itemText}>
                A Vite and React app, a Nitro API and this Next.js docs site, with Drizzle on
                PostgreSQL and five React Email templates sent through Resend.
              </p>
              <Link className={styles.itemLink} href={links.architecture}>
                See the architecture
              </Link>
            </article>
          </div>
        </section>

        <section aria-labelledby="backorder-title" className={styles.backorder}>
          <div className={styles.backorderInner}>
            <div>
              <h2 className={styles.h2} id="backorder-title">
                Not on the receipt yet.
              </h2>
              <p>
                We would rather tell you now than have you find out in production. These are on the
                roadmap and not in the code today.
              </p>
            </div>
            <ul className={`${styles.backorderList} ${styles.mono}`}>
              {BACKORDER.map(([item, status]) => (
                <li key={item}>
                  <span>{item}</span>
                  <span>{status}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="stub-title" className={styles.stubWrap}>
          <div className={styles.stub}>
            <div className={styles.stubMain}>
              <h2 className={styles.h2} id="stub-title">
                Start with the boring month already done.
              </h2>
              <p>
                Scaffold a project, add your Mercado Pago or Polar keys and run it on your machine.
              </p>
              <CopyCommand className={`${styles.stubCommand} ${styles.mono}`} />
            </div>
            <div className={styles.stubSide}>
              <Link href={links.quickStart}>Quick start</Link>
              <a href={links.demo} rel="noopener noreferrer" target="_blank">
                Live demo
              </a>
              <a href={links.repo} rel="noopener noreferrer" target="_blank">
                Source on GitHub
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>Beztack, an MIT licensed TypeScript SaaS starter.</span>
          <span>
            <Link href={links.docs}>Docs</Link>
            <a href={links.repo} rel="noopener noreferrer" target="_blank">
              GitHub
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
