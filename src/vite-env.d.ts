/// <reference types="vite/client" />

interface FocusFlowNotionConfig {
  authUrl: string
  clientId: string
  configured: boolean
  redirectUri: string
}

interface FocusFlowNotionOAuthCallback {
  code: string
  error: string
  state: string
}

interface FocusFlowNotionTokenResponse {
  access_token: string
  bot_id?: string
  duplicated_template_id?: string | null
  expires_in?: number
  owner?: unknown
  refresh_token?: string
  request_id?: string
  token_type: "bearer"
  workspace_icon?: string | null
  workspace_id?: string
  workspace_name?: string
}

interface FocusFlowNotionBridge {
  decrypt: (payload: string) => Promise<string>
  encrypt: (payload: string) => Promise<string>
  exchangeCode: (payload: { code: string; redirectUri: string }) => Promise<FocusFlowNotionTokenResponse>
  getConfig: () => Promise<FocusFlowNotionConfig>
  onOAuthCallback: (callback: (payload: FocusFlowNotionOAuthCallback) => void) => () => void
  openExternal: (url: string) => Promise<boolean>
  refreshToken: (payload: { refreshToken: string }) => Promise<FocusFlowNotionTokenResponse>
  request: <Response = unknown>(payload: {
    accessToken: string
    body?: unknown
    method?: "GET" | "POST" | "PATCH" | "DELETE"
    path: string
  }) => Promise<Response>
}

interface Window {
  focusflowCalendarOCR?: {
    recognizeImage: (payload: { dataUrl: string }) => Promise<{ canceled: boolean; text: string }>
  }
  focusflowNotion?: FocusFlowNotionBridge
}
