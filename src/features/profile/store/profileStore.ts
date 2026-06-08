import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export type AppearanceMode = "system" | "light" | "dark" | "synthwave" | "pixel" | "pop" | "mondrian"
export type LanguageMode = "zh-CN" | "zh-TW" | "en"
export type ProcrastinationSensitivity = "conservative" | "standard" | "active"
export type TheoSkin = "default" | "orange" | "black" | "ragdoll" | "gold" | "midnight"

interface ProfileSettings {
  ambienceThemes: boolean
  appearance: AppearanceMode
  checkInMood: boolean
  dailyMorningReminder: boolean
  dailyMorningTime: string
  dailyReviewReminder: boolean
  dailyReviewTime: string
  entranceRitual: boolean
  focusDoNotDisturb: boolean
  haptics: boolean
  language: LanguageMode
  masterSound: boolean
  morningRitual: boolean
  pomodoroNotifications: boolean
  procrastinationAlert: boolean
  procrastinationSensitivity: ProcrastinationSensitivity
  taskDeadlineLead: string
  taskSounds: boolean
  theoSkin: TheoSkin
}

export interface ProfileState {
  avatarUrl: string
  email: string
  feedCount: number
  joinedAt: string
  loginStreak: number
  phone: string
  settings: ProfileSettings
  signature: string
  theoClicks: number
  theoFood: number
  theoName: string
  username: string
  feedTheo: () => void
  incrementTheoClicks: () => void
  resetAccount: () => void
  resetTheoProgress: () => void
  setAvatarUrl: (avatarUrl: string) => void
  setEmail: (email: string) => void
  setPhone: (phone: string) => void
  setSetting: <Key extends keyof ProfileSettings>(key: Key, value: ProfileSettings[Key]) => void
  setSignature: (signature: string) => void
  setTheoSkin: (skin: TheoSkin) => void
  setUsername: (username: string) => void
}

const defaultSettings: ProfileSettings = {
  ambienceThemes: true,
  appearance: "light",
  checkInMood: true,
  dailyMorningReminder: false,
  dailyMorningTime: "08:30",
  dailyReviewReminder: false,
  dailyReviewTime: "21:00",
  entranceRitual: true,
  focusDoNotDisturb: true,
  haptics: true,
  language: "zh-CN",
  masterSound: true,
  morningRitual: true,
  pomodoroNotifications: true,
  procrastinationAlert: false,
  procrastinationSensitivity: "standard",
  taskDeadlineLead: "2h",
  taskSounds: true,
  theoSkin: "default",
}

function normalizeSettings(settings?: Partial<ProfileSettings>): ProfileSettings {
  return {
    ...defaultSettings,
    ...settings,
  }
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      avatarUrl: "",
      email: "",
      feedCount: 0,
      joinedAt: "2026-05-29T00:00:00.000Z",
      loginStreak: 7,
      phone: "",
      settings: defaultSettings,
      signature: "",
      theoClicks: 0,
      theoFood: 18,
      theoName: "西奥",
      username: "yaoyaoflow 用户",
      feedTheo: () =>
        set((state) => ({
          feedCount: state.theoFood > 0 ? state.feedCount + 1 : state.feedCount,
          theoFood: Math.max(0, state.theoFood - 1),
        })),
      incrementTheoClicks: () =>
        set((state) => ({
          theoClicks: state.theoClicks + 1,
          settings: state.theoClicks + 1 >= 10 ? { ...state.settings, theoSkin: "midnight" } : state.settings,
        })),
      resetAccount: () =>
        set({
          avatarUrl: "",
          email: "",
          phone: "",
          signature: "",
          username: "yaoyaoflow 用户",
        }),
      resetTheoProgress: () => set({ feedCount: 0, theoFood: 0, theoClicks: 0 }),
      setAvatarUrl: (avatarUrl) => set({ avatarUrl }),
      setEmail: (email) => set({ email }),
      setPhone: (phone) => set({ phone }),
      setSetting: (key, value) =>
        set((state) => ({
          settings: normalizeSettings({ ...state.settings, [key]: value }),
        })),
      setSignature: (signature) => set({ signature }),
      setTheoSkin: (theoSkin) =>
        set((state) => ({
          settings: { ...state.settings, theoSkin },
        })),
      setUsername: (username) => set({ username }),
    }),
    {
      name: "focusflow.profile.v1",
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<ProfileState> | undefined

        return {
          ...current,
          ...persistedState,
          settings: normalizeSettings(persistedState?.settings),
        }
      },
    }
  )
)
