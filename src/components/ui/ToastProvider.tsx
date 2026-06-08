import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react"
import { cn } from "../../lib/cn"

type ToastTone = "info" | "success" | "warning" | "error"

interface Toast {
  id: string
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneStyles: Record<ToastTone, string> = {
  info: "border-[var(--ff-border)] bg-[var(--ff-surface)] text-[var(--ff-ink-700)] dark:text-[var(--ff-text)]",
  success: "border-[var(--ff-teal)]/30 bg-[var(--ff-teal-soft)] text-[var(--ff-teal-text)]",
  warning: "border-[var(--ff-warning)]/30 bg-[var(--ff-warning-soft)] text-[var(--ff-warning)]",
  error: "border-[var(--ff-danger)]/30 bg-[var(--ff-danger-soft)] text-[var(--ff-danger)]",
}

const toneIcons: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
}

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId))
  }, [])

  const notify = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const toast: Toast = { id: createToastId(), message, tone }
      setToasts((current) => [toast, ...current].slice(0, 3))
      window.setTimeout(() => dismiss(toast.id), 3200)
    },
    [dismiss]
  )

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        aria-live="polite"
        aria-atomic="true"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const Icon = toneIcons[toast.tone]
            return (
              <motion.div
                className={cn(
                  "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl",
                  toneStyles[toast.tone]
                )}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                key={toast.id}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <p className="min-w-0 flex-1">{toast.message}</p>
                <button
                  className="ff-icon-button -mr-2 -mt-2 h-9 w-9"
                  type="button"
                  aria-label="关闭提示"
                  onClick={() => dismiss(toast.id)}
                >
                  <X className="h-4 w-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }

  return context
}
