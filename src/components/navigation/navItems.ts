import { CalendarDays, CheckSquare2, FileText, Hourglass, Timer, UserCircle2 } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  emoji: string
  label: string
  path: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { emoji: "✅", label: "任务", path: "/tasks", icon: CheckSquare2 },
  { emoji: "✨", label: "笔记", path: "/notes", icon: FileText },
  { emoji: "🗓️", label: "日历", path: "/calendar", icon: CalendarDays },
  { emoji: "🎉", label: "日子", path: "/countdown", icon: Hourglass },
  { emoji: "🍅", label: "番茄", path: "/pomodoro", icon: Timer },
  { emoji: "🌿", label: "我的", path: "/profile", icon: UserCircle2 },
]
