import { useEffect, useMemo, useRef, useState } from "react"
import { ActionToast } from "../components/ActionToast"
import { usePlanner } from "../store/plannerStore"
import { addDays, getListMeta, getTaskTags, priorityLabel, toDateNumber } from "../utils/plannerUtils"

const RAIL_ITEMS = [
  { id: "today", label: "今天", icon: "today", href: "./index.html" },
  { id: "calendar", label: "日历", icon: "calendar-grid", href: "./calendar.html" },
  { id: "lists", label: "清单", icon: "check-square", href: "./lists.html" },
  { id: "profile", label: "我的", icon: "summary", href: "./profile.html" },
]

const PAGE_TITLES = {
  today: "Pulse Planner - 今天",
  calendar: "Pulse Planner - 日历",
  lists: "Pulse Planner - 清单",
  profile: "Pulse Planner - 我的",
}

const SMART_VIEW_META = {
  today: { label: "今天", icon: "today" },
  next7: { label: "最近7天", icon: "recent" },
  inbox: { label: "收集箱", icon: "inbox" },
  summary: { label: "摘要", icon: "summary" },
}

const PROJECT_VIEW_ICONS = {
  work: "briefcase",
  personal: "home",
  health: "leaf",
  growth: "sparkles",
}

function getViewTitle(view, lists) {
  if (view.kind === "smart") {
    if (view.id === "today") return "今天"
    if (view.id === "next7") return "最近7天"
    if (view.id === "summary") return "摘要"
    return "收集箱"
  }

  return lists.find((item) => item.id === view.id)?.name || "任务"
}

function getInitialView(pageId) {
  if (pageId === "today") {
    return { kind: "smart", id: "today" }
  }

  return { kind: "smart", id: "summary" }
}

function getViewTasks(view, planner) {
  if (view.kind === "smart") {
    if (view.id === "today") {
      return planner.tasks.filter((task) => task.date === planner.today)
    }

    if (view.id === "next7") {
      const end = addDays(planner.today, 6)
      return planner.tasks.filter(
        (task) =>
          toDateNumber(task.date) >= toDateNumber(planner.today) &&
          toDateNumber(task.date) <= toDateNumber(end)
      )
    }

    if (view.id === "summary") {
      return planner.tasks
    }

    return planner.tasks.filter((task) => task.listId === "inbox")
  }

  return planner.tasksByList(view.id)
}

function buildSections(tasks, today) {
  const tomorrow = addDays(today, 1)
  const recentEnd = addDays(today, 6)

  return [
    {
      id: "overdue",
      label: "已过期",
      tasks: tasks.filter((task) => task.date && toDateNumber(task.date) < toDateNumber(today)),
    },
    {
      id: "today",
      label: "今天",
      tasks: tasks.filter((task) => task.date === today),
    },
    {
      id: "tomorrow",
      label: "明天",
      tasks: tasks.filter((task) => task.date === tomorrow),
    },
    {
      id: "recent",
      label: "最近7天",
      tasks: tasks.filter(
        (task) =>
          toDateNumber(task.date) > toDateNumber(tomorrow) &&
          toDateNumber(task.date) <= toDateNumber(recentEnd)
      ),
    },
    {
      id: "later",
      label: "以后",
      tasks: tasks.filter((task) => task.date && toDateNumber(task.date) > toDateNumber(recentEnd)),
    },
    {
      id: "unscheduled",
      label: "未安排日期",
      tasks: tasks.filter((task) => !task.date),
    },
  ].filter((section) => section.tasks.length)
}

function buildCalendarDays(tasks, today) {
  const current = new Date(`${today}T00:00:00`)
  const monthStart = new Date(current.getFullYear(), current.getMonth(), 1)
  const gridStart = new Date(monthStart)
  gridStart.setDate(monthStart.getDate() - monthStart.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const dateText = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-")

    return {
      date: dateText,
      dayNumber: String(date.getDate()),
      inMonth: date.getMonth() === current.getMonth(),
      isToday: dateText === today,
      tasks: tasks.filter((task) => task.date === dateText),
    }
  })
}

function defaultListIdForView(view) {
  if (view.kind === "project") {
    return view.id
  }

  if (view.id === "inbox") {
    return "inbox"
  }

  return "inbox"
}

function defaultDateForView(view, today) {
  if (view.kind === "smart" && view.id === "next7") {
    return addDays(today, 1)
  }

  return today
}

function createTaskForm(task) {
  if (!task) {
    return null
  }

  return {
    title: task.title,
    note: task.note,
    listId: task.listId,
    date: task.date,
    time: task.time || "",
    endTime: task.endTime || "",
    priority: task.priority || "medium",
    tag: task.tags?.[0] || "",
    starred: task.starred,
    parentId: task.parentId || "",
    persistentReminder: Boolean(task.persistentReminder),
  }
}

function taskToUpdatePayload(task, overrides = {}) {
  return {
    title: task.title,
    note: task.note || "",
    listId: task.listId,
    date: task.date,
    time: task.time || "",
    endTime: task.endTime || "",
    priority: task.priority || "medium",
    tag: task.tags?.[0] || "",
    starred: task.starred,
    parentId: task.parentId || "",
    persistentReminder: Boolean(task.persistentReminder),
    subtasks: task.subtasks || [],
    ...overrides,
  }
}

