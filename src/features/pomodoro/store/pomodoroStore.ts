import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createId } from "../../../lib/ids"
import type { PomodoroPhase, PomodoroRecord, PomodoroSettings, PomodoroSound, PomodoroTimer } from "../types"

interface PomodoroState {
  records: PomodoroRecord[]
  selectedHistoryDate: string
  settings: PomodoroSettings
  timer: PomodoroTimer
  finishPhase: (reason: "completed" | "skipped") => PomodoroRecord | null
  pauseTimer: () => void
  recalibrateTimer: () => boolean
  resetTimer: () => void
  selectHistoryDate: (date: string) => void
  selectTask: (taskId: string | null, taskTitle?: string) => void
  setRemainingSeconds: (remainingSeconds: number) => void
  setSetting: <Key extends keyof PomodoroSettings>(key: Key, value: PomodoroSettings[Key]) => void
  startTimer: () => void
}

const secondsPerMinute = 60

const defaultSettings: PomodoroSettings = {
  autoStartBreak: false,
  autoStartWork: false,
  doNotDisturb: true,
  longBreakInterval: 4,
  longBreakMinutes: 15,
  shortBreakMinutes: 5,
  sound: "bell",
  volume: 0.55,
  workMinutes: 25,
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function normalizeSettings(settings?: Partial<PomodoroSettings>): PomodoroSettings {
  return {
    autoStartBreak: settings?.autoStartBreak ?? defaultSettings.autoStartBreak,
    autoStartWork: settings?.autoStartWork ?? defaultSettings.autoStartWork,
    doNotDisturb: settings?.doNotDisturb ?? defaultSettings.doNotDisturb,
    longBreakInterval: clamp(settings?.longBreakInterval ?? defaultSettings.longBreakInterval, 2, 8),
    longBreakMinutes: clamp(settings?.longBreakMinutes ?? defaultSettings.longBreakMinutes, 5, 60),
    shortBreakMinutes: clamp(settings?.shortBreakMinutes ?? defaultSettings.shortBreakMinutes, 1, 30),
    sound: normalizeSound(settings?.sound),
    volume: clamp(settings?.volume ?? defaultSettings.volume, 0, 1),
    workMinutes: clamp(settings?.workMinutes ?? defaultSettings.workMinutes, 5, 90),
  }
}

function normalizeSound(sound?: PomodoroSound): PomodoroSound {
  if (sound === "bell" || sound === "wood" || sound === "noise" || sound === "silent") return sound
  return "bell"
}

function getPhaseSeconds(phase: PomodoroPhase, settings: PomodoroSettings): number {
  if (phase === "shortBreak") return settings.shortBreakMinutes * secondsPerMinute
  if (phase === "longBreak") return settings.longBreakMinutes * secondsPerMinute
  return settings.workMinutes * secondsPerMinute
}

function createTimer(settings: PomodoroSettings): PomodoroTimer {
  return {
    completedWorkSessions: 0,
    endsAt: null,
    phase: "work",
    remainingSeconds: getPhaseSeconds("work", settings),
    selectedTaskId: null,
    selectedTaskTitle: "",
    startedAt: null,
    status: "idle",
    totalSeconds: getPhaseSeconds("work", settings),
  }
}

function nextPhase(timer: PomodoroTimer, settings: PomodoroSettings, workCompleted: boolean): PomodoroPhase {
  if (timer.phase !== "work") return "work"
  const completedCount = timer.completedWorkSessions + (workCompleted ? 1 : 0)
  return completedCount > 0 && completedCount % settings.longBreakInterval === 0 ? "longBreak" : "shortBreak"
}

function shouldAutoStart(phase: PomodoroPhase, settings: PomodoroSettings): boolean {
  if (phase === "work") return settings.autoStartWork
  return settings.autoStartBreak
}

function buildStartedTimer(timer: PomodoroTimer, remainingSeconds: number): PomodoroTimer {
  const now = Date.now()
  return {
    ...timer,
    endsAt: new Date(now + remainingSeconds * 1000).toISOString(),
    remainingSeconds,
    startedAt: timer.startedAt ?? new Date(now).toISOString(),
    status: "running",
  }
}

function normalizeTimer(timer: Partial<PomodoroTimer> | undefined, settings: PomodoroSettings): PomodoroTimer {
  const phase = timer?.phase === "shortBreak" || timer?.phase === "longBreak" ? timer.phase : "work"
  const totalSeconds = timer?.totalSeconds ?? getPhaseSeconds(phase, settings)
  return {
    completedWorkSessions: timer?.completedWorkSessions ?? 0,
    endsAt: timer?.endsAt ?? null,
    phase,
    remainingSeconds: timer?.remainingSeconds ?? totalSeconds,
    selectedTaskId: timer?.selectedTaskId ?? null,
    selectedTaskTitle: timer?.selectedTaskTitle ?? "",
    startedAt: timer?.startedAt ?? null,
    status: timer?.status === "running" || timer?.status === "paused" ? timer.status : "idle",
    totalSeconds,
  }
}

function normalizeRecords(records?: PomodoroRecord[]): PomodoroRecord[] {
  if (!Array.isArray(records)) return []

  return records
    .filter((record) => record && record.startedAt && record.endedAt)
    .map((record) => ({
      durationMinutes: record.durationMinutes ?? defaultSettings.workMinutes,
      endedAt: record.endedAt,
      id: record.id ?? createId("pomodoro"),
      startedAt: record.startedAt,
      taskId: record.taskId ?? null,
      taskTitle: record.taskTitle ?? "",
    }))
}

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => {
      const settings = defaultSettings

      return {
        records: [],
        selectedHistoryDate: todayKey(),
        settings,
        timer: createTimer(settings),
        finishPhase: (reason) => {
          const state = get()
          const { settings, timer } = state
          const completedWork = reason === "completed" && timer.phase === "work"
          const record: PomodoroRecord | null = completedWork
            ? {
                durationMinutes: Math.round(timer.totalSeconds / secondsPerMinute),
                endedAt: new Date().toISOString(),
                id: createId("pomodoro"),
                startedAt: timer.startedAt ?? new Date(Date.now() - timer.totalSeconds * 1000).toISOString(),
                taskId: timer.selectedTaskId,
                taskTitle: timer.selectedTaskTitle,
              }
            : null
          const upcomingPhase = nextPhase(timer, settings, completedWork)
          const totalSeconds = getPhaseSeconds(upcomingPhase, settings)
          const baseTimer: PomodoroTimer = {
            ...timer,
            completedWorkSessions: completedWork ? timer.completedWorkSessions + 1 : timer.completedWorkSessions,
            endsAt: null,
            phase: upcomingPhase,
            remainingSeconds: totalSeconds,
            startedAt: null,
            status: "idle",
            totalSeconds,
          }
          const nextTimer = shouldAutoStart(upcomingPhase, settings)
            ? buildStartedTimer(baseTimer, totalSeconds)
            : baseTimer

          set({
            records: record ? [record, ...state.records] : state.records,
            selectedHistoryDate: record ? record.endedAt.slice(0, 10) : state.selectedHistoryDate,
            timer: nextTimer,
          })

          return record
        },
        pauseTimer: () =>
          set((state) => {
            if (state.timer.status !== "running" || !state.timer.endsAt) return state
            const remainingSeconds = Math.max(0, Math.ceil((new Date(state.timer.endsAt).getTime() - Date.now()) / 1000))
            return {
              timer: {
                ...state.timer,
                endsAt: null,
                remainingSeconds,
                status: "paused",
              },
            }
          }),
        recalibrateTimer: () => {
          const state = get()
          if (state.timer.status !== "running" || !state.timer.endsAt) return false
          const remainingSeconds = Math.max(0, Math.ceil((new Date(state.timer.endsAt).getTime() - Date.now()) / 1000))
          set((current) => ({
            timer: {
              ...current.timer,
              remainingSeconds,
            },
          }))
          return remainingSeconds <= 0
        },
        resetTimer: () =>
          set((state) => {
            const totalSeconds = getPhaseSeconds(state.timer.phase, state.settings)
            return {
              timer: {
                ...state.timer,
                endsAt: null,
                remainingSeconds: totalSeconds,
                startedAt: null,
                status: "idle",
                totalSeconds,
              },
            }
          }),
        selectHistoryDate: (selectedHistoryDate) => set({ selectedHistoryDate }),
        selectTask: (selectedTaskId, selectedTaskTitle = "") =>
          set((state) => ({
            timer: {
              ...state.timer,
              selectedTaskId,
              selectedTaskTitle,
            },
          })),
        setRemainingSeconds: (remainingSeconds) =>
          set((state) => ({
            timer: {
              ...state.timer,
              remainingSeconds: Math.max(0, remainingSeconds),
            },
          })),
        setSetting: (key, value) =>
          set((state) => {
            const settings = normalizeSettings({ ...state.settings, [key]: value })
            const phaseSeconds = getPhaseSeconds(state.timer.phase, settings)
            const timer =
              state.timer.status === "running"
                ? state.timer
                : {
                    ...state.timer,
                    remainingSeconds: phaseSeconds,
                    totalSeconds: phaseSeconds,
                  }

            return { settings, timer }
          }),
        startTimer: () =>
          set((state) => {
            if (state.timer.status === "running") return state
            const remainingSeconds = state.timer.remainingSeconds || getPhaseSeconds(state.timer.phase, state.settings)
            return { timer: buildStartedTimer(state.timer, remainingSeconds) }
          }),
      }
    },
    {
      name: "focusflow.pomodoro.v1",
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<PomodoroState> | undefined
        const settings = normalizeSettings(persistedState?.settings)

        return {
          ...current,
          ...persistedState,
          records: normalizeRecords(persistedState?.records as PomodoroRecord[] | undefined),
          selectedHistoryDate: persistedState?.selectedHistoryDate ?? todayKey(),
          settings,
          timer: normalizeTimer(persistedState?.timer, settings),
        }
      },
      partialize: (state) => ({
        records: state.records,
        selectedHistoryDate: state.selectedHistoryDate,
        settings: state.settings,
        timer: state.timer,
      }),
    }
  )
)
