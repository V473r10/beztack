import type React from "react"
import { Card } from "@/components/ui/card"

interface FeatureCardProps {
  icon: React.ReactNode
  title: string
  description: string
  gradient?: string
}

export function FeatureCard({ icon, title, description, gradient }: FeatureCardProps) {
  return (
    <Card className="group relative p-6 bg-card border-border hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10 overflow-hidden">
      {gradient && (
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300"
          style={{ background: gradient }}
        />
      )}

      <div className="relative flex flex-col gap-4">
        <div className="relative w-fit">
          <div
            className="absolute inset-0 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-300"
            style={{ background: gradient }}
          />
          <div className="relative text-accent group-hover:scale-110 transition-transform duration-300">{icon}</div>
        </div>

        <div>
          <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-accent transition-colors">
            {title}
          </h3>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </Card>
  )
}
