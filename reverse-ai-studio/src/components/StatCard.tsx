import { cn } from '@/utils/cn'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  iconColor?: string
  iconBg?: string
  trend?: { value: number; label: string }
  className?: string
  progress?: number
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-[#7c6af7]',
  iconBg = 'bg-[#7c6af720]',
  trend,
  className,
  progress,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'rounded-[14px] bg-[#111118] border border-[#1e1e2a] p-5 flex flex-col gap-3',
        'hover:border-[#2a2a38] transition-all duration-200',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-[10px]', iconBg)}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
        {trend && (
          <span
            className={cn(
              'text-xs font-medium',
              trend.value >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'
            )}
          >
            {trend.value >= 0 ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-[#f0f0f5] tracking-tight">{value}</div>
        <div className="text-xs text-[#8888a8] mt-0.5">{title}</div>
        {subtitle && <div className="text-xs text-[#55556a] mt-0.5">{subtitle}</div>}
      </div>
      {progress !== undefined && (
        <div className="w-full h-1.5 bg-[#1a1a24] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7c6af7] rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      )}
    </div>
  )
}
