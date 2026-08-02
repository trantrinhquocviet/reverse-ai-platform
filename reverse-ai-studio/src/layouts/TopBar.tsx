import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Bell, Search, CheckCheck, Cpu, AlertCircle, Eye, Download, Loader2, X, ChevronRight, ListVideo, Bot, Zap } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockNotifications } from '@/services/mockData'
import { useProcessing, VISION_MODELS } from '@/contexts/ProcessingContext'
import { useAutoTrain } from '@/hooks/useAutoTrain'
import type { Notification, NotificationType } from '@/types'

const breadcrumbMap: Record<string, string[]> = {
  '/': ['Dashboard'],
  '/videos': ['Video Center'],
  '/dataset': ['Dataset'],
  '/models': ['AI Models'],
  '/settings': ['Settings'],
  '/ai-processing': ['AI Processing'],
  '/annotation-queue': ['Annotation Queue'],
  '/review-queue': ['Review Queue'],
  '/feature-explorer': ['Feature Explorer'],
}

function getBreadcrumb(pathname: string): string[] {
  if (pathname.startsWith('/videos/')) return ['Video Center', 'Video Detail']
  if (pathname.match(/^\/ai-processing\/[^/]+\/frames/)) return ['AI Processing', 'Job Detail', 'Frame Gallery']
  if (pathname.match(/^\/ai-processing\/.+/)) return ['AI Processing', 'Job Detail']
  if (pathname.startsWith('/annotation/')) return ['Annotation Queue', 'Annotation Tool']
  return breadcrumbMap[pathname] ?? [pathname]
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const cfg = {
    processing_complete: { icon: Cpu, color: 'text-[#a89bff]', bg: 'bg-[#7c6af720]' },
    ocr_failed: { icon: AlertCircle, color: 'text-[#f87171]', bg: 'bg-[#dc262620]' },
    frame_needs_review: { icon: Eye, color: 'text-[#fbbf24]', bg: 'bg-[#d9770620]' },
    dataset_exported: { icon: Download, color: 'text-[#4ade80]', bg: 'bg-[#16a34a20]' },
  }
  const { icon: Icon, color, bg } = cfg[type]
  return (
    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', bg)}>
      <Icon className={cn('w-3.5 h-3.5', color)} />
    </div>
  )
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const crumbs = getBreadcrumb(location.pathname)
  const { job, queue, preferredModel, setPreferredModel, removeFromQueue, clearQueue, cancelJob } = useProcessing()

  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications)
  const [queueOpen, setQueueOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const queueRef = useRef<HTMLDivElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (queueRef.current && !queueRef.current.contains(e.target as Node)) setQueueOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { count: atCount, notified: atNotified, isReady: atIsReady } = useAutoTrain()
  const showAutoTrainAlert = atIsReady && atNotified && location.pathname !== '/mini-ai-trainer'

  const unreadCount = notifications.filter(n => !n.read).length + (showAutoTrainAlert ? 1 : 0)

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="h-[60px] flex items-center justify-between px-6 border-b border-[#1e1e2a] bg-[#0a0a0f] flex-shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        {crumbs.map((crumb, idx) => (
          <div key={crumb} className="flex items-center gap-2">
            {idx > 0 && <span className="text-[#55556a] text-sm">/</span>}
            <span
              className={
                idx === crumbs.length - 1
                  ? 'text-sm font-semibold text-[#f0f0f5]'
                  : 'text-sm text-[#8888a8]'
              }
            >
              {crumb}
            </span>
          </div>
        ))}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Processing indicator + queue dropdown */}
        {(job?.status === 'running' || queue.length > 0) && (
          <div ref={queueRef} className="relative">
            <button
              onClick={() => setQueueOpen(v => !v)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-[8px] border transition-colors',
                queueOpen
                  ? 'bg-[#7c6af730] border-[#7c6af760]'
                  : 'bg-[#7c6af720] border-[#7c6af740] hover:bg-[#7c6af730]'
              )}
            >
              {job?.status === 'running'
                ? <Loader2 className="w-3 h-3 text-[#a89bff] animate-spin flex-shrink-0" />
                : <ListVideo className="w-3 h-3 text-[#a89bff] flex-shrink-0" />}
              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-[#a89bff] leading-none max-w-[120px] truncate">
                    {job?.status === 'running' ? job.videoName : `${queue.length} in queue`}
                  </span>
                  {job?.status === 'running' && queue.length > 0 && (
                    <span className="text-[9px] text-[#55556a]">+{queue.length}</span>
                  )}
                </div>
                {job?.status === 'running' && (
                  <div className="flex items-center gap-1">
                    <div className="w-16 h-0.5 rounded-full bg-[#1e1e2a]">
                      <div
                        className="h-0.5 rounded-full bg-[#7c6af7] transition-all duration-300"
                        style={{ width: `${job.total ? (job.current / job.total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-[#55556a]">{job.current}/{job.total}</span>
                  </div>
                )}
              </div>
            </button>

            {/* Queue dropdown */}
            {queueOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] shadow-2xl z-50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2a]">
                  <span className="text-sm font-semibold text-[#f0f0f5]">Processing Queue</span>
                  {queue.length > 0 && (
                    <button
                      onClick={() => clearQueue()}
                      className="text-[10px] text-[#55556a] hover:text-[#f87171] transition-colors"
                    >
                      Clear queue
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-[#1e1e2a]">
                  {/* Currently processing */}
                  {job?.status === 'running' && (
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] animate-pulse" />
                          <span className="text-[10px] text-[#55556a] font-medium uppercase tracking-wider">Processing now</span>
                        </div>
                        <button
                          onClick={() => cancelJob()}
                          className="flex items-center gap-1 text-[10px] text-[#55556a] hover:text-[#f87171] transition-colors px-2 py-0.5 rounded-[4px] hover:bg-[#f8717110]"
                          title="Cancel processing"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                      <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => { navigate(`/videos/${job.videoId}`); setQueueOpen(false) }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-[#f0f0f5] truncate group-hover:text-[#a89bff] transition-colors">{job.videoName}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 rounded-full bg-[#1e1e2a]">
                              <div
                                className="h-1 rounded-full bg-[#7c6af7] transition-all duration-300"
                                style={{ width: `${job.total ? (job.current / job.total) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-[#55556a] flex-shrink-0">
                              {job.current}/{job.total} frames
                            </span>
                          </div>
                          <p className="text-[10px] text-[#55556a] mt-0.5 truncate">{job.message}</p>
                          <p className="text-[9px] text-[#44445a] mt-0.5 truncate">
                            Model: {VISION_MODELS.find(m => m.id === preferredModel)?.label ?? preferredModel}
                          </p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#55556a] group-hover:text-[#a89bff] transition-colors flex-shrink-0" />
                      </div>
                    </div>
                  )}

                  {/* Queued videos */}
                  {queue.length > 0 && (
                    <div className="px-4 py-2">
                      <div className="flex items-center gap-2 mb-2 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#55556a]" />
                        <span className="text-[10px] text-[#55556a] font-medium uppercase tracking-wider">Waiting ({queue.length})</span>
                      </div>
                      <div className="space-y-1">
                        {queue.map((v, i) => (
                          <div key={v.id} className="flex items-center gap-2 py-1.5 group">
                            <span className="text-[10px] text-[#44445a] w-4 flex-shrink-0 text-center">{i + 1}</span>
                            <p className="text-xs text-[#8888a8] truncate flex-1">{v.name}</p>
                            <button
                              onClick={() => removeFromQueue(v.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-[#55556a] hover:text-[#f87171] transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!job && queue.length === 0 && (
                    <p className="px-4 py-6 text-center text-xs text-[#55556a]">Queue trống</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {/* AI Model picker */}
        <div ref={modelRef} className="relative">
          <button
            onClick={() => setModelOpen(v => !v)}
            title="Switch AI model"
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-[10px] font-medium transition-colors',
              modelOpen
                ? 'bg-[#7c6af730] border-[#7c6af760] text-[#a89bff]'
                : 'bg-[#ffffff08] border-transparent text-[#8888a8] hover:text-[#a89bff] hover:bg-[#7c6af720]'
            )}
          >
            <Bot className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="max-w-[90px] truncate hidden sm:block">
              {VISION_MODELS.find(m => m.id === preferredModel)?.label.split(' ')[0] ?? 'AI Model'}
            </span>
          </button>

          {modelOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1e1e2a]">
                <p className="text-xs font-semibold text-[#f0f0f5]">Vision AI Model</p>
                <p className="text-[10px] text-[#55556a] mt-0.5">Preferred model — auto-fallbacks if rate-limited</p>
              </div>
              <div className="p-2">
                {VISION_MODELS.map((m, i) => (
                  <button
                    key={m.id}
                    onClick={() => { setPreferredModel(m.id); setModelOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left transition-colors',
                      preferredModel === m.id
                        ? 'bg-[#7c6af720] text-[#a89bff]'
                        : 'hover:bg-[#ffffff06] text-[#8888a8]'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                      preferredModel === m.id ? 'bg-[#7c6af7] text-white' : 'bg-[#1e1e2a] text-[#55556a]'
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{m.label}</p>
                      <p className="text-[9px] text-[#44445a] truncate mt-0.5">{m.id}</p>
                    </div>
                    {preferredModel === m.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-[#1e1e2a]">
                <p className="text-[10px] text-[#44445a]">
                  Fallback order: 1 → 2 → 3 → 4 → 5 khi hết token
                </p>
              </div>
            </div>
          )}
        </div>

        <button className="p-2 rounded-[8px] text-[#55556a] hover:text-[#f0f0f5] hover:bg-[#ffffff08] transition-colors">
          <Search className="w-4 h-4" />
        </button>

        {/* Notification bell */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen(prev => !prev)}
            className="relative p-2 rounded-[8px] text-[#55556a] hover:text-[#f0f0f5] hover:bg-[#ffffff08] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-[#7c6af7] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-[#0d0d14] border border-[#1e1e2a] rounded-[12px] shadow-2xl z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2a]">
                <span className="text-sm font-semibold text-[#f0f0f5]">Notifications</span>
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[10px] text-[#8888a8] hover:text-[#a89bff] transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  Mark all read
                </button>
              </div>

              {/* List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-[#1e1e2a]">
                {/* Auto-train alert */}
                {showAutoTrainAlert && (
                  <div
                    className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[#7c6af710] bg-[#7c6af708] transition-colors"
                    onClick={() => { navigate('/mini-ai-trainer'); setOpen(false) }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-[#7c6af720]">
                      <Zap className="w-3.5 h-3.5 text-[#a89bff]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#a89bff]">Đủ {atCount} frames — sẵn sàng train</p>
                      <p className="text-[10px] text-[#55556a] mt-0.5">Đi đến Mini AI Trainer →</p>
                    </div>
                  </div>
                )}
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-[#ffffff04] transition-colors',
                      !notif.read && 'bg-[#7c6af708]'
                    )}
                    onClick={() => setNotifications(prev =>
                      prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
                    )}
                  >
                    <NotificationIcon type={notif.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-[#f0f0f5] truncate">{notif.title}</p>
                        {!notif.read && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#7c6af7] flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-[10px] text-[#8888a8] line-clamp-2 mt-0.5">{notif.message}</p>
                      <p className="text-[10px] text-[#55556a] mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-[#1e1e2a] mx-1" />
        <div className="flex items-center gap-2 pl-1">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#a855f7] flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">VT</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-medium text-[#f0f0f5]">Viet Tran</p>
            <p className="text-[10px] text-[#8888a8]">Admin</p>
          </div>
        </div>
      </div>
    </header>
  )
}
