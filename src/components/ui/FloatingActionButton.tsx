import { Plus } from "lucide-react"

interface FloatingActionButtonProps {
  onClick: () => void
}

export function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <button
      className="ff-fab fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-[var(--ff-brand)] text-[var(--ff-paper)] transition hover:bg-[var(--ff-brand-hover)] active:scale-95 sm:hidden"
      type="button"
      aria-label="新建任务"
      onClick={onClick}
    >
      <Plus className="h-6 w-6" />
    </button>
  )
}