function parseQuickTaskInput(input, { today, activeView, lists, tags }) {
  let title = input.trim()
  const parsed = {
    title,
    note: "",
    listId: defaultListIdForView(activeView),
    date: defaultDateForView(activeView, today),
    time: "",
    endTime: "",
    tag: "",
    priority: "medium",
    starred: false,
    parentId: "",
    persistentReminder: false,
  }

  const priorityMatch = title.match(/(?:^|\s)!(高|中|低|high|medium|low|1|2|3)\b/i)
  if (priorityMatch) {
    const value = priorityMatch[1].toLowerCase()
    parsed.priority = value === "高" || value === "high" || value === "1" ? "high" : value === "低" || value === "low" || value === "3" ? "low" : "medium"
    title = title.replace(priorityMatch[0], " ")
  }

  const tagMatch = title.match(/(?:^|\s)#([\p{L}\p{N}_-]+)/u)
  if (tagMatch) {
    const value = tagMatch[1].toLowerCase()
    parsed.tag = tags.find((tag) => tag.id.toLowerCase() === value || tag.name.toLowerCase() === value)?.id || ""
    title = title.replace(tagMatch[0], " ")
  }

  const listMatch = title.match(/(?:^|\s)~([^\s#！!]+)/u)
  if (listMatch) {
    const value = listMatch[1].toLowerCase()
    parsed.listId = lists.find((list) => list.id.toLowerCase() === value || list.name.toLowerCase() === value)?.id || parsed.listId
    title = title.replace(listMatch[0], " ")
  }

  if (/后天/.test(title)) {
    parsed.date = addDays(today, 2)
    title = title.replace(/后天/g, " ")
  } else if (/明天/.test(title)) {
    parsed.date = addDays(today, 1)
    title = title.replace(/明天/g, " ")
  } else if (/今天/.test(title)) {
    parsed.date = today
    title = title.replace(/今天/g, " ")
  }

  const timeMatch = title.match(/(?:^|\s)([01]?\d|2[0-3]):([0-5]\d)(?:\s*[-~]\s*([01]?\d|2[0-3]):([0-5]\d))?/)
  if (timeMatch) {
    parsed.time = `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}`
    parsed.endTime = timeMatch[3] ? `${timeMatch[3].padStart(2, "0")}:${timeMatch[4]}` : ""
    title = title.replace(timeMatch[0], " ")
  }

  parsed.title = title.replace(/\s+/g, " ").trim() || input.trim()
  return parsed
}

export function PlannerSPA({ pageId = "today" }) {
  const planner = usePlanner()
  const quickInputRef = useRef(null)
  const [activeView, setActiveView] = useState(() => getInitialView(pageId))
  const [viewMode, setViewMode] = useState("list")
  const [focusSession, setFocusSession] = useState(null)
  const [notionDatabaseId, setNotionDatabaseId] = useState(
    () => window.localStorage.getItem("pulse-planner-notion-database-id") || ""
  )
  const [notionSyncStatus, setNotionSyncStatus] = useState("")
  const [quickTitle, setQuickTitle] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortMode, setSortMode] = useState("time")
  const [statusFilter, setStatusFilter] = useState("all")
  const [tagFilter, setTagFilter] = useState("all")
  const [collapsedSections, setCollapsedSections] = useState({
    overdue: false,
    today: false,
    tomorrow: false,
    recent: false,
    later: false,
    unscheduled: false,
  })
  const [collapsedSidebar, setCollapsedSidebar] = useState({
    smart: false,
    projects: false,
    utility: false,
  })
  const isTaskPage = pageId === "today" || pageId === "lists"
  const frameMode = pageId === "calendar" ? "calendar" : pageId === "profile" ? "stats" : "tasks"
  const pageTitle = PAGE_TITLES[pageId] || "Pulse Planner"

  const baseViewTasks = useMemo(() => getViewTasks(activeView, planner), [activeView, planner])
  const viewTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const filtered = baseViewTasks.filter((task) => {
      if (statusFilter === "pending" && task.completed) return false
      if (statusFilter === "completed" && !task.completed) return false
      if (statusFilter === "starred" && !task.starred) return false
      if (tagFilter !== "all" && !(task.tags || []).includes(tagFilter)) return false
      if (!normalizedQuery) return true

      const haystack = [task.title, task.note, ...(task.subtasks || []).map((item) => item.title)]
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })

    const sorted = filtered.slice()
    if (sortMode === "title") {
      sorted.sort((left, right) => left.title.localeCompare(right.title, "zh-CN"))
    } else if (sortMode === "priority") {
      const rank = { high: 0, medium: 1, low: 2 }
      sorted.sort((left, right) => {
        const byPriority = (rank[left.priority] ?? 9) - (rank[right.priority] ?? 9)
        if (byPriority !== 0) return byPriority
        return `${left.date} ${left.time || "23:59"}`.localeCompare(`${right.date} ${right.time || "23:59"}`)
      })
    } else {
      sorted.sort((left, right) => `${left.date} ${left.time || "23:59"}`.localeCompare(`${right.date} ${right.time || "23:59"}`))
    }

    return sorted
  }, [baseViewTasks, searchQuery, sortMode, statusFilter, tagFilter])

  const sections = useMemo(() => buildSections(viewTasks, planner.today), [planner.today, viewTasks])
  const recommendedTasks = useMemo(
    () =>
      planner.tasks
        .filter(
          (task) =>
            !task.completed &&
            task.date !== planner.today &&
            (task.starred || task.priority === "high" || (task.date && toDateNumber(task.date) < toDateNumber(planner.today)))
        )
        .slice(0, 3),
    [planner.tasks, planner.today]
  )
  const activeTask =
    viewTasks.find((task) => task.id === planner.selectedTask?.id) || viewTasks[0] || null

  useEffect(() => {
    if (!focusSession) {
      document.title = pageTitle
      return undefined
    }

    const updateTitle = () => {
      const elapsedMinutes = Math.max(0, Math.floor((Date.now() - focusSession.startedAt) / 60000))
      document.title = `${elapsedMinutes} 分钟专注中 - Pulse Planner`
    }

    updateTitle()
    const timer = window.setInterval(updateTitle, 30000)
    return () => {
      window.clearInterval(timer)
      document.title = pageTitle
    }
  }, [focusSession, pageTitle])

  useEffect(() => {
    if (viewTasks.length === 0) {
      if (planner.selectedTask?.id) {
        planner.actions.setSelectedTask(null)
      }
      return
    }

    const selectedStillVisible = planner.selectedTask?.id
      ? viewTasks.some((task) => task.id === planner.selectedTask.id)
      : false

    if ((!planner.selectedTask?.id || !selectedStillVisible) && activeTask?.id) {
      planner.actions.setSelectedTask(activeTask.id)
    }
  }, [activeTask?.id, planner.actions, planner.selectedTask?.id, viewTasks])

  function handleSelectView(view) {
    setActiveView(view)
    setSearchQuery("")
    setStatusFilter("all")
    setTagFilter("all")
    const nextTasks = getViewTasks(view, planner)
    planner.actions.setSelectedTask(nextTasks[0]?.id ?? null)
  }

  function handleAddTask(event) {
    event.preventDefault()
    if (!quickTitle.trim()) {
      return
    }

    planner.actions.addTask(
      parseQuickTaskInput(quickTitle, {
        today: planner.today,
        activeView,
        lists: planner.lists,
        tags: planner.tags,
      })
    )
    setQuickTitle("")
  }

  function handlePlanToday(task) {
    planner.actions.updateTask(task.id, taskToUpdatePayload(task, { date: planner.today }))
    handleSelectView({ kind: "smart", id: "today" })
  }

  function handleStartFocus(task) {
    setFocusSession({ taskId: task.id, startedAt: Date.now(), title: task.title })
  }

  async function handleSyncToNotion() {
    const databaseId = notionDatabaseId.trim()
    if (!databaseId) {
      setNotionSyncStatus("先填写 Notion database id")
      return
    }

    window.localStorage.setItem("pulse-planner-notion-database-id", databaseId)
    setNotionSyncStatus("同步中...")

    try {
      const response = await fetch("/api/notion/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          databaseId,
          tasks: planner.tasks,
          lists: planner.lists,
          tags: planner.tags,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Notion sync failed")
      }

      setNotionSyncStatus(`已同步 ${result.synced.length} 条任务`)
    } catch (error) {
      setNotionSyncStatus(error.message)
    }
  }

  function toggleSection(sectionId) {
    setCollapsedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  function toggleSidebarSection(sectionId) {
    setCollapsedSidebar((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  function resetToolbarState() {
    setSearchQuery("")
    setSortMode("time")
    setStatusFilter("all")
    setTagFilter("all")
  }

  const sortLabel = sortMode === "time" ? "时间" : sortMode === "priority" ? "优先级" : "标题"
  const filterLabel =
    statusFilter === "all" ? "全部" : statusFilter === "pending" ? "待处理" : statusFilter === "starred" ? "重要" : "已完成"
  const activeTagLabel = tagFilter === "all" ? "全部标签" : planner.tags.find((item) => item.id === tagFilter)?.name || "全部标签"
  const toolbarDirty = searchQuery || sortMode !== "time" || statusFilter !== "all" || tagFilter !== "all"
  const completionPercent = planner.stats.total
    ? Math.round((planner.stats.completed / planner.stats.total) * 100)
    : 0

  return (
    <main className="spa-shell">
      <ActionToast feedback={planner.feedback} onDismiss={planner.actions.clearFeedback} />

      <section className={`spa-frame spa-frame-${frameMode}`}>
        <aside className="spa-rail">
          <div className="spa-rail-stack">
            {RAIL_ITEMS.map((item) => (
              <a
                key={item.id}
                className={`spa-rail-btn ${pageId === item.id ? "is-active" : ""}`}
                href={item.href}
                aria-label={item.label}
              >
                <GlyphIcon name={item.icon} />
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </aside>

        {isTaskPage ? (
        <aside className="spa-sidebar">
          <section className="spa-progress-card">
            <span>今日进度</span>
            <strong>{completionPercent}%</strong>
            <div className="spa-progress-track">
              <span style={{ width: `${completionPercent}%` }} />
            </div>
            <p>{planner.stats.pending} 项待处理，{planner.stats.completed} 项已完成</p>
          </section>

          <section className="spa-sidebar-block">
            <button className="spa-sidebar-header" type="button" onClick={() => toggleSidebarSection("smart")}>
              <span>智能清单</span>
              <strong>{collapsedSidebar.smart ? "+" : "−"}</strong>
            </button>
            {!collapsedSidebar.smart ? (
              <>
                <button
                  className={`spa-sidebar-item ${activeView.kind === "smart" && activeView.id === "today" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => handleSelectView({ kind: "smart", id: "today" })}
                >
                  <span className="spa-sidebar-item-label">
                    <GlyphIcon name={SMART_VIEW_META.today.icon} />
                    <em>{SMART_VIEW_META.today.label}</em>
                  </span>
                  <strong>{planner.smartListTasks("today").length}</strong>
                </button>
                <button
                  className={`spa-sidebar-item ${activeView.kind === "smart" && activeView.id === "next7" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => handleSelectView({ kind: "smart", id: "next7" })}
                >
                  <span className="spa-sidebar-item-label">
                    <GlyphIcon name={SMART_VIEW_META.next7.icon} />
                    <em>{SMART_VIEW_META.next7.label}</em>
                  </span>
                  <strong>{planner.smartListTasks("next7").length}</strong>
                </button>
                <button
                  className={`spa-sidebar-item ${activeView.kind === "smart" && activeView.id === "inbox" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => handleSelectView({ kind: "smart", id: "inbox" })}
                >
                  <span className="spa-sidebar-item-label">
                    <GlyphIcon name={SMART_VIEW_META.inbox.icon} />
                    <em>{SMART_VIEW_META.inbox.label}</em>
                  </span>
                  <strong>{planner.smartListTasks("inbox").length}</strong>
                </button>
                <button
                  className={`spa-sidebar-item ${activeView.kind === "smart" && activeView.id === "summary" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => handleSelectView({ kind: "smart", id: "summary" })}
                >
                  <span className="spa-sidebar-item-label">
                    <GlyphIcon name={SMART_VIEW_META.summary.icon} />
                    <em>{SMART_VIEW_META.summary.label}</em>
                  </span>
                  <strong>{planner.tasks.length}</strong>
                </button>
              </>
            ) : null}
          </section>

          <section className="spa-sidebar-block">
            <button className="spa-sidebar-header" type="button" onClick={() => toggleSidebarSection("projects")}>
              <span>清单</span>
              <strong>{collapsedSidebar.projects ? "+" : "−"}</strong>
            </button>
            {!collapsedSidebar.projects
              ? planner.lists
                  .filter((list) => list.type === "project")
                  .map((list) => (
                    <button
                      key={list.id}
                      className={`spa-sidebar-item ${activeView.kind === "project" && activeView.id === list.id ? "is-active" : ""}`}
                      type="button"
                      onClick={() => handleSelectView({ kind: "project", id: list.id })}
                    >
                      <span className="spa-sidebar-item-label">
                        <GlyphIcon name={PROJECT_VIEW_ICONS[list.id] || "dot"} />
                        <em>{list.name}</em>
                      </span>
                      <strong>{planner.tasksByList(list.id).length}</strong>
                    </button>
                  ))
              : null}
          </section>

          <section className="spa-sidebar-block spa-sidebar-block-muted">
            <button className="spa-sidebar-header" type="button" onClick={() => toggleSidebarSection("utility")}>
              <span>归档</span>
              <strong>{collapsedSidebar.utility ? "+" : "−"}</strong>
            </button>
            {!collapsedSidebar.utility ? (
              <>
                <button
                  className={`spa-sidebar-item ${activeView.kind === "smart" && activeView.id === "summary" && statusFilter === "completed" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => {
                    handleSelectView({ kind: "smart", id: "summary" })
                    setStatusFilter("completed")
                  }}
                >
                  <span className="spa-sidebar-item-label">
                    <GlyphIcon name="check-circle" />
                    <em>已完成</em>
                  </span>
                  <strong>{planner.stats.completed}</strong>
                </button>
              </>
            ) : null}
          </section>
        </aside>
        ) : null}

        <section className={`spa-center ${pageId === "calendar" ? "spa-center-calendar" : ""}`}>
          {pageId === "calendar" ? (
            <CalendarWorkspace
              activeTaskId={planner.selectedTask?.id}
              tasks={planner.tasks}
              today={planner.today}
              onSelectTask={planner.actions.setSelectedTask}
              onToggleTask={planner.actions.toggleTask}
            />
          ) : null}
          {pageId === "profile" ? (
            <ProfileWorkspace
              planner={planner}
              notionDatabaseId={notionDatabaseId}
              notionSyncStatus={notionSyncStatus}
              onDatabaseIdChange={setNotionDatabaseId}
              onResetDemo={planner.actions.resetDemo}
              onResetFilters={resetToolbarState}
              onSyncToNotion={handleSyncToNotion}
            />
          ) : null}
          {isTaskPage ? (
          <>
          <header className="spa-center-head">
            <div className="spa-center-title">
              <p>快速收集，按清单推进</p>
              <h1>{getViewTitle(activeView, planner.lists)}</h1>
              <span>{viewTasks.length} 项任务可见，{planner.stats.pending} 项待处理</span>
            </div>
            <button className="spa-new-task-btn" type="button" onClick={() => quickInputRef.current?.focus()}>
              <GlyphIcon name="plus-circle" />
              <span>新建任务</span>
            </button>
          </header>

          <div className="spa-center-tools">
            <button
              className={`spa-chip-btn ${searchOpen ? "is-active" : ""}`}
              type="button"
              onClick={() => setSearchOpen((value) => !value)}
            >
              <GlyphIcon name="search" />
              <span>搜索</span>
            </button>
            <label className="spa-tool-select">
              <GlyphIcon name="sort" />
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                <option value="time">按时间</option>
                <option value="priority">按优先级</option>
                <option value="title">按标题</option>
              </select>
            </label>
            <label className="spa-tool-select">
              <GlyphIcon name="filter" />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="starred">仅重要</option>
                <option value="completed">已完成</option>
              </select>
            </label>
            <label className="spa-tool-select">
              <GlyphIcon name="tag" />
              <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
                <option value="all">全部标签</option>
                {planner.tags.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {toolbarDirty ? (
              <button className="spa-chip-btn" type="button" onClick={resetToolbarState}>
                <GlyphIcon name="close-circle" />
                <span>重置</span>
              </button>
            ) : null}
          </div>

          <div className="spa-view-switcher" aria-label="视图切换">
            {["list", "kanban", "calendar"].map((mode) => (
              <button
                className={viewMode === mode ? "is-active" : ""}
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
              >
                {mode === "list" ? "列表" : mode === "kanban" ? "看板" : "日历"}
              </button>
            ))}
          </div>

          <div className="spa-toolbar-row">
            <div className="spa-center-tools">
              <button
                className={activeView.kind === "smart" && activeView.id === "summary" && statusFilter === "all" ? "spa-filter-pill is-active" : "spa-filter-pill"}
                type="button"
                onClick={() => {
                  handleSelectView({ kind: "smart", id: "summary" })
                  setStatusFilter("all")
                }}
              >
                全部任务
              </button>
              <button className={activeView.kind === "project" && activeView.id === "work" ? "spa-filter-pill is-active" : "spa-filter-pill"} type="button" onClick={() => handleSelectView({ kind: "project", id: "work" })}>工作</button>
              <button className={activeView.kind === "project" && activeView.id === "personal" ? "spa-filter-pill is-active" : "spa-filter-pill"} type="button" onClick={() => handleSelectView({ kind: "project", id: "personal" })}>个人</button>
              <button className={statusFilter === "starred" ? "spa-filter-pill is-active" : "spa-filter-pill"} type="button" onClick={() => setStatusFilter("starred")}>重要</button>
            </div>
          </div>

          {searchOpen ? (
            <label className="spa-toolbar-search">
              <GlyphIcon name="search" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="搜索任务、备注或检查项"
              />
            </label>
          ) : null}

          <div className="spa-toolbar-meta">
            <span>{viewTasks.length} 项任务</span>
            <span>排序: {sortLabel}</span>
            {statusFilter !== "all" ? <span>状态: {filterLabel}</span> : null}
            {tagFilter !== "all" ? <span>标签: {activeTagLabel}</span> : null}
            {searchQuery ? <span>关键词: {searchQuery}</span> : null}
          </div>

          <form className="spa-inline-add" onSubmit={handleAddTask}>
            <span>＋</span>
            <input
              ref={quickInputRef}
              value={quickTitle}
              onChange={(event) => setQuickTitle(event.target.value)}
              placeholder="添加任务，可输入：明天 09:30 !高 #会议 ~工作系统"
            />
          </form>

          {activeView.kind === "smart" && activeView.id === "today" && recommendedTasks.length ? (
            <section className="spa-recommend-panel">
              <div>
                <strong>推荐加入今天</strong>
                <span>来自高优先级、重要或已过期任务</span>
              </div>
              <div>
                {recommendedTasks.map((task) => (
                  <button key={task.id} type="button" onClick={() => handlePlanToday(task)}>
                    {task.title}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {viewMode === "calendar" ? (
            <CalendarTaskView
              activeTaskId={activeTask?.id}
              tasks={viewTasks}
              today={planner.today}
              onSelectTask={planner.actions.setSelectedTask}
              onToggleTask={planner.actions.toggleTask}
            />
          ) : (
            <div className={`spa-task-sections view-${viewMode}`}>
              {sections.length ? (
                sections.map((section) => (
                  <section className="spa-task-group" key={section.id}>
                    <button className="spa-task-group-head" type="button" onClick={() => toggleSection(section.id)}>
                      <div>
                        <span className={`spa-task-group-caret ${collapsedSections[section.id] ? "is-collapsed" : ""}`}>⌄</span>
                        <strong>{section.label}</strong>
                      </div>
                      <span>{section.tasks.length}</span>
                    </button>

                    {!collapsedSections[section.id] ? (
                      <div className="spa-task-lines">
                        {section.tasks.map((task) => {
                          const taskList = getListMeta(task.listId)
                          const taskTag = getTaskTags(task)[0]
                          return (
                            <article className={`spa-task-line priority-${task.priority} ${activeTask?.id === task.id ? "is-active" : ""}`} key={task.id}>
                              <button
                                className="spa-task-open"
                                type="button"
                                onClick={() => planner.actions.setSelectedTask(task.id)}
                              >
                                <span className="spa-task-avatar">
                                  <GlyphIcon name={task.subtasks?.length ? "note" : "check-circle"} />
                                </span>
                                <span className="spa-task-body">
                                  <span className="spa-task-kicker">
                                    <em>{taskTag?.name || taskList.name}</em>
                                    <time>{task.time || "全天"}</time>
                                  </span>
                                  <strong className={task.completed ? "is-done" : ""}>{task.title}</strong>
                                  {task.note ? <span>{task.note}</span> : null}
                                </span>
                              </button>
                              <span className="spa-task-status">
                                {task.completed ? "已完成" : priorityLabel(task.priority)}
                              </span>
                              <button
                                className={`spa-task-check ${task.completed ? "is-done" : ""}`}
                                type="button"
                                aria-label="切换完成状态"
                                onClick={() => planner.actions.toggleTask(task.id)}
                              />
                            </article>
                          )
                        })}
                      </div>
                    ) : null}
                  </section>
                ))
              ) : (
                <div className="spa-empty">这个视图里还没有任务，先在上方快速加一条吧。</div>
              )}
            </div>
          )}
          </>
          ) : null}
        </section>

        {isTaskPage ? (
          <TaskInspectorPanel
            key={activeTask?.id ?? "empty-task"}
            task={activeTask}
            today={planner.today}
            lists={planner.lists}
            tags={planner.tags}
            onToggleTask={planner.actions.toggleTask}
            onToggleStar={planner.actions.toggleStar}
            onDeleteTask={planner.actions.deleteTask}
            onToggleSubtask={planner.actions.toggleSubtask}
            onAddSubtask={planner.actions.addSubtask}
            onRemoveSubtask={planner.actions.removeSubtask}
            onTogglePersistentReminder={planner.actions.togglePersistentReminder}
            onUpdateTask={planner.actions.updateTask}
            onStartFocus={handleStartFocus}
            focusSession={focusSession}
            tasks={planner.tasks}
          />
        ) : null}
      </section>
    </main>
  )
}

function CalendarTaskView({ activeTaskId, tasks, today, onSelectTask, onToggleTask }) {
  const days = buildCalendarDays(tasks, today)
  const monthNumber = Number(today.slice(5, 7))
  const weekLabels = ["日", "一", "二", "三", "四", "五", "六"]

  return (
    <div className="spa-calendar-view">
      <header className="spa-calendar-toolbar">
        <div>
          <GlyphIcon name="calendar-grid" />
          <strong>{monthNumber}月</strong>
        </div>
        <div>
          <button type="button" aria-label="新建日程">
            <GlyphIcon name="plus-circle" />
          </button>
          <button type="button">月</button>
          <button type="button">今天</button>
        </div>
      </header>
      <div className="spa-calendar-weekdays">
        {weekLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="spa-calendar-grid">
        {days.map((day) => (
          <section className={`spa-calendar-day ${day.inMonth ? "" : "is-muted"} ${day.isToday ? "is-today" : ""}`} key={day.date}>
            <strong>{day.dayNumber}</strong>
            <div className="spa-calendar-events">
              {day.tasks.map((task) => (
                <article className={`spa-calendar-event priority-${task.priority} ${activeTaskId === task.id ? "is-active" : ""}`} key={task.id}>
                  <button type="button" onClick={() => onSelectTask(task.id)}>
                    <strong className={task.completed ? "is-done" : ""}>{task.title}</strong>
                  </button>
                  <button
                    className={`spa-task-check ${task.completed ? "is-done" : ""}`}
                    type="button"
                    aria-label="切换完成状态"
                    onClick={() => onToggleTask(task.id)}
                  />
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function CalendarWorkspace({ activeTaskId, tasks, today, onSelectTask, onToggleTask }) {
  const incompleteTasks = tasks.filter((task) => !task.completed)

  return (
    <section className="spa-calendar-workspace">
      <CalendarTaskView
        activeTaskId={activeTaskId}
        tasks={incompleteTasks}
        today={today}
        onSelectTask={onSelectTask}
        onToggleTask={onToggleTask}
      />
    </section>
  )
}

function ProfileWorkspace({
  planner,
  notionDatabaseId,
  notionSyncStatus,
  onDatabaseIdChange,
  onResetDemo,
  onResetFilters,
  onSyncToNotion,
}) {
  const [focusDraft, setFocusDraft] = useState(() => planner.focus)

  return (
    <div className="spa-profile-page">
      <StatsWorkspace planner={planner} />
      <section className="spa-module-page">
        <header>
          <p>我的</p>
          <h1>今日提醒</h1>
        </header>
        <div className="spa-settings-panel">
          <label>
            <span>聚焦语句</span>
            <input
              value={focusDraft}
              onChange={(event) => setFocusDraft(event.target.value)}
              placeholder="写一句今天想提醒自己的话"
            />
          </label>
          <div className="spa-settings-actions">
            <button
              className="spa-primary-btn"
              type="button"
              onClick={() => planner.actions.updateFocus(focusDraft.trim() || planner.focus)}
            >
              保存提醒
            </button>
          </div>
          <p>{planner.focus}</p>
        </div>
      </section>
      <SettingsWorkspace
        notionDatabaseId={notionDatabaseId}
        notionSyncStatus={notionSyncStatus}
        onDatabaseIdChange={onDatabaseIdChange}
        onResetDemo={onResetDemo}
        onResetFilters={onResetFilters}
        onSyncToNotion={onSyncToNotion}
      />
    </div>
  )
}

function StatsWorkspace({ planner }) {
  const completionRate = planner.stats.total ? Math.round((planner.stats.completed / planner.stats.total) * 100) : 0
  const highPriority = planner.tasks.filter((task) => task.priority === "high" && !task.completed).length

  return (
    <section className="spa-module-page">
      <header>
        <p>统计</p>
        <h1>任务概览</h1>
      </header>
      <div className="spa-stats-grid">
        <article>
          <span>总任务</span>
          <strong>{planner.stats.total}</strong>
        </article>
        <article>
          <span>待处理</span>
          <strong>{planner.stats.pending}</strong>
        </article>
        <article>
          <span>已完成</span>
          <strong>{planner.stats.completed}</strong>
        </article>
        <article>
          <span>完成率</span>
          <strong>{completionRate}%</strong>
        </article>
      </div>
      <div className="spa-stats-panel">
        <h2>优先处理</h2>
        <p>{highPriority} 项高优先级任务还未完成，今天有 {planner.stats.today} 项任务。</p>
      </div>
    </section>
  )
}

function SettingsWorkspace({
  notionDatabaseId,
  notionSyncStatus,
  onDatabaseIdChange,
  onResetDemo,
  onResetFilters,
  onSyncToNotion,
}) {
  return (
    <section className="spa-module-page">
      <header>
        <p>设置</p>
        <h1>同步与数据</h1>
      </header>
      <div className="spa-settings-panel">
        <label>
          <span>Notion database id</span>
          <input
            value={notionDatabaseId}
            onChange={(event) => onDatabaseIdChange(event.target.value)}
            placeholder="粘贴 Notion database id"
          />
        </label>
        <div className="spa-settings-actions">
          <button className="spa-primary-btn" type="button" onClick={onSyncToNotion}>
            同步到 Notion
          </button>
          <button className="spa-secondary-btn" type="button" onClick={onResetFilters}>
            清除筛选
          </button>
          <button className="spa-secondary-btn" type="button" onClick={onResetDemo}>
            恢复示例数据
          </button>
        </div>
        {notionSyncStatus ? <p>{notionSyncStatus}</p> : null}
      </div>
    </section>
  )
}

function TaskInspectorPanel({
  task,
  today,
  lists,
  tags,
  tasks,
  onToggleTask,
  onToggleStar,
  onDeleteTask,
  onToggleSubtask,
  onAddSubtask,
  onRemoveSubtask,
  onTogglePersistentReminder,
  onUpdateTask,
  onStartFocus,
  focusSession,
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => createTaskForm(task))
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("")

  if (!task || !form) {
    return (
      <aside className="spa-inspector spa-inspector-empty">
        <div>
          <p className="spa-detail-meta">选择一条任务</p>
          <h2>右侧会显示任务详情</h2>
          <p>你可以在这里查看备注、勾选检查项，或者直接编辑任务信息。</p>
        </div>
      </aside>
    )
  }

  const list = getListMeta(task.listId)
  const taskTags = getTaskTags(task)
  const parentTask = tasks.find((item) => item.id === task.parentId)
  const completedSubtasks = (task.subtasks || []).filter((item) => item.completed).length
  const detailDate =
    task.date === today
      ? `今天, ${task.time || "全天"}${task.endTime ? `-${task.endTime}` : ""}`
      : `${task.date}, ${task.time || "全天"}${task.endTime ? `-${task.endTime}` : ""}`

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleToggleEditing() {
    if (editing) {
      setForm(createTaskForm(task))
      setEditing(false)
      return
    }

    setForm(createTaskForm(task))
    setEditing(true)
  }

  function handleSave(event) {
    event.preventDefault()
    onUpdateTask(task.id, { ...form, subtasks: task.subtasks || [] })
    setEditing(false)
  }

  function handleAddSubtask(event) {
    event.preventDefault()
    if (!newSubtaskTitle.trim()) {
      return
    }

    onAddSubtask(task.id, newSubtaskTitle)
    setNewSubtaskTitle("")
  }

  return (
    <aside className="spa-inspector">
      <div className="spa-detail-head">
        <div>
          <p className="spa-detail-meta">
            <GlyphIcon name="calendar-mini" />
            <span>{detailDate}</span>
          </p>
          <h2>{editing ? "编辑任务" : task.title}</h2>
        </div>
        <div className="spa-detail-actions">
          <button className="spa-chip-btn" type="button" onClick={() => onToggleStar(task.id)}>
            <GlyphIcon name={task.starred ? "star-fill" : "star"} />
          </button>
          <button className="spa-chip-btn" type="button" onClick={handleToggleEditing}>
            <GlyphIcon name="edit" />
            <span>{editing ? "取消" : "编辑"}</span>
          </button>
        </div>
      </div>

      {editing ? (
        <form className="spa-detail-form" onSubmit={handleSave}>
          <label>
            <span>任务标题</span>
            <input value={form.title} onChange={(event) => updateField("title", event.target.value)} required />
          </label>
          <label>
            <span>备注</span>
            <textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} />
          </label>
          <div className="spa-detail-grid">
            <label>
              <span>日期</span>
              <input type="date" value={form.date} onChange={(event) => updateField("date", event.target.value)} />
            </label>
            <label>
              <span>时间</span>
              <input type="time" value={form.time} onChange={(event) => updateField("time", event.target.value)} />
            </label>
            <label>
              <span>结束时间</span>
              <input type="time" value={form.endTime} onChange={(event) => updateField("endTime", event.target.value)} />
            </label>
          </div>
          <div className="spa-detail-grid">
            <label>
              <span>清单</span>
              <select value={form.listId} onChange={(event) => updateField("listId", event.target.value)}>
                {lists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>标签</span>
              <select value={form.tag} onChange={(event) => updateField("tag", event.target.value)}>
                <option value="">无标签</option>
                {tags.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="spa-detail-grid">
            <label>
              <span>优先级</span>
              <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
                <option value="low">低优先级</option>
                <option value="medium">中优先级</option>
                <option value="high">高优先级</option>
              </select>
            </label>
            <label>
              <span>关联主任务</span>
              <select value={form.parentId} onChange={(event) => updateField("parentId", event.target.value)}>
                <option value="">无关联</option>
                {tasks
                  .filter((item) => item.id !== task.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label className="spa-detail-check">
            <input
              checked={form.persistentReminder}
              type="checkbox"
              onChange={(event) => updateField("persistentReminder", event.target.checked)}
            />
            <span>持续提醒</span>
          </label>
          <button className="spa-primary-btn" type="submit">
            保存修改
          </button>
        </form>
      ) : (
        <>
          <div className="spa-detail-card">
            <p>{task.note || "这条任务还没有补充备注。你可以补充执行细节或准备清单。"}</p>
            <div className="spa-tag-row">
              <span className="spa-meta-pill">{list.name}</span>
              <span className="spa-meta-pill">{priorityLabel(task.priority)}</span>
              {task.persistentReminder ? <span className="spa-meta-pill">持续提醒</span> : null}
              {parentTask ? <span className="spa-meta-pill">主任务: {parentTask.title}</span> : null}
              {taskTags.map((item) => (
                <span className="spa-meta-pill" key={item.id}>
                  {item.name}
                </span>
              ))}
            </div>
          </div>

          <section className="spa-checklist">
            <div className="spa-checklist-head">
              <strong>检查项</strong>
              <span>
                {completedSubtasks}/{(task.subtasks || []).length || 0}
              </span>
            </div>
            {(task.subtasks || []).length ? (
              <div className="spa-checklist-list">
                {task.subtasks.map((item) => (
                  <div className={`spa-checklist-item ${item.completed ? "is-done" : ""}`} key={item.id}>
                    <button
                      className="spa-checklist-toggle"
                      type="button"
                      onClick={() => onToggleSubtask(task.id, item.id)}
                    >
                      <span className={`spa-task-check ${item.completed ? "is-done" : ""}`} />
                      <strong>{item.title}</strong>
                    </button>
                    <button className="spa-checklist-remove" type="button" onClick={() => onRemoveSubtask(task.id, item.id)}>
                      <GlyphIcon name="trash" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="spa-empty-inline">这条任务还没有拆分检查项。</div>
            )}
            <form className="spa-checklist-add" onSubmit={handleAddSubtask}>
              <input
                value={newSubtaskTitle}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                placeholder="新增检查项"
              />
              <button className="spa-secondary-btn" type="submit">
                添加
              </button>
            </form>
          </section>

          <div className="spa-detail-foot">
            <button className="spa-primary-btn" type="button" onClick={() => onToggleTask(task.id)}>
              {task.completed ? "标记未完成" : "标记完成"}
            </button>
            <button className="spa-secondary-btn" type="button" onClick={() => onTogglePersistentReminder(task.id)}>
              {task.persistentReminder ? "关闭持续提醒" : "持续提醒"}
            </button>
            <button className="spa-secondary-btn" type="button" onClick={() => onStartFocus(task)}>
              {focusSession?.taskId === task.id ? "专注中" : "开始专注"}
            </button>
            <button className="spa-secondary-btn" type="button" onClick={() => onDeleteTask(task.id)}>
              删除任务
            </button>
          </div>
          <div className="spa-detail-list-link">
            <GlyphIcon name="inbox" />
            <span>{list.name}</span>
          </div>
        </>
      )}
    </aside>
  )
}

function GlyphIcon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  }

  switch (name) {
    case "spark-check":
      return (
        <svg {...common}>
          <path d="M12 4a7 7 0 1 0 7 7" />
          <path d="m10 12 2 2 7-7" />
          <path d="M18 4v3" />
          <path d="M16.5 5.5h3" />
        </svg>
      )
    case "check-square":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <path d="m8.5 12 2.4 2.4 4.6-5.3" />
        </svg>
      )
    case "calendar-grid":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16M9 14h.01M15 14h.01M9 18h.01M15 18h.01" />
        </svg>
      )
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-4.2-4.2" />
        </svg>
      )
    case "help":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.8-1.7 1.3-1.7 2.7" />
          <path d="M12 17h.01" />
        </svg>
      )
    case "today":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="4" />
          <path d="M8 3v4M16 3v4M9 13h6" />
        </svg>
      )
    case "recent":
      return (
        <svg {...common}>
          <rect x="4" y="5" width="16" height="15" rx="4" />
          <path d="M8 3v4M16 3v4M8 14h8M8 18h5" />
        </svg>
      )
    case "inbox":
      return (
        <svg {...common}>
          <path d="M4 12.5 6.5 6h11L20 12.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
          <path d="M4 13h4l2 3h4l2-3h4" />
        </svg>
      )
    case "summary":
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="16" rx="4" />
          <path d="M8.5 9h7M8.5 13h7M8.5 17h4" />
        </svg>
      )
    case "briefcase":
      return (
        <svg {...common}>
          <path d="M9 6V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <rect x="4" y="6" width="16" height="13" rx="3" />
          <path d="M4 11h16" />
        </svg>
      )
    case "home":
      return (
        <svg {...common}>
          <path d="m4 11 8-7 8 7" />
          <path d="M7 10.5V20h10v-9.5" />
        </svg>
      )
    case "leaf":
      return (
        <svg {...common}>
          <path d="M18 4c-6 .5-10.5 5-11 11 6-.5 10.5-5 11-11Z" />
          <path d="M6 18c2-2 4.5-3.5 8-5" />
        </svg>
      )
    case "sparkles":
      return (
        <svg {...common}>
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z" />
          <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z" />
        </svg>
      )
    case "check-circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12 2.2 2.2 4.8-5.2" />
        </svg>
      )
    case "trash":
      return (
        <svg {...common}>
          <path d="M5 7h14" />
          <path d="M9 7V5h6v2" />
          <path d="M8 7v12h8V7" />
        </svg>
      )
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16M8 12h12M11 17h9" />
        </svg>
      )
    case "sort":
      return (
        <svg {...common}>
          <path d="M8 5v14M8 19l-3-3M8 19l3-3M16 19V5M16 5l-3 3M16 5l3 3" />
        </svg>
      )
    case "more":
      return (
        <svg {...common}>
          <path d="M6 12h.01M12 12h.01M18 12h.01" />
        </svg>
      )
    case "note":
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="16" rx="4" />
          <path d="M8.5 9h7M8.5 13h7M8.5 17h4" />
        </svg>
      )
    case "calendar-mini":
      return (
        <svg {...common} width="16" height="16">
          <rect x="4" y="5" width="16" height="15" rx="3" />
          <path d="M8 3v4M16 3v4M4 10h16" />
        </svg>
      )
    case "star":
      return (
        <svg {...common}>
          <path d="m12 4 2.5 5 5.5.8-4 3.9.9 5.3-4.9-2.6-4.9 2.6.9-5.3-4-3.9 5.5-.8Z" />
        </svg>
      )
    case "star-fill":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="m12 4 2.5 5 5.5.8-4 3.9.9 5.3-4.9-2.6-4.9 2.6.9-5.3-4-3.9 5.5-.8Z" />
        </svg>
      )
    case "edit":
      return (
        <svg {...common}>
          <path d="m4 20 4.5-1 9-9-3.5-3.5-9 9Z" />
          <path d="m13 6 3.5 3.5" />
        </svg>
      )
    case "filter":
      return (
        <svg {...common}>
          <path d="M4 6h16" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </svg>
      )
    case "tag":
      return (
        <svg {...common}>
          <path d="M11 4H6a2 2 0 0 0-2 2v5l8 9 8-8-9-8Z" />
          <circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      )
    case "close-circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </svg>
      )
    case "plus-circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      )
    case "dot":
      return (
        <svg {...common} width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="4" fill="currentColor" stroke="none" />
        </svg>
      )
    default:
      return null
  }
}
