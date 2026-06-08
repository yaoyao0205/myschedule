import { addDays, addMonths, addWeeks, format, parseISO, startOfToday } from "date-fns"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createId } from "../../../lib/ids"
import { useTrashStore } from "../../trash/store/trashStore"
import type { Reminder, ReminderCustomUnit, ReminderDraft, ReminderRepeat, ReminderSettings, ReminderSound } from "../types"

type LegacyReminder = Reminder & { customIntervalDays?: number }

interface ReminderState {
  reminders: Reminder[]
  selectedReminderIds: string[]
  settings: ReminderSettings
  addReminder: (draft: ReminderDraft) => void
  bulkDelete: () => void
  bulkDisable: () => void
  bulkEnable: () => void
  clearSelection: () => void
  completeReminder: (reminderId: string) => void
  deleteReminder: (reminderId: string) => void
  restoreReminder: (reminder: Reminder) => void
  selectAll: (reminderIds: string[]) => void
  setSetting: <Key extends keyof ReminderSettings>(key: Key, value: ReminderSettings[Key]) => void
  snoozeReminder: (reminderId: string, minutes: number) => void
  toggleEnabled: (reminderId: string) => void
  toggleSelectedReminder: (reminderId: string) => void
  triggerReminder: (reminderId: string) => Reminder | null
  updateReminder: (reminderId: string, draft: ReminderDraft) => void
}

const defaultSettings: ReminderSettings = {
  sound: "bell",
  vibration: true,
  volume: 0.55,
}

function todayKey(): string {
  return format(startOfToday(), "yyyy-MM-dd")
}

function defaultTime(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() + 30)
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
}

export function createEmptyReminderDraft(): ReminderDraft {
  const today = new Date()

  return {
    customEndCount: 0,
    customEndDate: "",
    customInterval: 2,
    customUnit: "day",
    date: todayKey(),
    monthDay: today.getDate(),
    note: "",
    repeat: "none",
    taskTitle: "",
    time: defaultTime(),
    title: "",
    weekDay: today.getDay(),
  }
}

