import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createId } from "../../../lib/ids"

export type TrashItemType = "countdown" | "note" | "reminder" | "task"

export interface TrashItem {
  data: unknown
  deletedAt: string
  id: string
  itemId: string
  title: string
  type: TrashItemType
}

interface TrashState {
  items: TrashItem[]
  addTrashItem: (item: Omit<TrashItem, "deletedAt" | "id">) => void
  clearTrash: () => void
  removeTrashItem: (trashItemId: string) => void
}

function normalizeTrashItems(items?: TrashItem[]): TrashItem[] {
  if (!Array.isArray(items)) return []

  return items
    .filter((item) => item && item.itemId && item.title && item.type)
    .map((item) => ({
      data: item.data,
      deletedAt: item.deletedAt ?? new Date().toISOString(),
      id: item.id ?? createId("trash"),
      itemId: item.itemId,
      title: item.title,
      type: item.type,
    }))
}

export const useTrashStore = create<TrashState>()(
  persist(
    (set) => ({
      items: [],
      addTrashItem: (item) =>
        set((state) => ({
          items: [
            {
              ...item,
              deletedAt: new Date().toISOString(),
              id: createId("trash"),
            },
            ...state.items.filter((current) => current.itemId !== item.itemId || current.type !== item.type),
          ].slice(0, 100),
        })),
      clearTrash: () => set({ items: [] }),
      removeTrashItem: (trashItemId) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== trashItemId),
        })),
    }),
    {
      name: "focusflow.trash.v1",
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<TrashState> | undefined
        return {
          ...current,
          ...persistedState,
          items: normalizeTrashItems(persistedState?.items as TrashItem[] | undefined),
        }
      },
      partialize: (state) => ({ items: state.items }),
    }
  )
)
