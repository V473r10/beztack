import { Button } from "@/components/ui/button"
import { CopyCommandButton } from "@/components/copy-command-button"
import { TechBadge } from "@/components/tech-badge"
import { Card } from "@/components/ui/card"
import { Zap, Blocks, Plug, Rocket, Code2, Database, Shield, Check, Clock } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative selection:bg-accent/30">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-accent/20 opacity-20 blur-[100px]"></div>
      </div>

      {/* Hero Section */}
      <section className="relative container mx-auto px-4 py-20 md:py-32 overflow-hidden z-10">
        {/* Spotlight effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(59,130,246,0.15),transparent)]" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-2 mb-6">
            <Zap className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">Modern TypeScript Monorepo</span>
          </div>

          <h1 className="font-heading text-5xl md:text-7xl font-bold text-foreground mb-6 text-balance">
            Launch Projects at{" "}
            <span className="bg-gradient-to-b from-accent via-accent to-accent/60 bg-clip-text text-transparent">
              Lightning Speed
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto text-pretty">
            Beztack is a production-ready monorepo starter built on modern TypeScript tools. Stop configuring, start
            building.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Rocket className="mr-2 h-5 w-5" />
              Get Started
            </Button>
            <Button size="lg" variant="outline">
              View Documentation
            </Button>
          </div>

          <div className="flex justify-center">
            <CopyCommandButton />
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-center text-foreground mb-4">Built on Modern Tools</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Carefully selected technologies that work seamlessly together
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <TechBadge name="Vite" logoUrl="https://svgl.app/library/vitejs.svg" />
            <TechBadge name="React" logoUrl="https://svgl.app/library/react_dark.svg" />
            <TechBadge name="shadcn/ui" logoUrl="https://svgl.app/library/shadcn-ui_dark.svg" />
            <TechBadge name="Nitro" logoUrl="https://nitro.build/icon.svg" />
            <TechBadge name="better-auth" logoUrl="https://svgl.app/library/better-auth_dark.svg" />
            <TechBadge name="Drizzle" logoUrl="https://svgl.app/library/drizzle-orm_dark.svg" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-heading text-3xl font-bold text-center text-foreground mb-4">Everything You Need</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Ship faster with best practices and modern architecture built-in
          </p>

          {/* Application Layer Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-[minmax(250px,auto)] mb-6">
            {/* Authentication Card - Spans 2 columns */}
            <Card className="md:col-span-2 p-8 bg-card border-border hover:border-accent/50 transition-all duration-300 overflow-hidden group relative">
              <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 pointer-events-none">
                <img src="https://svgl.app/library/better-auth_dark.svg" alt="Better Auth" className="w-64 h-64 object-contain -rotate-12 translate-x-10 -translate-y-10" />
              </div>
              
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
                    <Shield className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold font-heading">Authentication Ready</h3>
                </div>
                
                <p className="text-muted-foreground mb-6 max-w-lg">
                  Built-in auth with <span className="text-foreground font-semibold">better-auth</span>. Secure, flexible, and easy to customize for your needs.
                </p>

                <div className="grid md:grid-cols-2 gap-8 mt-auto">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                      Integrated Plugins
                    </h4>
                    <ul className="space-y-2">
                      {["2FA Support", "Admin & Roles", "Organizations", "Polar Integration"].map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="w-4 h-4 text-green-500" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                      </span>
                      Coming Soon
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {["OAuth", "Have I Been PWND", "Magic Link", "Multi Session", "Passkey", "API Key"].map((item) => (
                        <span key={item} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/50 text-xs text-secondary-foreground border border-secondary">
                          <Clock className="w-3 h-3" />
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Database Card */}
            <Card className="p-8 bg-card border-border hover:border-accent/50 transition-all duration-300 overflow-hidden group relative flex flex-col">
              {/* Centered and enlarged Drizzle logo background */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 pointer-events-none">
                <img src="https://svgl.app/library/drizzle-orm_dark.svg" alt="Drizzle" className="w-80 h-80 object-contain rotate-12" />
              </div>

              <div className="relative z-10 flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                  <Database className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold font-heading">Type-Safe Database</h3>
              </div>
              
              <p className="text-muted-foreground mb-6 flex-grow">
                Drizzle ORM with full TypeScript support. Write queries with confidence, autocomplete, and zero runtime overhead.
              </p>

              <div className="bg-secondary/30 rounded-lg p-4 font-mono text-xs text-muted-foreground border border-border/50">
                <div className="flex gap-2 mb-1">
                  <span className="text-purple-400">const</span>
                  <span className="text-blue-400">users</span>
                  <span className="text-foreground">=</span>
                  <span className="text-purple-400">await</span>
                  <span className="text-foreground">db</span>
                </div>
                <div className="pl-4 flex gap-2">
                  <span className="text-foreground">.</span>
                  <span className="text-yellow-400">select</span>
                  <span className="text-foreground">()</span>
                </div>
                <div className="pl-4 flex gap-2">
                  <span className="text-foreground">.</span>
                  <span className="text-yellow-400">from</span>
                  <span className="text-foreground">(users)</span>
                </div>
                <div className="pl-4 flex gap-2">
                  <span className="text-foreground">.</span>
                  <span className="text-yellow-400">where</span>
                  <span className="text-foreground">(...)</span>
                </div>
              </div>
            </Card>

            {/* Modern UI - Now Full Width in this row or separate? Let's make it span 3 cols in a new row if needed, or just fit it here. 
                Wait, I want to separate Rapid and Monorepo. So UI should stay with Auth and DB.
                If I have 3 cols: Auth(2), DB(1). Row filled.
                Next row: UI(3).
            */}
            <Card className="md:col-span-3 p-8 bg-card border-border hover:border-accent/50 transition-all duration-300 group relative overflow-hidden flex flex-col md:flex-row items-center gap-8">
              <div className="absolute -bottom-4 -right-4 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-500 pointer-events-none">
                <img src="https://svgl.app/library/shadcn-ui_dark.svg" alt="shadcn/ui" className="w-64 h-64 object-contain rotate-12" />
              </div>

              <div className="relative z-10 flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold font-heading">Modern UI Components</h3>
                </div>
                <p className="text-muted-foreground mb-4 max-w-2xl">
                  Beautiful, accessible components with <span className="text-foreground font-semibold">shadcn/ui</span>. Customizable and production-ready out of the box.
                </p>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/50 border border-secondary text-xs font-medium text-muted-foreground w-fit">
                  <img src="https://svgl.app/library/shadcn-ui_dark.svg" alt="shadcn/ui" className="w-4 h-4" />
                  shadcn/ui
                </div>
              </div>
              
              {/* Visual preview for UI components */}
              <div className="relative z-10 flex gap-4 opacity-80 grayscale group-hover:grayscale-0 transition-all duration-500">
                 <div className="bg-background border border-border rounded-lg p-4 shadow-sm w-40 space-y-2">
                    <div className="h-2 w-12 bg-muted rounded" />
                    <div className="h-8 w-full bg-primary/20 rounded" />
                 </div>
                 <div className="bg-background border border-border rounded-lg p-4 shadow-sm w-40 space-y-2 mt-4">
                    <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted" />
                        <div className="space-y-1">
                            <div className="h-2 w-16 bg-muted rounded" />
                            <div className="h-2 w-10 bg-muted rounded" />
                        </div>
                    </div>
                 </div>
              </div>
            </Card>
          </div>

          {/* Core Infrastructure Section - Separated visually */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rapid Development */}
            <Card className="p-8 bg-secondary/5 border-dashed border-2 border-border hover:border-blue-500/30 hover:bg-secondary/10 transition-all duration-300 group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-500 pointer-events-none">
                <img src="https://svgl.app/library/vitejs.svg" alt="Vite" className="w-32 h-32 object-contain rotate-12" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold font-heading font-mono tracking-tight">RAPID_DEVELOPMENT</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Powered by <span className="text-foreground font-semibold">Vite</span>. Experience hot module replacement, instant server start, and optimized build times.
                </p>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 border border-border text-xs font-medium text-muted-foreground w-fit">
                  <img src="https://svgl.app/library/vitejs.svg" alt="Vite" className="w-4 h-4" />
                  Vite
                </div>
              </div>
            </Card>

            {/* Monorepo Architecture */}
            <Card className="p-8 bg-secondary/5 border-dashed border-2 border-border hover:border-purple-500/30 hover:bg-secondary/10 transition-all duration-300 group relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity duration-500 pointer-events-none flex gap-2">
                <img src="https://svgl.app/library/pnpm.svg" alt="pnpm" className="w-24 h-24 object-contain" />
                <img src="https://svgl.app/library/nx_dark.svg" alt="NX" className="w-24 h-24 object-contain" />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                    <Blocks className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold font-heading font-mono tracking-tight">MONOREPO_ARCHITECTURE</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  Powered by <span className="text-foreground font-semibold">pnpm workspaces</span> and <span className="text-foreground font-semibold">NX</span>. Efficient dependency management and task orchestration.
                </p>
                <div className="flex gap-3 mt-auto">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 border border-border text-xs font-medium text-muted-foreground">
                    <img src="https://svgl.app/library/pnpm.svg" alt="pnpm" className="w-4 h-4" />
                    pnpm
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background/50 border border-border text-xs font-medium text-muted-foreground">
                    <img src="https://svgl.app/library/nx_dark.svg" alt="NX" className="w-4 h-4" />
                    NX
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
            Ready to Build Something Amazing?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed max-w-2xl mx-auto">
            Join developers who are shipping faster with Beztack
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
            <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Rocket className="mr-2 h-5 w-5" />
              Get Started Now
            </Button>
            <Button size="lg" variant="outline">
              View on GitHub
            </Button>
          </div>

          <div className="flex justify-center">
            <CopyCommandButton />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">Beztack - Modern TypeScript Monorepo</p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Documentation
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                GitHub
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-accent transition-colors">
                Examples
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
