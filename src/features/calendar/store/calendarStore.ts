import { format, startOfToday } from "date-fns"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { CalendarEventType } from "../../tasks/types"

export type CalendarMode = "month" | "week" | "day"
export type CalendarSourceType = CalendarEventType | "countdown"

interface CalendarState {
  mode: CalendarMode
  cursorDate: string
  selectedDate: string
  showLunar: boolean
  activeEventTypes: CalendarSourceType[]
  setMode: (mode: CalendarMode) => void
  setCursorDate: (date: string) => void
  setSelectedDate: (date: string) => void
  setShowLunar: (showLunar: boolean) => void
  showEventType: (eventType: CalendarSourceType) => void
  toggleEventType: (eventType: CalendarSourceType) => void
  resetToToday: () => void
}

function todayKey() {
  return format(startOfToday(), "yyyy-MM-dd")
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      mode: "month",
      cursorDate: todayKey(),
      selectedDate: todayKey(),
      showLunar: true,
      activeEventTypes: ["task", "reminder", "pomodoro", "countdown"],
      setMode: (mode) => set({ mode }),
      setCursorDate: (cursorDate) => set({ cursorDate }),
      setSelectedDate: (selectedDate) => set({ selectedDate }),
      setShowLunar: (showLunar) => set({ showLunar }),
      showEventType: (eventType) =>
        set((state) => ({
          activeEventTypes: state.activeEventTypes.includes(eventType)
            ? state.activeEventTypes
            : [...state.activeEventTypes, eventType],
        })),
      toggleEventType: (eventType) =>
        set((state) => {
          const enabled = state.activeEventTypes.includes(eventType)
          const next = enabled
            ? state.activeEventTypes.filter((item) => item !== eventType)
            : [...state.activeEventTypes, eventType]

          return { activeEventTypes: next.length ? next : state.activeEventTypes }
        }),
      resetToToday: () => {
        const today = todayKey()
        set({ cursorDate: today, selectedDate: today })
      },
    }),
    {
      name: "focusflow.calendar.v1",
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      partialize: (state) => ({
        mode: state.mode,
        cursorDate: state.cursorDate,
        selectedDate: state.selectedDate,
        showLunar: state.showLunar,
        activeEventTypes: state.activeEventTypes,
      }),
    }
  )
)
