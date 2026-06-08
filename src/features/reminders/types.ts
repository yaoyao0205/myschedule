export type ReminderCustomUnit = "day" | "week" | "month"
export type ReminderRepeat = "none" | "daily" | "workdays" | "weekly" | "monthly" | "custom"
export type ReminderSound = "bell" | "wood" | "silent"

export interface ReminderSettings {
  sound: ReminderSound
  vibration: boolean
  volume: number
}

export interface Reminder {
  completed: boolean
  createdAt: string
  customEndCount: number
  customEndDate: string
  customInterval: number
  customUnit: ReminderCustomUnit
  enabled: boolean
  id: string
  lastTriggeredAt: string | null
  monthDay: number
  note: string
  repeat: ReminderRepeat
  scheduledAt: string
  snoozedAt: string | null
  taskTitle: string
  title: string
  triggerCount: number
  weekDay: number
}

export interface ReminderDraft {
  customEndCount: number
  customEndDate: string
  customInterval: number
  customUnit: ReminderCustomUnit
  date: string
  monthDay: number
  note: string
  repeat: ReminderRepeat
  taskTitle: string
  time: string
  title: string
  weekDay: number
}
