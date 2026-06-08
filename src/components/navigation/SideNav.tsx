import { NavLink, useLocation } from "react-router-dom"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { cn } from "../../lib/cn"
import { TrashPanel } from "../../features/trash/components/TrashPanel"
import { navItems } from "./navItems"

interface SideNavProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}

export function SideNav({ collapsed, onToggleCollapsed }: SideNavProps) {
  const location = useLocation()
  const activeItem = navItems.find((item) => item.path === location.pathname) ?? navItems[0]

  return (
    <aside className={cn("hidden h-full flex-col p-3 sm:flex", collapsed ? "lg:w-[96px]" : "lg:w-72")}>
      <div className={cn("ff-glass-panel flex h-full flex-col rounded-[30px] p-3 transition-all", collapsed && "items-center")}>
        <div className={cn("flex w-full items-center", collapsed ? "justify-center" : "justify-between gap-2 px-2 pt-1")}>
          <div className={cn("hidden min-w-0 lg:block", collapsed && "lg:hidden")}>
            <p className="ff-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ff-muted)]">Now editing</p>
            <p className="mt-1 truncate text-sm font-semibold text-[var(--ff-text)]">{activeItem.label}</p>
          </div>
          <button
            className="ff-icon-button grid h-10 w-10 place-items-center rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-secondary-bg)]"
            type="button"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
            onClick={onToggleCollapsed}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        <nav className={cn("mt-5 w-full space-y-1.5", collapsed && "flex flex-col items-center")}>
          {navItems.map((item, index) => (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "group relative flex items-center justify-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition lg:justify-start",
                    collapsed && "lg:h-12 lg:w-12 lg:justify-center lg:px-0",
                    isActive
                      ? "border border-[var(--ff-border)] bg-[var(--ff-nav-active-bg)] text-[var(--ff-nav-active-text)] shadow-[0_10px_24px_rgba(17,19,26,0.08)] before:absolute before:left-0 before:top-1/2 before:h-7 before:w-1 before:-translate-y-1/2 before:rounded-full before:bg-[var(--ff-nav-active-border)]"
                      : "text-[var(--ff-ink-500)] hover:bg-[var(--ff-nav-hover-bg)] hover:text-[var(--ff-text)]"
                  )
                }
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
              >
                <span className={cn("ff-mono hidden w-5 text-[10px] text-current/42 lg:inline", collapsed && "lg:hidden")}>{String(index + 1).padStart(2, "0")}</span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-[var(--ff-nav-icon-bg)] text-base leading-none shadow-[0_1px_0_rgba(255,255,255,0.7)_inset] group-[.active]:bg-white/16">
                  {item.emoji}
                </span>
                <span className={cn("hidden lg:inline", collapsed && "lg:hidden")}>{item.label}</span>
              </NavLink>
            ))}
        </nav>

        <div className={cn("mt-auto w-full border-t border-[var(--ff-border)] pt-3", collapsed && "flex justify-center")}>
          <TrashPanel collapsed={collapsed} />
        </div>
      </div>
    </aside>
  )
}
