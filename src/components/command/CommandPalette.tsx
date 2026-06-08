import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Search, X } from "lucide-react"
import { navItems } from "../navigation/navItems"
import { useNavigate } from "react-router-dom"

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable
}

export function CommandPalette() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-start bg-slate-950/30 px-3 pt-20 backdrop-blur-sm sm:place-items-center sm:p-5">
          <motion.div
            className="ff-popover w-full max-w-xl overflow-hidden rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)]"
            initial={{ opacity: 0, y: -14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 border-b border-[var(--ff-border)] px-4 py-3">
              <Search className="h-4 w-4 text-[var(--ff-ink-400)]" />
              <input
                autoFocus
                className="min-h-10 flex-1 bg-transparent text-sm text-[var(--ff-ink-900)] outline-none dark:text-[var(--ff-text)]"
                placeholder="跳转模块，后续可扩展为全局搜索"
              />
              <button className="ff-icon-button h-11 w-11" type="button" onClick={() => setOpen(false)} aria-label="关闭命令面板">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-2">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-[var(--ff-ink-500)] hover:bg-[var(--ff-surface-muted)] active:bg-[var(--ff-surface-muted)] dark:text-[var(--ff-muted)]"
                    key={item.path}
                    type="button"
                    onClick={() => {
                      navigate(item.path)
                      setOpen(false)
                    }}
                  >
                    <Icon className="h-4 w-4 text-[var(--ff-brand)]" />
                    打开{item.label}
                  </button>
                )
              })}
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
