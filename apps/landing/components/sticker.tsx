"use client"

import { useState } from "react"

interface StickerProps {
  packageName: string
  libraryName: string
  logoUrl: string
  rotation?: number
}

export function Sticker({ packageName, libraryName, logoUrl, rotation = 0 }: StickerProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className="relative group cursor-pointer transition-all duration-300"
      style={{
        transform: `rotate(${rotation}deg)`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Sticker shadow */}
      <div
        className="absolute inset-0 bg-black/10 blur-sm rounded-xl"
        style={{
          transform: isHovered ? "translateY(4px) scale(1.05)" : "translateY(2px)",
          transition: "all 0.3s ease",
        }}
      />

      {/* Sticker body */}
      <div
        className="relative bg-white border-2 border-white rounded-xl p-4 transition-all duration-300"
        style={{
          transform: isHovered ? "translateY(-4px) scale(1.05)" : "translateY(0)",
          boxShadow: isHovered
            ? "0 8px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.8)"
            : "0 4px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.8)",
        }}
      >
        {/* Glossy effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-transparent rounded-xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center justify-center h-16 mb-3">
          <img src={logoUrl || "/placeholder.svg"} alt={libraryName} className="h-full w-auto object-contain" />
        </div>

        <div className="text-center">
          <p className="font-mono text-xs font-semibold text-gray-800 tracking-wide">{packageName}</p>
        </div>

        {/* Peeling corner effect */}
        <div
          className="absolute top-0 right-0 w-0 h-0 border-t-8 border-r-8 border-t-gray-100 border-r-transparent rounded-tr-xl opacity-60"
          style={{
            filter: "drop-shadow(-1px 1px 1px rgba(0,0,0,0.1))",
          }}
        />
      </div>

      {/* Tape effect (optional, shows on hover) */}
      {isHovered && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-yellow-100/80 border border-yellow-200/50 rounded-sm"
          style={{
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            transform: "translateX(-50%) rotate(-2deg)",
          }}
        />
      )}
    </div>
  )
}
