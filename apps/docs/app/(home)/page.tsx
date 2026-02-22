import {
  ArrowRight,
  Blocks,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  CreditCard,
  Database,
  FileText,
  Globe,
  Layout,
  Link2,
  Rocket,
  Server,
  Shield,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CopyCommandButton } from "@/components/copy-command-button";
import { FumaDocsIcon } from "@/components/svg/fumadocs";
import { T3Icon } from "@/components/svg/t3";
import { TechBadge } from "@/components/tech-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Beztack - Ship Full-Stack Apps Faster",
  description:
    "Production-ready TypeScript monorepo with React, Nitro, Better Auth, Polar and Mercado Pago payments, plus Template Sync workflows.",
};

export default function Home() {
  return (
    <div className="relative min-h-screen bg-background selection:bg-accent/30">
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        <div className="-z-10 absolute top-0 right-0 left-0 m-auto h-[310px] w-[310px] rounded-full bg-accent/20 opacity-20 blur-[100px]" />
      </div>
      {/* Hero Section */}
      <section className="container relative z-10 mx-auto overflow-hidden px-4 py-20 md:py-32">
        {/* Spotlight effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-4 py-2">
            <Zap className="h-4 w-4 text-accent" />
            <span className="font-medium text-accent text-sm">
              Modern TypeScript Monorepo
            </span>
          </div>

          <h1 className="mb-6 text-balance font-bold font-heading text-5xl text-foreground md:text-7xl">
            You want to ship.
            <br />
            <span className="bg-gradient-to-b from-accent via-accent to-accent/60 bg-clip-text text-transparent">
              You need this.
            </span>
          </h1>

          <p className="mx-auto mb-8 max-w-2xl text-pretty text-muted-foreground text-xl leading-relaxed">
            Beztack is a production-ready monorepo starter built on modern
            TypeScript tools. Stop configuring, start building.
          </p>

          <div className="mb-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              size="lg"
            >
              <Link href="/docs">
                <Rocket className="mr-2 h-5 w-5" />
                Get Started
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href={process.env.NEXT_PUBLIC_LIVE_DEMO_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                View Live Demo
              </a>
            </Button>
          </div>

          <div className="flex justify-center">
            <CopyCommandButton />
          </div>
        </div>
      </section>
      {/* Tech Stack Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center font-bold font-heading text-3xl text-foreground">
            Built on Modern Tools
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
            This project wouldn't be possible without the following gems
          </p>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <TechBadge
              logoUrl="https://svgl.app/library/vite.svg"
              name="Vite"
            />
            <TechBadge
              logoUrl="https://svgl.app/library/react_dark.svg"
              logoUrlLight="https://svgl.app/library/react_light.svg"
              name="React"
            />
            <TechBadge
              logoUrl="https://svgl.app/library/shadcn-ui_dark.svg"
              logoUrlLight="https://svgl.app/library/shadcn-ui.svg"
              name="shadcn/ui"
            />
            <TechBadge logoUrl="https://nitro.build/icon.svg" name="Nitro" />
            <TechBadge
              logoUrl="https://svgl.app/library/better-auth_dark.svg"
              logoUrlLight="https://svgl.app/library/better-auth_light.svg"
              name="better-auth"
            />
            <TechBadge
              logoUrl="https://svgl.app/library/drizzle-orm_dark.svg"
              logoUrlLight="https://svgl.app/library/drizzle-orm_light.svg"
              name="Drizzle"
            />
            <TechBadge logoComponent={<T3Icon />} name="T3 Env" />
            <TechBadge
              logoUrl="https://svgl.app/library/nuqs_dark.svg"
              logoUrlLight="https://svgl.app/library/nuqs.svg"
              name="nuqs"
            />
            <TechBadge logoUrl="https://svgl.app/library/zod.svg" name="Zod" />
            <TechBadge
              logoUrl="https://svgl.app/library/vercel_dark.svg"
              logoUrlLight="https://svgl.app/library/vercel.svg"
              name="AI SDK"
            />
            <TechBadge
              logoUrl="https://svgl.app/library/nextjs_icon_dark.svg"
              name="Next.js"
            />
            <TechBadge logoComponent={<FumaDocsIcon />} name="Fumadocs" />
          </div>
        </div>
      </section>
      {/* Architecture Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center font-bold font-heading text-3xl text-foreground">
            Project Architecture
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
            Three apps, one monorepo. Each optimized for its purpose.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {/* UI App */}
            <Card className="group relative overflow-hidden border-border bg-card p-6 transition-all duration-300 hover:border-cyan-500/50">
              <div className="pointer-events-none absolute top-0 right-0 p-4 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.12]">
                <Image
                  alt="React"
                  className="h-24 w-24 object-contain"
                  height={96}
                  src="https://svgl.app/library/react_dark.svg"
                  width={96}
                />
              </div>

              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-500">
                    <Layout className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">apps/ui</h3>
                    <p className="font-mono text-muted-foreground text-xs">
                      Frontend SPA
                    </p>
                  </div>
                </div>

                <div className="mb-4 flex items-center gap-2 text-muted-foreground text-sm">
                  <Image
                    alt="Vite"
                    className="h-4 w-4"
                    height={16}
                    src="https://svgl.app/library/vite.svg"
                    width={16}
                  />
                  <span className="font-semibold text-foreground">Vite</span>
                  <ArrowRight className="h-3 w-3" />
                  <Image
                    alt="React"
                    className="hidden h-4 w-4 dark:block"
                    height={16}
                    src="https://svgl.app/library/react_dark.svg"
                    width={16}
                  />
                  <Image
                    alt="React"
                    className="block h-4 w-4 dark:hidden"
                    height={16}
                    src="https://svgl.app/library/react.svg"
                    width={16}
                  />
                  <span className="font-semibold text-foreground">React</span>
                </div>

                <ul className="space-y-1.5 text-muted-foreground text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-cyan-500" />
                    <span>Fast HMR & instant refresh</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-cyan-500" />
                    <span>shadcn/ui components</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-cyan-500" />
                    <span>Client-side routing</span>
                  </li>
                </ul>
              </div>
            </Card>

            {/* API App */}
            <Card className="group relative overflow-hidden border-border bg-card p-6 transition-all duration-300 hover:border-amber-500/50">
              <div className="pointer-events-none absolute top-0 right-0 p-4 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.12]">
                <Image
                  alt="Nitro"
                  className="h-24 w-24 object-contain"
                  height={96}
                  src="https://nitro.build/icon.svg"
                  width={96}
                />
              </div>

              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                    <Server className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">apps/api</h3>
                    <p className="font-mono text-muted-foreground text-xs">
                      Backend Server
                    </p>
                  </div>
                </div>

                <div className="mb-4 flex items-center gap-2 text-muted-foreground text-sm">
                  <Image
                    alt="Nitro"
                    className="h-4 w-4"
                    height={16}
                    src="https://nitro.build/icon.svg"
                    width={16}
                  />
                  <span className="font-semibold text-foreground">Nitro</span>
                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-amber-500 text-xs">
                    h3
                  </span>
                </div>

                <ul className="space-y-1.5 text-muted-foreground text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-amber-500" />
                    <span>Edge-ready & portable</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-amber-500" />
                    <span>File-based routing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-amber-500" />
                    <span>Auto-imports & HMR</span>
                  </li>
                </ul>
              </div>
            </Card>

            {/* Docs App */}
            <Card className="group relative overflow-hidden border-border bg-card p-6 transition-all duration-300 hover:border-foreground/30">
              <div className="pointer-events-none absolute top-0 right-0 p-4 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.12]">
                <Image
                  alt="Next.js"
                  className="h-24 w-24 object-contain"
                  height={96}
                  src="https://svgl.app/library/nextjs_icon_dark.svg"
                  width={96}
                />
              </div>

              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-foreground/10 p-2 text-foreground">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">
                      apps/docs
                    </h3>
                    <p className="font-mono text-muted-foreground text-xs">
                      Landing & Docs
                    </p>
                  </div>
                </div>

                <div className="mb-4 flex items-center gap-2 text-muted-foreground text-sm">
                  <Image
                    alt="Next.js"
                    className="h-4 w-4"
                    height={16}
                    src="https://svgl.app/library/nextjs_icon_dark.svg"
                    width={16}
                  />
                  <span className="font-semibold text-foreground">Next.js</span>
                  <ArrowRight className="h-3 w-3" />
                  <FumaDocsIcon className="h-4 w-4" />
                  <span className="font-semibold text-foreground">
                    Fumadocs
                  </span>
                </div>

                <ul className="space-y-1.5 text-muted-foreground text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-foreground" />
                    <span>SSR & static generation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-foreground" />
                    <span>MDX documentation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-foreground" />
                    <span>SEO optimized</span>
                  </li>
                </ul>
              </div>
            </Card>
          </div>

          {/* Connection indicator */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-muted-foreground text-sm">
                Deploy anywhere
              </span>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-muted-foreground text-sm">
                Vercel, Cloudflare, Node.js
              </span>
            </div>
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-4 text-center font-bold font-heading text-3xl text-foreground">
            Everything You Need
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
            Ship faster with best practices and modern architecture built-in
          </p>

          {/* Application Layer Features */}
          <div className="mb-6 grid auto-rows-[minmax(250px,auto)] grid-cols-1 gap-6 md:grid-cols-3">
            {/* Authentication Card - Spans 2 columns */}
            <Card className="group relative overflow-hidden border-border bg-card p-8 transition-all duration-300 hover:border-accent/50 md:col-span-2">
              <div className="pointer-events-none absolute top-0 right-0 p-6 opacity-[0.03] transition-opacity duration-500 group-hover:opacity-[0.08]">
                <Image
                  alt="Better Auth"
                  className="-rotate-12 -translate-y-10 hidden h-64 w-64 translate-x-10 object-contain dark:block"
                  height={256}
                  src="https://svgl.app/library/better-auth_dark.svg"
                  width={256}
                />
                <Image
                  alt="Better Auth"
                  className="-rotate-12 -translate-y-10 block h-64 w-64 translate-x-10 object-contain dark:hidden"
                  height={256}
                  src="https://svgl.app/library/better-auth_light.svg"
                  width={256}
                />
              </div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-green-500/10 p-2 text-green-500">
                    <Shield className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold font-heading text-2xl">
                    Authentication Ready
                  </h3>
                </div>

                <p className="mb-6 max-w-lg text-muted-foreground">
                  Built-in auth with{" "}
                  <span className="font-semibold text-foreground">
                    better-auth
                  </span>
                  . Secure, flexible, and easy to customize for your needs.
                </p>

                <div className="mt-auto grid gap-8 md:grid-cols-2">
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-foreground text-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                      </span>
                      Integrated Plugins
                    </h4>
                    <ul className="space-y-2">
                      {["2FA Support", "Admin & Roles", "Organizations"].map(
                        (item) => (
                          <li
                            className="flex items-center gap-2 text-muted-foreground text-sm"
                            key={item}
                          >
                            <Check className="h-4 w-4 text-green-500" />
                            {item}
                          </li>
                        )
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 className="mb-3 flex items-center gap-2 font-semibold text-foreground text-sm">
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
                      </span>
                      Coming Soon
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "OAuth",
                        "Have I Been PWND",
                        "Magic Link",
                        "Multi Session",
                        "Passkey",
                        "API Key",
                      ].map((item) => (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md border border-secondary bg-secondary/50 px-2.5 py-1 text-secondary-foreground text-xs"
                          key={item}
                        >
                          <Clock className="h-3 w-3" />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Database Card */}
            <Card className="group relative flex flex-col overflow-hidden border-border bg-card p-8 transition-all duration-300 hover:border-accent/50">
              {/* Centered and enlarged Drizzle logo background */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.03] transition-opacity duration-500 group-hover:opacity-[0.08]">
                <Image
                  alt="Drizzle"
                  className="hidden h-80 w-80 rotate-12 object-contain dark:block"
                  height={320}
                  src="https://svgl.app/library/drizzle-orm_dark.svg"
                  width={320}
                />
                <Image
                  alt="Drizzle"
                  className="block h-80 w-80 rotate-12 object-contain dark:hidden"
                  height={320}
                  src="https://svgl.app/library/drizzle-orm_light.svg"
                  width={320}
                />
              </div>

              <div className="relative z-10 mb-4 flex items-center gap-3">
                <div className="rounded-lg bg-orange-500/10 p-2 text-orange-500">
                  <Database className="h-6 w-6" />
                </div>
                <h3 className="font-bold font-heading text-xl">
                  Type-Safe Database
                </h3>
              </div>

              <p className="mb-6 grow text-muted-foreground">
                Drizzle ORM with full TypeScript support. Write queries with
                confidence, autocomplete, and zero runtime overhead.
              </p>

              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 font-mono text-muted-foreground text-xs">
                <div className="mb-1 flex gap-2">
                  <span className="text-purple-400">const</span>
                  <span className="text-blue-400">users</span>
                  <span className="text-foreground">=</span>
                  <span className="text-purple-400">await</span>
                  <span className="text-foreground">db</span>
                </div>
                <div className="flex gap-2 pl-4">
                  <span className="text-foreground">.</span>
                  <span className="text-yellow-400">select</span>
                  <span className="text-foreground">()</span>
                </div>
                <div className="flex gap-2 pl-4">
                  <span className="text-foreground">.</span>
                  <span className="text-yellow-400">from</span>
                  <span className="text-foreground">(users)</span>
                </div>
                <div className="flex gap-2 pl-4">
                  <span className="text-foreground">.</span>
                  <span className="text-yellow-400">where</span>
                  <span className="text-foreground">(...)</span>
                </div>
              </div>
            </Card>

            {/* Payments Card */}
            <Card className="group relative overflow-hidden border-border bg-card p-8 transition-all duration-300 hover:border-emerald-500/50 md:col-span-3">
              <div className="pointer-events-none absolute top-0 right-0 p-6 opacity-[0.04] transition-opacity duration-500 group-hover:opacity-[0.1]">
                <div className="flex items-center justify-center">
                  <Image
                    alt="Payments"
                    className="h-28 w-28 rotate-12 object-contain"
                    height={112}
                    src="https://svgl.app/library/mercado-pago.svg"
                    width={112}
                  />
                </div>

                <div className="flex items-center justify-center">
                  <Image
                    alt="Payments"
                    className="h-28 w-28 rotate-12 object-contain dark:block"
                    height={112}
                    src="https://svgl.app/library/polar-sh_dark.svg"
                    width={112}
                  />

                  <Image
                    alt="Payments"
                    className="h-28 w-28 rotate-12 object-contain dark:hidden"
                    height={112}
                    src="https://svgl.app/library/polar-sh_light.svg"
                    width={112}
                  />
                </div>
              </div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                    <CreditCard className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold font-heading text-2xl">Payments</h3>
                </div>

                <p className="mb-6 max-w-2xl text-muted-foreground">
                  Choose the payment stack that fits your market and rollout.
                  Beztack supports both provider-native flows and centralized
                  integration points.
                </p>

                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="mb-3 font-semibold text-foreground text-sm">
                      Included providers
                    </h4>
                    <ul className="space-y-2">
                      {[
                        "Polar - SaaS and digital products only",
                        "Mercado Pago - Physical and digital products, services, subscriptions",
                      ].map((item) => (
                        <li
                          className="flex items-center gap-2 text-muted-foreground text-sm"
                          key={item}
                        >
                          <Check className="h-4 w-4 text-emerald-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>

            {/* Modern UI - Now Full Width in this row or separate? Let's make it span 3 cols in a new row if needed, or just fit it here. 
                Wait, I want to separate Rapid and Monorepo. So UI should stay with Auth and DB.
                If I have 3 cols: Auth(2), DB(1). Row filled.
                Next row: UI(3).
            */}
            <Card className="group relative flex flex-col items-center gap-8 overflow-hidden border-border bg-card p-8 transition-all duration-300 hover:border-accent/50 md:col-span-3 md:flex-row">
              <div className="-bottom-4 -right-4 pointer-events-none absolute opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.1]">
                <Image
                  alt="shadcn/ui"
                  className="hidden h-64 w-64 rotate-12 object-contain dark:block"
                  height={256}
                  src="https://svgl.app/library/shadcn-ui_dark.svg"
                  width={256}
                />
                <Image
                  alt="shadcn/ui"
                  className="block h-64 w-64 rotate-12 object-contain dark:hidden"
                  height={256}
                  src="https://svgl.app/library/shadcn-ui.svg"
                  width={256}
                />
              </div>

              <div className="relative z-10 flex-1">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-pink-500/10 p-2 text-pink-500">
                    <Code2 className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold font-heading text-xl">
                    Modern UI Components
                  </h3>
                </div>
                <p className="mb-4 max-w-2xl text-muted-foreground">
                  Beautiful, accessible components with{" "}
                  <span className="font-semibold text-foreground">
                    shadcn/ui
                  </span>
                  . Customizable and production-ready out of the box.
                </p>
                <div className="flex w-fit items-center gap-1.5 rounded-md border border-secondary bg-secondary/50 px-2 py-1 font-medium text-muted-foreground text-xs">
                  <Image
                    alt="shadcn/ui"
                    className="hidden h-4 w-4 dark:block"
                    height={16}
                    src="https://svgl.app/library/shadcn-ui_dark.svg"
                    width={16}
                  />
                  <Image
                    alt="shadcn/ui"
                    className="block h-4 w-4 dark:hidden"
                    height={16}
                    src="https://svgl.app/library/shadcn-ui.svg"
                    width={16}
                  />
                  shadcn/ui
                </div>
              </div>

              {/* Visual preview for UI components */}
              <div className="relative z-10 flex gap-4 opacity-80 grayscale transition-all duration-500 group-hover:grayscale-0">
                <div className="w-40 space-y-2 rounded-lg border border-border bg-background p-4 shadow-sm">
                  <div className="h-2 w-12 rounded bg-muted" />
                  <div className="h-8 w-full rounded bg-primary/20" />
                </div>
                <div className="mt-4 w-40 space-y-2 rounded-lg border border-border bg-background p-4 shadow-sm">
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="space-y-1">
                      <div className="h-2 w-16 rounded bg-muted" />
                      <div className="h-2 w-10 rounded bg-muted" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* nuqs - URL State Management */}
            <Card className="group relative overflow-hidden border-border bg-card p-8 transition-all duration-300 hover:border-accent/50 md:col-span-3">
              <div className="pointer-events-none absolute top-0 right-0 p-6 opacity-[0.03] transition-opacity duration-500 group-hover:opacity-[0.08]">
                <Image
                  alt="nuqs"
                  className="-rotate-12 hidden h-64 w-64 object-contain dark:block"
                  height={256}
                  src="https://svgl.app/library/nuqs_dark.svg"
                  width={256}
                />
                <Image
                  alt="nuqs"
                  className="-rotate-12 block h-64 w-64 object-contain dark:hidden"
                  height={256}
                  src="https://svgl.app/library/nuqs.svg"
                  width={256}
                />
              </div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
                    <Link2 className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold font-heading text-2xl">
                    URL State Management
                  </h3>
                </div>

                <p className="mb-6 max-w-2xl text-muted-foreground">
                  Type-safe URL search params with{" "}
                  <span className="font-semibold text-foreground">nuqs</span>.
                  Synchronize component state with the URL effortlessly with
                  full TypeScript support and SSR compatibility.
                </p>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 font-mono text-xs">
                    <div className="mb-3 font-semibold text-foreground text-sm">
                      Type-safe parsers
                    </div>
                    <div className="space-y-1 text-muted-foreground">
                      <div className="flex gap-2">
                        <span className="text-purple-400">const</span>
                        <span className="text-blue-400">[page, setPage]</span>
                        <span className="text-foreground">=</span>
                      </div>
                      <div className="flex gap-2 pl-4">
                        <span className="text-yellow-400">useQueryState</span>
                        <span className="text-foreground">(</span>
                      </div>
                      <div className="flex gap-2 pl-6">
                        <span className="text-green-400">"page"</span>
                        <span className="text-foreground">,</span>
                      </div>
                      <div className="flex gap-2 pl-6">
                        <span className="text-foreground">parseAsInteger</span>
                      </div>
                      <div className="flex gap-2 pl-4">
                        <span className="text-foreground">)</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 font-semibold text-foreground text-sm">
                      Built-in Parsers
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "String",
                        "Integer",
                        "Float",
                        "Boolean",
                        "Enum",
                        "Array",
                        "JSON",
                        "DateTime",
                      ].map((parser) => (
                        <span
                          className="inline-flex items-center rounded-md border border-secondary bg-secondary/50 px-2.5 py-1 text-secondary-foreground text-xs"
                          key={parser}
                        >
                          {parser}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex w-fit items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 font-medium text-muted-foreground text-xs">
                      <Image
                        alt="nuqs"
                        className="hidden h-4 w-4 dark:block"
                        height={16}
                        src="https://svgl.app/library/nuqs_dark.svg"
                        width={16}
                      />
                      <Image
                        alt="nuqs"
                        className="block h-4 w-4 dark:hidden"
                        height={16}
                        src="https://svgl.app/library/nuqs.svg"
                        width={16}
                      />
                      nuqs
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* AI SDK Card */}
            <Card className="group relative overflow-hidden border-border bg-card p-8 transition-all duration-300 hover:border-accent/50 md:col-span-3">
              <div className="pointer-events-none absolute top-0 right-0 p-6 opacity-[0.03] transition-opacity duration-500 group-hover:opacity-[0.08]">
                <Image
                  alt="Vercel AI SDK"
                  className="-rotate-12 hidden h-64 w-64 object-contain dark:block"
                  height={256}
                  src="https://svgl.app/library/vercel_dark.svg"
                  width={256}
                />
                <Image
                  alt="Vercel AI SDK"
                  className="-rotate-12 block h-64 w-64 object-contain dark:hidden"
                  height={256}
                  src="https://svgl.app/library/vercel.svg"
                  width={256}
                />
              </div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-violet-500/10 p-2 text-violet-500">
                    <Bot className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold font-heading text-2xl">AI Ready</h3>
                </div>

                <p className="mb-6 max-w-2xl text-muted-foreground">
                  Integrated{" "}
                  <span className="font-semibold text-foreground">
                    Vercel AI SDK
                  </span>
                  . Build AI-powered features with streaming, tool calling, and
                  structured outputs.
                </p>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 font-mono text-xs">
                    <div className="mb-3 font-semibold text-foreground text-sm">
                      Streaming responses
                    </div>
                    <div className="space-y-1 text-muted-foreground">
                      <div className="flex gap-2">
                        <span className="text-purple-400">import</span>
                        <span className="text-foreground">{"{"}</span>
                        <span className="text-blue-400">streamText</span>
                        <span className="text-foreground">{"}"}</span>
                      </div>
                      <div className="flex gap-2 pl-2">
                        <span className="text-purple-400">from</span>
                        <span className="text-green-400">
                          &apos;@beztack/ai&apos;
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <span className="text-purple-400">const</span>
                        <span className="text-blue-400">result</span>
                        <span className="text-foreground">=</span>
                        <span className="text-purple-400">await</span>
                      </div>
                      <div className="flex gap-2 pl-2">
                        <span className="text-yellow-400">streamText</span>
                        <span className="text-foreground">({"{ ... }"})</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 font-semibold text-foreground text-sm">
                      Features
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Streaming",
                        "Tool Calling",
                        "Structured Output",
                        "Multi-Modal",
                        "Embeddings",
                        "React Hooks",
                      ].map((feature) => (
                        <span
                          className="inline-flex items-center rounded-md border border-secondary bg-secondary/50 px-2.5 py-1 text-secondary-foreground text-xs"
                          key={feature}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 flex w-fit items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 font-medium text-muted-foreground text-xs">
                      <Image
                        alt="Vercel AI SDK"
                        className="hidden h-4 w-4 dark:block"
                        height={16}
                        src="https://svgl.app/library/vercel_dark.svg"
                        width={16}
                      />
                      <Image
                        alt="Vercel AI SDK"
                        className="block h-4 w-4 dark:hidden"
                        height={16}
                        src="https://svgl.app/library/vercel.svg"
                        width={16}
                      />
                      AI SDK
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Core Infrastructure Section - Separated visually */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* T3 Env - Type-Safe Environment */}
            <Card className="group relative overflow-hidden border-2 border-border border-dashed bg-secondary/5 p-8 transition-all duration-300 hover:border-emerald-500/30 hover:bg-secondary/10">
              <div className="pointer-events-none absolute top-0 right-0 flex gap-2 p-4 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.1]">
                <T3Icon className="h-24 w-24 object-contain" />
                <Image
                  alt="Zod"
                  className="h-32 w-32 object-contain"
                  height={128}
                  src="https://svgl.app/library/zod.svg"
                  width={128}
                />
              </div>

              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold font-heading font-mono text-xl tracking-tight">
                    TYPE_SAFE_ENV
                  </h3>
                </div>
                <p className="mb-4 text-muted-foreground">
                  Powered by{" "}
                  <span className="font-semibold text-foreground">T3 Env</span>{" "}
                  and <span className="font-semibold text-foreground">Zod</span>
                  . Environment variables validated at build time with full
                  TypeScript support.
                </p>
                <div className="flex gap-3">
                  <div className="flex w-fit items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 font-medium text-muted-foreground text-xs">
                    <T3Icon className="h-4 w-4" />
                    Env
                  </div>
                  <div className="flex w-fit items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 font-medium text-muted-foreground text-xs">
                    <Image
                      alt="Zod"
                      className="h-4 w-4"
                      height={16}
                      src="https://svgl.app/library/zod.svg"
                      width={16}
                    />
                    Zod
                  </div>
                </div>
              </div>
            </Card>

            {/* Rapid Development */}
            <Card className="group relative overflow-hidden border-2 border-border border-dashed bg-secondary/5 p-8 transition-all duration-300 hover:border-blue-500/30 hover:bg-secondary/10">
              <div className="pointer-events-none absolute top-0 right-0 p-4 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.1]">
                <Image
                  alt="Vite"
                  className="h-32 w-32 rotate-12 object-contain"
                  height={128}
                  src="https://svgl.app/library/vite.svg"
                  width={128}
                />
              </div>

              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
                    <Zap className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold font-heading font-mono text-xl tracking-tight">
                    RAPID_DEVELOPMENT
                  </h3>
                </div>
                <p className="mb-4 text-muted-foreground">
                  Powered by{" "}
                  <span className="font-semibold text-foreground">Vite</span>.
                  Experience hot module replacement, instant server start, and
                  optimized build times.
                </p>
                <div className="flex w-fit items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 font-medium text-muted-foreground text-xs">
                  <Image
                    alt="Vite"
                    className="h-4 w-4"
                    height={16}
                    src="https://svgl.app/library/vite.svg"
                    width={16}
                  />
                  Vite
                </div>
              </div>
            </Card>

            {/* Monorepo Architecture */}
            <Card className="group relative overflow-hidden border-2 border-border border-dashed bg-secondary/5 p-8 transition-all duration-300 hover:border-purple-500/30 hover:bg-secondary/10">
              <div className="pointer-events-none absolute top-0 right-0 flex gap-2 p-4 opacity-[0.05] transition-opacity duration-500 group-hover:opacity-[0.1]">
                <Image
                  alt="pnpm"
                  className="h-24 w-24 object-contain"
                  height={96}
                  src="https://svgl.app/library/pnpm.svg"
                  width={96}
                />
                <Image
                  alt="NX"
                  className="hidden h-24 w-24 object-contain dark:block"
                  height={96}
                  src="https://svgl.app/library/nx_dark.svg"
                  width={96}
                />
                <Image
                  alt="NX"
                  className="block h-24 w-24 object-contain dark:hidden"
                  height={96}
                  src="https://svgl.app/library/nx.svg"
                  width={96}
                />
              </div>

              <div className="relative z-10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-lg bg-purple-500/10 p-2 text-purple-500">
                    <Blocks className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold font-heading font-mono text-xl tracking-tight">
                    MONOREPO_ARCHITECTURE
                  </h3>
                </div>
                <p className="mb-4 text-muted-foreground">
                  Powered by{" "}
                  <span className="font-semibold text-foreground">
                    pnpm workspaces
                  </span>{" "}
                  and <span className="font-semibold text-foreground">NX</span>.
                  Efficient dependency management, task orchestration, and
                  repeatable template updates with Template Sync.
                </p>
                <div className="mt-auto flex gap-3">
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 font-medium text-muted-foreground text-xs">
                    <Image
                      alt="pnpm"
                      className="h-4 w-4"
                      height={16}
                      src="https://svgl.app/library/pnpm.svg"
                      width={16}
                    />
                    pnpm
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 font-medium text-muted-foreground text-xs">
                    <Image
                      alt="NX"
                      className="hidden h-4 w-4 dark:block"
                      height={16}
                      src="https://svgl.app/library/nx_dark.svg"
                      width={16}
                    />
                    <Image
                      alt="NX"
                      className="block h-4 w-4 dark:hidden"
                      height={16}
                      src="https://svgl.app/library/nx.svg"
                      width={16}
                    />
                    NX
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 font-medium text-muted-foreground text-xs">
                    Template Sync
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-balance font-bold font-heading text-4xl text-foreground md:text-5xl">
            Ready to Build Something Amazing?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-muted-foreground text-xl leading-relaxed">
            Join developers who are shipping faster with Beztack
          </p>

          <div className="mb-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              asChild
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              size="lg"
            >
              <Link href="/docs">
                <Rocket className="mr-2 h-5 w-5" />
                Get Started Now
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a
                href={process.env.NEXT_PUBLIC_REPO_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                View on GitHub
              </a>
            </Button>
          </div>

          <div className="flex justify-center">
            <CopyCommandButton />
          </div>
        </div>
      </section>
      <footer className="border-border border-t">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-muted-foreground text-sm">
              Beztack - Modern TypeScript Monorepo
            </p>
            <div className="flex items-center gap-6">
              <Link
                className="text-muted-foreground text-sm transition-colors hover:text-accent"
                href="/docs"
              >
                Documentation
              </Link>
              <a
                className="text-muted-foreground text-sm transition-colors hover:text-accent"
                href={process.env.NEXT_PUBLIC_REPO_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                GitHub
              </a>
              <a
                className="text-muted-foreground text-sm transition-colors hover:text-accent"
                href={process.env.NEXT_PUBLIC_LIVE_DEMO_URL}
                rel="noopener noreferrer"
                target="_blank"
              >
                Live Demo
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
