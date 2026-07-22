import { cn } from '@/utils/cn'
import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#7c6af7] hover:bg-[#9180ff] text-white border border-[#9180ff40]',
  secondary: 'bg-[#1a1a24] hover:bg-[#22222e] text-[#f0f0f5] border border-[#2a2a38]',
  ghost: 'bg-transparent hover:bg-[#ffffff08] text-[#8888a8] hover:text-[#f0f0f5] border border-transparent',
  danger: 'bg-[#ef444420] hover:bg-[#ef444430] text-[#f87171] border border-[#ef444440]',
  outline: 'bg-transparent hover:bg-[#ffffff08] text-[#f0f0f5] border border-[#2a2a38]',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-[8px] font-medium transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c6af7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0f]',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  )
}
