import { ReactNode, HTMLAttributes } from 'react'

interface NavyCardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: 'coral' | 'blue' | 'none'
  dots?: boolean
  padding?: 'md' | 'lg'
  children: ReactNode
}

/**
 * Navy authority surface used for focus cards, practice cards, snapshots.
 * Supports an optional radial gradient glow in the corner and a subtle dot
 * texture — both are Boon brand signature elements.
 */
export function NavyCard({
  glow = 'blue',
  dots = false,
  padding = 'md',
  className = '',
  children,
  ...rest
}: NavyCardProps) {
  const padClass = padding === 'lg' ? 'p-11' : 'p-8'

  return (
    <div
      {...rest}
      className={`relative overflow-hidden rounded-card bg-boon-navy text-white ${padClass} ${className}`}
    >
      {glow === 'coral' && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-32 h-80 w-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(255, 109, 106, 0.22) 0%, transparent 65%)' }}
        />
      )}
      {glow === 'blue' && (
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(70, 111, 246, 0.32) 0%, transparent 65%)' }}
        />
      )}
      {dots && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-4 right-4 h-10 w-10"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255, 255, 255, 0.22) 1px, transparent 1.2px)',
            backgroundSize: '6px 6px',
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  )
}
