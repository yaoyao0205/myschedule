import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createId } from "../../../lib/ids"
import { useTrashStore } from "../../trash/store/trashStore"
import { DEFAULT_TASK_LIST_ID, type Task, type TaskDraft, type TaskList } from "../types"
import { parseTags, todayInputValue, tomorrowInputValue } from "../utils"

interface TaskState {
  tasks: Task[]
  taskLists: TaskList[]
  selectedTaskIds: string[]
  addTaskList: (name: string) => string | null
  renameTaskList: (listId: string, name: string) => void
  deleteTaskList: (listId: string) => void
  addTask: (draft: TaskDraft) => void
  updateTask: (taskId: string, draft: TaskDraft) => void
  deleteTask: (taskId: string) => void
  restoreTask: (task: Task) => void
  toggleTask: (taskId: string) => void
  reorderTasks: (activeId: string, overId: string) => void
  toggleSelectedTask: (taskId: string) => void
  clearSelection: () => void
  selectAll: (taskIds: string[]) => void
  bulkComplete: () => void
  bulkDelete: () => void
  recordPomodoro: (taskId: string) => void
}

const initialTaskLists: TaskList[] = [
  {
    id: DEFAULT_TASK_LIST_ID,
    name: "收件箱",
    description: "所有还没分清单的任务都会先放在这里。",
    color: "blue",
    createdAt: new Date().toISOString(),
    order: 1,
  },
]

const initialTasks: Task[] = [
  {
    id: "task-focus-setup",
    listId: DEFAULT_TASK_LIST_ID,
    title: "梳理本周最重要的 3 个目标",
    note: "用 yaoyaoflow 只留下真正需要推进的事情。",
    priority: "high",
    dueDate: todayInputValue(),
    startTime: "09:00",
    endTime: "10:00",
    eventType: "task",
    tags: ["规划", "深度工作"],
    subtasks: [],
    pomodoroCount: 1,
    completed: false,
    createdAt: new Date().toISOString(),
    order: 1,
  },
  {
    id: "task-calendar-review",
    listId: DEFAULT_TASK_LIST_ID,
    title: "检查明天的会议和提醒",
    note: "确认是否需要提前准备资料。",
    priority: "medium",
    dueDate: tomorrowInputValue(),
    startTime: "14:00",
    endTime: "15:00",
    eventType: "task",
    tags: ["日程"],
    subtasks: [],
    pomodoroCount: 0,
    completed: false,
    createdAt: new Date().toISOString(),
    order: 2,
  },
  {
    id: "task-notes-link",
    listId: DEFAULT_TASK_LIST_ID,
    title: "把产品想法整理成一篇笔记",
    note: "后续可以从任务直接关联到 Notes。",
    priority: "low",
    dueDate: "",
    startTime: "",
    endTime: "",
    eventType: "task",
    tags: ["笔记", "产品"],
    subtasks: [],
    pomodoroCount: 0,
    completed: false,
    createdAt: new Date().toISOString(),
    order: 3,
  },
]

function createTaskFromDraft(draft: TaskDraft, order: number): Task {
  return {
    id: createId("task"),
    listId: draft.listId || DEFAULT_TASK_LIST_ID,
    title: draft.title.trim(),
    note: draft.note.trim(),
    priority: draft.priority,
    dueDate: draft.dueDate,
    startTime: draft.startTime,
    endTime: draft.endTime,
    eventType: draft.eventType,
    tags: parseTags(draft.tags),
    subtasks: [],
    pomodoroCount: 0,
    completed: false,
    createdAt: new Date().toISOString(),
    order,
  }
}

function updateTaskFromDraft(task: Task, draft: TaskDraft): Task {
  return {
    ...task,
    listId: draft.listId || DEFAULT_TASK_LIST_ID,
    title: draft.title.trim(),
    note: draft.note.trim(),
    priority: draft.priority,
    dueDate: draft.dueDate,
    startTime: draft.startTime,
    endTime: draft.endTime,
    eventType: draft.eventType,
    tags: parseTags(draft.tags),
  }
}

function normalizeTasks(tasks: Task[]): Task[] {
  return tasks.map((task, index) => ({
    ...task,
    listId: task.listId || DEFAULT_TASK_LIST_ID,
    note: (task.note ?? "").replace(/FocusFlow/g, "yaoyaoflow"),
    dueDate: task.dueDate ?? "",
    startTime: task.startTime ?? "",
    endTime: task.endTime ?? "",
    eventType: task.eventType ?? "task",
    tags: Array.isArray(task.tags) ? task.tags : [],
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    pomodoroCount: task.pomodoroCount ?? 0,
    completed: task.completed ?? false,
    createdAt: task.createdAt ?? new Date().toISOString(),
    order: Number.isFinite(task.order) ? task.order : index + 1,
  }))
}

