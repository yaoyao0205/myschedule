import { createContext, type ReactNode, useContext } from "react"

export interface TopBarSlotContent {
  desktop?: ReactNode
  mobileAction?: ReactNode
  mobilePanel?: ReactNode
}

interface TopBarSlotContextValue {
  setTopBarSlot: (content: ReactNode | TopBarSlotContent) => void
}

export const TopBarSlotContext = createContext<TopBarSlotContextValue | null>(null)

export function useTopBarSlot() {
  return useContext(TopBarSlotContext)
}
