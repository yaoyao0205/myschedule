export function ProgressPanel({ lists, tasksByList }) {
  return (
    <section className="glass-card aux-card">
      <div className="section-head">
        <div>
          <p className="eyebrow">Project Progress</p>
          <h3>项目进度</h3>
        </div>
        <div className="section-meta">不同清单各自推进</div>
      </div>
      <div className="progress-list">
        {lists.map((list) => {
          const tasks = tasksByList(list.id)
          const done = tasks.filter((task) => task.completed).length
          const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
          return (
            <article className="progress-item" key={list.id}>
              <div className="progress-head">
                <strong>{list.name}</strong>
                <span className="section-meta">
                  {done} / {tasks.length} 已完成
                </span>
              </div>
              <div className="progress-track">
                <div className="progress-bar" style={{ width: `${progress}%`, background: list.color }} />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
