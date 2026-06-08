import type { Note } from "../../notes/types"
import type { Task } from "../../tasks/types"
import type { NotionDatabaseSummary } from "./types"

const NOTION_QUEUE_INTERVAL_MS = 360
const NOTION_MAX_RETRIES = 4

type NotionRequest<Response> = {
  accessToken: string
  body?: unknown
  method?: "GET" | "POST" | "PATCH" | "DELETE"
  path: string
}

let chain = Promise.resolve()

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function runQueued<Response>(request: NotionRequest<Response>, attempt = 0): Promise<Response> {
  await wait(NOTION_QUEUE_INTERVAL_MS)

  try {
    if (!window.focusflowNotion) throw new Error("Notion bridge is unavailable")
    return await window.focusflowNotion.request<Response>(request)
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 0
    if ((status === 429 || status >= 500) && attempt < NOTION_MAX_RETRIES) {
      await wait(800 * 2 ** attempt)
      return runQueued(request, attempt + 1)
    }
    throw error
  }
}

export function notionRequest<Response>(request: NotionRequest<Response>): Promise<Response> {
  const next = chain.then(() => runQueued<Response>(request))
  chain = next.then(
    () => undefined,
    () => undefined
  )
  return next
}

function richText(content: string) {
  return content ? [{ text: { content: content.slice(0, 2000) } }] : []
}

function priorityLabel(priority: Task["priority"]) {
  if (priority === "high") return "高"
  if (priority === "medium") return "中"
  return "低"
}

function plainTextFromHtml(content: string) {
  const parser = new DOMParser()
  const document = parser.parseFromString(content, "text/html")
  return document.body.textContent?.replace(/\s+/g, " ").trim() ?? ""
}

export function taskToNotionProperties(task: Task) {
  return {
    focusflow_id: { rich_text: richText(task.id) },
    截止日期: task.dueDate ? { date: { start: task.dueDate } } : { date: null },
    标签: { multi_select: task.tags.map((tag) => ({ name: tag })) },
    任务名称: { title: [{ text: { content: task.title } }] },
    优先级: { select: { name: priorityLabel(task.priority) } },
    备注: { rich_text: richText(task.note ?? "") },
    状态: { checkbox: task.completed },
  }
}

export function noteToNotionProperties(note: Note) {
  return {
    focusflow_id: { rich_text: richText(note.id) },
    标签: { multi_select: note.tags.map((tag) => ({ name: tag })) },
    笔记内容: { rich_text: richText(plainTextFromHtml(note.content)) },
    任务名称: { title: [{ text: { content: note.title } }] },
    状态: { checkbox: Boolean(note.pinned) },
    优先级: { select: { name: "中" } },
    备注: { rich_text: richText(plainTextFromHtml(note.content)) },
  }
}

export async function queryAccessibleDatabases(accessToken: string): Promise<NotionDatabaseSummary[]> {
  type SearchResponse = {
    results: Array<{
      id: string
      last_edited_time: string
      object: string
      title?: Array<{ plain_text?: string }>
    }>
  }

  const response = await notionRequest<SearchResponse>({
    accessToken,
    body: { filter: { property: "object", value: "database" }, page_size: 50 },
    method: "POST",
    path: "/v1/search",
  })

  return response.results
    .filter((item) => item.object === "database")
    .map((item) => ({
      id: item.id,
      lastEditedTime: item.last_edited_time,
      title: item.title?.map((part) => part.plain_text ?? "").join("").trim() || "未命名 Database",
    }))
}

export async function createPage(accessToken: string, databaseId: string, properties: unknown) {
  return notionRequest<{ id: string }>({
    accessToken,
    body: {
      parent: { database_id: databaseId },
      properties,
    },
    method: "POST",
    path: "/v1/pages",
  })
}

export async function updatePage(accessToken: string, pageId: string, properties: unknown) {
  return notionRequest<{ id: string }>({
    accessToken,
    body: { properties },
    method: "PATCH",
    path: `/v1/pages/${pageId}`,
  })
}

export async function archivePage(accessToken: string, pageId: string) {
  return notionRequest<{ id: string }>({
    accessToken,
    body: { archived: true },
    method: "PATCH",
    path: `/v1/pages/${pageId}`,
  })
}
