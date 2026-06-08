export function PageHero({ eyebrow, title, copy, stats, todayLabel, onAddTask, onReset }) {
  return (
    <section className="glass-card page-hero">
      <div className="hero-top">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="page-title">{title}</h1>
          <p className="page-copy">{copy}</p>
          <div className="hero-actions">
            <button className="primary-btn" type="button" onClick={onAddTask}>
              新增任务
            </button>
            <button className="ghost-btn" type="button" onClick={onReset}>
              恢复示例数据
            </button>
          </div>
        </div>
        <div className="hero-date">
          <strong>{todayLabel.day}</strong>
          <span>
            {todayLabel.date}
            <br />
            {todayLabel.weekday}
          </span>
        </div>
      </div>

      <div className="hero-stats">
        <article className="stat-tile">
          <strong>{stats.today}</strong>
          <span>今天安排</span>
        </article>
        <article className="stat-tile">
          <strong>{stats.pending}</strong>
          <span>待完成</span>
        </article>
        <article className="stat-tile">
          <strong>{stats.completed}</strong>
          <span>已完成</span>
        </article>
        <article className="stat-tile">
          <strong>{stats.starred}</strong>
          <span>重要事项</span>
        </article>
      </div>
    </section>
  )
}
