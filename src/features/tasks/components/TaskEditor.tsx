import { FormEvent, useState } from "react"
import { CalendarDays, Clock3, Flag, FolderKanban, Tags, X } from "lucide-react"
import { BottomSheet } from "../../../components/ui/BottomSheet"
import { ErrorBanner } from "../../../components/ui/ErrorBanner"
import type { CalendarEventType, Task, TaskDraft, TaskList, TaskPriority } from "../types"
import { createEmptyDraft, taskToDraft } from "../utils"

export type TaskEditorEventType = CalendarEventType | "countdown"
type TaskEditorDraft = Omit<TaskDraft, "eventType"> & { eventType: TaskEditorEventType }

interface TaskEditorProps {
  task?: Task
  initialDraft?: TaskDraft
  includeCountdownType?: boolean
  taskLists: TaskList[]
  onClose: () => void
  onSubmit: (draft: TaskDraft, eventType: TaskEditorEventType) => void
}

const priorityOptions: Array<{ value: TaskPriority; label: string }> = [
  { value: "high", label: "高优先级" },
  { value: "medium", label: "中优先级" },
  { value: "low", label: "低优先级" },
]

const taskEventTypeOptions: Array<{ value: TaskEditorEventType; label: string }> = [
  { value: "task", label: "任务" },
  { value: "reminder", label: "提醒" },
  { value: "pomodoro", label: "番茄钟" },
]

const countdownEventTypeOption: { value: TaskEditorEventType; label: string } = { value: "countdown", label: "日子" }

function normalizeEditorDraft(draft: TaskEditorDraft): TaskDraft {
  return {
    ...draft,
    eventType: draft.eventType === "countdown" ? "task" : draft.eventType,
  }
}

export function TaskEditor({ task, initialDraft, includeCountdownType = false, taskLists, onClose, onSubmit }: TaskEditorProps) {
  const [draft, setDraft] = useState<TaskEditorDraft>(() => (task ? taskToDraft(task) : initialDraft ?? createEmptyDraft()))
  const [titleError, setTitleError] = useState(false)
  const eventTypeOptions = includeCountdownType ? [...taskEventTypeOptions, countdownEventTypeOption] : taskEventTypeOptions
  const isCountdownDraft = draft.eventType === "countdown"

  function updateField<Key extends keyof TaskEditorDraft>(key: Key, value: TaskEditorDraft[Key]) {
    if (key === "title") {
      setTitleError(false)
    }
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft.title.trim()) {
      setTitleError(true)
      return
    }
    onSubmit(normalizeEditorDraft(draft), draft.eventType)
  }

  return (
    <BottomSheet ariaLabel={isCountdownDraft ? "新建日子" : task ? "编辑任务" : "新建任务"} className="max-w-xl" onClose={onClose}>
      <form className="p-4" onSubmit={handleSubmit}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-500">{isCountdownDraft ? "新建日子" : task ? "编辑任务" : "新建任务"}</p>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-slate-100">
              {isCountdownDraft ? "把重要日子放进时间流" : task ? "让这条任务更清晰" : "把想法放进 myschedule"}
            </h2>
          </div>
          <button className="ff-icon-button h-11 w-11" type="button" onClick={onClose} aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>

        {titleError ? <ErrorBanner message="请先写下任务标题，这样稍后才能准确找回它。" /> : null}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">任务标题</span>
            <input
              autoFocus
              className="ff-input mt-2 w-full px-4 py-3 text-base outline-none"
              value={draft.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder={isCountdownDraft ? "例如：越野赛、生日、纪念日" : "例如：完成产品路线图复盘"}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">备注</span>
            <textarea
              className="ff-input mt-2 min-h-28 w-full resize-none px-4 py-3 text-sm outline-none"
              value={draft.note}
              onChange={(event) => updateField("note", event.target.value)}
              placeholder="补充执行细节、上下文或验收标准"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <FolderKanban className="h-4 w-4" />
                清单
              </span>
              <select
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                value={draft.listId}
                onChange={(event) => updateField("listId", event.target.value)}
              >
                {taskLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Flag className="h-4 w-4" />
                优先级
              </span>
              <select
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                value={draft.priority}
                onChange={(event) => updateField("priority", event.target.value as TaskPriority)}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <CalendarDays className="h-4 w-4" />
                日期
              </span>
              <input
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                type="date"
                value={draft.dueDate}
                onChange={(event) => updateField("dueDate", event.target.value)}
              />
            </label>

          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Clock3 className="h-4 w-4" />
                开始
              </span>
              <input
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                type="time"
                value={draft.startTime}
                onChange={(event) => updateField("startTime", event.target.value)}
              />
            </label>

            <label className="block">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Clock3 className="h-4 w-4" />
                结束
              </span>
              <input
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                type="time"
                value={draft.endTime}
                onChange={(event) => updateField("endTime", event.target.value)}
              />
            </label>

            <label className="block">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                <Tags className="h-4 w-4" />
                类型
              </span>
              <select
                className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
                value={draft.eventType}
                onChange={(event) => updateField("eventType", event.target.value as TaskEditorEventType)}
              >
                {eventTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              <Tags className="h-4 w-4" />
              标签
            </span>
            <input
              className="ff-input mt-2 w-full px-3 py-3 text-sm outline-none"
              value={draft.tags}
              onChange={(event) => updateField("tags", event.target.value)}
              placeholder="规划, 工作"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button className="ff-button-secondary px-4 py-3 text-sm" type="button" onClick={onClose}>
            取消
          </button>
          <button className="ff-button-primary px-4 py-3 text-sm" type="submit">
            {isCountdownDraft ? "记录日子" : task ? "保存修改" : "创建任务"}
          </button>
        </div>
      </form>
    </BottomSheet>
  )
}
