import { useState } from 'react'
import { BookOpen, Plus, Edit2, Trash2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { mockKnowledgeRules } from '@/services/mockData'
import type { KnowledgeRule, KnowledgeRuleTarget, KnowledgeRuleType } from '@/types'

const TARGET_COLORS: Record<KnowledgeRuleTarget, string> = {
  TrackingCode: 'text-[#a89bff] bg-[#7c6af720]',
  Barcode:      'text-[#60a5fa] bg-[#3b82f620]',
  Packaging:    'text-[#f97316] bg-[#f9731620]',
  Product:      'text-[#34d399] bg-[#10b98120]',
}

const TYPE_COLORS: Record<KnowledgeRuleType, string> = {
  regex:          'text-[#e879f9] bg-[#a21caf20]',
  min_confidence: 'text-[#fbbf24] bg-[#f59e0b20]',
  must_contain:   'text-[#60a5fa] bg-[#3b82f620]',
  aspect_ratio:   'text-[#4ade80] bg-[#16a34a20]',
}

function RuleCard({ rule, onToggle, onEdit, onDelete }: {
  rule: KnowledgeRule
  onToggle: (id: string) => void
  onEdit: (rule: KnowledgeRule) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className={cn('bg-[#12121c] border rounded-xl p-5 transition-colors', rule.active ? 'border-[#1e1e2a]' : 'border-[#1e1e2a] opacity-60')}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-[#f0f0f5]">{rule.name}</h3>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', TARGET_COLORS[rule.target])}>{rule.target}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium capitalize', TYPE_COLORS[rule.type])}>{rule.type.replace('_', ' ')}</span>
          </div>
          <p className="text-xs text-[#8888a8]">{rule.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Toggle */}
          <button
            onClick={() => onToggle(rule.id)}
            className={cn('relative w-10 h-5 rounded-full transition-colors flex-shrink-0', rule.active ? 'bg-[#7c6af7]' : 'bg-[#1e1e2a]')}
          >
            <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', rule.active ? 'translate-x-5' : 'translate-x-0.5')} />
          </button>
          <button onClick={() => onEdit(rule)} className="p-1.5 rounded text-[#55556a] hover:text-[#60a5fa] hover:bg-[#3b82f620] transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(rule.id)} className="p-1.5 rounded text-[#55556a] hover:text-[#f87171] hover:bg-[#dc262620] transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="font-mono text-xs bg-[#0d0d14] rounded-lg px-3 py-2 text-[#a89bff] border border-[#1e1e2a]">
        {rule.value}
      </div>
    </div>
  )
}

const EMPTY_RULE: Omit<KnowledgeRule, 'id'> = {
  name: '',
  target: 'TrackingCode',
  type: 'regex',
  value: '',
  description: '',
  active: true,
}

export function KnowledgeRules() {
  const [rules, setRules] = useState<KnowledgeRule[]>(mockKnowledgeRules)
  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState<KnowledgeRule | null>(null)
  const [form, setForm] = useState<Omit<KnowledgeRule, 'id'>>(EMPTY_RULE)

  const openAdd = () => {
    setEditingRule(null)
    setForm(EMPTY_RULE)
    setShowModal(true)
  }
  const openEdit = (rule: KnowledgeRule) => {
    setEditingRule(rule)
    setForm({ name: rule.name, target: rule.target, type: rule.type, value: rule.value, description: rule.description, active: rule.active })
    setShowModal(true)
  }
  const saveRule = () => {
    if (editingRule) {
      setRules(rs => rs.map(r => r.id === editingRule.id ? { ...r, ...form } : r))
    } else {
      setRules(rs => [...rs, { id: `kr${Date.now()}`, ...form }])
    }
    setShowModal(false)
  }
  const toggleRule = (id: string) => setRules(rs => rs.map(r => r.id === id ? { ...r, active: !r.active } : r))
  const deleteRule = (id: string) => setRules(rs => rs.filter(r => r.id !== id))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7c6af720] flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#a89bff]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#f0f0f5]">Knowledge Rules</h1>
            <p className="text-xs text-[#55556a]">{rules.filter(r => r.active).length} active rules · {rules.length} total</p>
          </div>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7c6af7] text-white text-sm font-medium hover:bg-[#6b5ce7] transition-colors">
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen className="w-10 h-10 text-[#2e2e3a] mb-3" />
          <p className="text-[#55556a]">No rules defined yet.</p>
          <button onClick={openAdd} className="mt-3 text-sm text-[#a89bff] hover:underline">Add your first rule</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map(rule => (
            <RuleCard key={rule.id} rule={rule} onToggle={toggleRule} onEdit={openEdit} onDelete={deleteRule} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#12121c] border border-[#1e1e2a] rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-[#f0f0f5] mb-4">{editingRule ? 'Edit Rule' : 'Add Rule'}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#55556a] block mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-[#0d0d14] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]"
                  placeholder="Rule name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#55556a] block mb-1">Target</label>
                  <select value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value as KnowledgeRuleTarget }))}
                    className="w-full bg-[#0d0d14] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]">
                    <option value="TrackingCode">TrackingCode</option>
                    <option value="Barcode">Barcode</option>
                    <option value="Packaging">Packaging</option>
                    <option value="Product">Product</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#55556a] block mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as KnowledgeRuleType }))}
                    className="w-full bg-[#0d0d14] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7]">
                    <option value="regex">regex</option>
                    <option value="min_confidence">min_confidence</option>
                    <option value="must_contain">must_contain</option>
                    <option value="aspect_ratio">aspect_ratio</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-[#55556a] block mb-1">Value</label>
                <input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  className="w-full bg-[#0d0d14] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] font-mono focus:outline-none focus:border-[#7c6af7]"
                  placeholder="e.g. ^SPX\d{12}$ or 80" />
              </div>
              <div>
                <label className="text-xs text-[#55556a] block mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-[#0d0d14] border border-[#1e1e2a] rounded-lg px-3 py-2 text-sm text-[#f0f0f5] focus:outline-none focus:border-[#7c6af7] resize-none"
                  placeholder="Describe what this rule does" />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-[#55556a]">Active</label>
                <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={cn('relative w-10 h-5 rounded-full transition-colors', form.active ? 'bg-[#7c6af7]' : 'bg-[#1e1e2a]')}>
                  <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform', form.active ? 'translate-x-5' : 'translate-x-0.5')} />
                </button>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2 rounded-lg border border-[#1e1e2a] text-[#8888a8] text-sm hover:border-[#7c6af7] transition-colors">Cancel</button>
              <button onClick={saveRule} disabled={!form.name || !form.value}
                className="flex-1 py-2 rounded-lg bg-[#7c6af7] text-white text-sm font-medium hover:bg-[#6b5ce7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {editingRule ? 'Save Changes' : 'Add Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
