import {
  addDays,
  addMonths,
  addYears,
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  parseISO,
  setYear,
  startOfDay,
  startOfToday,
} from "date-fns"
import type { CountdownDaysInfo, CountdownEvent } from "./types"

export const DEFAULT_COUNTDOWN_COLOR = "#11131A"
export const COUNTDOWN_DANGER = "#E14B42"
export const COUNTDOWN_WARNING = "#946300"
export const COUNTDOWN_PAST = "#9AA0AD"

export const colorPresets = [
  "#3B7DD8",
  "#2A9D8F",
  "#6C7A8D",
  "#D64545",
  "#B07D2A",
  "#E46AA0",
  "#8B5CF6",
  "#E76F51",
  "#2A8A5C",
]

export const categoryLabels = {
  work: "工作",
  life: "生活",
  memorial: "纪念",
  health: "健康",
  other: "其他",
} as const

export function todayInputValue() {
  return format(startOfToday(), "yyyy-MM-dd")
}

export function getQuickDate(kind: "tomorrow" | "nextWeek" | "nextMonth" | "nextYear") {
  const today = startOfToday()
  if (kind === "tomorrow") return format(addDays(today, 1), "yyyy-MM-dd")
  if (kind === "nextWeek") return format(addDays(today, 7), "yyyy-MM-dd")
  if (kind === "nextMonth") return format(addMonths(today, 1), "yyyy-MM-dd")
  return format(addYears(today, 1), "yyyy-MM-dd")
}

export function getDaysInfo(event: CountdownEvent): CountdownDaysInfo {
  const today = startOfToday()
  let target = startOfDay(parseISO(event.targetDate))

  if (event.type === "annual") {
    const thisYear = setYear(target, today.getFullYear())
    target = isBefore(thisYear, today) ? addYears(thisYear, 1) : thisYear
  }

  const diff = differenceInCalendarDays(target, today)
  const effectiveTargetDate = format(target, "yyyy-MM-dd")

  if (diff === 0) {
    return { days: 0, displayType: "today", effectiveTargetDate, isPast: false, isToday: true }
  }

  if (diff > 0) {
    return { days: diff, displayType: "countdown", effectiveTargetDate, isPast: false, isToday: false }
  }

  return { days: Math.abs(diff), displayType: "countup", effectiveTargetDate, isPast: true, isToday: false }
}

export function getAccentColor(event: CountdownEvent) {
  const info = getDaysInfo(event)
  return event.color || DEFAULT_COUNTDOWN_COLOR
}

export function getProgress(event: CountdownEvent): number {
  const info = getDaysInfo(event)
  if (info.isPast || event.type === "countup") return 100

  const created = startOfDay(parseISO(event.createdAt))
  const target = startOfDay(parseISO(info.effectiveTargetDate))
  const today = startOfToday()
  const total = differenceInCalendarDays(target, created)
  const elapsed = differenceInCalendarDays(today, created)

  if (total <= 0) return 100
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)))
}

export function formatDateLabel(date: string) {
  return format(parseISO(date), "yyyy.MM.dd")
}

export function isFutureDate(date: string) {
  return isAfter(startOfDay(parseISO(date)), startOfToday())
}

export function isPastDate(date: string) {
  return isBefore(startOfDay(parseISO(date)), startOfToday())
}

export function sortCountdownEvents(events: CountdownEvent[], mode: "days" | "createdAt" | "title" | "color") {
  const pinnedSorted = [...events].sort((left, right) => Number(right.pinned) - Number(left.pinned))

  return pinnedSorted.sort((left, right) => {
    if (left.pinned !== right.pinned) return Number(right.pinned) - Number(left.pinned)
    if (mode === "createdAt") return right.createdAt.localeCompare(left.createdAt)
    if (mode === "title") return left.title.localeCompare(right.title, "zh-Hans-CN")
    if (mode === "color") return left.color.localeCompare(right.color)
    return getDaysInfo(left).days - getDaysInfo(right).days
  })
}
