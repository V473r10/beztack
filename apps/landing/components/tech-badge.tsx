interface TechBadgeProps {
  name: string
  logoUrl: string
}

export function TechBadge({ name, logoUrl }: TechBadgeProps) {
  return (
    <div className="flex items-center gap-3 bg-secondary/30 border border-border rounded-lg px-4 py-3 hover:bg-secondary/50 transition-colors group">
      <div className="w-6 h-6 flex items-center justify-center">
        <img
          src={logoUrl || "/placeholder.svg"}
          alt={`${name} logo`}
          className="w-full h-full object-contain group-hover:scale-110 transition-transform"
        />
      </div>
      <span className="font-mono text-sm text-foreground">{name}</span>
    </div>
  )
}
