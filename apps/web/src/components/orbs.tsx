import { cn } from 'cn'

type Orb = { color: string; size: string; x: string; y: string; delay?: string; driftX?: string; driftY?: string }

const PRESETS: Record<'aurora' | 'presales' | 'postsales' | 'ember', Orb[]> = {
  aurora: [
    { color: 'var(--primary)', size: '55vmax', x: '-10%', y: '-20%', driftX: '8%', driftY: '6%' },
    { color: 'var(--presales)', size: '45vmax', x: '60%', y: '-10%', delay: '-6s', driftX: '-6%', driftY: '10%' },
    { color: 'var(--postsales)', size: '40vmax', x: '30%', y: '60%', delay: '-12s', driftX: '5%', driftY: '-9%' },
  ],
  presales: [
    { color: 'var(--presales)', size: '70%', x: '-10%', y: '-60%', driftX: '5%', driftY: '4%' },
    { color: 'var(--primary)', size: '50%', x: '55%', y: '-40%', delay: '-8s', driftX: '-4%', driftY: '6%' },
  ],
  postsales: [
    { color: 'var(--postsales)', size: '70%', x: '-10%', y: '-60%', driftX: '5%', driftY: '4%' },
    { color: 'var(--primary)', size: '50%', x: '55%', y: '-40%', delay: '-8s', driftX: '-4%', driftY: '6%' },
  ],
  ember: [
    { color: 'var(--primary)', size: '60%', x: '20%', y: '-30%', driftX: '4%', driftY: '6%' },
    { color: 'var(--chart-4)', size: '45%', x: '-15%', y: '30%', delay: '-9s', driftX: '-5%', driftY: '-5%' },
  ],
}

// Ambient blurred gradient orbs. Pure CSS (radial-gradient + blur + one drift keyframe), no runtime deps.
// Used only where it cannot compete with data: auth, empty states, engagement headers.
export function Orbs({
  preset = 'aurora',
  className,
  opacity = 0.55,
  grain = true,
}: {
  preset?: keyof typeof PRESETS
  className?: string
  opacity?: number
  grain?: boolean
}) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} style={{ opacity }}>
      {PRESETS[preset].map((o, i) => (
        <div
          key={i}
          className="absolute rounded-full animate-orb-drift will-change-transform"
          style={{
            width: o.size,
            height: o.size,
            left: o.x,
            top: o.y,
            background: `radial-gradient(circle at 50% 50%, ${o.color} 0%, transparent 70%)`,
            filter: 'blur(60px)',
            animationDelay: o.delay,
            ['--drift-x' as string]: o.driftX,
            ['--drift-y' as string]: o.driftY,
          }}
        />
      ))}
      {grain && (
        <div
          className="absolute inset-0 mix-blend-overlay opacity-40"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")",
          }}
        />
      )}
    </div>
  )
}
