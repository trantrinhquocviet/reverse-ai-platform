import { useNavigate } from 'react-router-dom'
import {
  Video,
  Loader2,
  ClipboardCheck,
  Database,
  BrainCircuit,
  HardDrive,
  Upload,
  RefreshCw,
  Star,
  Download,
  Zap,
} from 'lucide-react'
import { useDashboardStats, useRecentVideos, useActivities } from '@/hooks/useDashboard'
import { StatCard } from '@/components/StatCard'
import { Card, CardHeader, CardTitle } from '@/components/Card'
import { VideoStatusBadge } from '@/components/Badge'
import { formatRelativeTime } from '@/utils/formatters'
import type { Activity } from '@/types'
import type { LucideIcon } from 'lucide-react'

const activityIcons: Record<Activity['type'], { icon: LucideIcon; color: string; bg: string }> = {
  upload: { icon: Upload, color: 'text-[#60a5fa]', bg: 'bg-[#3b82f620]' },
  process: { icon: RefreshCw, color: 'text-[#a89bff]', bg: 'bg-[#7c6af720]' },
  review: { icon: Star, color: 'text-[#fbbf24]', bg: 'bg-[#f59e0b20]' },
  export: { icon: Download, color: 'text-[#4ade80]', bg: 'bg-[#22c55e20]' },
  train: { icon: Zap, color: 'text-[#f87171]', bg: 'bg-[#ef444420]' },
}

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: recentVideos, isLoading: videosLoading } = useRecentVideos()
  const { data: activities, isLoading: activitiesLoading } = useActivities()
  const navigate = useNavigate()

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#f0f0f5]">Dashboard</h1>
        <p className="text-sm text-[#8888a8] mt-0.5">Overview of your AI platform activity</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-[14px] h-32 skeleton" />
          ))
        ) : stats ? (
          <>
            <StatCard
              title="Uploaded Videos"
              value={stats.uploadedVideos}
              icon={Video}
              iconColor="text-[#60a5fa]"
              iconBg="bg-[#3b82f620]"
            />
            <StatCard
              title="Processing"
              value={stats.processingVideos}
              icon={Loader2}
              iconColor="text-[#fbbf24]"
              iconBg="bg-[#f59e0b20]"
            />
            <StatCard
              title="Need Review"
              value={stats.needReview}
              icon={ClipboardCheck}
              iconColor="text-[#f87171]"
              iconBg="bg-[#ef444420]"
            />
            <StatCard
              title="Total Dataset"
              value={stats.totalDataset.toLocaleString()}
              subtitle="images"
              icon={Database}
              iconColor="text-[#4ade80]"
              iconBg="bg-[#22c55e20]"
            />
            <StatCard
              title="AI Models"
              value={stats.aiModels}
              icon={BrainCircuit}
              iconColor="text-[#a89bff]"
              iconBg="bg-[#7c6af720]"
            />
            <StatCard
              title="Storage"
              value={stats.storageUsed}
              subtitle={`of ${stats.storageTotal}`}
              icon={HardDrive}
              iconColor="text-[#8888a8]"
              iconBg="bg-[#ffffff10]"
              progress={stats.storagePercent}
            />
          </>
        ) : null}
      </div>

      {/* Bottom two-col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent videos */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
            <button
              onClick={() => navigate('/videos')}
              className="text-xs text-[#7c6af7] hover:text-[#9180ff] transition-colors"
            >
              View all →
            </button>
          </CardHeader>
          <div className="space-y-3">
            {videosLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-20 h-12 rounded-[8px] skeleton" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 skeleton rounded w-3/4" />
                      <div className="h-3 skeleton rounded w-1/2" />
                    </div>
                  </div>
                ))
              : recentVideos?.map((video) => (
                  <div
                    key={video.id}
                    onClick={() => navigate(`/videos/${video.id}`)}
                    className="flex gap-3 items-center p-2 rounded-[10px] hover:bg-[#ffffff05] cursor-pointer transition-colors group"
                  >
                    <img
                      src={video.thumbnail}
                      alt={video.name}
                      className="w-20 h-12 object-cover rounded-[8px] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#f0f0f5] truncate group-hover:text-[#a89bff] transition-colors">
                        {video.name}
                      </p>
                      <p className="text-xs text-[#8888a8] mt-0.5">
                        {video.warehouse} · {video.brand}
                      </p>
                      <p className="text-[10px] text-[#55556a] mt-0.5">
                        {formatRelativeTime(video.uploadTime)}
                      </p>
                    </div>
                    <VideoStatusBadge status={video.status} />
                  </div>
                ))}
          </div>
        </Card>

        {/* Recent activities */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <div className="space-y-3">
            {activitiesLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-[8px] skeleton flex-shrink-0" />
                    <div className="flex-1 space-y-1.5 pt-1">
                      <div className="h-3 skeleton rounded w-3/4" />
                      <div className="h-3 skeleton rounded w-1/3" />
                    </div>
                  </div>
                ))
              : activities?.map((activity) => {
                  const { icon: Icon, color, bg } = activityIcons[activity.type]
                  return (
                    <div key={activity.id} className="flex gap-3 items-start">
                      <div className={`p-2 rounded-[8px] flex-shrink-0 ${bg}`}>
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[#f0f0f5] leading-snug">{activity.description}</p>
                        <p className="text-[10px] text-[#55556a] mt-0.5">
                          {activity.user} · {formatRelativeTime(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  )
                })}
          </div>
        </Card>
      </div>
    </div>
  )
}
