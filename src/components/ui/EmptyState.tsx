import type { ReactNode } from "react"
import { TheoMascot, type TheoPose } from "../brand/TheoMascot"

interface EmptyStateProps {
  actionLabel?: string
  children?: ReactNode
  description: string
  onAction?: () => void
  pose?: TheoPose
  title: string
}

export function EmptyState({ actionLabel, children, description, onAction, pose = "idle", title }: EmptyStateProps) {
  return (
    <div className="grid place-items-center px-4 py-8 text-center sm:py-10">
      <TheoMascot className="mb-2 opacity-80" pose={pose} size={48} />
      <h3 className="text-sm font-semibold text-[var(--ff-text)]">{title}</h3>
      <p className="mt-1 max-w-sm text-xs leading-5 text-[var(--ff-muted)]">{description}</p>
      {children}
      {actionLabel && onAction ? (
        <button className="ff-button-secondary mt-3 px-4 py-2 text-sm sm:hidden" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
