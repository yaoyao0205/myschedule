import { useState } from "react"
import { colorBadge, getListMeta, getTaskTags, priorityLabel } from "../utils/plannerUtils"

function createFormState(task, lists) {
  if (!task) {
    return {
      title: "",
      note: "",
      listId: lists[0]?.id ?? "inbox",
      date: "",
      time: "",
      priority: "medium",
      tag: "",
      starred: false,
    }
  }

  return {
    title: task.title,
    note: task.note,
    listId: task.listId,
    date: task.date,
    time: task.time || "",
    priority: task.priority || "medium",
    tag: task.tags?.[0] || "",
    starred: task.starred,
  }
}

export function DetailPanel({ task, lists, tags, onClose, onToggle, onStar, onUpdate }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(() => createFormState(task, lists))

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleEditToggle() {
    if (!editing && task) {
      setForm(createFormState(task, lists))
    }
    setEditing((value) => !value)
  }

  function handleSave(event) {
    event.preventDefault()
    if (!task || !form.title.trim()) return
    onUpdate(task.id, form)
    setEditing(false)
  }

  if (!task) {
    return (
      <section className="glass-card aux-card detail-card">
        <div className="section-head">
          <div>
            <p className="eyebrow">Task Detail</p>
            <h3>任务详情</h3>
          </div>
          <div className="section-meta">从列表里点开一个任务</div>
        </div>
        <div className="empty-state">这里会显示任务的备注、标签、优先级和所属清单。</div>
      </section>
    )
  }

  const list = getListMeta(task.listId)
  const taskTags = getTaskTags(task)

  return (
    <section className="glass-card aux-card detail-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Task Detail</p>
          <h3>{editing ? "编辑任务" : task.title}</h3>
        </div>
        <div className="platform-row">
          <button className="ghost-btn small-btn" type="button" onClick={handleEditToggle}>
            {editing ? "取消编辑" : "编辑"}
          </button>
          <button className="ghost-btn small-btn" type="button" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>

      {editing ? (
        <form className="field-list" onSubmit={handleSave}>
          <label className="field">
            <span>任务标题</span>
            <input value={form.title} onChange={(event) => updateField("title", event.target.value)} required />
          </label>

          <label className="field">
            <span>备注</span>
            <textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} />
          </label>

          <div className="field-grid">
            <label className="field">
              <span>清单</span>
              <select value={form.listId} onChange={(event) => updateField("listId", event.target.value)}>
                {lists.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>日期</span>
              <input type="date" value={form.date} onChange={(event) => updateField("date", event.target.value)} required />
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>时间</span>
              <input type="time" value={form.time} onChange={(event) => updateField("time", event.target.value)} />
            </label>
            <label className="field">
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

          <div className="field-grid">
            <label className="field">
              <span>优先级</span>
              <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
                <option value="low">低优先级</option>
                <option value="medium">中优先级</option>
                <option value="high">高优先级</option>
              </select>
            </label>
            <div className="toggle-box">
              <div>
                <strong>标记重要</strong>
                <p>是否提升为重点处理事项</p>
              </div>
              <button
                className={`switch ${form.starred ? "is-on" : ""}`}
                type="button"
                aria-pressed={form.starred}
                onClick={() => updateField("starred", !form.starred)}
              />
            </div>
          </div>

          <div className="detail-actions">
            <button className="primary-btn" type="submit">
              保存修改
            </button>
            <button className="ghost-btn" type="button" onClick={() => setEditing(false)}>
              返回详情
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="detail-stack">
            <div className="detail-row">
              <span className="detail-label">清单</span>
              <strong>{list.name}</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">时间</span>
              <strong>
                {task.date} · {task.time || "全天"}
              </strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">优先级</span>
              <strong>{priorityLabel(task.priority)}</strong>
            </div>
            <div className="detail-row">
              <span className="detail-label">状态</span>
              <strong>{task.completed ? "已完成" : "待处理"}</strong>
            </div>
          </div>

          <div className="detail-block">
            <span className="detail-label">标签</span>
            <div className="tag-row">
              {taskTags.length ? (
                taskTags.map((tag) => (
                  <span key={tag.id} className={`tag-badge ${colorBadge(tag.color)}`}>
                    {tag.name}
                  </span>
                ))
              ) : (
                <span className="tag-badge badge-blue">无标签</span>
              )}
            </div>
          </div>

          <div className="detail-block">
            <span className="detail-label">备注</span>
            <p className="task-note">{task.note || "这条任务还没有补充备注。"}</p>
          </div>

          <div className="detail-actions">
            <button className="primary-btn" type="button" onClick={() => onToggle(task.id)}>
              {task.completed ? "标记未完成" : "标记完成"}
            </button>
            <button className="ghost-btn" type="button" onClick={() => onStar(task.id)}>
              {task.starred ? "取消重要" : "标记重要"}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
