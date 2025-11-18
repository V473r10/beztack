"use client"

interface PackageItemProps {
  name: string
  color: string
}

export function PackageItem({ name, color }: PackageItemProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
      <span style={{ color }}>→</span>
      <span className="text-pretty">{name}</span>
    </div>
  )
}
