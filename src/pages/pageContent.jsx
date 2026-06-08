import { FilterBar } from "../components/FilterBar"
import { PageHero } from "../components/PageHero"
import { TaskCard } from "../components/TaskCard"
import { ActiveFilterSummary } from "../components/ActiveFilterSummary"
import { addDays } from "../utils/plannerUtils"

export function TodayContent({ planner, todayLabel }) {
  const todayTasks = planner.filteredTasks(planner.tasksForDate(planner.today))
  const upcomingTasks = planner.filteredTasks(
    planner.tasks.filter((task) => task.date >= planner.today && !task.completed).slice(0, 8)
  )

  return (
    <>
      <PageHero
        eyebrow="Today Focus"
        title="像清单工具一样高密度，又保留日程视角。"
        copy="参考滴答清单的信息架构，我们把总览页聚焦在 Today、Next 7 Days、Inbox 这些高频入口上，同时保留你自己的任务项目分组。"
        stats={planner.stats}
        todayLabel={todayLabel}
        onAddTask={() => document.querySelector("#quick-form-panel")?.scrollIntoView({ behavior: "smooth" })}
        onReset={planner.actions.resetDemo}
      />

      <section className="glass-card main-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Today Queue</p>
            <h2>今天的任务</h2>
          </div>
          <div className="section-meta">
            {planner.today} · {todayTasks.length} 项安排
          </div>
        </div>
        <FilterBar
          filters={planner.filters}
          tags={planner.tags}
          lists={planner.lists}
          onStatusChange={(value) => planner.actions.setFilter("status", value)}
          onTagChange={(value) => planner.actions.setFilter("tag", value)}
          onListChange={(value) => planner.actions.setFilter("listId", value)}
        />
        <div className="task-list">
          {todayTasks.length ? (
            todayTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                selected={planner.selectedTask?.id === task.id}
                onToggle={planner.actions.toggleTask}
                onStar={planner.actions.toggleStar}
                onDelete={planner.actions.deleteTask}
                onOpen={planner.actions.setSelectedTask}
              />
            ))
          ) : (
            <div className="empty-state">当前筛选条件下没有任务，试试切换标签或状态。</div>
          )}
        </div>
      </section>

      <section className="glass-card main-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Upcoming</p>
            <h2>接下来</h2>
          </div>
          <div className="section-meta">未来 7 天优先推进的安排</div>
        </div>
        <div className="timeline-list">
          {upcomingTasks.length ? (
            upcomingTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                selected={planner.selectedTask?.id === task.id}
                onToggle={planner.actions.toggleTask}
                onStar={planner.actions.toggleStar}
                onDelete={planner.actions.deleteTask}
                onOpen={planner.actions.setSelectedTask}
              />
            ))
          ) : (
            <div className="empty-state">未来 7 天还没有符合筛选条件的待办。</div>
          )}
        </div>
      </section>
    </>
  )
}

