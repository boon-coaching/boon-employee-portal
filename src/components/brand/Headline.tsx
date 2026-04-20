import { ReactNode, HTMLAttributes } from 'react'

interface HeadlineProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3'
  size?: 'xl' | 'lg' | 'md' | 'sm'
  children: ReactNode
}

const sizeClasses: Record<NonNullable<HeadlineProps['size']>, string> = {
  xl: 'text-[72px] leading-[0.98] tracking-[-0.03em]',
  lg: 'text-[56px] leading-[1] tracking-[-0.025em]',
  md: 'text-[32px] leading-[1.15] tracking-[-0.02em]',
  sm: 'text-[22px] leading-[1.2] tracking-[-0.015em]',
}

export function Headline({ as = 'h1', size = 'xl', className = '', children, ...rest }: HeadlineProps) {
  const Tag = as
  return (
    <Tag
      {...rest}
      className={`font-display font-bold text-boon-navy ${sizeClasses[size]} ${className}`}
    >
      {children}
    </Tag>
  )
}

interface KickerProps extends HTMLAttributes<HTMLSpanElement> {
  color?: 'blue' | 'coral' | 'coralLight'
  block?: boolean
  children: ReactNode
}

const kickerColors: Record<NonNullable<KickerProps['color']>, string> = {
  blue: 'text-boon-blue',
  coral: 'text-boon-coral',
  coralLight: 'text-boon-coralLight',
}

function Kicker({ color = 'blue', block = true, className = '', children, ...rest }: KickerProps) {
  return (
    <span
      {...rest}
      className={`font-serif italic font-normal ${kickerColors[color]} ${block ? 'block mt-1' : ''} ${className}`}
    >
      {children}
    </span>
  )
}

Headline.Kicker = Kicker
