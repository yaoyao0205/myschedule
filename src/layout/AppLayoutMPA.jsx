import { useMemo } from "react"
import { ActionToast } from "../components/ActionToast"
import { DetailPanel } from "../components/DetailPanel"
import { ExpansionPanel } from "../components/ExpansionPanel"
import { ProgressPanel } from "../components/ProgressPanel"
import { QuickAddPanel } from "../components/QuickAddPanel"
import { SidebarMPA } from "../components/SidebarMPA"
import { PLANNER_STORAGE_KEY, usePlanner } from "../store/plannerStore"

function getTodayLabel(today) {
  const date = new Date(`${today}T00:00:00`)
  return {
    day: String(date.getDate()).padStart(2, "0"),
    date: today,
    weekday: date.toLocaleDateString("en-US", { weekday: "long" }),
  }
}

export function AppLayoutMPA({ pageId, children }) {
  const planner = usePlanner()
  const todayLabel = useMemo(() => getTodayLabel(planner.today), [planner.today])

  function applySidebarFilters(nextFilters, href) {
    const filters = {
      status: "all",
      tag: "all",
      listId: "all",
      ...nextFilters,
    }

    planner.actions.setFilters(filters)

    if (!href) {
      return
    }

    const nextState = {
      ...planner.state,
      ui: {
        ...planner.state.ui,
        filters,
      },
    }

    localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(nextState))

    const nextPath = new URL(href, window.location.href).pathname
    if (window.location.pathname !== nextPath) {
      window.location.assign(href)
    }
  }

  return (
    <main className="app-shell">
      <ActionToast feedback={planner.feedback} onDismiss={planner.actions.clearFeedback} />
      <section className="app-grid">
        <SidebarMPA
          pageId={pageId}
          filters={planner.filters}
          smartLists={planner.smartLists}
          smartListTasks={planner.smartListTasks}
          lists={planner.lists}
          tags={planner.tags}
          countTasksByTag={planner.countTasksByTag}
          sidebarGroups={planner.sidebarGroups}
          onToggleGroup={planner.actions.toggleSidebarGroup}
          tasksByList={planner.tasksByList}
          onApplyFilters={applySidebarFilters}
        />

        <section className="main-panel">{children({ planner, todayLabel })}</section>

        <aside className="aux-panel">
          <QuickAddPanel lists={planner.lists} tags={planner.tags} onAddTask={planner.actions.addTask} />
          {pageId === "profile" ? (
            <ExpansionPanel />
          ) : (
            <ProgressPanel lists={planner.lists} tasksByList={planner.tasksByList} />
          )}
          <DetailPanel
            key={planner.selectedTask?.id ?? "empty-task"}
            task={planner.selectedTask}
            lists={planner.lists}
            tags={planner.tags}
            onClose={() => planner.actions.setSelectedTask(null)}
            onToggle={planner.actions.toggleTask}
            onStar={planner.actions.toggleStar}
            onUpdate={planner.actions.updateTask}
          />
        </aside>
      </section>
      <p className="footer-note">这版是多入口多页面 React 应用，每个页面都有独立入口和真实 URL。</p>
    </main>
  )
}
