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
      { name: "Tailwind", logo: `${SVGL}/tailwindcss.svg` },
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
      <div className={styles.bandInner}>
        {STACK_GROUPS.map((group) => (
          <div className={styles.bandGroup} key={group.label}>
            <h2 className={styles.bandLabel}>{group.label}</h2>
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

const ADAPTER_FILE = "packages/payments/core/src/types.ts";

const CAPABILITIES = [
  {
    flag: "proratedUpgrade",
    mercadoPago: "An upgrade is a new subscription. The customer pays it at a redirect.",
    polar:
      "The existing subscription moves to the higher product now, and Polar charges the prorated difference.",
  },
  {
    flag: "cadenceChange",
    mercadoPago: "The API refuses the request instead of guessing.",
    polar: "The existing subscription moves to the other cadence, for example monthly to yearly.",
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

const TOKEN =
  /(\/\/.*)|\b(export|type|readonly)\b|\b(true|false)\b|\b(boolean|string|Promise)\b|\b([A-Z][A-Za-z]+)\b|\b([a-z][A-Za-z]*)(?=\??:|\()/g;

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
  { initials: "RP", role: "Member" },
] as const;

const FAILED_CHANGES = [
  ["Acme", "Pro to Team"],
  ["Norte SRL", "Team to Pro"],
] as const;

function Bento() {
  return (
    <div className={styles.bento}>
      <article className={`${styles.tile} ${styles.tileNavy} ${styles.span3}`}>
        <div className={styles.tileHead}>
          <Logo src={`${SVGL}/better-auth_light.svg`} />
          <span>Better Auth</span>
        </div>
        <h3 className={styles.tileTitle}>Sign-in that says no</h3>
        <p className={styles.tileText}>
          Email and password, codes from an authenticator app, and passwords from known breaches
          refused at sign-up and on every reset.
        </p>
        <div aria-hidden="true" className={styles.otp}>
          {["4", "8", "2", "9", "1", "3"].map((digit, index) => (
            <span key={`${digit}-${index}`}>{digit}</span>
          ))}
        </div>
      </article>

      <article className={`${styles.tile} ${styles.tileWhite} ${styles.span3}`}>
        <div className={styles.tileHead}>
          <span>Organizations</span>
        </div>
        <h3 className={styles.tileTitle}>Teams from day one</h3>
        <p className={styles.tileText}>
          Organizations with teams, invitations and roles. Bill each person or each organization.
        </p>
        <ul aria-label="Example members" className={styles.members}>
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
          <span>i18next</span>
        </div>
        <p aria-hidden="true" className={styles.bigWord}>
          en / es
        </p>
        <h3 className={styles.tileTitle}>Spanish written with vos</h3>
        <p className={styles.speech} lang="es">
          Ingresá el código de 6 dígitos de tu app de autenticación.
        </p>
        <p className={styles.tileText}>A test fails if a tú slips in.</p>
      </article>

      <article className={`${styles.tile} ${styles.tileSun} ${styles.span2}`}>
        <div className={styles.tileHead}>
          <span>Admin area</span>
        </div>
        <h3 className={styles.tileTitle}>Run it, don't just ship it</h3>
        <ul aria-label="Example of failed plan changes" className={styles.queue}>
          {FAILED_CHANGES.map(([org, change]) => (
            <li key={org}>
              <span>
                <strong>{org}</strong> {change}
              </span>
              <span className={styles.retry}>Retry</span>
            </li>
          ))}
        </ul>
        <p className={styles.tileText}>
          Users, analytics, failed changes to retry and tiers granted without a charge.
        </p>
      </article>

      <article className={`${styles.tile} ${styles.tileNavy} ${styles.span2}`}>
        <div className={styles.tileHead}>
          <span>For coding agents</span>
        </div>
        <h3 className={styles.tileTitle}>A repo that explains itself</h3>
        <pre aria-label="Files for agents" className={styles.tree}>
          {`AGENTS.md
CONTEXT.md        glossary
docs/adr/
  0001 … 0007     decisions
llms-full.txt     all docs`}
        </pre>
        <Link className={styles.tileLink} href={links.llms}>
          Open llms-full.txt
        </Link>
      </article>

      <article className={`${styles.tile} ${styles.tileWhite} ${styles.span3}`}>
        <div className={styles.tileHead}>
          <Logo src={`${SVGL}/vitest.svg`} />
          <Logo src={`${SVGL}/playwright.svg`} />
          <span>Vitest, Playwright</span>
        </div>
        <p aria-hidden="true" className={styles.bigNumber}>
          127
        </p>
        <h3 className={styles.tileTitle}>Test files, plus a live check</h3>
        <p className={styles.tileText}>
          Unit and route tests across the API, the app and the packages. A smoke test checks the
          deployed site, and <code>/api/health</code> checks the database.
        </p>
      </article>

      <article className={`${styles.tile} ${styles.tileWhite} ${styles.span3}`}>
        <div className={styles.tileHead}>
          <Logo src={`${SVGL}/drizzle-orm_light.svg`} />
          <Logo src={`${SVGL}/postgresql.svg`} />
          <Logo src={`${SVGL}/resend-icon-black.svg`} />
          <span>Drizzle, PostgreSQL, Resend</span>
        </div>
        <h3 className={styles.tileTitle}>Data and email, wired</h3>
        <p className={styles.tileText}>
          A Drizzle schema with SQL migrations on PostgreSQL. Five React Email templates sent with
          Resend: welcome, password reset, invitation, subscription and a sample.
        </p>
        <div aria-hidden="true" className={styles.envelopes}>
          {["Welcome", "Reset", "Invite", "Receipt", "Sample"].map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      </article>
    </div>
  );
}

export default function TwoMarketsLanding() {
  return (
    <div className={`${styles.page} ${display.variable} ${body.variable}`}>
      <MarketHero />

      <main>
        <StackBand />

        <section aria-labelledby="timeline-title" className={styles.timelineSection}>
          <div className={styles.section}>
            <div className={styles.providers} aria-hidden="true">
              <span className={`${styles.provider} ${styles.providerMp}`}>
                <Logo size={44} src={`${SVGL}/mercado-pago.svg`} />
                Mercado Pago
              </span>
              <span className={`${styles.provider} ${styles.providerPolar}`}>
                <Logo size={40} src={`${SVGL}/polar-sh_light.svg`} />
                Polar
              </span>
              <span className={styles.joint} />
              <span className={styles.adapter}>PaymentProviderAdapter</span>
            </div>

            <div className={styles.split}>
              <h2 className={styles.h2} id="timeline-title">
                A plan change, start to finish.
              </h2>
              <p className={styles.sectionLede}>
                Proration, downgrades and failed renewals are where billing code usually breaks.
                Here is how each one behaves. It all runs on one adapter interface, so the rules
                live in the API and not in the provider code.
              </p>
            </div>

            <ol className={styles.timeline}>
              {TIMELINE.map((step, index) => (
                <li className={styles.step} key={step.title}>
                  <span className={styles.stepNumber}>{index + 1}</span>
                  <span className={styles.stepWhen}>{step.when}</span>
                  <h3 className={styles.stepTitle}>{step.title}</h3>
                  <p className={styles.stepText}>{step.text}</p>
                </li>
              ))}
            </ol>

            <div className={styles.capGrid}>
              <div>
                <h3 className={styles.capTitle}>What each provider can do</h3>
                <table className={styles.capTable}>
                  <thead>
                    <tr>
                      <th scope="col">Capability</th>
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
                        <td data-provider="Mercado Pago" data-supported="false">
                          <strong>false</strong>
                          <span>{row.mercadoPago}</span>
                        </td>
                        <td data-provider="Polar" data-supported="true">
                          <strong>true</strong>
                          <span>{row.polar}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className={styles.capNote}>
                  The API reads these flags, never the provider's name. When a provider can't do
                  something, it says so instead of guessing.{" "}
                  <Link className={styles.textLink} href={links.planChanges}>
                    Read how plan changes work
                  </Link>
                </p>
              </div>

              <figure className={styles.code}>
                <figcaption className={styles.codeHead}>
                  <span>packages/payments/core/src/types.ts</span>
                  <a
                    href={`${links.repo}/blob/main/${ADAPTER_FILE}#L235`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    View on GitHub
                  </a>
                </figcaption>
                <Code source={ADAPTER_SNIPPET} />
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
              </figure>
            </div>
          </div>
        </section>

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
          <Bento />
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
