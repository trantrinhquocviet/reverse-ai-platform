import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="p-4 rounded-[16px] bg-[#1a1a24] border border-[#2a2a38]">
        <Icon className="w-8 h-8 text-[#55556a]" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-[#f0f0f5]">{title}</p>
        {description && (
          <p className="text-xs text-[#8888a8] mt-1 max-w-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