export function CalendarContent({ planner, todayLabel }) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(planner.today, index))

  return (
    <>
      <PageHero
        eyebrow="Calendar View"
        title="把清单和时间连起来看，而不是分开管理。"
        copy="借鉴滴答清单的日历与列表结合思路，这一页重点看未来 7 天的任务密度，适合做周计划和时间分配。"
        stats={planner.stats}
        todayLabel={todayLabel}
        onAddTask={() => document.querySelector("#quick-form-panel")?.scrollIntoView({ behavior: "smooth" })}
        onReset={planner.actions.resetDemo}
      />

      <section className="glass-card main-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Next 7 Days</p>
            <h2>未来 7 天日程</h2>
          </div>
          <div className="section-meta">List View + Timeline 的轻量版本</div>
        </div>
        <FilterBar
          filters={planner.filters}
          tags={planner.tags}
          lists={planner.lists}
          onStatusChange={(value) => planner.actions.setFilter("status", value)}
          onTagChange={(value) => planner.actions.setFilter("tag", value)}
          onListChange={(value) => planner.actions.setFilter("listId", value)}
        />
        <div className="calendar-stack">
          {days.map((date) => {
            const tasks = planner.filteredTasks(planner.tasksForDate(date))
            return (
              <article className="day-card" key={date}>
                <div className="day-title">
                  <strong>{date}</strong>
                  <span className="section-meta">{tasks.length} 项安排</span>
                </div>
                {tasks.length ? (
                  tasks.map((task) => (
                    <div className="mini-task" key={task.id}>
                      <div>
                        <button className="task-open" type="button" onClick={() => planner.actions.setSelectedTask(task.id)}>
                          <h4 className={`task-title ${task.completed ? "is-done" : ""}`}>{task.title}</h4>
                        </button>
                        <p className="task-meta">
                          {task.time || "全天"} · {planner.lists.find((list) => list.id === task.listId)?.name}
                        </p>
                      </div>
                      <div className="task-actions">
                        <button className="icon-btn" type="button" onClick={() => planner.actions.toggleTask(task.id)}>
                          {task.completed ? "已完" : "完成"}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">这一天还没有安排。</div>
                )}
              </article>
            )
          })}
        </div>
      </section>
    </>
  )
}

export function ListsContent({ planner, todayLabel }) {
  const visibleTaskCount = planner.filteredTasks(planner.tasks).length

  return (
    <>
      <PageHero
        eyebrow="Projects & Lists"
        title="Smart Lists 负责聚焦，Projects 负责沉淀。"
        copy="滴答清单把 Smart List 和 Regular List 分开处理，我们这里也延续这个心智：上面看 Today、Next 7 Days、Inbox，下面看你的长期项目清单。"
        stats={planner.stats}
        todayLabel={todayLabel}
        onAddTask={() => document.querySelector("#quick-form-panel")?.scrollIntoView({ behavior: "smooth" })}
        onReset={planner.actions.resetDemo}
      />

      <section className="glass-card main-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Smart Lists</p>
            <h2>高频入口</h2>
          </div>
          <div className="section-meta">Today / Next 7 Days / Inbox</div>
        </div>
        <FilterBar
          filters={planner.filters}
          tags={planner.tags}
          lists={planner.lists}
          onStatusChange={(value) => planner.actions.setFilter("status", value)}
          onTagChange={(value) => planner.actions.setFilter("tag", value)}
          onListChange={(value) => planner.actions.setFilter("listId", value)}
        />
        <ActiveFilterSummary
          filters={planner.filters}
          tags={planner.tags}
          lists={planner.lists}
          totalTasks={visibleTaskCount}
          onClearAll={() => planner.actions.setFilters({ status: "all", tag: "all", listId: "all" })}
          onClearFilter={(name) => planner.actions.setFilter(name, "all")}
        />
        <div className="smart-list-grid">
          {planner.smartLists.map((item) => {
            const tasks = planner.filteredTasks(planner.smartListTasks(item.id))
            return (
              <article className="smart-card" key={item.id}>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
                <div className="stat-line">
                  <span>{tasks.filter((task) => !task.completed).length} 项待处理</span>
                  <span>{tasks.length} 项总计</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="glass-card main-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Projects</p>
            <h2>项目清单</h2>
          </div>
          <div className="section-meta">长期任务按主题沉淀</div>
        </div>
        <div className="group-list">
          {planner.lists.map((list) => {
            const tasks = planner.filteredTasks(planner.tasksByList(list.id))
            return (
              <section className="group-card" key={list.id}>
                <div className="section-head">
                  <div>
                    <p className="eyebrow">{list.type === "smart" ? "Capture List" : "Project List"}</p>
                    <h3>{list.name}</h3>
                  </div>
                  <div className="section-meta">{list.description}</div>
                </div>
                <div className="group-list">
                  {tasks.length ? (
                    tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        selected={planner.selectedTask?.id === task.id}
                        onToggle={planner.actions.toggleTask}
                        onStar={planner.actions.toggleStar}
                        onDelete={planner.actions.deleteTask}
                        onOpen={planner.actions.setSelectedTask}
                      />
                    ))
                  ) : (
                    <div className="empty-state">当前筛选条件下这个清单没有任务。</div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      </section>
    </>
  )
}

export function ProfileContent({ planner, todayLabel, focus, setFocus }) {
  return (
    <>
      <PageHero
        eyebrow="Profile & Insights"
        title="在多页面结构里，统计和设置也该有自己的位置。"
        copy="这一页保留轻量的个人面板：任务统计、重要事项、聚焦语句和产品扩展方向，方便后面继续加同步、提醒和番茄钟。"
        stats={planner.stats}
        todayLabel={todayLabel}
        onAddTask={() => document.querySelector("#quick-form-panel")?.scrollIntoView({ behavior: "smooth" })}
        onReset={planner.actions.resetDemo}
      />

      <section className="glass-card main-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Overview</p>
            <h2>个人统计</h2>
          </div>
          <div className="section-meta">用完成量和安排密度看自己的节奏</div>
        </div>
        <div className="profile-grid">
          <article className="profile-stat">
            <strong>{planner.stats.total}</strong>
            <span>累计任务</span>
          </article>
          <article className="profile-stat">
            <strong>{planner.stats.pending}</strong>
            <span>待处理</span>
          </article>
          <article className="profile-stat">
            <strong>{planner.stats.completed}</strong>
            <span>已完成</span>
          </article>
          <article className="profile-stat">
            <strong>{planner.stats.starred}</strong>
            <span>重要事项</span>
          </article>
        </div>
      </section>

      <section className="glass-card main-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Focus Line</p>
            <h2>今日提醒</h2>
          </div>
          <div className="section-meta">这句话会同步显示在每个页面的头图区域</div>
        </div>
        <div className="field-list">
          <label className="field">
            <span>聚焦语句</span>
            <textarea value={focus} onChange={(event) => setFocus(event.target.value)} />
          </label>
          <button className="primary-btn" type="button" onClick={() => planner.actions.updateFocus(focus.trim() || planner.focus)}>
            保存提醒
          </button>
        </div>
      </section>
    </>
  )
}
