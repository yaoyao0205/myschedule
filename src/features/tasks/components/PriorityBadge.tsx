import { cn } from "../../../lib/cn"
import type { TaskPriority } from "../types"
import { PRIORITY_META } from "../utils"

interface PriorityBadgeProps {
  priority: TaskPriority
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const meta = PRIORITY_META[priority]

  return (
    <span className={cn("ff-mono inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em]", meta.classes)}>
      {meta.label}优先级
    </span>
  )
}
