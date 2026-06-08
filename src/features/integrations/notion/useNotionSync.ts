import { useCallback, useEffect, useRef, useState } from "react"
import type { Note } from "../../notes/types"
import type { Task } from "../../tasks/types"
import { createPage, queryAccessibleDatabases, taskToNotionProperties, noteToNotionProperties, updatePage } from "./notionApi"
import { useNotionStore } from "./store/notionStore"
import type { NotionConnection } from "./types"

function createOAuthState() {
  return `notion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

async function decryptAccessToken(connection: NotionConnection | null) {
  if (!connection || !window.focusflowNotion) return ""
  return window.focusflowNotion.decrypt(connection.encryptedAccessToken)
}

async function buildConnection(token: FocusFlowNotionTokenResponse): Promise<NotionConnection> {
  if (!window.focusflowNotion) throw new Error("Notion bridge is unavailable")

  const encryptedAccessToken = await window.focusflowNotion.encrypt(token.access_token)
  const encryptedRefreshToken = token.refresh_token ? await window.focusflowNotion.encrypt(token.refresh_token) : ""

  return {
    botId: token.bot_id ?? "",
    connectedAt: new Date().toISOString(),
    encryptedAccessToken,
    encryptedRefreshToken,
    tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    workspaceIcon: token.workspace_icon ?? null,
    workspaceId: token.workspace_id ?? "",
    workspaceName: token.workspace_name ?? "Notion workspace",
  }
}

function extractCode(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (!trimmed.includes("://") && !trimmed.includes("code=")) return trimmed

  try {
    const url = new URL(trimmed)
    return url.searchParams.get("code") ?? ""
  } catch {
    return new URLSearchParams(trimmed.replace(/^[^?]*\?/, "")).get("code") ?? ""
  }
}

export function useNotionSync(tasks: Task[], notes: Note[], notify?: (message: string, tone?: "info" | "success" | "warning" | "error") => void) {
  const {
    clearConnection,
    connection,
    databases,
    markEntityFailed,
    markEntitySynced,
    markEntitySyncing,
    oauthState,
    setConnection,
    setDatabases,
    setLastSyncedAt,
    setOAuthState,
    settings,
    syncMeta,
  } = useNotionStore()
  const [config, setConfig] = useState<FocusFlowNotionConfig | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const lastFingerprintRef = useRef("")

  const refreshDatabases = useCallback(async () => {
    if (!connection) return []
    const accessToken = await decryptAccessToken(connection)
    const nextDatabases = await queryAccessibleDatabases(accessToken)
    setDatabases(nextDatabases)
    return nextDatabases
  }, [connection, setDatabases])

  const syncTask = useCallback(
    async (task: Task, accessToken: string) => {
      if (!settings.databaseId) return
      const existing = syncMeta.tasks[task.id]?.notionPageId
      markEntitySyncing("task", task.id)

      try {
        const response = existing
          ? await updatePage(accessToken, existing, taskToNotionProperties(task))
          : await createPage(accessToken, settings.databaseId, taskToNotionProperties(task))
        markEntitySynced("task", task.id, response.id)
      } catch (error) {
        markEntityFailed("task", task.id, String(error instanceof Error ? error.message : error))
        throw error
      }
    },
    [markEntityFailed, markEntitySynced, markEntitySyncing, settings.databaseId, syncMeta.tasks]
  )

  const syncNote = useCallback(
    async (note: Note, accessToken: string) => {
      if (!settings.databaseId) return
      const existing = syncMeta.notes[note.id]?.notionPageId
      markEntitySyncing("note", note.id)

      try {
        const response = existing
          ? await updatePage(accessToken, existing, noteToNotionProperties(note))
          : await createPage(accessToken, settings.databaseId, noteToNotionProperties(note))
        markEntitySynced("note", note.id, response.id)
      } catch (error) {
        markEntityFailed("note", note.id, String(error instanceof Error ? error.message : error))
        throw error
      }
    },
    [markEntityFailed, markEntitySynced, markEntitySyncing, settings.databaseId, syncMeta.notes]
  )

  const runFullSync = useCallback(async () => {
    if (!connection || !settings.databaseId) {
      notify?.("请先连接 Notion 并选择目标数据库", "warning")
      return
    }

    setBusy(true)
    setError("")
    try {
      const accessToken = await decryptAccessToken(connection)
      for (const task of tasks) {
        await syncTask(task, accessToken)
      }
      for (const note of notes) {
        await syncNote(note, accessToken)
      }
      const now = new Date().toISOString()
      setLastSyncedAt(now)
      notify?.("Notion 全量同步完成", "success")
    } catch (error) {
      const message = String(error instanceof Error ? error.message : error)
      setError(message)
      notify?.("Notion 暂时不可用，稍后重试", "error")
    } finally {
      setBusy(false)
    }
  }, [connection, notes, notify, setLastSyncedAt, settings.databaseId, syncNote, syncTask, tasks])

  const connect = useCallback(async () => {
    if (!window.focusflowNotion) {
      notify?.("当前运行环境不支持 Notion OAuth", "warning")
      return
    }

    const nextConfig = config ?? (await window.focusflowNotion.getConfig())
    setConfig(nextConfig)
    if (!nextConfig.configured) {
      notify?.("需要先配置 Notion OAuth Client ID 和 Secret", "warning")
      return
    }

    const state = createOAuthState()
    setOAuthState(state)
    const url = new URL(nextConfig.authUrl)
    url.searchParams.set("client_id", nextConfig.clientId)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("owner", "user")
    url.searchParams.set("redirect_uri", nextConfig.redirectUri)
    url.searchParams.set("state", state)
    console.info("[notion] oauth authorize url", url.toString())
    await window.focusflowNotion.openExternal(url.toString())
  }, [config, notify, setOAuthState])

  const completeWithCode = useCallback(
    async (value: string) => {
      if (!window.focusflowNotion) {
        notify?.("当前运行环境不支持 Notion OAuth", "warning")
        return
      }

      const code = extractCode(value)
      if (!code) {
        notify?.("没有找到 Notion 授权 code", "warning")
        return
      }

      setBusy(true)
      setError("")
      try {
        const currentConfig = await window.focusflowNotion.getConfig()
        const token = await window.focusflowNotion.exchangeCode({
          code,
          redirectUri: currentConfig.redirectUri,
        })
        setConnection(await buildConnection(token))
        setDatabases(await queryAccessibleDatabases(token.access_token))
        notify?.(`已连接 ${token.workspace_name ?? "Notion workspace"}`, "success")
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error)
        setError(message)
        notify?.("Notion 授权交换失败", "error")
      } finally {
        setBusy(false)
      }
    },
    [notify, setConnection, setDatabases]
  )

  useEffect(() => {
    if (!window.focusflowNotion) return
    window.focusflowNotion.getConfig().then(setConfig).catch(() => setConfig(null))

    return window.focusflowNotion.onOAuthCallback(async (payload) => {
      if (payload.error) {
        notify?.(`Notion 授权失败：${payload.error}`, "error")
        return
      }
      if (!payload.code || payload.state !== useNotionStore.getState().oauthState) {
        notify?.("Notion 授权状态不匹配，请重新连接", "warning")
        return
      }

      setBusy(true)
      try {
        const currentConfig = await window.focusflowNotion!.getConfig()
        const token = await window.focusflowNotion!.exchangeCode({
          code: payload.code,
          redirectUri: currentConfig.redirectUri,
        })
        setConnection(await buildConnection(token))
        const accessToken = token.access_token
        setDatabases(await queryAccessibleDatabases(accessToken))
        notify?.(`已连接 ${token.workspace_name ?? "Notion workspace"}`, "success")
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error)
        setError(message)
        notify?.("Notion 授权交换失败", "error")
      } finally {
        setBusy(false)
      }
    })
  }, [notify, setConnection, setDatabases])

  useEffect(() => {
    if (!settings.enabled || !connection || !settings.databaseId) return

    const fingerprint = JSON.stringify({
      notes: notes.map((note) => [note.id, note.updatedAt]),
      tasks: tasks.map((task) => [task.id, task.completed, task.createdAt, task.dueDate, task.note, task.priority, task.tags, task.title]),
    })
    if (lastFingerprintRef.current === "") {
      lastFingerprintRef.current = fingerprint
      return
    }
    if (lastFingerprintRef.current === fingerprint) return
    lastFingerprintRef.current = fingerprint

    const timer = window.setTimeout(() => {
      void runFullSync()
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [connection, notes, runFullSync, settings.databaseId, settings.enabled, tasks])

  return {
    busy,
    clearConnection,
    completeWithCode,
    config,
    connection,
    connect,
    databases,
    error,
    refreshDatabases,
    runFullSync,
    settings,
    syncMeta,
  }
}
