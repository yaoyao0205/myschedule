import { type ReactNode, useEffect, useMemo, useState } from "react"
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { AnimatePresence } from "framer-motion"
import { CalendarCheck2, Clock3, FolderKanban, Flame, Plus, Search } from "lucide-react"
import { useTopBarSlot } from "../../../components/layout/topBarSlot"
import { useToast } from "../../../components/ui/ToastProvider"
import { cn } from "../../../lib/cn"
import { useNoteStore } from "../../notes/store/noteStore"
import { BulkActionBar } from "./BulkActionBar"
import { TaskEditor } from "./TaskEditor"
import { TaskGroup } from "./TaskGroup"
import { useTaskStore } from "../store/taskStore"
import { DEFAULT_TASK_LIST_ID, type Task, type TaskDraft } from "../types"
import { buildTaskListGroups, createEmptyDraft } from "../utils"

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable
}

export function TaskListPage() {
  const {
    tasks,
    taskLists,
    selectedTaskIds,
    addTaskList,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    toggleSelectedTask,
    clearSelection,
    selectAll,
    bulkComplete,
    bulkDelete,
  } = useTaskStore()
  const notes = useNoteStore((state) => state.notes)
  const { notify } = useToast()
  const topBarSlot = useTopBarSlot()
  const [editingTask, setEditingTask] = useState<Task | undefined>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeListId, setActiveListId] = useState("all")
  const [newListName, setNewListName] = useState("")
  const [mobileListFormOpen, setMobileListFormOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const scopedTasks = activeListId === "all" ? tasks : tasks.filter((task) => task.listId === activeListId)
    if (!normalizedQuery) return scopedTasks

    return scopedTasks.filter((task) => {
      const haystack = [task.title, task.note ?? "", ...task.tags].join(" ").toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [activeListId, query, tasks])

  const visibleTaskLists = activeListId === "all" ? taskLists : taskLists.filter((list) => list.id === activeListId)
  const groups = useMemo(() => buildTaskListGroups(filteredTasks, visibleTaskLists), [filteredTasks, visibleTaskLists])
  const visibleTaskIds = filteredTasks.map((task) => task.id)
  const pendingCount = tasks.filter((task) => !task.completed).length
  const completedCount = tasks.length - pendingCount
  const highPriorityCount = tasks.filter((task) => !task.completed && task.priority === "high").length

  useEffect(() => {
    function openEditor() {
      setEditingTask(undefined)
      setEditorOpen(true)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return

      if (event.key.toLowerCase() === "n") {
        event.preventDefault()
        openEditor()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("focusflow:create-task", openEditor)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("focusflow:create-task", openEditor)
    }
  }, [])

  useEffect(() => {
    const stats = (
      <div className="grid shrink-0 grid-cols-3 gap-2">
        <StatChip icon={<Clock3 className="h-3.5 w-3.5" />} label="待处理" value={pendingCount} />
        <StatChip icon={<CalendarCheck2 className="h-3.5 w-3.5" />} label="已完成" value={completedCount} />
        <StatChip icon={<Flame className="h-3.5 w-3.5" />} label="高优先级" value={highPriorityCount} />
      </div>
    )

    const searchInput = (
      <div className="flex min-w-0 items-center gap-3">
        <label className="ff-input flex min-h-10 min-w-0 flex-1 items-center gap-2 px-3 text-[var(--ff-ink-500)]">
          <Search className="h-4 w-4 shrink-0" />
          <input
            className="w-full bg-transparent text-sm text-[var(--ff-ink-900)] outline-none placeholder:text-[var(--ff-ink-400)] dark:text-[var(--ff-text)]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索任务"
          />
        </label>
        {stats}
      </div>
    )

    const mobileSearchInput = (
      <label className="ff-input flex h-10 min-h-10 w-[118px] items-center gap-2 px-3 text-[var(--ff-ink-500)]">
        <Search className="h-4 w-4 shrink-0" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ff-ink-900)] outline-none placeholder:text-[var(--ff-ink-400)] dark:text-[var(--ff-text)]"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索"
        />
      </label>
    )

    topBarSlot?.setTopBarSlot({
      desktop: searchInput,
      mobileAction: mobileSearchInput,
      mobilePanel: stats,
    })

    return () => topBarSlot?.setTopBarSlot(null)
  }, [completedCount, highPriorityCount, pendingCount, query, topBarSlot])

  function handleSubmit(draft: TaskDraft) {
    if (editingTask) {
      updateTask(editingTask.id, draft)
      notify("任务已保存", "success")
    } else {
      addTask(draft)
      notify("新任务已加入清单", "success")
    }

    setEditorOpen(false)
    setEditingTask(undefined)
  }

  function handleEdit(task: Task) {
    setEditingTask(task)
    setEditorOpen(true)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    reorderTasks(String(active.id), String(over.id))
  }

  function handleCreateTask() {
    setEditingTask(undefined)
    setEditorOpen(true)
  }

  const newTaskDraft = useMemo(() => {
    if (activeListId === "all") return undefined
    const listExists = taskLists.some((list) => list.id === activeListId)
    return { ...createEmptyDraft(), listId: listExists ? activeListId : DEFAULT_TASK_LIST_ID }
  }, [activeListId, taskLists])

  function handleAddTaskList() {
    const listId = addTaskList(newListName)
    if (!listId) {
      notify("先写一个清单名称", "info")
      setMobileListFormOpen(true)
      return
    }
    setNewListName("")
    setMobileListFormOpen(false)
    setActiveListId(listId)
    notify("清单已创建", "success")
  }

  function handleDeleteTask(taskId: string) {
    deleteTask(taskId)
    notify("任务已删除", "info")
  }

  function handleBulkComplete() {
    bulkComplete()
    notify("已批量标记完成", "success")
  }

  function handleBulkDelete() {
    bulkDelete()
    notify("已删除选中的任务", "info")
  }

  return (
    <div className="mx-auto h-full min-h-0 w-full max-w-6xl">
      <section className="h-full min-h-0 min-w-0">
        <div className="grid h-full min-h-0 overflow-hidden gap-2 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="ff-glass-panel flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-[18px] p-2 sm:rounded-[24px]">
            <div className="flex items-center justify-between px-1">
              <p className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ff-muted)]">lists</p>
              <button
                className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--ff-brand-text)] hover:bg-[var(--ff-brand-soft)]"
                type="button"
                onClick={() => setMobileListFormOpen((open) => !open)}
              >
                + 清单
              </button>
            </div>
            <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
              <button
                className={cn("flex min-h-10 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition", activeListId === "all" ? "ff-tag-active" : "ff-button-secondary")}
                type="button"
                onClick={() => setActiveListId("all")}
              >
                <span>全部清单</span>
                <span className="ff-mono text-[10px] opacity-60">{tasks.length}</span>
              </button>
              {taskLists.map((list) => {
                const listCount = tasks.filter((task) => task.listId === list.id).length
                return (
                  <button
                    className={cn("flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition", activeListId === list.id ? "ff-tag-active" : "ff-button-secondary")}
                    key={list.id}
                    type="button"
                    onClick={() => setActiveListId(list.id)}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <FolderKanban className="h-4 w-4 shrink-0" />
                      <span className="truncate">{list.name}</span>
                    </span>
                    <span className="ff-mono shrink-0 text-[10px] opacity-60">{listCount}</span>
                  </button>
                )
              })}
            </div>
            <label
              className={cn(
                "ff-input min-h-10 w-full items-center gap-2 overflow-hidden rounded-2xl px-3 text-sm text-[var(--ff-ink-500)] focus-within:border-black/20 focus-within:bg-white/72 focus-within:shadow-[0_0_0_4px_rgba(17,19,26,0.06)]",
                mobileListFormOpen ? "flex" : "hidden"
              )}
            >
              <input
                className="min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-[var(--ff-text)] outline-none ring-0 placeholder:text-[var(--ff-ink-400)] focus:outline-none focus:ring-0 focus-visible:outline-none"
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleAddTaskList()
                }}
                placeholder="新清单名"
              />
              <button className="min-h-8 shrink-0 rounded-xl bg-black px-3 text-sm font-semibold text-[#f8f6f0] transition hover:bg-black/80" type="button" onClick={handleAddTaskList}>
                新建
              </button>
            </label>
          </aside>

          <div className="flex h-full min-h-0 flex-col overflow-hidden">

            <button
              className="ff-button-primary fixed bottom-[92px] right-5 z-30 grid h-13 w-13 place-items-center rounded-full p-0 shadow-[0_18px_40px_rgba(17,19,26,0.22)] sm:bottom-8 sm:right-8 sm:h-14 sm:w-14"
              type="button"
              onClick={handleCreateTask}
              aria-label="新建任务"
              title="新建任务"
            >
              <Plus className="h-5 w-5" />
            </button>

            <BulkActionBar
              selectedCount={selectedTaskIds.length}
              totalCount={visibleTaskIds.length}
              onSelectAll={() => selectAll(visibleTaskIds)}
              onComplete={handleBulkComplete}
              onDelete={handleBulkDelete}
              onClear={clearSelection}
            />

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-24 pr-0 sm:pb-4 sm:pr-1">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={visibleTaskIds} strategy={verticalListSortingStrategy}>
                  <div className="grid content-start gap-2 sm:gap-3">
                    {groups.map((group) => (
                      <TaskGroup
                        key={group.id}
                        group={group}
                        notes={notes}
                        selectedTaskIds={selectedTaskIds}
                        onEdit={handleEdit}
                        onDelete={handleDeleteTask}
                        onToggle={toggleTask}
                        onSelect={toggleSelectedTask}
                        onCreate={handleCreateTask}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {editorOpen ? (
          <TaskEditor
            key={editingTask?.id ?? `new-task-${activeListId}`}
            initialDraft={editingTask ? undefined : newTaskDraft}
            task={editingTask}
            taskLists={taskLists}
            onClose={() => setEditorOpen(false)}
            onSubmit={handleSubmit}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

interface StatChipProps {
  icon: ReactNode
  label: string
  value: number
}

function StatChip({ icon, label, value }: StatChipProps) {
  return (
    <div className="relative grid h-10 min-w-[104px] grid-cols-[1fr_auto] items-center overflow-hidden rounded-2xl border border-black/10 bg-white/42 px-3 shadow-[0_1px_0_rgba(255,255,255,0.74)_inset] backdrop-blur-xl sm:h-11 sm:min-w-[118px]">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] text-[var(--ff-muted)] sm:text-[11px]">
          {icon}
          <span className="truncate">{label}</span>
        </div>
      </div>
      <strong className="ff-display block text-xl leading-none text-[var(--ff-text)] sm:text-2xl">{value}</strong>
    </div>
  )
}
