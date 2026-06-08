import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type {
  NotionConnection,
  NotionDatabaseSummary,
  NotionEntitySyncState,
  NotionEntityType,
  NotionSyncDirection,
  NotionSyncMeta,
  NotionSyncSettings,
} from "../types"

interface NotionState {
  connection: NotionConnection | null
  databases: NotionDatabaseSummary[]
  oauthState: string
  settings: NotionSyncSettings
  syncMeta: NotionSyncMeta
  clearConnection: () => void
  markEntityFailed: (type: NotionEntityType, entityId: string, error: string) => void
  markEntitySynced: (type: NotionEntityType, entityId: string, notionPageId: string) => void
  markEntitySyncing: (type: NotionEntityType, entityId: string) => void
  removeEntity: (type: NotionEntityType, entityId: string) => void
  setConnection: (connection: NotionConnection) => void
  setDatabases: (databases: NotionDatabaseSummary[]) => void
  setDatabase: (database: NotionDatabaseSummary | null) => void
  setDirection: (direction: NotionSyncDirection) => void
  setEnabled: (enabled: boolean) => void
  setLastPulledAt: (lastPulledAt: string) => void
  setLastSyncedAt: (lastSyncedAt: string) => void
  setOAuthState: (oauthState: string) => void
}

const defaultSettings: NotionSyncSettings = {
  databaseId: "",
  databaseTitle: "",
  direction: "push",
  enabled: false,
  lastPulledAt: null,
  lastSyncedAt: null,
}

const defaultSyncMeta: NotionSyncMeta = {
  notes: {},
  tasks: {},
}

function normalizeSettings(settings?: Partial<NotionSyncSettings>): NotionSyncSettings {
  return {
    ...defaultSettings,
    ...settings,
  }
}

function normalizeSyncMeta(syncMeta?: Partial<NotionSyncMeta>): NotionSyncMeta {
  return {
    notes: syncMeta?.notes ?? {},
    tasks: syncMeta?.tasks ?? {},
  }
}

function getEntityBucket(type: NotionEntityType) {
  return type === "task" ? "tasks" : "notes"
}

function updateEntityState(type: NotionEntityType, entityId: string, state: NotionEntitySyncState) {
  return (current: NotionState) => {
    const bucket = getEntityBucket(type)
    return {
      syncMeta: {
        ...current.syncMeta,
        [bucket]: {
          ...current.syncMeta[bucket],
          [entityId]: state,
        },
      },
    }
  }
}

export const useNotionStore = create<NotionState>()(
  persist(
    (set) => ({
      connection: null,
      databases: [],
      oauthState: "",
      settings: defaultSettings,
      syncMeta: defaultSyncMeta,
      clearConnection: () =>
        set({
          connection: null,
          databases: [],
          settings: defaultSettings,
          syncMeta: defaultSyncMeta,
        }),
      markEntityFailed: (type, entityId, error) =>
        set(updateEntityState(type, entityId, { error, status: "failed" })),
      markEntitySynced: (type, entityId, notionPageId) =>
        set(
          updateEntityState(type, entityId, {
            lastSyncedAt: new Date().toISOString(),
            notionPageId,
            status: "synced",
          })
        ),
      markEntitySyncing: (type, entityId) =>
        set((state) => {
          const bucket = getEntityBucket(type)
          return updateEntityState(type, entityId, {
            ...state.syncMeta[bucket][entityId],
            error: undefined,
            status: "syncing",
          })(state)
        }),
      removeEntity: (type, entityId) =>
        set((state) => {
          const bucket = getEntityBucket(type)
          const next = { ...state.syncMeta[bucket] }
          delete next[entityId]
          return { syncMeta: { ...state.syncMeta, [bucket]: next } }
        }),
      setConnection: (connection) =>
        set((state) => ({
          connection,
          settings: { ...state.settings, enabled: Boolean(state.settings.databaseId) },
        })),
      setDatabases: (databases) => set({ databases }),
      setDatabase: (database) =>
        set((state) => ({
          settings: {
            ...state.settings,
            databaseId: database?.id ?? "",
            databaseTitle: database?.title ?? "",
            enabled: Boolean(database?.id),
          },
        })),
      setDirection: (direction) => set((state) => ({ settings: { ...state.settings, direction } })),
      setEnabled: (enabled) => set((state) => ({ settings: { ...state.settings, enabled } })),
      setLastPulledAt: (lastPulledAt) => set((state) => ({ settings: { ...state.settings, lastPulledAt } })),
      setLastSyncedAt: (lastSyncedAt) => set((state) => ({ settings: { ...state.settings, lastSyncedAt } })),
      setOAuthState: (oauthState) => set({ oauthState }),
    }),
    {
      name: "focusflow.notion.v1",
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<NotionState> | undefined
        return {
          ...current,
          ...persistedState,
          databases: Array.isArray(persistedState?.databases) ? persistedState.databases : [],
          settings: normalizeSettings(persistedState?.settings),
          syncMeta: normalizeSyncMeta(persistedState?.syncMeta),
        }
      },
      partialize: (state) => ({
        connection: state.connection,
        databases: state.databases,
        oauthState: state.oauthState,
        settings: state.settings,
        syncMeta: state.syncMeta,
      }),
    }
  )
)
