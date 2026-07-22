import { useState } from 'react'
import { Archive, ChevronDown, Download, Trash2, RotateCcw, Filter } from 'lucide-react'
import { mockModelRegistry } from '@/services/mockData'
import { cn } from '@/utils/cn'

const DEPLOY_BADGE: Record<string, string> = {
  deployed: 'bg-green-900/40 text-green-400',
  not_deployed: 'bg-gray-800/60 text-gray-400',
  deploying: 'bg-blue-900/40 text-blue-400',
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-900/40 text-green-400',
  archived: 'bg-gray-800/60 text-gray-400',
  deprecated: 'bg-red-900/40 text-red-400',
}

export function ModelRegistry() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterTask, setFilterTask] = useState('all')
  const [filterDeploy, setFilterDeploy] = useState('all')

  const tasks = Array.from(new Set(mockModelRegistry.map(m => m.task)))
  const filtered = mockModelRegistry.filter(m =>
    (filterTask === 'all' || m.task === filterTask) &&
    (filterDeploy === 'all' || m.versions.some(v => v.deploymentStatus === filterDeploy))
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f0f5] flex items-center gap-3">
            <Archive className="w-7 h-7 text-[#a89bff]" />
            Model Registry
          </h1>
          <p className="text-[#8888a8] mt-1">Manage trained models, versions, and deployments</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c6af7] hover:bg-[#6b5ce7] text-white text-sm font-medium transition-colors">
          <Archive className="w-4 h-4" /> Register Model
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-[#55556a]" />
        <select
          value={filterTask}
          onChange={e => setFilterTask(e.target.value)}
          className="bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
        >
          <option value="all">All Tasks</option>
          {tasks.map(t => <option key={t}>{t}</option>)}
        </select>
        <select
          value={filterDeploy}
          onChange={e => setFilterDeploy(e.target.value)}
          className="bg-[#1e1e2a] border border-[#2a2a3a] rounded-lg px-3 py-1.5 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
        >
          <option value="all">All Deploy Status</option>
          <option value="deployed">Deployed</option>
          <option value="not_deployed">Not Deployed</option>
          <option value="deploying">Deploying</option>
        </select>
      </div>

      {/* Model cards */}
      <div className="space-y-4">
        {filtered.map(model => {
          const latest = model.versions.find(v => v.version === model.latestVersion)
          const expanded = expandedId === model.id
          return (
            <div key={model.id} className="bg-[#13131f] border border-[#1e1e2a] rounded-xl overflow-hidden">
              {/* Card header */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-[#1e1e2a]/40 transition-colors"
                onClick={() => setExpandedId(expanded ? null : model.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-[#f0f0f5]">{model.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#7c6af720] text-[#a89bff]">{model.task}</span>
                    <span className="text-xs text-[#55556a]">{model.latestVersion}</span>
                    {latest && (
                      <span className={cn('text-xs px-2 py-0.5 rounded-full', DEPLOY_BADGE[latest.deploymentStatus])}>
                        {latest.deploymentStatus.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#55556a] truncate">{model.description}</p>
                </div>
                <div className="hidden md:flex items-center gap-6 text-xs text-center flex-shrink-0">
                  <div>
                    <div className="text-[#f0f0f5] font-medium">{model.versions.length}</div>
                    <div className="text-[#44445a]">Versions</div>
                  </div>
                  <div>
                    <div className="text-green-400 font-medium">{latest ? latest.mAP50.toFixed(3) : '—'}</div>
                    <div className="text-[#44445a]">mAP50</div>
                  </div>
                  <div>
                    <div className="text-[#8888a8]">{model.owner}</div>
                    <div className="text-[#44445a]">Owner</div>
                  </div>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-[#44445a] transition-transform flex-shrink-0', expanded && 'rotate-180')} />
              </div>

              {/* Expanded versions */}
              {expanded && (
                <div className="border-t border-[#1e1e2a]">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#1e1e2a] text-[#44445a] uppercase tracking-wider">
                          <th className="text-left px-4 py-2">Version</th>
                          <th className="text-left px-4 py-2">Framework</th>
                          <th className="text-center px-4 py-2">Dataset</th>
                          <th className="text-center px-4 py-2">mAP50</th>
                          <th className="text-center px-4 py-2">Accuracy</th>
                          <th className="text-center px-4 py-2">Speed</th>
                          <th className="text-center px-4 py-2">Size</th>
                          <th className="text-center px-4 py-2">Status</th>
                          <th className="text-center px-4 py-2">Deployed</th>
                          <th className="text-right px-4 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {model.versions.map(v => (
                          <tr key={v.id} className="border-b border-[#1e1e2a]/50 hover:bg-[#1e1e2a]/30">
                            <td className="px-4 py-2 font-mono font-medium text-[#a89bff]">{v.version}</td>
                            <td className="px-4 py-2 text-[#8888a8]">{v.framework}</td>
                            <td className="px-4 py-2 text-center text-[#55556a]">{v.datasetVersion}</td>
                            <td className="px-4 py-2 text-center text-green-400 font-medium">{v.mAP50.toFixed(3)}</td>
                            <td className="px-4 py-2 text-center text-[#f0f0f5]">{v.accuracy}%</td>
                            <td className="px-4 py-2 text-center text-[#8888a8]">{v.inferenceSpeedMs}ms</td>
                            <td className="px-4 py-2 text-center text-[#8888a8]">{v.modelSizeMB}MB</td>
                            <td className="px-4 py-2 text-center">
                              <span className={cn('px-1.5 py-0.5 rounded-full text-[9px]', STATUS_BADGE[v.status])}>{v.status}</span>
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className={cn('px-1.5 py-0.5 rounded-full text-[9px]', DEPLOY_BADGE[v.deploymentStatus])}>
                                {v.deploymentStatus.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <button className="text-[#55556a] hover:text-[#a89bff] transition-colors" title="Download">
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button className="text-[#55556a] hover:text-yellow-400 transition-colors" title="Archive/Restore">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button className="text-[#55556a] hover:text-red-400 transition-colors" title="Delete">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 border-t border-[#1e1e2a]/50">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="text-[#44445a]">Artifacts:</span>
                      {model.versions.flatMap(v => v.artifacts).filter((a, i, arr) => arr.indexOf(a) === i).map(a => (
                        <span key={a} className="px-2 py-0.5 rounded bg-[#1e1e2a] text-[#55556a] font-mono">{a}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
