import { useState } from "react"

export function QuickAddPanel({ lists, tags, onAddTask }) {
  const [starred, setStarred] = useState(false)
  const [form, setForm] = useState({
    title: "",
    note: "",
    listId: lists[0]?.id ?? "inbox",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    tag: "",
    priority: "medium",
  })

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.title.trim()) return
    onAddTask({ ...form, starred })
    setForm((prev) => ({
      ...prev,
      title: "",
      note: "",
      date: new Date().toISOString().slice(0, 10),
      time: "",
      tag: "",
      priority: "medium",
    }))
    setStarred(false)
  }

  return (
    <section className="glass-card aux-card" id="quick-form-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Quick Add</p>
          <h3>快速新增任务</h3>
        </div>
        <div className="section-meta">先捕获，再归类，再安排时间</div>
      </div>

      <form className="field-list" onSubmit={handleSubmit}>
        <label className="field">
          <span>任务标题</span>
          <input value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="例如：准备周会材料、安排体检、预订车票" required />
        </label>

        <label className="field">
          <span>备注</span>
          <textarea value={form.note} onChange={(event) => updateField("note", event.target.value)} placeholder="记录地点、补充细节或执行步骤" />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>清单</span>
            <select value={form.listId} onChange={(event) => updateField("listId", event.target.value)}>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
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
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
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
              <p>会在总览与未来安排里优先露出</p>
            </div>
            <button
              className={`switch ${starred ? "is-on" : ""}`}
              type="button"
              aria-pressed={starred}
              onClick={() => setStarred((value) => !value)}
            />
          </div>
        </div>

        <button className="primary-btn" type="submit">
          添加任务
        </button>
      </form>
    </section>
  )
}
