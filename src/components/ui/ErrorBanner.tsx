import { AlertCircle } from "lucide-react"

interface ErrorBannerProps {
  message: string
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div
      className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-[var(--ff-danger-soft)] px-3 py-3 text-sm font-medium text-rose-800 dark:border-rose-500/30 dark:text-rose-100"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  )
}