export function reminderToDraft(reminder: Reminder): ReminderDraft {
  const scheduledAt = parseISO(reminder.scheduledAt)

  return {
    customEndCount: reminder.customEndCount,
    customEndDate: reminder.customEndDate,
    customInterval: reminder.customInterval,
    customUnit: reminder.customUnit,
    date: format(scheduledAt, "yyyy-MM-dd"),
    monthDay: reminder.monthDay,
    note: reminder.note,
    repeat: reminder.repeat,
    taskTitle: reminder.taskTitle,
    time: format(scheduledAt, "HH:mm"),
    title: reminder.title,
    weekDay: reminder.weekDay,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeRepeat(repeat?: ReminderRepeat): ReminderRepeat {
  if (repeat === "daily" || repeat === "workdays" || repeat === "weekly" || repeat === "monthly" || repeat === "custom") {
    return repeat
  }
  return "none"
}

function normalizeCustomUnit(unit?: ReminderCustomUnit): ReminderCustomUnit {
  if (unit === "week" || unit === "month") return unit
  return "day"
}

function normalizeSound(sound?: ReminderSound): ReminderSound {
  if (sound === "wood" || sound === "silent") return sound
  return "bell"
}

function buildScheduledAt(draft: ReminderDraft): string {
  return new Date(`${draft.date}T${draft.time || "09:00"}:00`).toISOString()
}

function buildReminderFromDraft(draft: ReminderDraft): Reminder {
  return {
    completed: false,
    createdAt: new Date().toISOString(),
    customEndCount: Math.floor(clamp(draft.customEndCount || 0, 0, 999)),
    customEndDate: draft.customEndDate,
    customInterval: Math.floor(clamp(draft.customInterval || 1, 1, 30)),
    customUnit: normalizeCustomUnit(draft.customUnit),
    enabled: true,
    id: createId("reminder"),
    lastTriggeredAt: null,
    monthDay: Math.floor(clamp(draft.monthDay || new Date().getDate(), 1, 31)),
    note: draft.note.trim(),
    repeat: normalizeRepeat(draft.repeat),
    scheduledAt: buildScheduledAt(draft),
    snoozedAt: null,
    taskTitle: draft.taskTitle.trim(),
    title: draft.title.trim(),
    triggerCount: 0,
    weekDay: Math.floor(clamp(draft.weekDay ?? new Date().getDay(), 0, 6)),
  }
}

function updateReminderFromDraft(reminder: Reminder, draft: ReminderDraft): Reminder {
  return {
    ...reminder,
    completed: false,
    customEndCount: Math.floor(clamp(draft.customEndCount || 0, 0, 999)),
    customEndDate: draft.customEndDate,
    customInterval: Math.floor(clamp(draft.customInterval || 1, 1, 30)),
    customUnit: normalizeCustomUnit(draft.customUnit),
    lastTriggeredAt: null,
    monthDay: Math.floor(clamp(draft.monthDay || new Date().getDate(), 1, 31)),
    note: draft.note.trim(),
    repeat: normalizeRepeat(draft.repeat),
    scheduledAt: buildScheduledAt(draft),
    snoozedAt: null,
    taskTitle: draft.taskTitle.trim(),
    title: draft.title.trim(),
    weekDay: Math.floor(clamp(draft.weekDay ?? new Date().getDay(), 0, 6)),
  }
}

function nextWorkday(date: Date): Date {
  let next = addDays(date, 1)
  while (next.getDay() === 0 || next.getDay() === 6) {
    next = addDays(next, 1)
  }
  return next
}

function getNextSchedule(reminder: Reminder): string | null {
  const scheduledAt = parseISO(reminder.scheduledAt)
  if (reminder.repeat === "daily") return addDays(scheduledAt, 1).toISOString()
  if (reminder.repeat === "weekly") return addWeeks(scheduledAt, 1).toISOString()
  if (reminder.repeat === "monthly") return addMonths(scheduledAt, 1).toISOString()
  if (reminder.repeat === "workdays") return nextWorkday(scheduledAt).toISOString()
  if (reminder.repeat === "custom") {
    if (reminder.customEndCount && reminder.triggerCount + 1 >= reminder.customEndCount) return null
    if (reminder.customEndDate && scheduledAt >= parseISO(`${reminder.customEndDate}T23:59:59`)) return null
    if (reminder.customUnit === "week") return addWeeks(scheduledAt, reminder.customInterval).toISOString()
    if (reminder.customUnit === "month") return addMonths(scheduledAt, reminder.customInterval).toISOString()
    return addDays(scheduledAt, reminder.customInterval).toISOString()
  }
  return null
}

function normalizeSettings(settings?: Partial<ReminderSettings>): ReminderSettings {
  return {
    sound: normalizeSound(settings?.sound),
    vibration: settings?.vibration ?? defaultSettings.vibration,
    volume: clamp(settings?.volume ?? defaultSettings.volume, 0, 1),
  }
}

function normalizeReminders(reminders?: Reminder[]): Reminder[] {
  if (!Array.isArray(reminders)) return []

  return reminders
    .filter((reminder) => reminder && reminder.title && reminder.scheduledAt)
    .map((reminder) => {
      const legacyReminder = reminder as LegacyReminder

      return {
        completed: reminder.completed ?? false,
        createdAt: reminder.createdAt ?? new Date().toISOString(),
        customEndCount: Math.floor(clamp(reminder.customEndCount ?? 0, 0, 999)),
        customEndDate: reminder.customEndDate ?? "",
        customInterval: Math.floor(clamp(reminder.customInterval ?? legacyReminder.customIntervalDays ?? 1, 1, 30)),
        customUnit: normalizeCustomUnit(reminder.customUnit),
        enabled: reminder.enabled ?? true,
        id: reminder.id ?? createId("reminder"),
        lastTriggeredAt: reminder.lastTriggeredAt ?? null,
        monthDay: Math.floor(clamp(reminder.monthDay ?? 1, 1, 31)),
        note: reminder.note ?? "",
        repeat: normalizeRepeat(reminder.repeat),
        scheduledAt: reminder.scheduledAt,
        snoozedAt: reminder.snoozedAt ?? null,
        taskTitle: reminder.taskTitle ?? "",
        title: reminder.title,
        triggerCount: reminder.triggerCount ?? 0,
        weekDay: Math.floor(clamp(reminder.weekDay ?? 1, 0, 6)),
      }
    })
}

export const useReminderStore = create<ReminderState>()(
  persist(
    (set, get) => ({
      reminders: [],
      selectedReminderIds: [],
      settings: defaultSettings,
      addReminder: (draft) =>
        set((state) => ({
          reminders: [buildReminderFromDraft(draft), ...state.reminders],
        })),
      bulkDelete: () =>
        set((state) => {
          state.reminders
            .filter((reminder) => state.selectedReminderIds.includes(reminder.id))
            .forEach((reminder) =>
              useTrashStore.getState().addTrashItem({
                data: reminder,
                itemId: reminder.id,
                title: reminder.title,
                type: "reminder",
              })
            )

          return {
            reminders: state.reminders.filter((reminder) => !state.selectedReminderIds.includes(reminder.id)),
            selectedReminderIds: [],
          }
        }),
      bulkDisable: () =>
        set((state) => ({
          reminders: state.reminders.map((reminder) =>
            state.selectedReminderIds.includes(reminder.id) ? { ...reminder, enabled: false } : reminder
          ),
          selectedReminderIds: [],
        })),
      bulkEnable: () =>
        set((state) => ({
          reminders: state.reminders.map((reminder) =>
            state.selectedReminderIds.includes(reminder.id) ? { ...reminder, enabled: true } : reminder
          ),
          selectedReminderIds: [],
        })),
      clearSelection: () => set({ selectedReminderIds: [] }),
      completeReminder: (reminderId) =>
        set((state) => ({
          reminders: state.reminders.map((reminder) =>
            reminder.id === reminderId ? { ...reminder, completed: true, enabled: false } : reminder
          ),
          selectedReminderIds: state.selectedReminderIds.filter((id) => id !== reminderId),
        })),
      deleteReminder: (reminderId) =>
        set((state) => {
          const reminder = state.reminders.find((item) => item.id === reminderId)
          if (reminder) {
            useTrashStore.getState().addTrashItem({
              data: reminder,
              itemId: reminder.id,
              title: reminder.title,
              type: "reminder",
            })
          }
          return {
            reminders: state.reminders.filter((reminder) => reminder.id !== reminderId),
            selectedReminderIds: state.selectedReminderIds.filter((id) => id !== reminderId),
          }
        }),
      selectAll: (reminderIds) => set({ selectedReminderIds: reminderIds }),
      setSetting: (key, value) =>
        set((state) => ({
          settings: normalizeSettings({ ...state.settings, [key]: value }),
        })),
      snoozeReminder: (reminderId, minutes) =>
        set((state) => ({
          reminders: state.reminders.map((reminder) =>
            reminder.id === reminderId
              ? {
                  ...reminder,
                  completed: false,
                  enabled: true,
                  lastTriggeredAt: null,
                  snoozedAt: new Date().toISOString(),
                  scheduledAt: new Date(Date.now() + minutes * 60_000).toISOString(),
                }
              : reminder
          ),
        })),
      toggleEnabled: (reminderId) =>
        set((state) => ({
          reminders: state.reminders.map((reminder) =>
            reminder.id === reminderId ? { ...reminder, completed: false, enabled: !reminder.enabled } : reminder
          ),
        })),
      toggleSelectedReminder: (reminderId) =>
        set((state) => {
          const selected = state.selectedReminderIds.includes(reminderId)
          return {
            selectedReminderIds: selected
              ? state.selectedReminderIds.filter((id) => id !== reminderId)
              : [...state.selectedReminderIds, reminderId],
          }
        }),
      triggerReminder: (reminderId) => {
        const reminder = get().reminders.find((item) => item.id === reminderId)
        if (!reminder || reminder.completed || !reminder.enabled) return null

        const nextSchedule = getNextSchedule(reminder)
        const triggeredAt = new Date().toISOString()
        set((state) => ({
          reminders: state.reminders.map((item) => {
            if (item.id !== reminderId) return item

            return nextSchedule
              ? {
                  ...item,
                  lastTriggeredAt: triggeredAt,
                  scheduledAt: nextSchedule,
                  snoozedAt: null,
                  triggerCount: item.triggerCount + 1,
                }
              : {
                  ...item,
                  completed: true,
                  enabled: false,
                  lastTriggeredAt: triggeredAt,
                  snoozedAt: null,
                  triggerCount: item.triggerCount + 1,
                }
          }),
        }))

        return reminder
      },
      updateReminder: (reminderId, draft) =>
        set((state) => ({
          reminders: state.reminders.map((reminder) =>
            reminder.id === reminderId ? updateReminderFromDraft(reminder, draft) : reminder
          ),
        })),
      restoreReminder: (reminder) =>
        set((state) => ({
          reminders: state.reminders.some((item) => item.id === reminder.id) ? state.reminders : [reminder, ...state.reminders],
        })),
    }),
    {
      name: "focusflow.reminders.v1",
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<ReminderState> | undefined

        return {
          ...current,
          ...persistedState,
          reminders: normalizeReminders(persistedState?.reminders as Reminder[] | undefined),
          selectedReminderIds: [],
          settings: normalizeSettings(persistedState?.settings),
        }
      },
      partialize: (state) => ({
        reminders: state.reminders,
        settings: state.settings,
      }),
    }
  )
)
