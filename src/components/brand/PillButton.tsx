import { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode, forwardRef } from 'react'

type Variant =
  | 'navy-filled'
  | 'coral-filled'
  | 'coral-outlined'
  | 'ghost'

interface BaseProps {
  variant?: Variant
  size?: 'sm' | 'md'
  icon?: ReactNode
  children: ReactNode
}

const variantClasses: Record<Variant, string> = {
  'navy-filled': 'bg-boon-navy text-white hover:bg-boon-blue',
  'coral-filled': 'bg-boon-coral text-white hover:bg-boon-coralLight',
  'coral-outlined': 'bg-white text-boon-coral border-[1.5px] border-boon-coral hover:bg-boon-coral hover:text-white',
  'ghost': 'bg-transparent text-boon-charcoal/70 hover:text-boon-navy',
}

const sizeClasses: Record<NonNullable<BaseProps['size']>, string> = {
  sm: 'px-4 py-2 text-[12px]',
  md: 'px-5 py-3 text-[13px]',
}

type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { as?: 'button' }
type AnchorProps = BaseProps & AnchorHTMLAttributes<HTMLAnchorElement> & { as: 'a' }
type PillButtonProps = ButtonProps | AnchorProps

/**
 * Boon's standard interactive pill. Use for primary CTAs, nav buttons, and
 * inline action links. The `as="a"` variant renders an anchor while keeping
 * all the same variant and size styles.
 */
export const PillButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, PillButtonProps>(
  function PillButton(
    { variant = 'navy-filled', size = 'md', icon, className = '', children, ...rest },
    ref,
  ) {
    const classes = `inline-flex items-center gap-[10px] rounded-btn font-display font-medium tracking-[0.01em] transition-colors ${variantClasses[variant]} ${sizeClasses[size]} ${className}`

    if ('as' in rest && rest.as === 'a') {
      const { as: _as, ...anchorRest } = rest as AnchorProps
      return (
        <a
          {...(anchorRest as AnchorHTMLAttributes<HTMLAnchorElement>)}
          ref={ref as React.Ref<HTMLAnchorElement>}
          className={classes}
        >
          {children}
          {icon}
        </a>
      )
    }

    const { as: _as, ...buttonRest } = rest as ButtonProps
    return (
      <button
        {...(buttonRest as ButtonHTMLAttributes<HTMLButtonElement>)}
        ref={ref as React.Ref<HTMLButtonElement>}
        className={classes}
      >
        {children}
        {icon}
      </button>
    )
  },
)
