import { NavLink } from "react-router-dom"
import { Bell } from "lucide-react"
import { cn } from "../../lib/cn"

const utilityItems = [
  { label: "提醒", path: "/reminders", icon: Bell, hasDot: true },
]

export function UtilityActions() {
  return (
    <div className="flex items-center gap-2">
      {utilityItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            className={({ isActive }) =>
              cn(
                "relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-2xl border border-[var(--ff-border)] px-3 text-sm font-semibold transition backdrop-blur-xl",
                isActive
                  ? "bg-[var(--ff-nav-active-bg)] text-[var(--ff-nav-active-text)] shadow-[0_10px_24px_rgba(17,19,26,0.08)]"
                  : "bg-[var(--ff-secondary-bg)] text-[var(--ff-ink-500)] hover:bg-[var(--ff-nav-hover-bg)] hover:text-[var(--ff-text)] active:bg-[var(--ff-nav-hover-bg)]"
              )
            }
            aria-label={item.label}
            key={item.path}
            to={item.path}
          >
            <Icon className="h-5 w-5" />
            <span className="hidden lg:inline">{item.label}</span>
            {item.hasDot ? (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--ff-accent-3)] shadow-[0_0_0_3px_rgba(255,111,92,0.16)]" aria-hidden="true" />
            ) : null}
          </NavLink>
        )
      })}
    </div>
  )
}
