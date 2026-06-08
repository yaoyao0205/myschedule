import { EmptyState } from "../../../components/ui/EmptyState"

interface EmptyTaskStateProps {
  actionLabel?: string
  title: string
  description: string
  onAction?: () => void
}

export function EmptyTaskState({ actionLabel, description, onAction, title }: EmptyTaskStateProps) {
  return <EmptyState actionLabel={actionLabel} description={description} onAction={onAction} pose="idle" title={title} />
}
