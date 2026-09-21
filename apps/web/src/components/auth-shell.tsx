import type { ReactNode } from 'react'
import { Orbs } from './orbs'

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen grid place-items-center bg-background">
      <Orbs preset="aurora" />
      <div className="relative w-full max-w-sm rounded-2xl border border-border/60 bg-card/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-2">
          <Logo />
          <span className="font-heading text-sm font-semibold tracking-tight">Tesseract</span>
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export function Logo({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--presales)" />
          <stop offset="1" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      <path d="M6 10 L16 4 L26 10 L26 22 L16 28 L6 22 Z" stroke="url(#tg)" strokeWidth="1.8" />
      <path d="M11 13 L16 10 L21 13 L21 19 L16 22 L11 19 Z" stroke="url(#tg)" strokeWidth="1.4" opacity="0.8" />
      <path d="M6 10 L11 13 M26 10 L21 13 M26 22 L21 19 M6 22 L11 19 M16 4 L16 10 M16 28 L16 22" stroke="url(#tg)" strokeWidth="1" opacity="0.6" />
    </svg>
  )
}
