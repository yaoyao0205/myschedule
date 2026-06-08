import { NavLink } from "react-router-dom"
import { cn } from "../../lib/cn"
import { navItems } from "./navItems"

export function BottomTabBar() {
  return (
    <nav className="fixed inset-x-2 bottom-2 z-30 rounded-[20px] border border-[var(--ff-border)] bg-[var(--ff-surface-raised)] px-1.5 py-1.5 shadow-[0_18px_54px_rgba(17,19,26,0.16)] backdrop-blur-2xl sm:hidden">
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map((item) => (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-semibold leading-none transition",
                  isActive
                    ? "border border-[var(--ff-border)] bg-[var(--ff-nav-active-bg)] text-[var(--ff-nav-active-text)] shadow-[0_8px_18px_rgba(17,19,26,0.08)]"
                    : "text-[var(--ff-ink-500)] hover:bg-[var(--ff-nav-hover-bg)] active:bg-[var(--ff-nav-hover-bg)]"
                )
              }
              key={item.path}
              to={item.path}
            >
              <span className="text-base leading-none">{item.emoji}</span>
              {item.label}
            </NavLink>
          ))}
      </div>
    </nav>
  )
}
