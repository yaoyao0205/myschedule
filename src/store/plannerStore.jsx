import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { DEFAULT_STATE, LISTS, SMART_LISTS, TAGS } from "../data/plannerData"
import {
  addDays,
  clone,
  getToday,
  sortedTasks,
  toDateNumber,
} from "../utils/plannerUtils"

export const PLANNER_STORAGE_KEY = "pulse-planner-react-v1"
const PlannerContext = createContext(null)

function normalizeState(raw) {
  const state = raw && Array.isArray(raw.tasks) ? raw : clone(DEFAULT_STATE)
  state.ui = state.ui || {}
  state.ui.sidebarGroups = {
    smart: true,
    projects: true,
    tags: true,
    ...(state.ui.sidebarGroups || {}),
  }
  state.ui.filters = {
    status: "all",
    tag: "all",
    listId: "all",
    ...(state.ui.filters || {}),
  }
  state.ui.selectedTaskId = state.ui.selectedTaskId || null
  state.tasks = (state.tasks || []).map((task) => ({
    tags: [],
    priority: "medium",
    subtasks: [],
    endTime: "",
    parentId: "",
    persistentReminder: false,
    ...task,
  }))
  return state
}

function loadState() {
  try {
    const raw = localStorage.getItem(PLANNER_STORAGE_KEY)
    if (!raw) return normalizeState(clone(DEFAULT_STATE))
    return normalizeState(JSON.parse(raw))
  } catch {
    return normalizeState(clone(DEFAULT_STATE))
  }
}

