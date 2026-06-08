export type CountdownType = "countdown" | "countup" | "annual"
export type CountdownCategory = "work" | "life" | "memorial" | "health" | "other"
export type CountdownSortMode = "days" | "createdAt" | "title" | "color"

export interface CountdownReminder {
  enabled: boolean
  daysBefore: number
}

export interface CountdownEvent {
  id: string
  title: string
  targetDate: string
  type: CountdownType
  category: CountdownCategory
  color: string
  pinned: boolean
  note?: string
  reminder?: CountdownReminder
  linkedTaskIds?: string[]
  createdAt: string
  updatedAt: string
}

export interface CountdownDraft {
  category: CountdownCategory
  color: string
  linkedTaskIds: string[]
  note: string
  reminderDaysBefore: number
  reminderEnabled: boolean
  targetDate: string
  title: string
  type: CountdownType
}

export interface CountdownDaysInfo {
  days: number
  displayType: "today" | "countdown" | "countup"
  effectiveTargetDate: string
  isPast: boolean
  isToday: boolean
}
