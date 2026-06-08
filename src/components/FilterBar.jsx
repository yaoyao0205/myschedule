export function FilterBar({ filters, tags, lists, onStatusChange, onTagChange, onListChange }) {
  const statusOptions = [
    ["all", "全部"],
    ["pending", "待处理"],
    ["completed", "已完成"],
    ["starred", "重要"],
  ]

  return (
    <div className="filter-bar">
      <div className="filter-group">
        <span className="filter-label">状态</span>
        <div className="filter-pills">
          {statusOptions.map(([value, label]) => (
            <button
              key={value}
              className={`filter-pill ${filters.status === value ? "active" : ""}`}
              type="button"
              onClick={() => onStatusChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">标签</span>
        <div className="filter-pills">
          <button
            className={`filter-pill ${filters.tag === "all" ? "active" : ""}`}
            type="button"
            onClick={() => onTagChange("all")}
          >
            全部标签
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              className={`filter-pill ${filters.tag === tag.id ? "active" : ""}`}
              type="button"
              onClick={() => onTagChange(tag.id)}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-select">
        <span className="filter-label">清单</span>
        <select value={filters.listId} onChange={(event) => onListChange(event.target.value)}>
          <option value="all">全部清单</option>
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
