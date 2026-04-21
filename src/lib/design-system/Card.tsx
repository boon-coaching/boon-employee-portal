import { HTMLAttributes, ReactNode } from 'react'

/**
 * Card
 *
 * Boon's container surface. Three variants, each with a distinct purpose.
 *
 * Source:
 *   default          inline dashboard tiles across the portal
 *                    (bg-white rounded-card, subtle border)
 *   navy             boon-employee-portal/components/brand/NavyCard.tsx
 *                    authority surface with optional radial glow and dot texture
 *   coral-outlined   boon-employee-portal/components/brand/CoralOutlinedCard.tsx
 *                    CTA surface with optional soft coral radial accent
 *
 * For marketing surfaces that want dotted corner framing, wrap the Card
 * with `<DottedCorners>` externally rather than passing a prop.
 *
 * Example:
 *   <Card>Dashboard tile</Card>
 *   <Card variant="navy" glow="coral" dots>Focus card</Card>
 *   <Card variant="coral-outlined" accent>Book a Strategy Call</Card>
 */

type Variant = 'default' | 'navy' | 'coral-outlined'
type Padding = 'sm' | 'md' | 'lg'
type Glow = 'coral' | 'blue' | 'none'

interface Props extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: Padding
  glow?: Glow
  dots?: boolean
  accent?: boolean
  children: ReactNode
}

const paddingClasses: Record<Padding, string> = {
  sm: 'p-5',
  md: 'p-7',
  lg: 'p-10',
}

export function Card({
  variant = 'default',
  padding = 'md',
  glow = 'blue',
  dots = false,
  accent = false,
  className = '',
  children,
  ...rest
}: Props) {
  if (variant === 'navy') {
    return (
      <div
        {...rest}
        className={`relative overflow-hidden rounded-[10px] text-white ${paddingClasses[padding]} ${className}`}
        style={{ backgroundColor: 'var(--boon-navy)' }}
      >
        {glow === 'coral' ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -right-32 h-80 w-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(255, 109, 106, 0.22) 0%, transparent 65%)' }}
          />
        ) : glow === 'blue' ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(70, 111, 246, 0.32) 0%, transparent 65%)' }}
          />
        ) : null}
        {dots ? (
          <span
            aria-hidden
            className="pointer-events-none absolute top-4 right-4 h-10 w-10"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255, 255, 255, 0.22) 1px, transparent 1.2px)',
              backgroundSize: '6px 6px',
            }}
          />
        ) : null}
        <div className="relative">{children}</div>
      </div>
    )
  }

  if (variant === 'coral-outlined') {
    return (
      <div
        {...rest}
        className={`relative overflow-hidden rounded-[10px] bg-white ${paddingClasses[padding]} ${className}`}
        style={{ border: '1.5px solid var(--boon-coral)' }}
      >
        {accent ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full opacity-40"
            style={{
              background:
                'radial-gradient(circle, var(--boon-coral-soft) 0%, transparent 65%)',
            }}
          />
        ) : null}
        <div className="relative">{children}</div>
      </div>
    )
  }

  return (
    <div
      {...rest}
      className={`rounded-[10px] bg-white ${paddingClasses[padding]} ${className}`}
      style={{
        border: '1px solid color-mix(in srgb, var(--boon-charcoal) 10%, transparent)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {children}
    </div>
  )
}
