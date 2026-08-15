import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Video, Database, BrainCircuit, Settings,
  ChevronLeft, ChevronRight, Zap, Tag, Brain, BarChart2,
} from 'lucide-react'
import { cn } from '@/utils/cn'

const coreItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/videos', icon: Video, label: 'Video Center' },
  { to: '/ai-metrics', icon: BarChart2, label: 'AI Metrics' },
  { to: '/annotation-queue', icon: Tag, label: 'Annotation Queue' },
  { to: '/dataset', icon: Database, label: 'Training Set' },
  { to: '/models', icon: BrainCircuit, label: 'AI Models' },
]

const trainingItems = [
  { to: '/mini-ai-trainer', icon: Brain, label: 'Mini AI Trainer' },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  const NavItem = ({ to, icon: Icon, label, exact = false }: { to: string; icon: typeof LayoutDashboard; label: string; exact?: boolean }) => {
    const isActive = exact ? location.pathname === to : (to === '/' ? location.pathname === '/' : location.pathname.startsWith(to))
    return (
      <NavLink
        to={to}
        className={cn(
          'flex items-center gap-3 px-2.5 py-2 rounded-[8px] transition-all duration-150',
          isActive ? 'bg-[#7c6af720] text-[#a89bff]' : 'text-[#8888a8] hover:text-[#f0f0f5] hover:bg-[#ffffff08]',
          collapsed && 'justify-center px-2'
        )}
        title={collapsed ? label : undefined}
      >
        <Icon className={cn('w-4 h-4 flex-shrink-0', isActive && 'text-[#a89bff]')} />
        {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{label}</span>}
        {isActive && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#7c6af7]" />}
      </NavLink>
    )
  }

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-[#0d0d14] border-r border-[#1e1e2a] transition-all duration-300 flex-shrink-0',
      collapsed ? 'w-[60px]' : 'w-[220px]'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-3 px-4 h-[60px] border-b border-[#1e1e2a]', collapsed && 'justify-center px-0')}>
        <div className="flex-shrink-0 w-7 h-7 rounded-[8px] bg-[#7c6af7] flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="text-sm font-bold text-[#f0f0f5] whitespace-nowrap">Reverse AI</span>
            <span className="block text-[10px] text-[#8888a8] whitespace-nowrap">Studio</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto space-y-0.5">
        {coreItems.map(item => <NavItem key={item.to} {...item} />)}

        {/* Training section */}
        {!collapsed && (
          <div className="pt-4 pb-1 px-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#44445a]">Training</span>
          </div>
        )}
        {collapsed && <div className="my-2 border-t border-[#1e1e2a]" />}
        {trainingItems.map(item => <NavItem key={item.to} {...item} />)}

        {/* Settings */}
        <div className="pt-4">
          <NavItem to="/settings" icon={Settings} label="Settings" exact />
        </div>
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-[#1e1e2a]">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-2.5 py-2 rounded-[8px] text-[#55556a] hover:text-[#f0f0f5] hover:bg-[#ffffff08] transition-colors',
            collapsed && 'justify-center'
          )}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : (
            <><ChevronLeft className="w-4 h-4" /><span className="text-xs">Collapse</span></>
          )}
        </button>
      </div>
    </aside>
  )
}