export function PlannerProvider({ children }) {
  const [state, setState] = useState(() => loadState())
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!feedback) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setFeedback(null)
    }, 2400)

    return () => window.clearTimeout(timer)
  }, [feedback])

  const actions = useMemo(
    () => ({
      resetDemo() {
        setState(normalizeState(clone(DEFAULT_STATE)))
        setFeedback({
          title: "已恢复示例数据",
          detail: "演示任务、选中项和默认筛选都已回到初始状态。",
        })
      },
      addTask(payload) {
        const taskId = `task-${Date.now()}`
        const title = payload.title.trim()
        setState((prev) => ({
          ...prev,
          tasks: [
            {
              id: taskId,
              title,
              note: payload.note.trim(),
              listId: payload.listId,
              date: payload.date || getToday(),
              time: payload.time || "",
              endTime: payload.endTime || "",
              completed: false,
              starred: payload.starred,
              tags: payload.tag ? [payload.tag] : [],
              priority: payload.priority || "medium",
              parentId: payload.parentId || "",
              persistentReminder: Boolean(payload.persistentReminder),
              subtasks: [],
            },
            ...prev.tasks,
          ],
          ui: {
            ...prev.ui,
            selectedTaskId: taskId,
          },
        }))
        setFeedback({
          title: "任务已添加",
          detail: title,
        })
      },
      updateTask(taskId, payload) {
        const title = payload.title.trim()
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  title,
                  note: payload.note.trim(),
                  listId: payload.listId,
                  date: payload.date || task.date,
                  time: payload.time || "",
                  endTime: payload.endTime || "",
                  priority: payload.priority || "medium",
                  tags: payload.tag ? [payload.tag] : [],
                  starred: payload.starred,
                  parentId: payload.parentId || "",
                  persistentReminder: Boolean(payload.persistentReminder),
                  subtasks: payload.subtasks ?? task.subtasks ?? [],
                }
              : task
          ),
        }))
        setFeedback({
          title: "任务已更新",
          detail: title,
        })
      },
      toggleTask(taskId) {
        setState((prev) => {
          const currentTask = prev.tasks.find((task) => task.id === taskId)
          if (!currentTask) {
            return prev
          }

          const nextCompleted = !currentTask.completed
          setFeedback({
            title: nextCompleted ? "任务已完成" : "任务重新打开",
            detail: currentTask.title,
          })

          return {
            ...prev,
            tasks: prev.tasks.map((task) =>
              task.id === taskId ? { ...task, completed: nextCompleted } : task
            ),
          }
        })
      },
      toggleStar(taskId) {
        setState((prev) => {
          const currentTask = prev.tasks.find((task) => task.id === taskId)
          if (!currentTask) {
            return prev
          }

          const nextStarred = !currentTask.starred
          setFeedback({
            title: nextStarred ? "已标记为重要" : "已取消重要",
            detail: currentTask.title,
          })

          return {
            ...prev,
            tasks: prev.tasks.map((task) =>
              task.id === taskId ? { ...task, starred: nextStarred } : task
            ),
          }
        })
      },
      togglePersistentReminder(taskId) {
        setState((prev) => {
          const currentTask = prev.tasks.find((task) => task.id === taskId)
          if (!currentTask) {
            return prev
          }

          const nextEnabled = !currentTask.persistentReminder
          setFeedback({
            title: nextEnabled ? "已开启持续提醒" : "已关闭持续提醒",
            detail: currentTask.title,
          })

          return {
            ...prev,
            tasks: prev.tasks.map((task) =>
              task.id === taskId ? { ...task, persistentReminder: nextEnabled } : task
            ),
          }
        })
      },
      toggleSubtask(taskId, subtaskId) {
        setState((prev) => {
          const currentTask = prev.tasks.find((task) => task.id === taskId)
          const currentSubtask = currentTask?.subtasks?.find((item) => item.id === subtaskId)
          if (!currentTask || !currentSubtask) {
            return prev
          }

          const nextCompleted = !currentSubtask.completed
          setFeedback({
            title: nextCompleted ? "子任务已完成" : "子任务重新打开",
            detail: currentSubtask.title,
          })

          return {
            ...prev,
            tasks: prev.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: (task.subtasks || []).map((item) =>
                      item.id === subtaskId ? { ...item, completed: nextCompleted } : item
                    ),
                  }
                : task
            ),
          }
        })
      },
      addSubtask(taskId, title) {
        const trimmedTitle = title.trim()
        if (!trimmedTitle) {
          return
        }

        setState((prev) => {
          const currentTask = prev.tasks.find((task) => task.id === taskId)
          if (!currentTask) {
            return prev
          }

          const subtaskId = `subtask-${Date.now()}`
          setFeedback({
            title: "已添加检查项",
            detail: trimmedTitle,
          })

          return {
            ...prev,
            tasks: prev.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: [
                      ...(task.subtasks || []),
                      { id: subtaskId, title: trimmedTitle, completed: false },
                    ],
                  }
                : task
            ),
          }
        })
      },
      removeSubtask(taskId, subtaskId) {
        setState((prev) => {
          const currentTask = prev.tasks.find((task) => task.id === taskId)
          const currentSubtask = currentTask?.subtasks?.find((item) => item.id === subtaskId)
          if (!currentTask || !currentSubtask) {
            return prev
          }

          setFeedback({
            title: "已删除检查项",
            detail: currentSubtask.title,
          })

          return {
            ...prev,
            tasks: prev.tasks.map((task) =>
              task.id === taskId
                ? {
                    ...task,
                    subtasks: (task.subtasks || []).filter((item) => item.id !== subtaskId),
                  }
                : task
            ),
          }
        })
      },
      deleteTask(taskId) {
        setState((prev) => {
          const currentTask = prev.tasks.find((task) => task.id === taskId)
          if (!currentTask) {
            return prev
          }

          setFeedback({
            title: "任务已删除",
            detail: currentTask.title,
          })

          return {
            ...prev,
            tasks: prev.tasks.filter((task) => task.id !== taskId),
            ui: {
              ...prev.ui,
              selectedTaskId: prev.ui.selectedTaskId === taskId ? null : prev.ui.selectedTaskId,
            },
          }
        })
      },
      setSelectedTask(taskId) {
        setState((prev) => ({
          ...prev,
          ui: { ...prev.ui, selectedTaskId: taskId },
        }))
      },
      updateFocus(focus) {
        setState((prev) => ({
          ...prev,
          focus,
        }))
      },
      toggleSidebarGroup(groupKey) {
        setState((prev) => ({
          ...prev,
          ui: {
            ...prev.ui,
            sidebarGroups: {
              ...prev.ui.sidebarGroups,
              [groupKey]: !prev.ui.sidebarGroups[groupKey],
            },
          },
        }))
      },
      setFilter(name, value) {
        setState((prev) => ({
          ...prev,
          ui: {
            ...prev.ui,
            filters: {
              ...prev.ui.filters,
              [name]: value,
            },
          },
        }))
      },
      setFilters(filters) {
        setState((prev) => ({
          ...prev,
          ui: {
            ...prev.ui,
            filters: {
              ...prev.ui.filters,
              ...filters,
            },
          },
        }))
      },
      clearFeedback() {
        setFeedback(null)
      },
    }),
    []
  )

  const computed = useMemo(() => {
    const today = getToday()
    const tasks = sortedTasks(state.tasks)
    const selectedTask = tasks.find((task) => task.id === state.ui.selectedTaskId) || null

    const stats = {
      total: tasks.length,
      today: tasks.filter((task) => task.date === today).length,
      pending: tasks.filter((task) => !task.completed).length,
      completed: tasks.filter((task) => task.completed).length,
      starred: tasks.filter((task) => task.starred && !task.completed).length,
    }

    const matchesFilter = (task) => {
      const { status, tag, listId } = state.ui.filters
      if (status === "pending" && task.completed) return false
      if (status === "completed" && !task.completed) return false
      if (status === "starred" && !task.starred) return false
      if (tag !== "all" && !(task.tags || []).includes(tag)) return false
      if (listId !== "all" && task.listId !== listId) return false
      return true
    }

    const tasksForDate = (date) => tasks.filter((task) => task.date === date)
    const tasksByList = (listId) => tasks.filter((task) => task.listId === listId)
    const smartListTasks = (smartListId) => {
      if (smartListId === "today") return tasks.filter((task) => task.date === today)
      if (smartListId === "next7") {
        return tasks.filter(
          (task) =>
            toDateNumber(task.date) >= toDateNumber(today) &&
            toDateNumber(task.date) <= toDateNumber(addDays(today, 6))
        )
      }
      if (smartListId === "inbox") return tasks.filter((task) => task.listId === "inbox")
      return []
    }

    return {
      today,
      tasks,
      stats,
      selectedTask,
      filters: state.ui.filters,
      sidebarGroups: state.ui.sidebarGroups,
      focus: state.focus,
      lists: LISTS,
      tags: TAGS,
      smartLists: SMART_LISTS,
      tasksForDate,
      tasksByList,
      smartListTasks,
      filteredTasks: (inputTasks) => inputTasks.filter(matchesFilter),
      countTasksByTag: (tagId) => tasks.filter((task) => (task.tags || []).includes(tagId)).length,
    }
  }, [state])

  const value = useMemo(() => ({ state, actions, feedback, ...computed }), [state, actions, feedback, computed])

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
}

export function usePlanner() {
  const context = useContext(PlannerContext)
  if (!context) {
    throw new Error("usePlanner must be used within PlannerProvider")
  }
  return context
}
