import { LISTS, TAGS } from "../data/plannerData"

export function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function getToday() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-")
}

export function addDays(dateText, offset) {
  const date = new Date(`${dateText}T00:00:00`)
  date.setDate(date.getDate() + offset)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-")
}

export function toDateNumber(dateText) {
  return Number(dateText.replaceAll("-", ""))
}

export function sortedTasks(tasks) {
  return tasks.slice().sort((left, right) => {
    const leftKey = `${left.date} ${left.time || "23:59"}`
    const rightKey = `${right.date} ${right.time || "23:59"}`
    if (leftKey === rightKey) {
      return Number(right.starred) - Number(left.starred)
    }
    return leftKey.localeCompare(rightKey)
  })
}

export function priorityLabel(priority) {
  if (priority === "high") return "高优先级"
  if (priority === "low") return "低优先级"
  return "中优先级"
}

export function colorBadge(color) {
  if (color === "#8B735B") return "badge-orange"
  if (color === "#5E604D") return "badge-green"
  if (color === "#002933") return "badge-purple"
  return "badge-blue"
}

export function colorTone(color) {
  if (color === "#8B735B") return "orange"
  if (color === "#5E604D") return "green"
  if (color === "#002933") return "purple"
  return "blue"
}

export function getListMeta(listId) {
  return LISTS.find((item) => item.id === listId) || LISTS[0]
}

export function getTaskTags(task) {
  return TAGS.filter((tag) => (task.tags || []).includes(tag.id))
}
