import { useQuery } from '@tanstack/react-query'
import { BrainCircuit, Play, Rocket, Download, Zap, FileText, Info } from 'lucide-react'
import { api } from '@/services/api'
import { ModelStatusBadge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card'
import { formatDate } from '@/utils/formatters'
import type { AIModel } from '@/types'

export function AIModels() {
  const { data: models, isLoading } = useQuery({
    queryKey: ['ai-models'],
    queryFn: () => api.models.getAll(),
  })

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#f0f0f5]">AI Models</h1>
        <p className="text-sm text-[#8888a8] mt-0.5">Manage and deploy your AI detection models</p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-[12px] bg-[#7c6af720] border border-[#7c6af740]">
        <Info className="w-4 h-4 text-[#a89bff] flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-[#a89bff]">No trained models yet</p>
          <p className="text-xs text-[#8888a8] mt-0.5">
            Build your dataset first, then train your models. Minimum 1,000 images recommended per model.
          </p>
        </div>
      </div>

      {/* Model cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 skeleton rounded-[14px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {models?.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}

      {/* Architecture info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
        <Card>
          <CardHeader>
            <CardTitle>Training Requirements</CardTitle>
          </CardHeader>
          <div className="space-y-3 text-xs text-[#8888a8]">
            {[
              { label: 'Minimum images', value: '1,000 per class' },
              { label: 'Recommended split', value: '80% train / 20% validation' },
              { label: 'Supported formats', value: 'JPEG, PNG, WebP' },
              { label: 'GPU requirement', value: 'CUDA-compatible GPU' },
              { label: 'Estimated training time', value: '2–8 hours (varies)' },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-[#1e1e2a] last:border-0">
                <span className="text-[#55556a]">{label}</span>
                <span className="text-[#f0f0f5] font-medium">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Supported Tasks</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {[
              { icon: BrainCircuit, label: 'Object Detection', desc: 'Detect and localize objects in frames' },
              { icon: FileText, label: 'Text Recognition (OCR)', desc: 'Extract text from images' },
              { icon: Zap, label: 'Classification', desc: 'Categorize products and packaging' },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 p-3 rounded-[10px] bg-[#0a0a0f] border border-[#1e1e2a]">
                <div className="p-1.5 rounded-[7px] bg-[#7c6af720]">
                  <Icon className="w-3.5 h-3.5 text-[#a89bff]" />
                </div>
                <div>
                  <p className="text-xs font-medium text-[#f0f0f5]">{label}</p>
                  <p className="text-[10px] text-[#55556a] mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function ModelCard({ model }: { model: AIModel }) {
  const typeConfig: Record<AIModel['type'], { icon: typeof BrainCircuit; color: string; bg: string }> = {
    YOLO: { icon: Zap, color: 'text-[#fbbf24]', bg: 'bg-[#f59e0b20]' },
    OCR: { icon: FileText, color: 'text-[#60a5fa]', bg: 'bg-[#3b82f620]' },
    Custom: { icon: BrainCircuit, color: 'text-[#a89bff]', bg: 'bg-[#7c6af720]' },
  }

  const { icon: Icon, color, bg } = typeConfig[model.type]

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-[10px] ${bg}`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f0f0f5]">{model.name}</h3>
              <p className="text-xs text-[#8888a8] mt-0.5">{model.type} · {model.version}</p>
            </div>
          </div>
          <ModelStatusBadge status={model.status} />
        </div>

        <p className="text-xs text-[#8888a8] leading-relaxed">{model.description}</p>

        <div className="grid grid-cols-2 gap-3 p-3 rounded-[10px] bg-[#0a0a0f] border border-[#1e1e2a]">
          <div>
            <p className="text-[10px] text-[#55556a]">Status</p>
            <p className="text-xs text-[#f0f0f5] font-medium mt-0.5">{model.status}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#55556a]">Last Updated</p>
            <p className="text-xs text-[#f0f0f5] font-medium mt-0.5">{formatDate(model.lastUpdated)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#55556a]">Accuracy</p>
            <p className="text-xs text-[#55556a] font-medium mt-0.5">—</p>
          </div>
          <div>
            <p className="text-[10px] text-[#55556a]">Version</p>
            <p className="text-xs text-[#f0f0f5] font-medium mt-0.5">{model.version}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            disabled
            leftIcon={<Play className="w-3.5 h-3.5" />}
            className="flex-1"
          >
            Train
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled
            leftIcon={<Rocket className="w-3.5 h-3.5" />}
            className="flex-1"
          >
            Deploy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled
            leftIcon={<Download className="w-3.5 h-3.5" />}
          >
            Download
          </Button>
        </div>
      </div>
    </Card>
  )
}
