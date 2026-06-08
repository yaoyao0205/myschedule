import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { BottomTabBar } from "../navigation/BottomTabBar"
import { SideNav } from "../navigation/SideNav"
import { UtilityActions } from "../navigation/UtilityActions"
import { CommandPalette } from "../command/CommandPalette"
import { OfflineBanner } from "../ui/OfflineBanner"
import { cn } from "../../lib/cn"
import { useProfileStore, type AppearanceMode } from "../../features/profile/store/profileStore"
import { PageErrorBoundary } from "./PageErrorBoundary"
import { TopBarSlotContext, type TopBarSlotContent } from "./topBarSlot"

const pageMeta: Record<string, { emoji: string; name: string }> = {
  "/tasks": { emoji: "✅", name: "任务清单" },
  "/notes": { emoji: "✨", name: "笔记" },
  "/calendar": { emoji: "🗓️", name: "日历" },
  "/countdown": { emoji: "🎉", name: "倒数记日" },
  "/reminders": { emoji: "🔔", name: "提醒" },
  "/pomodoro": { emoji: "🍅", name: "番茄钟" },
  "/profile": { emoji: "🌿", name: "个人中心" },
}

function isTopBarSlotContent(value: ReactNode | TopBarSlotContent): value is TopBarSlotContent {
  return Boolean(
    value &&
      typeof value === "object" &&
      ("desktop" in value || "mobileAction" in value || "mobilePanel" in value)
  )
}

function resolveTheme(appearance: AppearanceMode): Exclude<AppearanceMode, "system"> {
  if (appearance !== "system") return appearance
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function AppShell() {
  const location = useLocation()
  const page = pageMeta[location.pathname] ?? pageMeta["/tasks"]
  const appearance = useProfileStore((state) => state.settings.appearance)
  const [sideNavCollapsed, setSideNavCollapsed] = useState(() => window.localStorage.getItem("focusflow.sideNavCollapsed") === "true")
  const [topBarSlot, setTopBarSlot] = useState<ReactNode | TopBarSlotContent>(null)
  const topBarSlotContext = useMemo(() => ({ setTopBarSlot }), [])
  const normalizedTopBarSlot: TopBarSlotContent = isTopBarSlotContent(topBarSlot)
    ? topBarSlot
    : { desktop: topBarSlot, mobilePanel: topBarSlot }

  useEffect(() => {
    function applyTheme() {
      const theme = resolveTheme(appearance)
      document.documentElement.dataset.theme = theme
      document.documentElement.classList.toggle("dark", theme === "dark" || theme === "synthwave")
    }

    applyTheme()
    if (appearance !== "system") return

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", applyTheme)
    return () => media.removeEventListener("change", applyTheme)
  }, [appearance])

  useEffect(() => {
    window.localStorage.setItem("focusflow.sideNavCollapsed", String(sideNavCollapsed))
  }, [sideNavCollapsed])

  return (
    <TopBarSlotContext.Provider value={topBarSlotContext}>
      <div className="ff-app-bg relative h-screen overflow-hidden">
        <OfflineBanner />
        <div className="pointer-events-none absolute left-[22rem] top-[-9rem] h-72 w-72 rounded-full bg-[var(--ff-accent)]/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-10rem] right-[-4rem] h-96 w-96 rounded-full bg-black/10 blur-3xl" />

        <div className={cn("relative h-full min-h-0 p-0 sm:grid sm:gap-3 sm:p-3", sideNavCollapsed ? "sm:grid-cols-[96px_minmax(0,1fr)]" : "sm:grid-cols-[96px_minmax(0,1fr)] lg:grid-cols-[292px_minmax(0,1fr)]")}>
          <SideNav collapsed={sideNavCollapsed} onToggleCollapsed={() => setSideNavCollapsed((collapsed) => !collapsed)} />
          <main className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden pb-[76px] sm:rounded-[32px] sm:border sm:border-[var(--ff-border)] sm:bg-[var(--ff-main-bg)] sm:pb-0 sm:shadow-[var(--ff-shell-shadow)] sm:backdrop-blur-2xl">
            <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ff-border)] bg-[var(--ff-header-bg)] px-3 py-2 backdrop-blur-2xl sm:hidden">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-brand)] text-[var(--ff-paper)] shadow-[0_12px_28px_rgba(17,19,26,0.2)]">
                  <span className="text-base leading-none">{page.emoji}</span>
                </div>
                <div className="min-w-0">
                  <p className="ff-mono truncate text-[9px] uppercase text-[var(--ff-muted)]">yaoyaoflow</p>
                  <h1 className="ff-display truncate text-[15px] text-[var(--ff-text)]">{page.name}</h1>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-2">
                {normalizedTopBarSlot.mobileAction}
                <UtilityActions />
              </div>
              {normalizedTopBarSlot.mobilePanel ? <div className="basis-full">{normalizedTopBarSlot.mobilePanel}</div> : null}
            </header>

            <header className="sticky top-0 z-20 hidden items-center justify-between gap-4 border-b border-[var(--ff-border)] bg-[var(--ff-header-bg)] px-6 py-4 backdrop-blur-2xl sm:flex lg:px-8">
              <div>
                <p className="ff-mono text-[10px] uppercase tracking-[0.26em] text-[var(--ff-muted)]">flow index</p>
                <h1 className="ff-display flex items-center gap-2 text-xl text-[var(--ff-text)]">
                  <span className="text-[1.05em] leading-none">{page.emoji}</span>
                  <span>{page.name}</span>
                </h1>
              </div>
              <div className="flex flex-1 items-center justify-end gap-3">
                {normalizedTopBarSlot.desktop ? <div className="w-full max-w-3xl">{normalizedTopBarSlot.desktop}</div> : null}
                <UtilityActions />
              </div>
            </header>

            <div className="min-h-0 overflow-hidden px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
              <PageErrorBoundary resetKey={location.pathname}>
                <Outlet />
              </PageErrorBoundary>
            </div>
          </main>
        </div>
        <BottomTabBar />
        <CommandPalette />
      </div>
    </TopBarSlotContext.Provider>
  )
}
