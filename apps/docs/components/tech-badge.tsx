interface TechBadgeProps {
  name: string;
  logoUrl: string;
}

export function TechBadge({ name, logoUrl }: TechBadgeProps) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3 transition-colors hover:bg-secondary/50">
      <div className="flex h-6 w-6 items-center justify-center">
        <img
          alt={`${name} logo`}
          className="h-full w-full object-contain transition-transform group-hover:scale-110"
          src={logoUrl || "/placeholder.svg"}
        />
      </div>
      <span className="font-mono text-foreground text-sm">{name}</span>
    </div>
  );
}
