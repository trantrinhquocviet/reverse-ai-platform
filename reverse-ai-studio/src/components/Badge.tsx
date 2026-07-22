import { cn } from '@/utils/cn'
import type { VideoStatus, DatasetStatus, ModelStatus } from '@/types'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'muted'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-[#7c6af720] text-[#a89bff] border border-[#7c6af740]',
  success: 'bg-[#22c55e20] text-[#4ade80] border border-[#22c55e40]',
  warning: 'bg-[#f59e0b20] text-[#fbbf24] border border-[#f59e0b40]',
  error: 'bg-[#ef444420] text-[#f87171] border border-[#ef444440]',
  info: 'bg-[#3b82f620] text-[#60a5fa] border border-[#3b82f640]',
  muted: 'bg-[#ffffff10] text-[#8888a8] border border-[#ffffff15]',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function VideoStatusBadge({ status }: { status: VideoStatus }) {
  const variantMap: Record<VideoStatus, BadgeVariant> = {
    Uploaded: 'info',
    Processing: 'warning',
    Ready: 'success',
    Failed: 'error',
  }
  return <Badge variant={variantMap[status]}>{status}</Badge>
}

export function DatasetStatusBadge({ status }: { status: DatasetStatus }) {
  const variantMap: Record<DatasetStatus, BadgeVariant> = {
    Training: 'success',
    Validation: 'info',
    Pending: 'muted',
  }
  return <Badge variant={variantMap[status]}>{status}</Badge>
}

export function ModelStatusBadge({ status }: { status: ModelStatus }) {
  const variantMap: Record<ModelStatus, BadgeVariant> = {
    'Not Trained': 'muted',
    Training: 'warning',
    Trained: 'info',
    Deployed: 'success',
  }
  return <Badge variant={variantMap[status]}>{status}</Badge>
}
