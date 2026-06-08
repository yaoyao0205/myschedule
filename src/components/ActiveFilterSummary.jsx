const STATUS_LABELS = {
  pending: "待处理",
  completed: "已完成",
  starred: "重要",
}

export function ActiveFilterSummary({ filters, tags, lists, totalTasks, onClearAll, onClearFilter }) {
  const activeItems = []

  if (filters.status !== "all") {
    activeItems.push({
      key: "status",
      label: `状态：${STATUS_LABELS[filters.status] || filters.status}`,
    })
  }

  if (filters.tag !== "all") {
    const tag = tags.find((item) => item.id === filters.tag)
    activeItems.push({
      key: "tag",
      label: `标签：${tag?.name || filters.tag}`,
    })
  }

  if (filters.listId !== "all") {
    const list = lists.find((item) => item.id === filters.listId)
    activeItems.push({
      key: "listId",
      label: `清单：${list?.name || filters.listId}`,
    })
  }

  if (!activeItems.length) {
    return null
  }

  return (
    <section className="active-filter-summary">
      <div className="active-filter-head">
        <div>
          <p className="eyebrow">Filter Snapshot</p>
          <h3>当前筛选中</h3>
        </div>
        <div className="section-meta">{totalTasks} 项任务符合当前条件</div>
      </div>
      <div className="active-filter-row">
        {activeItems.map((item) => (
          <button
            key={item.key}
            className="active-filter-chip"
            type="button"
            onClick={() => onClearFilter(item.key)}
          >
            <span>{item.label}</span>
            <strong>清除</strong>
          </button>
        ))}
        <button className="ghost-btn small-btn" type="button" onClick={onClearAll}>
          清空全部筛选
        </button>
      </div>
    </section>
  )
}
