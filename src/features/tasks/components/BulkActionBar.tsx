import { CheckCircle2, MousePointer2, Trash2, X } from "lucide-react"

interface BulkActionBarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onComplete: () => void
  onDelete: () => void
  onClear: () => void
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onComplete,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <div className="ff-popover sticky top-3 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-[var(--ff-surface)]/95 p-3 backdrop-blur dark:border-indigo-500/30">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <MousePointer2 className="h-4 w-4 text-indigo-500" />
        已选择 {selectedCount} / {totalCount} 项
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={onSelectAll}>
          全选
        </button>
        <button className="ff-success-action inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium" type="button" onClick={onComplete}>
          <CheckCircle2 className="h-4 w-4" />
          批量完成
        </button>
        <button className="ff-danger-soft inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium" type="button" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
          删除
        </button>
        <button className="ff-icon-button h-11 w-11" type="button" aria-label="清除选择" onClick={onClear}>
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
