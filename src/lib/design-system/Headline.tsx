import { ReactNode, HTMLAttributes } from 'react'

/**
 * Headline
 *
 * Renders the signature Boon pattern: DM Sans Bold statement with an optional
 * DM Serif Text italic kicker. See brand/voice.md and the signature phrases.
 *
 * Source: boon-employee-portal components/brand/Headline.tsx.
 *
 * The `statement` and `kicker` props provide the inventory-described API;
 * the compound form `<Headline><Headline.Kicker /></Headline>` is preserved
 * for flexible composition inside rich copy.
 *
 * Example:
 *   <Headline statement="Leadership signal without" kicker="the noise." />
 *
 *   <Headline as="h2" size="md">
 *     One resource for the <Headline.Kicker color="coral">whole person.</Headline.Kicker>
 *   </Headline>
 */

type Size = 'xl' | 'lg' | 'md' | 'sm'
type KickerColor = 'blue' | 'coral' | 'coral-light' | 'navy'

interface HeadlineProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3'
  size?: Size
  statement?: ReactNode
  kicker?: ReactNode
  kickerColor?: KickerColor
  children?: ReactNode
}

const sizeClasses: Record<Size, string> = {
  xl: 'text-[56px] md:text-[72px] leading-[0.98] tracking-[-0.03em]',
  lg: 'text-[40px] md:text-[56px] leading-[1] tracking-[-0.025em]',
  md: 'text-[28px] md:text-[32px] leading-[1.15] tracking-[-0.02em]',
  sm: 'text-[20px] md:text-[22px] leading-[1.2] tracking-[-0.015em]',
}

export function Headline({
  as = 'h1',
  size = 'xl',
  statement,
  kicker,
  kickerColor = 'blue',
  className = '',
  children,
  ...rest
}: HeadlineProps) {
  const Tag = as
  return (
    <Tag
      {...rest}
      className={`font-[var(--font-display)] font-bold text-[var(--boon-navy)] ${sizeClasses[size]} ${className}`}
    >
      {statement !== undefined ? (
        <>
          {statement}
          {kicker ? (
            <>
              {' '}
              <Kicker color={kickerColor}>{kicker}</Kicker>
            </>
          ) : null}
        </>
      ) : (
        children
      )}
    </Tag>
  )
}

interface KickerProps extends HTMLAttributes<HTMLSpanElement> {
  color?: KickerColor
  block?: boolean
  children: ReactNode
}

const kickerColors: Record<KickerColor, string> = {
  blue: 'text-[var(--boon-blue)]',
  coral: 'text-[var(--boon-coral)]',
  'coral-light': 'text-[var(--boon-coral-light)]',
  navy: 'text-[var(--boon-navy)]',
}

function Kicker({ color = 'blue', block = false, className = '', children, ...rest }: KickerProps) {
  return (
    <span
      {...rest}
      className={`font-[var(--font-serif)] italic font-normal ${kickerColors[color]} ${block ? 'block mt-1' : ''} ${className}`}
    >
      {children}
    </span>
  )
}

Headline.Kicker = Kicker
