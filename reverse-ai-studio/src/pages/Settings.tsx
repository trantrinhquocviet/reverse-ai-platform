import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Warehouse, Tag, User, Palette, Settings as SettingsIcon, Check } from 'lucide-react'
import {
  useWarehouses, useAddWarehouse, useDeleteWarehouse,
  useBrands, useAddBrand, useDeleteBrand,
  useUserProfile,
} from '@/hooks/useSettings'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/Card'
import { Button } from '@/components/Button'
import { Input } from '@/components/Input'
import { Modal } from '@/components/Modal'
import { formatDate } from '@/utils/formatters'

type TabId = 'app' | 'warehouses' | 'brands' | 'profile' | 'theme'

const tabs: { id: TabId; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'app', label: 'Application', icon: SettingsIcon },
  { id: 'warehouses', label: 'Warehouses', icon: Warehouse },
  { id: 'brands', label: 'Brands', icon: Tag },
  { id: 'profile', label: 'User Profile', icon: User },
  { id: 'theme', label: 'Theme', icon: Palette },
]

export function Settings() {
  const [activeTab, setActiveTab] = useState<TabId>('app')

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-[#f0f0f5]">Settings</h1>
        <p className="text-sm text-[#8888a8] mt-0.5">Manage your platform configuration</p>
      </div>

      <div className="flex gap-5">
        {/* Sidebar tabs */}
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-0.5">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-sm transition-colors ${
                  activeTab === id
                    ? 'bg-[#7c6af720] text-[#a89bff]'
                    : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#ffffff08]'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'app' && <AppSettings />}
          {activeTab === 'warehouses' && <WarehouseSettings />}
          {activeTab === 'brands' && <BrandSettings />}
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'theme' && <ThemeSettings />}
        </div>
      </div>
    </div>
  )
}

function AppSettings() {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Application Settings</CardTitle>
            <CardDescription>General platform configuration</CardDescription>
          </div>
        </CardHeader>
        <div className="space-y-4">
          <Input label="Platform Name" defaultValue="Reverse AI Studio" />
          <Input label="Organization" defaultValue="OnPoint Vietnam" />
          <Input label="API Endpoint" defaultValue="https://api.reverseai.local/v1" />
          <div className="flex items-center justify-between py-3 border-t border-[#1e1e2a]">
            <div>
              <p className="text-sm font-medium text-[#f0f0f5]">Auto-process on Upload</p>
              <p className="text-xs text-[#8888a8] mt-0.5">Automatically start AI analysis when a video is uploaded</p>
            </div>
            <div className="w-10 h-5 rounded-full bg-[#1a1a24] border border-[#2a2a38] flex items-center px-0.5 cursor-pointer">
              <div className="w-4 h-4 rounded-full bg-[#55556a]" />
            </div>
          </div>
          <div className="flex items-center justify-between py-3 border-t border-[#1e1e2a]">
            <div>
              <p className="text-sm font-medium text-[#f0f0f5]">Email Notifications</p>
              <p className="text-xs text-[#8888a8] mt-0.5">Receive email alerts for processing completion</p>
            </div>
            <div className="w-10 h-5 rounded-full bg-[#7c6af7] border border-[#7c6af7] flex items-center justify-end px-0.5 cursor-pointer">
              <div className="w-4 h-4 rounded-full bg-white" />
            </div>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-[#1e1e2a]">
          <Button variant="primary" onClick={handleSave} leftIcon={saved ? <Check className="w-4 h-4" /> : undefined}>
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </Card>
    </div>
  )
}

