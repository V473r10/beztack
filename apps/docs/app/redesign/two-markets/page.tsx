import type { Metadata } from "next";
import { Big_Shoulders, Hanken_Grotesk } from "next/font/google";
import Link from "next/link";
import { CopyCommand } from "../_shared/copy-command";
import { links } from "../_shared/links";
import { MarketHero } from "./market-hero";
import { MarketProvider } from "./market-context";
import { ProrationPlayground } from "./proration-playground";
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
  title: "Beztack: open-source TypeScript starter for B2B SaaS with Mercado Pago and Polar",
  description:
    "MIT-licensed TypeScript starter for B2B SaaS. Charges in local currency with Mercado Pago or worldwide with Polar, with plan changes, teams, 2FA, English and Spanish, and 131 test files.",
  openGraph: {
    type: "website",
    title: "Beztack: open-source TypeScript starter for B2B SaaS with Mercado Pago and Polar",
    description:
      "MIT-licensed TypeScript starter for B2B SaaS. Charges in local currency with Mercado Pago or worldwide with Polar, with plan changes, teams, 2FA, English and Spanish, and 131 test files.",
  },
};

const SVGL = "https://svgl.app/library";

/** A library logo. Decorative: the name is always written next to it. */
function Logo({ src, size = 28 }: { src: string; size?: number }) {
  return (
    <img
      alt=""
      className={styles.logo}
      height={size}
      loading="lazy"
      src={src}
      style={{ height: size, width: "auto", maxWidth: size * 1.6 }}
      width={size}
    />
  );
}

