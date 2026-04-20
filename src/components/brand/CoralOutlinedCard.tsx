import { ReactNode, HTMLAttributes } from 'react'

interface CoralOutlinedCardProps extends HTMLAttributes<HTMLDivElement> {
  gradient?: boolean
  padding?: 'md' | 'lg'
  children: ReactNode
}

/**
 * Coral-outlined CTA/focus surface. Use for "matches your focus", "next up",
 * and checkpoint-style prompts that should catch the eye without going navy.
 */
export function CoralOutlinedCard({
  gradient = false,
  padding = 'md',
  className = '',
  children,
  ...rest
}: CoralOutlinedCardProps) {
  const padClass = padding === 'lg' ? 'p-9' : 'p-7'

  return (
    <div
      {...rest}
      className={`relative overflow-hidden rounded-card bg-white border-[1.5px] border-boon-coral ${padClass} ${className}`}
    >
      {gradient && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, #FFBBBB 0%, transparent 65%)' }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  )
}
