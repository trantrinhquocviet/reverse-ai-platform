import { cn } from '@/utils/cn'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode
  label?: string
  error?: string
}

export function Input({ leftIcon, label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[#8888a8]">{label}</label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#55556a]">
            {leftIcon}
          </div>
        )}
        <input
          className={cn(
            'w-full h-9 bg-[#0a0a0f] border border-[#2a2a38] rounded-[8px] px-3 text-sm text-[#f0f0f5]',
            'placeholder:text-[#55556a]',
            'focus:outline-none focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af740]',
            'transition-colors duration-150',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            leftIcon && 'pl-9',
            error && 'border-[#ef4444]',
            className
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export function Select({ label, error, className, children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[#8888a8]">{label}</label>
      )}
      <select
        className={cn(
          'w-full h-9 bg-[#0a0a0f] border border-[#2a2a38] rounded-[8px] px-3 text-sm text-[#f0f0f5]',
          'focus:outline-none focus:border-[#7c6af7] focus:ring-1 focus:ring-[#7c6af740]',
          'transition-colors duration-150',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-[#ef4444]',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#f87171]">{error}</p>}
    </div>
  )
}