function normalizeTaskLists(taskLists: TaskList[] | undefined): TaskList[] {
  const now = new Date().toISOString()
  const normalized = Array.isArray(taskLists)
    ? taskLists
        .map((list, index) => ({
          id: list.id || createId("task-list"),
          name: list.name?.trim() || "未命名清单",
          description: list.description ?? "",
          color: list.color || "blue",
          createdAt: list.createdAt ?? now,
          order: Number.isFinite(list.order) ? list.order : index + 1,
        }))
        .sort((left, right) => left.order - right.order)
    : []

  const hasDefault = normalized.some((list) => list.id === DEFAULT_TASK_LIST_ID)
  return hasDefault ? normalized : [...initialTaskLists, ...normalized.map((list, index) => ({ ...list, order: index + 2 }))]
}

function reorder(tasks: Task[], activeId: string, overId: string): Task[] {
  const currentIndex = tasks.findIndex((task) => task.id === activeId)
  const targetIndex = tasks.findIndex((task) => task.id === overId)

  if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) {
    return tasks
  }

  const next = [...tasks]
  const [moved] = next.splice(currentIndex, 1)
  next.splice(targetIndex, 0, moved)
  return next.map((task, index) => ({ ...task, order: index + 1 }))
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      tasks: initialTasks,
      taskLists: initialTaskLists,
      selectedTaskIds: [],
      addTaskList: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return null
        const id = createId("task-list")
        set((state) => ({
          taskLists: [
            ...state.taskLists,
            {
              id,
              name: trimmed,
              description: "",
              color: "blue",
              createdAt: new Date().toISOString(),
              order: state.taskLists.length + 1,
            },
          ],
        }))
        return id
      },
      renameTaskList: (listId, name) =>
        set((state) => {
          const trimmed = name.trim()
          if (!trimmed) return state
          return {
            taskLists: state.taskLists.map((list) => (list.id === listId ? { ...list, name: trimmed } : list)),
          }
        }),
      deleteTaskList: (listId) =>
        set((state) => {
          if (listId === DEFAULT_TASK_LIST_ID) return state
          return {
            taskLists: state.taskLists.filter((list) => list.id !== listId),
            tasks: state.tasks.map((task) =>
              task.listId === listId ? { ...task, listId: DEFAULT_TASK_LIST_ID } : task
            ),
          }
        }),
      addTask: (draft) =>
        set((state) => ({
          tasks: [createTaskFromDraft(draft, state.tasks.length + 1), ...state.tasks],
        })),
      updateTask: (taskId, draft) =>
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === taskId ? updateTaskFromDraft(task, draft) : task)),
        })),
      deleteTask: (taskId) =>
        set((state) => {
          const task = state.tasks.find((item) => item.id === taskId)
          if (task) {
            useTrashStore.getState().addTrashItem({
              data: task,
              itemId: task.id,
              title: task.title,
              type: "task",
            })
          }
          return {
            tasks: state.tasks.filter((task) => task.id !== taskId),
            selectedTaskIds: state.selectedTaskIds.filter((id) => id !== taskId),
          }
        }),
      toggleTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id !== taskId) return task
            return { ...task, completed: !task.completed }
          }),
        })),
      reorderTasks: (activeId, overId) =>
        set((state) => ({
          tasks: reorder(state.tasks, activeId, overId),
        })),
      toggleSelectedTask: (taskId) =>
        set((state) => {
          const isSelected = state.selectedTaskIds.includes(taskId)
          return {
            selectedTaskIds: isSelected
              ? state.selectedTaskIds.filter((id) => id !== taskId)
              : [...state.selectedTaskIds, taskId],
          }
        }),
      clearSelection: () => set({ selectedTaskIds: [] }),
      selectAll: (taskIds) => set({ selectedTaskIds: taskIds }),
      bulkComplete: () =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            state.selectedTaskIds.includes(task.id) ? { ...task, completed: true } : task
          ),
          selectedTaskIds: [],
        })),
      bulkDelete: () =>
        set((state) => {
          state.tasks
            .filter((task) => state.selectedTaskIds.includes(task.id))
            .forEach((task) =>
              useTrashStore.getState().addTrashItem({
                data: task,
                itemId: task.id,
                title: task.title,
                type: "task",
              })
            )

          return {
            tasks: state.tasks.filter((task) => !state.selectedTaskIds.includes(task.id)),
            selectedTaskIds: [],
          }
        }),
      recordPomodoro: (taskId) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? { ...task, pomodoroCount: task.pomodoroCount + 1 } : task
          ),
        })),
      restoreTask: (task) =>
        set((state) => ({
          tasks: state.tasks.some((item) => item.id === task.id) ? state.tasks : [task, ...state.tasks],
        })),
    }),
    {
      name: "focusflow.tasks.v1",
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<TaskState> | undefined

        const taskLists = normalizeTaskLists(persistedState?.taskLists as TaskList[] | undefined)
        const validListIds = new Set(taskLists.map((list) => list.id))
        const tasks = Array.isArray(persistedState?.tasks)
          ? normalizeTasks(persistedState.tasks as Task[]).map((task) => ({
              ...task,
              listId: validListIds.has(task.listId) ? task.listId : DEFAULT_TASK_LIST_ID,
            }))
          : current.tasks

        return {
          ...current,
          ...persistedState,
          selectedTaskIds: [],
          taskLists,
          tasks,
        }
      },
      partialize: (state) => ({ taskLists: state.taskLists, tasks: state.tasks }),
    }
  )
)
