import { addDays, compareAsc, format, isSameDay, parseISO, startOfToday } from "date-fns"
import { DEFAULT_TASK_LIST_ID, type Task, type TaskDraft, type TaskGroup, type TaskList, type TaskPriority } from "./types"

export const PRIORITY_META: Record<TaskPriority, { label: string; classes: string }> = {
  high: {
    label: "高",
    classes:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
  },
  medium: {
    label: "中",
    classes:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  },
  low: {
    label: "低",
    classes:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
}

export function todayInputValue(): string {
  return format(startOfToday(), "yyyy-MM-dd")
}

export function tomorrowInputValue(): string {
  return format(addDays(startOfToday(), 1), "yyyy-MM-dd")
}

export function createEmptyDraft(): TaskDraft {
  return {
    listId: DEFAULT_TASK_LIST_ID,
    title: "",
    note: "",
    priority: "medium",
    dueDate: todayInputValue(),
    startTime: "",
    endTime: "",
    eventType: "task",
    tags: "",
  }
}

export function taskToDraft(task: Task): TaskDraft {
  return {
    listId: task.listId || DEFAULT_TASK_LIST_ID,
    title: task.title,
    note: task.note ?? "",
    priority: task.priority,
    dueDate: task.dueDate ?? "",
    startTime: task.startTime ?? "",
    endTime: task.endTime ?? "",
    eventType: task.eventType ?? "task",
    tags: task.tags.join(", "),
  }
}

export function buildTaskListGroups(tasks: Task[], taskLists: TaskList[]): TaskGroup[] {
  const ordered = sortTasks(tasks)

  return taskLists
    .sort((left, right) => left.order - right.order)
    .map((list) => ({
      id: list.id,
      title: list.name,
      description: list.description || "自定义清单，用来按项目、生活、学习或场景收纳任务。",
      tasks: ordered.filter((task) => (task.listId || DEFAULT_TASK_LIST_ID) === list.id),
    }))
}

export function parseTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((left, right) => {
    if (left.completed !== right.completed) {
      return Number(left.completed) - Number(right.completed)
    }

    if (left.order !== right.order) {
      return left.order - right.order
    }

    if (left.dueDate && right.dueDate) {
      return compareAsc(parseISO(left.dueDate), parseISO(right.dueDate))
    }

    return left.title.localeCompare(right.title, "zh-CN")
  })
}

export function buildTaskGroups(tasks: Task[]): TaskGroup[] {
  const today = startOfToday()
  const tomorrow = addDays(today, 1)
  const ordered = sortTasks(tasks)

  return [
    {
      id: "today",
      title: "今天",
      description: "只放现在最值得推进的事。",
      tasks: ordered.filter((task) => !task.completed && task.dueDate && isSameDay(parseISO(task.dueDate), today)),
    },
    {
      id: "tomorrow",
      title: "明天",
      description: "给下一步留出缓冲，避免未来突然挤成一团。",
      tasks: ordered.filter(
        (task) => !task.completed && task.dueDate && isSameDay(parseISO(task.dueDate), tomorrow)
      ),
    },
    {
      id: "planned",
      title: "计划中",
      description: "已安排但不急着今天完成的任务。",
      tasks: ordered.filter((task) => {
        if (task.completed) return false
        if (!task.dueDate) return true
        const due = parseISO(task.dueDate)
        return !isSameDay(due, today) && !isSameDay(due, tomorrow)
      }),
    },
    {
      id: "completed",
      title: "已完成",
      description: "小胜利会滚雪球，别忘了看一眼。",
      tasks: ordered.filter((task) => task.completed),
    },
  ]
}
