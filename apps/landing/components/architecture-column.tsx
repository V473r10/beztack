"use client"

interface ArchitectureColumnProps {
  title: string
  color: string
  items: string[]
}

export function ArchitectureColumn({ title, color, items }: ArchitectureColumnProps) {
  return (
    <div className="group flex flex-col gap-3">
      <div
        className="border rounded-lg p-6 hover:border-opacity-80 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 min-h-[200px]"
        style={{
          background: `linear-gradient(to bottom right, ${color}1A, ${color}0D)`,
          borderColor: `${color}4D`,
          boxShadow: `0 0 0 0 ${color}1A`,
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: color }} />
          <h3 className="font-heading font-mono text-sm" style={{ color }}>
            {title}
          </h3>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground transition-colors"
            >
              <span style={{ color }}>→</span>
              <span className="text-pretty">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
