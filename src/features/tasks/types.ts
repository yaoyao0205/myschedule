export type TaskPriority = "high" | "medium" | "low"
export type CalendarEventType = "task" | "reminder" | "pomodoro"

export const DEFAULT_TASK_LIST_ID = "task-list-inbox"

export interface Reminder {
  id: string
  at: string
  repeat: "none" | "daily" | "weekly" | "workdays" | "custom"
}

export interface SubTask {
  id: string
  title: string
  completed: boolean
  children?: SubTask[]
}

export interface Task {
  id: string
  listId: string
  title: string
  note?: string
  priority: TaskPriority
  dueDate?: string
  startTime?: string
  endTime?: string
  eventType?: CalendarEventType
  reminder?: Reminder
  tags: string[]
  subtasks: SubTask[]
  pomodoroCount: number
  completed: boolean
  createdAt: string
  order: number
}

export interface TaskDraft {
  listId: string
  title: string
  note: string
  priority: TaskPriority
  dueDate: string
  startTime: string
  endTime: string
  eventType: CalendarEventType
  tags: string
}

export interface TaskGroup {
  id: string
  title: string
  description: string
  tasks: Task[]
}

export interface TaskList {
  id: string
  name: string
  description?: string
  color: string
  createdAt: string
  order: number
}
