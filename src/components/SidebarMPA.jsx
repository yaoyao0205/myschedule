import { colorTone } from "../utils/plannerUtils"

const DEFAULT_FILTERS = {
  status: "all",
  tag: "all",
  listId: "all",
}

export function SidebarMPA({
  pageId,
  filters,
  smartLists,
  smartListTasks,
  lists,
  tags,
  countTasksByTag,
  sidebarGroups,
  onToggleGroup,
  tasksByList,
  onApplyFilters,
}) {
  const navItems = [
    { id: "today", href: "./index.html", title: "总览", subtitle: "Today + Smart Lists" },
    { id: "calendar", href: "./calendar.html", title: "日程", subtitle: "Next 7 Days" },
    { id: "lists", href: "./lists.html", title: "清单", subtitle: "Projects + Inbox" },
    { id: "profile", href: "./profile.html", title: "我的", subtitle: "统计与设置" },
  ]

  function handleNavSelect(href) {
    onApplyFilters(DEFAULT_FILTERS, href)
  }

  function handleSmartListSelect(smartListId) {
    if (smartListId === "today") {
      onApplyFilters(DEFAULT_FILTERS, "./index.html")
      return
    }

    if (smartListId === "next7") {
      onApplyFilters(DEFAULT_FILTERS, "./calendar.html")
      return
    }

    const listId = filters.listId === "inbox" ? "all" : "inbox"
    onApplyFilters({ ...DEFAULT_FILTERS, listId }, "./lists.html")
  }

  function handleProjectSelect(listId) {
    const nextListId = filters.listId === listId ? "all" : listId
    onApplyFilters({ ...DEFAULT_FILTERS, listId: nextListId }, "./lists.html")
  }

  function handleTagSelect(tagId) {
    const nextTag = filters.tag === tagId ? "all" : tagId
    onApplyFilters({ ...DEFAULT_FILTERS, tag: nextTag }, "./lists.html")
  }

  function isSmartListActive(smartListId) {
    if (smartListId === "today") {
      return pageId === "today" && filters.listId === "all" && filters.tag === "all"
    }

    if (smartListId === "next7") {
      return pageId === "calendar" && filters.listId === "all" && filters.tag === "all"
    }

    return filters.listId === "inbox" && filters.tag === "all"
  }

  return (
    <aside className="sidebar">
      <section className="glass-card brand-card">
        <p className="eyebrow">Cross Platform Planner</p>
        <h1>Pulse Planner</h1>
        <p className="brand-copy">这是一个真正的多页面 React 应用，每个页面都像应用程序里的独立界面。</p>
      </section>

      <section className="glass-card sidebar-card">
        <div className="mini-section">
          <h3>导航</h3>
          <nav className="nav-list">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={item.href}
                className={`nav-link ${pageId === item.id ? "active" : ""}`}
                onClick={(event) => {
                  event.preventDefault()
                  handleNavSelect(item.href)
                }}
              >
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
              </a>
            ))}
          </nav>
        </div>
      </section>

      <SidebarGroup
        title="Smart Lists"
        expanded={sidebarGroups.smart}
        onToggle={() => onToggleGroup("smart")}
        items={smartLists.map((item) => ({
          label: item.name,
          meta: `${smartListTasks(item.id).length} 项`,
          tone: "blue",
          active: isSmartListActive(item.id),
          onClick: () => handleSmartListSelect(item.id),
        }))}
      />

      <SidebarGroup
        title="Projects"
        expanded={sidebarGroups.projects}
        onToggle={() => onToggleGroup("projects")}
        items={lists
          .filter((list) => list.type === "project")
          .map((item) => ({
            label: item.name,
            meta: `${tasksByList(item.id).length} 项`,
            tone: colorTone(item.color),
            active: filters.listId === item.id,
            onClick: () => handleProjectSelect(item.id),
          }))}
      />

      <SidebarGroup
        title="Tags"
        expanded={sidebarGroups.tags}
        onToggle={() => onToggleGroup("tags")}
        items={tags.map((item) => ({
          label: item.name,
          meta: `${countTasksByTag(item.id)} 项`,
          tone: colorTone(item.color),
          active: filters.tag === item.id,
          onClick: () => handleTagSelect(item.id),
        }))}
      />
    </aside>
  )
}

function SidebarGroup({ title, items, expanded, onToggle }) {
  return (
    <section className="glass-card sidebar-card">
      <div className="sidebar-group">
        <button className="sidebar-group-toggle" type="button" onClick={onToggle}>
          <span>{title}</span>
          <span>{expanded ? "−" : "+"}</span>
        </button>
        <div className={`sidebar-group-body ${expanded ? "" : "is-collapsed"}`}>
          {items.map((item) => (
            <button
              className={`sidebar-pill sidebar-pill-${item.tone} ${item.active ? "active" : ""}`}
              key={`${title}-${item.label}`}
              type="button"
              onClick={item.onClick}
            >
              <strong>{item.label}</strong>
              <span>{item.meta}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
