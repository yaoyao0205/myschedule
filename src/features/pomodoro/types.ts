export type PomodoroPhase = "work" | "shortBreak" | "longBreak"
export type PomodoroStatus = "idle" | "running" | "paused"
export type PomodoroSound = "bell" | "wood" | "noise" | "silent"

export interface PomodoroSettings {
  autoStartBreak: boolean
  autoStartWork: boolean
  doNotDisturb: boolean
  longBreakInterval: number
  longBreakMinutes: number
  shortBreakMinutes: number
  sound: PomodoroSound
  volume: number
  workMinutes: number
}

export interface PomodoroTimer {
  completedWorkSessions: number
  endsAt: string | null
  phase: PomodoroPhase
  remainingSeconds: number
  selectedTaskId: string | null
  selectedTaskTitle: string
  startedAt: string | null
  status: PomodoroStatus
  totalSeconds: number
}

export interface PomodoroRecord {
  durationMinutes: number
  endedAt: string
  id: string
  startedAt: string
  taskId: string | null
  taskTitle: string
}
