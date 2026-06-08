import { DEFAULT_NOTE_GROUP_ID, type NoteDraft } from "./types"
import { escapeHtml } from "./utils"

export interface LinkMetadata {
  content?: string
  description?: string
  image?: string
  siteName?: string
  title?: string
  url: string
}

export interface LinkParserBridge {
  parse: (url: string) => Promise<LinkMetadata>
}

declare global {
  interface Window {
    focusflowLinkParser?: LinkParserBridge
  }
}

const URL_PATTERN = /https?:\/\/[^\s"'<>，。；、）)]+/i

export function extractFirstUrl(value: string) {
  return value.match(URL_PATTERN)?.[0] ?? ""
}

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  const url = extractFirstUrl(trimmed) || trimmed
  try {
    return new URL(url).toString()
  } catch {
    return ""
  }
}

function isXiaohongshuUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.includes("xiaohongshu.com") || host.includes("xhslink.com")
  } catch {
    return false
  }
}

function getPlatformTag(url: string) {
  if (isXiaohongshuUrl(url)) return "小红书"
  try {
    const host = new URL(url).hostname.replace(/^www\./, "")
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "YouTube"
    if (host.includes("bilibili.com")) return "B站"
    if (host.includes("weixin.qq.com") || host.includes("mp.weixin.qq.com")) return "微信"
    return host.split(".")[0] || "网页"
  } catch {
    return "网页"
  }
}

function getTitleFromSharedText(value: string, url: string) {
  const cleaned = cleanSharedText(value, url)
  const lines = cleaned
    .split(/[\n\r。]+/)
    .map((line) => line.trim().replace(/^【.*?】/, "").trim())
    .filter(Boolean)

  return lines[0]?.slice(0, 80) ?? ""
}

function cleanSharedText(value: string, url: string) {
  return value
    .replace(url, " ")
    .replace(URL_PATTERN, " ")
    .replace(/复制.*?(打开|到).*(App|APP|应用).*$/i, " ")
    .replace(/打开【?小红书】?.*$/i, " ")
    .replace(/快来看吧[！!]?/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function fetchMetadata(url: string): Promise<LinkMetadata | null> {
  if (window.focusflowLinkParser) {
    return window.focusflowLinkParser.parse(url)
  }

  try {
    const response = await fetch(url)
    const html = await response.text()
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim()
    return { title, url: response.url || url }
  } catch {
    return null
  }
}

export async function createNoteDraftFromLink(input: string, groupId = DEFAULT_NOTE_GROUP_ID): Promise<NoteDraft> {
  const url = normalizeUrl(input)
  if (!url) throw new Error("INVALID_URL")

  const metadata = await fetchMetadata(url).catch(() => null)
  const sourceUrl = metadata?.url || url
  const platform = metadata?.siteName || getPlatformTag(sourceUrl)
  const sharedTitle = getTitleFromSharedText(input, url)
  const title = metadata?.title?.trim() || sharedTitle || `${platform}链接`
  const description = metadata?.description?.trim()
  const sharedBody = cleanSharedText(input, url)
  const body = metadata?.content?.trim() || description || (sharedBody && sharedBody !== title ? sharedBody : "")
  const image = metadata?.image?.trim()
  const tags = ["链接导入", platform].filter(Boolean).join(", ")
  const sourceLine = `${platform} · ${sourceUrl}`
  const content = [
    `<h1>${escapeHtml(title)}</h1>`,
    `<blockquote><p>${escapeHtml(sourceLine)}</p></blockquote>`,
    image ? `<p><img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" /></p>` : "",
    body ? `<p>${escapeHtml(body).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br />")}</p>` : "",
    `<p><a href="${escapeHtml(sourceUrl)}">${escapeHtml(sourceUrl)}</a></p>`,
  ].filter(Boolean).join("")

  return {
    groupId,
    title,
    content,
    tags,
    linkedTaskIds: [],
  }
}