const RULES = [
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

const STACK_GROUPS = [
  {
    label: "Billing",
    tools: [
      { name: "Mercado Pago", logo: `${SVGL}/mercado-pago.svg` },
      { name: "Polar", logo: `${SVGL}/polar-sh_light.svg` },
    ],
  },
  {
    label: "Auth",
    tools: [{ name: "Better Auth", logo: `${SVGL}/better-auth_light.svg` }],
  },
  {
    label: "Data",
    tools: [
      { name: "Drizzle", logo: `${SVGL}/drizzle-orm_light.svg` },
      { name: "PostgreSQL", logo: `${SVGL}/postgresql.svg` },
    ],
  },
  {
    label: "App",
    tools: [
      { name: "React", logo: `${SVGL}/react_light.svg` },
      { name: "Vite", logo: `${SVGL}/vite.svg` },
      { name: "Tailwind CSS", logo: `${SVGL}/tailwindcss.svg` },
      { name: "shadcn/ui", logo: `${SVGL}/shadcn-ui.svg` },
    ],
  },
  {
    label: "API",
    tools: [{ name: "Nitro", logo: "https://nitro.build/icon.svg" }],
  },
  {
    label: "Quality",
    tools: [
      { name: "Vitest", logo: `${SVGL}/vitest.svg` },
      { name: "Playwright", logo: `${SVGL}/playwright.svg` },
    ],
  },
  {
    label: "Email",
    tools: [{ name: "Resend", logo: `${SVGL}/resend-icon-black.svg` }],
  },
] as const;

function StackBand() {
  return (
    <section aria-label="Stack" className={styles.band}>
      {/* On a phone the groups scroll sideways, so the region must be reachable by keyboard. */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region */}
      <div
        aria-label="Stack, scrolls sideways on small screens"
        className={styles.bandInner}
        role="group"
        tabIndex={0}
      >
        {STACK_GROUPS.map((group) => (
          <div
            className={`${styles.bandGroup} ${group.label === "App" ? styles.bandWide : ""}`}
            key={group.label}
          >
            <p className={styles.bandLabel}>{group.label}</p>
            <ul className={styles.bandTools}>
              {group.tools.map((tool) => (
                <li key={tool.name}>
                  <Logo size={22} src={tool.logo} />
                  <span>{tool.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdapterDiagram() {
  return (
    <div
      className={styles.diagram}
      role="img"
      aria-label="Mercado Pago and Polar both plug into PaymentProviderAdapter, which your app calls"
    >
      <div className={styles.diagramProviders}>
        <span className={`${styles.provider} ${styles.providerMp}`}>
          <Logo size={26} src={`${SVGL}/mercado-pago.svg`} />
          Mercado Pago
        </span>
        <span className={`${styles.provider} ${styles.providerPolar}`}>
          <Logo size={22} src={`${SVGL}/polar-sh_light.svg`} />
          Polar
        </span>
      </div>
      <svg
        aria-hidden="true"
        className={styles.diagramJoin}
        preserveAspectRatio="none"
        viewBox="0 0 40 100"
      >
        <path d="M0 25 C 24 25, 16 50, 40 50" />
        <path d="M0 75 C 24 75, 16 50, 40 50" />
      </svg>
      <span className={styles.adapter}>PaymentProviderAdapter</span>
      <span aria-hidden="true" className={styles.diagramLine} />
      <span className={styles.diagramApp}>Your app</span>
    </div>
  );
}

const ADAPTER_FILE = "packages/payments/core/src/types.ts";

const CAPABILITIES = [
  {
    flag: "proratedUpgrade",
    mercadoPago: {
      supported: false,
      label: "No",
      text: "An upgrade is a new subscription, paid at a redirect.",
    },
    polar: {
      supported: true,
      label: "Yes",
      text: "Polar charges the prorated difference on the existing subscription.",
    },
  },
  {
    flag: "cadenceChange",
    mercadoPago: {
      supported: false,
      label: "Not yet",
      text: "The API refuses it today. It is on the roadmap.",
    },
    polar: {
      supported: true,
      label: "Yes",
      text: "Moves the subscription to the other cadence, for example monthly to yearly.",
    },
  },
] as const;

// Copied from the files above. Doc comments and the other adapter methods are left out.
const ADAPTER_SNIPPET = `export type PaymentProviderCapabilities = {
  readonly proratedUpgrade: boolean;
  readonly cadenceChange: boolean;
};

export type PaymentProviderAdapter = {
  readonly provider: PaymentProviderName;
  readonly capabilities: PaymentProviderCapabilities;
  // …
  updateSubscription(
    subscriptionId: string,
    options: UpdateSubscriptionOptions,
  ): Promise<Subscription>;
  // …
};`;

const PROVIDER_SNIPPET = `// Mercado Pago
capabilities: { cadenceChange: false, proratedUpgrade: false },

// Polar
capabilities: { cadenceChange: true, proratedUpgrade: true },`;

// Copied from packages/db/src/schema.ts. Columns after `interval` are left out.
const SCHEMA_SNIPPET = `export const plan = pgTable("plan", {
  id: text("id").primaryKey(),
  price: integer("price").notNull(),
  currency: text("currency").notNull(),
  interval: text("interval"),
  // …
});`;

const TOKEN =
  /(\/\/.*)|\b(export|const|type|readonly)\b|\b(true|false)\b|\b(boolean|string|integer|text|Promise)\b|\b([A-Z][A-Za-z]+)\b|\b([a-z][A-Za-z]*)(?=\??:|\()/g;

const TOKEN_CLASSES = [
  styles.tokComment,
  styles.tokKeyword,
  styles.tokBool,
  styles.tokBuiltin,
  styles.tokType,
  styles.tokProp,
] as const;

/** Highlights one line of TypeScript by hand, so the page needs no syntax library. */
function highlight(line: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push(line.slice(last, index));
    }
    const group = match.slice(1).findIndex((value) => value !== undefined);
    parts.push(
      <span className={TOKEN_CLASSES[group]} key={index}>
        {match[0]}
      </span>,
    );
    last = index + match[0].length;
  }
  if (last < line.length) {
    parts.push(line.slice(last));
  }
  return parts;
}

function Code({ source }: { source: string }) {
  return (
    <pre className={styles.codeBlock}>
      <code>
        {source.split("\n").map((line, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static lines never reorder
          <span className={styles.codeLine} key={index}>
            {highlight(line)}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  );
}

const MEMBERS = [
  { initials: "FV", role: "Owner" },
  { initials: "AM", role: "Admin" },
  { initials: "LC", role: "Member" },
] as const;

const ADMIN_ROWS = [
  { org: "Acme", change: "Pro to Team", action: "Retry", retry: true },
  { org: "Norte SRL", change: "Team to Pro", action: "Retry", retry: true },
  { org: "Lumen", change: "Free to Pro", action: "No charge", retry: false },
] as const;

const SAMPLE_DATE = new Date(Date.UTC(2026, 10, 12));

const INTL_ROWS = [
  { locale: "es-UY", currency: "UYU", amount: 1290 },
  { locale: "en-US", currency: "USD", amount: 29 },
] as const;

function formatSample(locale: string, currency: string, amount: number) {
  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    SAMPLE_DATE,
  );
  return { money, date };
}

const TEST_FILES = 131;

const EMAIL_TEMPLATES = [
  "Welcome",
  "Password reset",
  "Organization invitation",
  "Subscription confirmation",
  "Sample",
] as const;

// Titles copied from docs/adr.
const ADRS = [
  { id: "0002", title: "Beztack owns Pending Plan change state" },
  { id: "0004", title: "App admin tier overrides stay outside payment providers" },
  { id: "0007", title: "Prices are integer minor units with an ISO 4217 currency code" },
] as const;

function SampleTag() {
  return <span className={styles.sample}>Sample data</span>;
}

function Bento() {
  return (
    <div className={styles.bento}>
      <article className={`${styles.tile} ${styles.tileAuth} ${styles.span4}`}>
        <div className={styles.authCopy}>
          <div className={styles.tileHead}>
            <Logo src={`${SVGL}/better-auth_light.svg`} />
            <span>Better Auth</span>
          </div>
          <h3 className={styles.tileTitle}>2FA and breached-password checks</h3>
          <p className={styles.tileText}>
            Email and password, codes from an authenticator app, and passwords from known breaches
            refused at sign-up, on password change and on reset. Checked against Have I Been Pwned.
          </p>
        </div>
        <div aria-hidden="true" className={styles.authDemo}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>New password</span>
            <span className={styles.fieldInput}>••••••••••</span>
            <span className={styles.fieldWarn}>This password appeared in a data breach.</span>
          </div>
          <div className={styles.otp}>
            {["4", "8", "2", "9", "1", "3"].map((digit, index) => (
              <span key={`${digit}-${index}`}>{digit}</span>
            ))}
          </div>
        </div>
      </article>

      <article className={`${styles.tile} ${styles.tileWhite} ${styles.span2}`}>
        <div className={styles.tileHead}>
          <span>Organizations</span>
        </div>
        <h3 className={styles.tileTitle}>Teams and roles, billed per org or per user</h3>
        <p className={styles.tileText}>
          Invitations, roles and teams. Each new user gets an organization of their own.
        </p>
        <code className={styles.envChip}>SUBSCRIPTION_MODE=organization</code>
        <ul aria-label="Sample members" className={styles.members}>
          {MEMBERS.map((member) => (
            <li key={member.initials}>
              <span className={styles.avatar}>{member.initials}</span>
              <span className={styles.role}>{member.role}</span>
            </li>
          ))}
          <li>
            <span className={`${styles.avatar} ${styles.avatarInvite}`}>+</span>
            <span className={styles.role}>Invite</span>
          </li>
        </ul>
      </article>

      <article className={`${styles.tile} ${styles.tileCeleste} ${styles.span2}`}>
        <div className={styles.tileHead}>
          <span>i18next and Intl</span>
        </div>
        <h3 className={styles.tileTitle}>English and Spanish</h3>
        <div className={styles.speech}>
          <p lang="es">Ingresá el código de 6 dígitos de tu app de autenticación.</p>
        </div>
        <div className={styles.intl}>
          {INTL_ROWS.map((row) => {
            const sample = formatSample(row.locale, row.currency, row.amount);
            return (
              <div key={row.locale}>
                <code>{row.locale}</code>
                <strong>{sample.money}</strong>
                <span>{sample.date}</span>
              </div>
            );
          })}
        </div>
        <p className={styles.tileNote}>
          Spanish ships with vos today. Tú and a formal usted are on the roadmap.
        </p>
      </article>

      <article className={`${styles.tile} ${styles.tileSun} ${styles.span4}`}>
        <div className={styles.adminLayout}>
          <div>
            <div className={styles.tileHead}>
              <span>Admin area</span>
            </div>
            <h3 className={styles.tileTitle}>
              Retry failed plan changes, grant tiers without a charge
            </h3>
            <p className={styles.tileText}>
              Users, analytics, the plan changes that failed after five tries, and tier overrides
              that never touch the payment provider. The plan catalog syncs from here too.
            </p>
          </div>
          <div className={styles.adminTable}>
            <SampleTag />
            <table aria-label="Sample admin queue">
              <thead>
                <tr>
                  <th scope="col">Organization</th>
                  <th scope="col">Change</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {ADMIN_ROWS.map((row) => (
                  <tr key={row.org}>
                    <th scope="row">{row.org}</th>
                    <td>{row.change}</td>
                    <td>
                      <span className={row.retry ? styles.retry : styles.noCharge}>
                        {row.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </article>

      <article className={`${styles.tile} ${styles.tileWhite} ${styles.span3}`}>
        <div className={styles.tileHead}>
          <Logo src={`${SVGL}/drizzle-orm_light.svg`} />
          <Logo src={`${SVGL}/postgresql.svg`} />
          <Logo src={`${SVGL}/resend-icon-black.svg`} />
          <span>Drizzle, PostgreSQL and Resend</span>
        </div>
        <h3 className={styles.tileTitle}>
          A typed schema, SQL migrations and five email templates
        </h3>
        <div className={styles.dataEmail}>
          <div className={styles.dataSide}>
            <p className={styles.tileText}>
              Prices are integers in the currency's minor unit, next to an ISO 4217 code.
            </p>
            <figure className={styles.tileCode}>
              <Code source={SCHEMA_SNIPPET} />
              <figcaption>
                <span>packages/db/src/schema.ts</span>
                <span>0009_prices_minor_units.sql</span>
              </figcaption>
            </figure>
          </div>
          <div className={styles.mailSide}>
            <p className={styles.tileText}>React Email, sent through Resend.</p>
            <ul aria-label="The five templates" className={styles.templates}>
              {EMAIL_TEMPLATES.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      <article className={`${styles.tile} ${styles.tileNavy} ${styles.span3}`}>
        <div className={styles.tileHead}>
          <Logo src={`${SVGL}/vitest.svg`} />
          <Logo src={`${SVGL}/playwright.svg`} />
          <span>Vitest, Playwright and coding agents</span>
        </div>
        <h3 className={styles.tileTitle}>Built to be checked</h3>
        <div className={styles.checkedTests}>
          <p aria-hidden="true" className={styles.bigNumber}>
            {TEST_FILES}
          </p>
          <p className={styles.tileText}>
            test files. Vitest covers the API, the app and the packages, Playwright runs end to end,
            a smoke test checks the published site, and <code>/api/health</code> checks the
            database.
          </p>
        </div>
        <div className={styles.checkedAgents}>
          <pre aria-label="Files for agents" className={styles.tree}>
            {`AGENTS.md
CONTEXT.md        glossary
llms-full.txt     all docs`}
          </pre>
          <ul aria-label="Some of the decision records" className={styles.adrList}>
            {ADRS.map((adr) => (
              <li key={adr.id}>
                <code>{adr.id}</code>
                <span>{adr.title}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.tileLinks}>
          <Link className={styles.tileLink} href={links.llms}>
            Open llms-full.txt
          </Link>
          <a
            className={styles.tileLink}
            href={`${links.repo}/tree/main/docs/adr`}
            rel="noopener noreferrer"
            target="_blank"
          >
            Read the ADRs
          </a>
        </div>
      </article>
    </div>
  );
}

const NOT_YET = [
  {
    group: "Billing",
    items: ["Monthly to yearly on Mercado Pago", "Stripe and other providers"],
  },
  {
    group: "Sign-in",
    items: ["OAuth", "Magic links", "Passkeys", "API keys"],
  },
  {
    group: "Language",
    items: ["Choosing vos, tú or usted"],
  },
  {
    group: "Operations",
    items: ["Template sync", "A Dockerfile", "Cloudflare config"],
  },
] as const;

const FAQ = [
  {
    question: "Can I add another payment provider?",
    answer: (
      <>
        Yes. Implement <code>PaymentProviderAdapter</code> for it and declare what it can do in{" "}
        <code>capabilities</code>. The API reads those flags, so it knows what to refuse. Start from{" "}
        <Link className={styles.faqLink} href={links.payments}>
          Payments Core
        </Link>
        .
      </>
    ),
  },
  {
    question: "Do I bill people or organizations?",
    answer: (
      <>
        Either one. <code>SUBSCRIPTION_MODE</code> is <code>user</code> or <code>organization</code>
        , and <code>organization</code> is the default.
      </>
    ),
  },
  {
    question: "What happens when a plan change fails at renewal?",
    answer: (
      <>
        A downgrade, or a cadence change on a provider that supports it, waits in a ledger and is
        applied at the next renewal. After five failed tries it is marked failed and shows up in the
        admin area, where an admin can send it back to the queue.
      </>
    ),
  },
  {
    question: "Is it available in Spanish?",
    answer: (
      <>
        Yes. The app ships in English and Spanish. The Spanish uses vos today, and a test fails if a
        tú slips in. Choosing vos, tú or a formal usted is not possible yet and is on the roadmap.
        Amounts and dates follow the language through Intl.{" "}
        <a
          className={styles.faqLink}
          href={`${links.repo}/blob/main/apps/ui/src/lib/i18n/locales.test.ts`}
          rel="noopener noreferrer"
          target="_blank"
        >
          Read the test
        </a>
      </>
    ),
  },
  {
    question: "How much does it cost?",
    answer: <>Nothing. Beztack is MIT licensed. Mercado Pago and Polar charge their own fees.</>,
  },
] as const;

// From the Quick Start in README.md.
const FIRST_RUN = [
  {
    title: "Install and configure",
    command: "pnpm install",
    text: "Copy the three .env.example files, then set DATABASE_URL, BETTER_AUTH_SECRET and your provider's keys.",
  },
  {
    title: "Create the tables",
    command: "pnpm db:migrate",
    text: "Applies the SQL migrations to your database.",
  },
  {
    title: "Run it",
    command: "pnpm dev",
    text: "The UI is on 5173, the API on 3000 and the docs on 3002.",
  },
] as const;

function NotYet() {
  return (
    <section aria-labelledby="not-yet-title" className={styles.section}>
      <div className={styles.faqGrid}>
        <div>
          <h2 className={styles.h2} id="not-yet-title">
            Not here yet.
          </h2>
          <p className={styles.notYetLede}>
            Beztack doesn't have these today. Better to know before you clone.
          </p>
          <div className={styles.notYet}>
            {NOT_YET.map((entry) => (
              <section className={styles.notYetGroup} key={entry.group}>
                <h3>{entry.group}</h3>
                <ul>
                  {entry.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>
        <div className={styles.faq}>
          <h2 className={styles.faqTitle}>Questions</h2>
          {FAQ.map((item) => (
            <details className={styles.faqItem} key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function TwoMarketsLanding() {
  return (
    <div className={`${styles.page} ${display.variable} ${body.variable}`}>
      <MarketProvider>
        <MarketHero />

        <main>
          <StackBand />

          <section aria-labelledby="timeline-title" className={styles.timelineSection}>
            <div className={styles.section}>
              <div className={styles.planIntro}>
                <h2 className={styles.h2} id="timeline-title">
                  A plan change, start to finish.
                </h2>
                <p className={styles.sectionLede}>
                  Proration, downgrades and failed renewals are where billing code usually breaks.
                  All of it runs on one adapter interface, so the rules live in the API and not in
                  the provider code.
                </p>
              </div>

              <AdapterDiagram />

              <ProrationPlayground />

              <ul className={styles.rules}>
                {RULES.map((rule) => (
                  <li className={styles.rule} key={rule.title}>
                    <span className={styles.ruleWhen}>{rule.when}</span>
                    <h3 className={styles.ruleTitle}>{rule.title}</h3>
                    <p className={styles.ruleText}>{rule.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section
            aria-labelledby="capabilities-title"
            className={`${styles.section} ${styles.capSection}`}
          >
            <div className={styles.capGrid}>
              <div>
                <h2 className={styles.capTitle} id="capabilities-title">
                  The API reads flags, never the provider's name
                </h2>
                <table className={styles.capTable}>
                  <thead>
                    <tr>
                      <th scope="col">
                        <span className={styles.srOnly}>Capability</span>
                      </th>
                      <th scope="col">Mercado Pago</th>
                      <th scope="col">Polar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAPABILITIES.map((row) => (
                      <tr key={row.flag}>
                        <th scope="row">
                          <code>{row.flag}</code>
                        </th>
                        {([row.mercadoPago, row.polar] as const).map((cell, index) => (
                          <td
                            data-provider={index === 0 ? "Mercado Pago" : "Polar"}
                            data-supported={cell.supported}
                            key={index === 0 ? "mp" : "polar"}
                          >
                            <strong>{cell.label}</strong>
                            <span>{cell.text}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={styles.capCode}>
                <figure className={styles.code}>
                  <figcaption className={styles.codeHead}>
                    <span>capabilities in each adapter</span>
                    <span className={styles.codeLinks}>
                      <a
                        href={`${links.repo}/blob/main/packages/payments/mercado-pago/src/adapter.ts#L477`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Mercado Pago
                      </a>
                      <a
                        href={`${links.repo}/blob/main/packages/payments/polar/src/adapter.ts#L229`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Polar
                      </a>
                    </span>
                  </figcaption>
                  <Code source={PROVIDER_SNIPPET} />
                  <details className={styles.codeDetails}>
                    <summary>See the type</summary>
                    <Code source={ADAPTER_SNIPPET} />
                    <p className={styles.codeFile}>
                      <span>{ADAPTER_FILE}</span>
                      <a
                        href={`${links.repo}/blob/main/${ADAPTER_FILE}#L235`}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        View on GitHub
                      </a>
                    </p>
                  </details>
                </figure>
                <p className={styles.capNote}>
                  When a provider can't do something, the API says so instead of guessing.{" "}
                  <Link className={styles.textLink} href={links.planChanges}>
                    Read how plan changes work
                  </Link>
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="constants-title" className={styles.section}>
            <div className={styles.split}>
              <h2 className={`${styles.h2} ${styles.h2Sm}`} id="constants-title">
                Three variables pick your market. The rest stays put.
              </h2>
              <p className={styles.sectionLede}>
                Add the provider's keys, set three variables, and sign-in, teams, languages and the
                admin area stay exactly as they are.
              </p>
            </div>
            <Bento />
          </section>

          <NotYet />

          <section aria-labelledby="start-title" className={styles.start}>
            <div className={styles.startInner}>
              <h2 className={styles.startTitle} id="start-title">
                <span className={styles.startLine}>One command.</span>{" "}
                <span className={styles.startLine}>Pick the market later.</span>
              </h2>
              <div className={styles.startFirst}>
                <span aria-hidden="true" className={styles.stepNumber}>
                  1
                </span>
                <CopyCommand
                  className={styles.startCommand}
                  labelClassName={styles.startCopy}
                  prefix={<span className={styles.startPrompt}>$ </span>}
                />
              </div>
              <p className={styles.startNote}>
                The CLI asks for a project name, a default currency and a default locale. You need
                Node.js 22, pnpm 11 and a PostgreSQL database.
              </p>
              <ol className={styles.steps} start={2}>
                {FIRST_RUN.map((step, index) => (
                  <li key={step.title}>
                    <h3>
                      <span aria-hidden="true" className={styles.stepNumber}>
                        {index + 2}
                      </span>
                      {step.title}
                    </h3>
                    <code>{step.command}</code>
                    <p>{step.text}</p>
                  </li>
                ))}
              </ol>
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
      </MarketProvider>

      <footer className={styles.footer}>
        <span>MIT licensed</span>
        <nav aria-label="Footer" className={styles.footerLinks}>
          <Link href={links.docs}>Docs</Link>
          <Link href={links.quickStart}>Quick start</Link>
          <a href={links.repo} rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
        </nav>
      </footer>
    </div>
  );
}
