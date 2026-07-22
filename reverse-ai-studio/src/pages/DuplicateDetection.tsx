import { useState } from 'react'
import { Copy, Star } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockDuplicateGroups } from '@/services/mockData'
import type { DuplicateGroup } from '@/types'

function GroupCard({ group }: { group: DuplicateGroup }) {
  const [keepId, setKeepId]       = useState(group.keepFrameId)
  const [discarded, setDiscarded] = useState<string[]>([])

  const discardOthers = () => {
    setDiscarded(group.frames.filter(f => f.frameId !== keepId).map(f => f.frameId))
  }

  return (
    <div className="bg-[#12121c] border border-[#1e1e2a] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Copy className="w-4 h-4 text-[#60a5fa]" />
          <span className="text-sm font-semibold text-[#f0f0f5]">Group {group.id.toUpperCase()}</span>
          <span className="text-xs text-[#55556a]">· {group.frames.length} frames</span>
        </div>
        <button
          onClick={discardOthers}
          className="px-3 py-1.5 rounded-lg bg-[#f87171] text-white text-xs font-medium hover:bg-[#ef4444] transition-colors"
        >
          Discard Others
        </button>
      </div>

      {/* Thumbnail row */}
      <div className="flex gap-3 overflow-x-auto">
        {group.frames.map(frame => {
          const isKeep     = frame.frameId === keepId
          const isDiscard  = discarded.includes(frame.frameId)
          return (
            <div
              key={frame.frameId}
              className={cn(
                'flex-shrink-0 w-36 rounded-xl overflow-hidden border-2 transition-all cursor-pointer',
                isKeep    ? 'border-[#4ade80]' : isDiscard ? 'border-[#f87171] opacity-40' : 'border-[#1e1e2a] hover:border-[#2e2e3a]'
              )}
              onClick={() => !isDiscard && setKeepId(frame.frameId)}
            >
              <div className="w-full aspect-video bg-[#1a1a28] flex items-center justify-center relative">
                <span className="text-[10px] text-[#2e2e3a] font-mono">{frame.frameId}</span>
                {isKeep && (
                  <div className="absolute top-1.5 right-1.5 bg-[#4ade80] rounded-full p-0.5">
                    <Star className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
                {isDiscard && (
                  <div className="absolute inset-0 bg-[#f8717140] flex items-center justify-center">
                    <span className="text-xs text-[#f87171] font-medium">Discarded</span>
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5 space-y-0.5">
                <div className="text-[10px] text-[#8888a8] font-mono">{frame.timestamp}</div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#55556a]">Sim</span>
                  <span className={cn('text-[10px] font-bold', frame.similarityScore >= 98 ? 'text-[#f87171]' : 'text-[#fbbf24]')}>
                    {frame.similarityScore}%
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <button
          onClick={() => setKeepId(group.frames.reduce((best, f) => f.similarityScore > (group.frames.find(x => x.frameId === best)?.similarityScore ?? 0) ? f.frameId : best, group.frames[0].frameId))}
          className="px-3 py-1.5 rounded-lg bg-[#16a34a20] text-[#4ade80] hover:bg-[#16a34a40] transition-colors font-medium"
        >
          Keep Best Quality
        </button>
        <span className="text-[#55556a]">Click a frame to mark as keeper</span>
        {discarded.length > 0 && (
          <button onClick={() => setDiscarded([])} className="ml-auto text-[#a89bff] hover:underline">Undo</button>
        )}
      </div>
    </div>
  )
}

export function DuplicateDetection() {
  const totalGroups   = mockDuplicateGroups.length
  const framesToDiscard = mockDuplicateGroups.reduce((a, g) => a + g.discardedCount, 0)
  const spaceSavedMB    = framesToDiscard * 2.4 // rough estimate

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#3b82f620] flex items-center justify-center">
          <Copy className="w-5 h-5 text-[#60a5fa]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#f0f0f5]">Duplicate Detection</h1>
          <p className="text-xs text-[#55556a]">Identify and remove near-identical frames</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Duplicate Groups', value: totalGroups,                 color: 'text-[#60a5fa]' },
          { label: 'Frames to Discard', value: framesToDiscard,            color: 'text-[#f87171]' },
          { label: 'Space Saved',      value: `~${spaceSavedMB.toFixed(0)} MB`, color: 'text-[#4ade80]' },
        ].map(s => (
          <div key={s.label} className="bg-[#12121c] border border-[#1e1e2a] rounded-xl p-4">
            <div className={cn('text-3xl font-black', s.color)}>{s.value}</div>
            <div className="text-xs text-[#55556a] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {mockDuplicateGroups.map(group => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>
    </div>
  )
}
