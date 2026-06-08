import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createId } from "../../../lib/ids"
import { useTrashStore } from "../../trash/store/trashStore"
import type { CountdownDraft, CountdownEvent, CountdownSortMode } from "../types"
import { DEFAULT_COUNTDOWN_COLOR, getDaysInfo, todayInputValue } from "../utils"

interface CountdownState {
  events: CountdownEvent[]
  selectedEventId: string | null
  sortMode: CountdownSortMode
  addEvent: (draft: CountdownDraft) => string
  deleteEvent: (eventId: string) => void
  restoreEvent: (event: CountdownEvent) => void
  migrateAnnualEvents: () => void
  selectEvent: (eventId: string | null) => void
  setSortMode: (sortMode: CountdownSortMode) => void
  togglePinned: (eventId: string) => void
  updateEvent: (eventId: string, draft: CountdownDraft) => void
}

const now = new Date().toISOString()

const initialEvents: CountdownEvent[] = [
  {
    id: "countdown-launch",
    title: "产品发布",
    targetDate: todayInputValue(),
    type: "countdown",
    category: "work",
    color: DEFAULT_COUNTDOWN_COLOR,
    pinned: true,
    note: "今天就是那个要被记住的日子。",
    reminder: { enabled: true, daysBefore: 0 },
    linkedTaskIds: ["task-focus-setup"],
    createdAt: now,
    updatedAt: now,
  },
]

function buildEventFromDraft(draft: CountdownDraft): CountdownEvent {
  const timestamp = new Date().toISOString()

  return {
    id: createId("countdown"),
    title: draft.title.trim().slice(0, 20),
    targetDate: draft.targetDate,
    type: draft.type,
    category: draft.category,
    color: draft.color || DEFAULT_COUNTDOWN_COLOR,
    pinned: false,
    note: draft.note.trim().slice(0, 100),
    reminder: {
      enabled: draft.reminderEnabled,
      daysBefore: Math.max(0, Math.floor(draft.reminderDaysBefore)),
    },
    linkedTaskIds: draft.linkedTaskIds,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function updateEventFromDraft(event: CountdownEvent, draft: CountdownDraft): CountdownEvent {
  return {
    ...event,
    title: draft.title.trim().slice(0, 20),
    targetDate: draft.targetDate,
    type: draft.type,
    category: draft.category,
    color: draft.color || DEFAULT_COUNTDOWN_COLOR,
    note: draft.note.trim().slice(0, 100),
    reminder: {
      enabled: draft.reminderEnabled,
      daysBefore: Math.max(0, Math.floor(draft.reminderDaysBefore)),
    },
    linkedTaskIds: draft.linkedTaskIds,
    updatedAt: new Date().toISOString(),
  }
}

function normalizeEvent(event: CountdownEvent): CountdownEvent {
  const timestamp = new Date().toISOString()

  return {
    id: event.id || createId("countdown"),
    title: event.title?.trim().slice(0, 20) || "未命名日子",
    targetDate: event.targetDate || todayInputValue(),
    type: event.type || "countdown",
    category: event.category || "other",
    color: event.color || DEFAULT_COUNTDOWN_COLOR,
    pinned: Boolean(event.pinned),
    note: event.note ?? "",
    reminder: event.reminder
      ? {
          enabled: Boolean(event.reminder.enabled),
          daysBefore: Math.max(0, Math.floor(event.reminder.daysBefore ?? 0)),
        }
      : { enabled: false, daysBefore: 0 },
    linkedTaskIds: Array.isArray(event.linkedTaskIds) ? event.linkedTaskIds : [],
    createdAt: event.createdAt ?? timestamp,
    updatedAt: event.updatedAt ?? timestamp,
  }
}

function migrateAnnualEvent(event: CountdownEvent): CountdownEvent {
  if (event.type !== "annual") return event
  const info = getDaysInfo(event)

  return info.effectiveTargetDate === event.targetDate
    ? event
    : { ...event, targetDate: info.effectiveTargetDate, updatedAt: new Date().toISOString() }
}

export function createEmptyCountdownDraft(): CountdownDraft {
  return {
    category: "life",
    color: DEFAULT_COUNTDOWN_COLOR,
    linkedTaskIds: [],
    note: "",
    reminderDaysBefore: 1,
    reminderEnabled: false,
    targetDate: todayInputValue(),
    title: "",
    type: "countdown",
  }
}

export function countdownToDraft(event: CountdownEvent): CountdownDraft {
  return {
    category: event.category,
    color: event.color,
    linkedTaskIds: event.linkedTaskIds ?? [],
    note: event.note ?? "",
    reminderDaysBefore: event.reminder?.daysBefore ?? 0,
    reminderEnabled: event.reminder?.enabled ?? false,
    targetDate: event.targetDate,
    title: event.title,
    type: event.type,
  }
}

export const useCountdownStore = create<CountdownState>()(
  persist(
    (set, get) => ({
      events: initialEvents,
      selectedEventId: initialEvents[0]?.id ?? null,
      sortMode: "days",
      addEvent: (draft) => {
        const event = buildEventFromDraft(draft)
        set((state) => ({
          events: [event, ...state.events],
          selectedEventId: event.id,
        }))
        return event.id
      },
      deleteEvent: (eventId) =>
        set((state) => {
          const event = state.events.find((item) => item.id === eventId)
          if (event) {
            useTrashStore.getState().addTrashItem({
              data: event,
              itemId: event.id,
              title: event.title,
              type: "countdown",
            })
          }
          const nextEvents = state.events.filter((event) => event.id !== eventId)
          return {
            events: nextEvents,
            selectedEventId: state.selectedEventId === eventId ? nextEvents[0]?.id ?? null : state.selectedEventId,
          }
        }),
      restoreEvent: (event) =>
        set((state) => ({
          events: state.events.some((item) => item.id === event.id) ? state.events : [event, ...state.events],
          selectedEventId: event.id,
        })),
      migrateAnnualEvents: () =>
        set((state) => ({
          events: state.events.map(migrateAnnualEvent),
        })),
      selectEvent: (selectedEventId) => set({ selectedEventId }),
      setSortMode: (sortMode) => set({ sortMode }),
      togglePinned: (eventId) =>
        set((state) => ({
          events: state.events.map((event) =>
            event.id === eventId ? { ...event, pinned: !event.pinned, updatedAt: new Date().toISOString() } : event
          ),
        })),
      updateEvent: (eventId, draft) =>
        set((state) => ({
          events: state.events.map((event) => (event.id === eventId ? updateEventFromDraft(event, draft) : event)),
        })),
    }),
    {
      name: "focusflow.countdown.v1",
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<CountdownState> | undefined
        const events = Array.isArray(persistedState?.events) ? persistedState.events.map(normalizeEvent) : current.events
        const selectedEventId = events.some((event) => event.id === persistedState?.selectedEventId)
          ? persistedState?.selectedEventId ?? null
          : events[0]?.id ?? null

        return {
          ...current,
          ...persistedState,
          events,
          selectedEventId,
          sortMode: persistedState?.sortMode ?? "days",
        }
      },
      partialize: (state) => ({
        events: state.events,
        selectedEventId: state.selectedEventId,
        sortMode: state.sortMode,
      }),
    }
  )
)
