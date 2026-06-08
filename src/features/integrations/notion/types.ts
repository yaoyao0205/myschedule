export type NotionSyncDirection = "push" | "bidirectional"
export type NotionSyncStatus = "idle" | "syncing" | "synced" | "failed"
export type NotionEntityType = "task" | "note"

export interface NotionConnection {
  botId: string
  connectedAt: string
  encryptedAccessToken: string
  encryptedRefreshToken: string
  tokenExpiresAt: string | null
  workspaceIcon: string | null
  workspaceId: string
  workspaceName: string
}

export interface NotionDatabaseSummary {
  id: string
  lastEditedTime: string
  title: string
}

export interface NotionSyncSettings {
  databaseId: string
  databaseTitle: string
  direction: NotionSyncDirection
  enabled: boolean
  lastPulledAt: string | null
  lastSyncedAt: string | null
}

export interface NotionEntitySyncState {
  error?: string
  lastSyncedAt?: string
  notionPageId?: string
  status: NotionSyncStatus
}

export interface NotionSyncMeta {
  notes: Record<string, NotionEntitySyncState>
  tasks: Record<string, NotionEntitySyncState>
}
