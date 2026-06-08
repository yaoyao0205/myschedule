import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { Buffer } from "node:buffer"
import { dirname, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const NOTION_VERSION = "2022-06-28"
const PULSE_ID_PROPERTY = "Pulse Planner ID"
const rootDir = dirname(fileURLToPath(import.meta.url))

function normalizeDatabaseId(databaseId) {
  return databaseId.replaceAll("-", "").trim()
}

function createJsonResponse(response, status = 200) {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response),
  }
}

async function readRequestJson(req) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
}

function sendJson(res, payload) {
  res.writeHead(payload.status, payload.headers)
  res.end(payload.body)
}

async function notionFetch(path, token, options = {}) {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
      ...(options.headers || {}),
    },
  })
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    const message = body.message || `Notion API request failed with ${response.status}`
    throw new Error(message)
  }

  return body
}

function findProperty(properties, type, preferredNames) {
  const entries = Object.entries(properties)
  return (
    entries.find(([name, property]) => property.type === type && preferredNames.includes(name)) ||
    entries.find(([, property]) => property.type === type)
  )
}

function getOptionalProperty(properties, type, preferredNames) {
  return Object.entries(properties).find(
    ([name, property]) => property.type === type && preferredNames.includes(name)
  )
}

async function ensurePulseIdProperty(databaseId, token, database) {
  const existing = database.properties[PULSE_ID_PROPERTY]
  if (existing?.type === "rich_text") {
    return database
  }

  try {
    return await notionFetch(`/databases/${databaseId}`, token, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          [PULSE_ID_PROPERTY]: { rich_text: {} },
        },
      }),
    })
  } catch {
    return database
  }
}

function buildDateValue(task) {
  if (!task.date) {
    return null
  }

  if (!task.time) {
    return { start: task.date }
  }

  return {
    start: `${task.date}T${task.time}:00`,
    ...(task.endTime ? { end: `${task.date}T${task.endTime}:00` } : {}),
  }
}

function buildTaskProperties(task, database, lists, tags) {
  const properties = {}
  const schema = database.properties
  const [titleName] = findProperty(schema, "title", ["Name", "任务", "标题", "Task", "Title"]) || []
  if (!titleName) {
    throw new Error("Notion database needs a title property.")
  }

  properties[titleName] = { title: [{ text: { content: task.title } }] }

  if (schema[PULSE_ID_PROPERTY]?.type === "rich_text") {
    properties[PULSE_ID_PROPERTY] = { rich_text: [{ text: { content: task.id } }] }
  }

  const noteProperty = getOptionalProperty(schema, "rich_text", ["备注", "Note", "Notes", "Description"])
  if (noteProperty) {
    properties[noteProperty[0]] = {
      rich_text: task.note ? [{ text: { content: task.note } }] : [],
    }
  }

  const dateProperty = getOptionalProperty(schema, "date", ["日期", "Date", "Due", "Due Date", "时间"])
  if (dateProperty) {
    properties[dateProperty[0]] = { date: buildDateValue(task) }
  }

  const completedProperty = getOptionalProperty(schema, "checkbox", ["完成", "已完成", "Done", "Completed"])
  if (completedProperty) {
    properties[completedProperty[0]] = { checkbox: Boolean(task.completed) }
  }

  const statusProperty = getOptionalProperty(schema, "select", ["状态", "Status"])
  if (statusProperty) {
    properties[statusProperty[0]] = { select: { name: task.completed ? "已完成" : "待处理" } }
  }

  const priorityProperty = getOptionalProperty(schema, "select", ["优先级", "Priority"])
  if (priorityProperty) {
    const priorityName = task.priority === "high" ? "高" : task.priority === "low" ? "低" : "中"
    properties[priorityProperty[0]] = { select: { name: priorityName } }
  }

  const listProperty = getOptionalProperty(schema, "select", ["清单", "List", "Project"])
  if (listProperty) {
    const listName = lists.find((list) => list.id === task.listId)?.name || task.listId
    properties[listProperty[0]] = { select: { name: listName } }
  }

  const tagsProperty = getOptionalProperty(schema, "multi_select", ["标签", "Tags", "Tag"])
  if (tagsProperty) {
    properties[tagsProperty[0]] = {
      multi_select: (task.tags || []).map((tagId) => ({
        name: tags.find((tag) => tag.id === tagId)?.name || tagId,
      })),
    }
  }

  return properties
}

async function findExistingPage(databaseId, token, database, task) {
  if (database.properties[PULSE_ID_PROPERTY]?.type === "rich_text") {
    const result = await notionFetch(`/databases/${databaseId}/query`, token, {
      method: "POST",
      body: JSON.stringify({
        filter: {
          property: PULSE_ID_PROPERTY,
          rich_text: { equals: task.id },
        },
        page_size: 1,
      }),
    })
    return result.results?.[0] || null
  }

  const [titleName] = findProperty(database.properties, "title", ["Name", "任务", "标题", "Task", "Title"]) || []
  if (!titleName) {
    return null
  }

  const result = await notionFetch(`/databases/${databaseId}/query`, token, {
    method: "POST",
    body: JSON.stringify({
      filter: {
        property: titleName,
        title: { equals: task.title },
      },
      page_size: 1,
    }),
  })
  return result.results?.[0] || null
}

async function syncTasksToNotion({ databaseId, tasks, lists, tags }) {
  const token = process.env.NOTION_TOKEN
  if (!token) {
    return createJsonResponse({ error: "Missing NOTION_TOKEN in the local server environment." }, 400)
  }

  if (!databaseId) {
    return createJsonResponse({ error: "Missing Notion database id." }, 400)
  }

  const normalizedDatabaseId = normalizeDatabaseId(databaseId)
  let database = await notionFetch(`/databases/${normalizedDatabaseId}`, token)
  database = await ensurePulseIdProperty(normalizedDatabaseId, token, database)

  const synced = []
  for (const task of tasks || []) {
    const properties = buildTaskProperties(task, database, lists || [], tags || [])
    const existingPage = await findExistingPage(normalizedDatabaseId, token, database, task)

    if (existingPage) {
      await notionFetch(`/pages/${existingPage.id}`, token, {
        method: "PATCH",
        body: JSON.stringify({ properties }),
      })
      synced.push({ taskId: task.id, action: "updated" })
    } else {
      const page = await notionFetch("/pages", token, {
        method: "POST",
        body: JSON.stringify({
          parent: { database_id: normalizedDatabaseId },
          properties,
        }),
      })
      synced.push({ taskId: task.id, action: "created", pageId: page.id })
    }
  }

  return createJsonResponse({ synced })
}

function notionSyncPlugin() {
  async function handleRequest(req, res) {
    if (req.method !== "POST") {
      sendJson(res, createJsonResponse({ error: "Method not allowed." }, 405))
      return
    }

    try {
      const body = await readRequestJson(req)
      const result = await syncTasksToNotion(body)
      sendJson(res, result)
    } catch (error) {
      sendJson(res, createJsonResponse({ error: error.message }, 500))
    }
  }

  return {
    name: "pulse-planner-notion-sync",
    configureServer(server) {
      server.middlewares.use("/api/notion/sync", handleRequest)
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/notion/sync", handleRequest)
    },
  }
}

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        app: resolve(rootDir, "index.html"),
      },
    },
  },
  plugins: [react(), notionSyncPlugin()],
})
