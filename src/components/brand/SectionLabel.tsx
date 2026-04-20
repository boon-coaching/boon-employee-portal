import { ReactNode, HTMLAttributes } from 'react'

interface SectionLabelProps extends HTMLAttributes<HTMLDivElement> {
  color?: 'charcoal' | 'blue' | 'coral' | 'navy'
  hairline?: boolean
  children: ReactNode
}

const colorClasses: Record<NonNullable<SectionLabelProps['color']>, string> = {
  charcoal: 'text-boon-charcoal opacity-55',
  blue: 'text-boon-blue',
  coral: 'text-boon-coral',
  navy: 'text-boon-navy',
}

export function SectionLabel({
  color = 'charcoal',
  hairline = false,
  className = '',
  children,
  ...rest
}: SectionLabelProps) {
  return (
    <div
      {...rest}
      className={`font-sans font-extrabold text-[11px] uppercase tracking-[0.18em] inline-flex items-center gap-[10px] ${colorClasses[color]} ${className}`}
    >
      {hairline && <span className="w-4 h-px bg-current" aria-hidden />}
      {children}
    </div>
  )
}
