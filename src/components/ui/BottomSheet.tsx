import { type ReactNode, useEffect } from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/cn"

interface BottomSheetProps {
  ariaLabel: string
  children: ReactNode
  className?: string
  onClose: () => void
}

export function BottomSheet({ ariaLabel, children, className, onClose }: BottomSheetProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <motion.div
      className="fixed inset-0 z-40 grid items-end px-3 pb-3 sm:items-center sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <button
        className="absolute inset-0 min-h-0 w-full bg-slate-950/30 backdrop-blur-sm"
        type="button"
        aria-label="关闭弹层"
        onClick={onClose}
      />
      <motion.div
        className={cn("ff-bottom-sheet-panel relative mx-auto w-full overflow-hidden", className)}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
