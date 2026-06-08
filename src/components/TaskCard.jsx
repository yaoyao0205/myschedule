import { colorBadge, getListMeta, getTaskTags, priorityLabel } from "../utils/plannerUtils"

export function TaskCard({ task, selected, onToggle, onStar, onDelete, onOpen }) {
  const list = getListMeta(task.listId)
  const tags = getTaskTags(task)
  const badgeClass = task.completed ? "badge-green" : task.starred ? "badge-orange" : colorBadge(list.color)
  const badgeText = task.completed ? "已完成" : task.starred ? "重要" : list.name

  return (
    <article className={`task-card ${selected ? "task-card-selected" : ""}`}>
      <div className="task-row">
        <button
          className={`check-btn ${task.completed ? "is-done" : ""}`}
          type="button"
          onClick={() => onToggle(task.id)}
          aria-label="切换完成状态"
        />
        <div className="task-main">
          <button className="task-open" type="button" onClick={() => onOpen(task.id)}>
            <h3 className={`task-title ${task.completed ? "is-done" : ""}`}>{task.title}</h3>
          </button>
          <p className="task-meta">
            {task.date} · {task.time || "全天"} · {list.name} · {priorityLabel(task.priority)}
          </p>
          {task.note ? <p className="task-note">{task.note}</p> : null}
          {tags.length ? (
            <div className="tag-row">
              {tags.map((tag) => (
                <span key={tag.id} className={`tag-badge ${colorBadge(tag.color)}`}>
                  {tag.name}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="task-actions">
          <span className={`badge ${badgeClass}`}>{badgeText}</span>
          <button className={`icon-btn icon-btn-star ${task.starred ? "is-active" : ""}`} type="button" onClick={() => onStar(task.id)}>
            {task.starred ? "★" : "☆"}
          </button>
          <button className="icon-btn icon-btn-delete" type="button" onClick={() => onDelete(task.id)}>
            删
          </button>
        </div>
      </div>
    </article>
  )
}