function WarehouseSettings() {
  const { data: warehouses, isLoading } = useWarehouses()
  const addMutation = useAddWarehouse()
  const deleteMutation = useDeleteWarehouse()
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; location: string }>()

  const onAdd = handleSubmit(async (data) => {
    await addMutation.mutateAsync(data)
    reset()
    setAddOpen(false)
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Warehouse List</CardTitle>
            <CardDescription>Manage warehouse locations for video tagging</CardDescription>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen(true)}>
            Add Warehouse
          </Button>
        </CardHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 skeleton rounded" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {warehouses?.map((wh) => (
              <div key={wh.id} className="flex items-center justify-between p-3 rounded-[10px] bg-[#0a0a0f] border border-[#1e1e2a]">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-[7px] bg-[#3b82f620]">
                    <Warehouse className="w-3.5 h-3.5 text-[#60a5fa]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#f0f0f5]">{wh.name}</p>
                    <p className="text-xs text-[#8888a8]">{wh.location} · Added {formatDate(wh.createdAt)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget(wh.id)}
                  className="p-1.5 rounded-[6px] text-[#55556a] hover:text-[#f87171] hover:bg-[#ef444415] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Warehouse" size="sm">
        <form onSubmit={onAdd} className="space-y-4">
          <Input
            label="Warehouse Name"
            placeholder="e.g. WH-Central"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message}
          />
          <Input
            label="Location"
            placeholder="e.g. Ho Chi Minh City"
            {...register('location')}
            error={errors.location?.message}
          />
          {addMutation.error && (
            <p className="text-xs text-[#f87171]">{(addMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={addMutation.isPending}>Add</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Warehouse" size="sm">
        <p className="text-sm text-[#8888a8] mb-5">This warehouse will be removed from all videos.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={async () => { if (deleteTarget) { await deleteMutation.mutateAsync(deleteTarget); setDeleteTarget(null) } }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function BrandSettings() {
  const { data: brands, isLoading } = useBrands()
  const addMutation = useAddBrand()
  const deleteMutation = useDeleteBrand()
  const [addOpen, setAddOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<{ name: string; code: string }>()

  const onAdd = handleSubmit(async (data) => {
    await addMutation.mutateAsync(data)
    reset()
    setAddOpen(false)
  })

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Brand List</CardTitle>
            <CardDescription>Manage brands for video categorization</CardDescription>
          </div>
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setAddOpen(true)}>
            Add Brand
          </Button>
        </CardHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 skeleton rounded" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {brands?.map((brand) => (
              <div key={brand.id} className="flex items-center justify-between p-3 rounded-[10px] bg-[#0a0a0f] border border-[#1e1e2a]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-[7px] bg-[#7c6af720] border border-[#7c6af740] flex items-center justify-center">
                    <span className="text-[10px] font-bold text-[#a89bff]">{brand.code}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#f0f0f5]">{brand.name}</p>
                    <p className="text-xs text-[#8888a8]">Code: {brand.code} · Added {formatDate(brand.createdAt)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget(brand.id)}
                  className="p-1.5 rounded-[6px] text-[#55556a] hover:text-[#f87171] hover:bg-[#ef444415] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Brand" size="sm">
        <form onSubmit={onAdd} className="space-y-4">
          <Input
            label="Brand Name"
            placeholder="e.g. Nike"
            {...register('name', { required: 'Name is required' })}
            error={errors.name?.message}
          />
          {addMutation.error && (
            <p className="text-xs text-[#f87171]">{(addMutation.error as Error).message}</p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" type="button" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" loading={addMutation.isPending}>Add</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Brand" size="sm">
        <p className="text-sm text-[#8888a8] mb-5">This brand will be removed from the platform.</p>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={async () => { if (deleteTarget) { await deleteMutation.mutateAsync(deleteTarget); setDeleteTarget(null) } }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function ProfileSettings() {
  const { data: user } = useUserProfile()
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>User Profile</CardTitle>
          <CardDescription>Manage your personal information</CardDescription>
        </div>
      </CardHeader>
      <div className="space-y-4">
        {/* Avatar */}
        <div className="flex items-center gap-4 p-4 rounded-[12px] bg-[#0a0a0f] border border-[#1e1e2a]">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#7c6af7] to-[#a855f7] flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-bold text-white">
              {user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2) ?? 'VT'}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#f0f0f5]">{user?.name}</p>
            <p className="text-xs text-[#8888a8]">{user?.role}</p>
            <button className="text-xs text-[#7c6af7] hover:text-[#9180ff] mt-1 transition-colors">Change avatar</button>
          </div>
        </div>

        <Input label="Full Name" defaultValue={user?.name ?? ''} />
        <Input label="Email Address" defaultValue={user?.email ?? ''} type="email" />
        <Input label="Role" defaultValue={user?.role ?? ''} disabled />
        <Input label="New Password" type="password" placeholder="Leave blank to keep current" />

        <div className="pt-2">
          <Button variant="primary" onClick={handleSave} leftIcon={saved ? <Check className="w-4 h-4" /> : undefined}>
            {saved ? 'Saved!' : 'Save Profile'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ThemeSettings() {
  const themes = [
    { id: 'dark-purple', label: 'Dark Purple', primary: '#7c6af7', bg: '#0a0a0f', active: true },
    { id: 'dark-blue', label: 'Dark Blue', primary: '#3b82f6', bg: '#0a0f1a', active: false },
    { id: 'dark-green', label: 'Dark Green', primary: '#22c55e', bg: '#0a1409', active: false },
    { id: 'dark-rose', label: 'Dark Rose', primary: '#f43f5e', bg: '#140a0d', active: false },
  ]

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Customize the appearance of the platform</CardDescription>
        </div>
      </CardHeader>
      <div className="space-y-4">
        <div>
          <p className="text-xs text-[#8888a8] mb-3">Color Theme</p>
          <div className="grid grid-cols-2 gap-3">
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`flex items-center gap-3 p-3 rounded-[10px] border transition-colors ${
                  theme.active
                    ? 'border-[#7c6af7] bg-[#7c6af710]'
                    : 'border-[#1e1e2a] hover:border-[#2a2a38] bg-[#0a0a0f]'
                }`}
              >
                <div className="w-8 h-8 rounded-[8px]" style={{ backgroundColor: theme.bg, border: `2px solid ${theme.primary}` }}>
                  <div className="w-full h-1/2 rounded-t-[6px]" style={{ backgroundColor: theme.primary }} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-medium text-[#f0f0f5]">{theme.label}</p>
                  {theme.active && <p className="text-[10px] text-[#a89bff]">Active</p>}
                </div>
                {theme.active && (
                  <div className="ml-auto">
                    <Check className="w-3.5 h-3.5 text-[#a89bff]" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-[#1e1e2a]">
          <p className="text-xs text-[#8888a8] mb-3">Display Mode</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#7c6af720] border border-[#7c6af740] cursor-pointer">
              <div className="w-4 h-4 rounded-full bg-[#0a0a0f] border-2 border-[#a89bff]" />
              <span className="text-xs font-medium text-[#a89bff]">Dark</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-[8px] bg-[#0a0a0f] border border-[#1e1e2a] cursor-pointer opacity-50">
              <div className="w-4 h-4 rounded-full bg-[#f0f0f5] border-2 border-[#55556a]" />
              <span className="text-xs font-medium text-[#8888a8]">Light (coming soon)</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
