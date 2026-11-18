import type { Metadata } from "next";
import { Chivo, Chivo_Mono } from "next/font/google";
import Link from "next/link";
import { CopyCommand } from "../_shared/copy-command";
import { links } from "../_shared/links";
import { FloorPlan } from "./plan";
import styles from "./floor-plan.module.css";

const display = Chivo({
  subsets: ["latin"],
  variable: "--font-plan-display",
});

const mono = Chivo_Mono({
  subsets: ["latin"],
  variable: "--font-plan-mono",
});

export const metadata: Metadata = {
  title: "Beztack - Te damos la obra gris",
  description:
    "Un starter de TypeScript para SaaS B2B con cobros en Mercado Pago y Polar, login con doble factor, equipos, dos idiomas y tests. Vos ponés las terminaciones.",
};

const MATERIALS = [
  ["Frente", "Vite, React 19, Tailwind 4, shadcn/ui", "apps/ui"],
  ["Estructura", "Nitro (h3), rutas por archivo, Zod", "apps/api"],
  ["Cimientos", "PostgreSQL con Drizzle ORM y migraciones SQL", "packages/db"],
  ["Cerradura", "Better Auth: 2FA, organizaciones, admin", "apps/api"],
  ["Caja", "Mercado Pago y Polar detrás de una interfaz", "packages/payments"],
  ["Buzón", "Cinco plantillas de React Email, enviadas con Resend", "packages/email"],
  ["Medidor", "T3 Env y Zod validan las variables al arrancar", "packages/env"],
  ["Cartel", "Next.js y Fumadocs, esta misma página", "apps/docs"],
] as const;

const PENDING = [
  "Stripe y otros proveedores de pago",
  "OAuth, magic link, passkeys y API keys",
  "Recibir actualizaciones del template como pull requests",
  "Dockerfile y configuración para Cloudflare",
] as const;

export default function FloorPlanLanding() {
  return (
    <div className={`${styles.page} ${display.variable} ${mono.variable}`} lang="es">
      <nav aria-label="Principal" className={styles.nav}>
        <Link className={styles.wordmark} href="/redesign/floor-plan">
          Beztack
        </Link>
        <div className={styles.navLinks}>
          <Link href={links.docs}>Docs</Link>
          <a href={links.demo} rel="noopener noreferrer" target="_blank">
            Demo
          </a>
          <a href={links.repo} rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
        </div>
      </nav>

      <header className={styles.hero}>
        <div className={styles.heroHead}>
          <h1 className={styles.title}>Te damos la obra gris. Vos ponés las terminaciones.</h1>
          <p className={styles.lede}>
            Beztack es un starter de TypeScript para SaaS B2B. Cobros en Latinoamérica y en el
            mundo, login con doble factor, equipos, dos idiomas y docs que tus agentes entienden.
            Recorré el plano.
          </p>
        </div>
        <FloorPlan />
      </header>

      <main>
        <section aria-labelledby="materials-title" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.h2} id="materials-title">
              Planilla de materiales
            </h2>
            <p className={styles.sectionLede}>
              Herramientas conocidas, en un monorepo de Nx con pnpm. Nada que tengas que aprender de
              cero para mudarte.
            </p>
          </div>
          <table className={styles.materials}>
            <thead>
              <tr>
                <th scope="col">Elemento</th>
                <th scope="col">Material</th>
                <th scope="col">Dónde</th>
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map(([part, material, where]) => (
                <tr key={part}>
                  <th scope="row">{part}</th>
                  <td>{material}</td>
                  <td className={styles.where}>{where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="pending-title" className={styles.pending}>
          <div className={styles.pendingInner}>
            <div>
              <h2 className={styles.h2} id="pending-title">
                Pendientes de obra
              </h2>
              <p className={styles.sectionLede}>
                Mejor que te enteres acá y no en producción. Esto está en la hoja de ruta y todavía
                no está en el código.
              </p>
            </div>
            <ul className={styles.pendingList}>
              {PENDING.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="keys-title" className={styles.keys}>
          <h2 className={styles.keysTitle} id="keys-title">
            Las llaves, en una línea.
          </h2>
          <p className={styles.keysLede}>
            Creá el proyecto, cargá tus claves de Mercado Pago o Polar y correlo en tu máquina.
          </p>
          <CopyCommand
            className={styles.keysCommand}
            copiedLabel="Copiado"
            label="Copiar"
            labelClassName={styles.keysCopy}
          />
          <div className={styles.keysLinks}>
            <Link href={links.quickStart}>Guía de inicio</Link>
            <a href={links.demo} rel="noopener noreferrer" target="_blank">
              Demo en vivo
            </a>
            <a href={links.repo} rel="noopener noreferrer" target="_blank">
              Código en GitHub
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Beztack, starter de SaaS en TypeScript con licencia MIT.</span>
        <span className={styles.footerScale}>Escala 1:1. Todo lo dibujado está construido.</span>
      </footer>
    </div>
  );
}
