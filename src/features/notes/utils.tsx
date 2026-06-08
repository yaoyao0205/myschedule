import type { ReactNode } from "react"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"
import { DEFAULT_NOTE_GROUP_ID, type Note, type NoteDraft, type NoteGroup } from "./types"

const tagToneClasses = [
  "bg-[var(--ff-slate-soft)] text-[var(--ff-slate)]",
  "bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]",
  "bg-[var(--ff-teal-soft)] text-[var(--ff-teal-text)]",
]

export function createEmptyNoteDraft(): NoteDraft {
  return {
    groupId: DEFAULT_NOTE_GROUP_ID,
    title: "未命名笔记",
    content: "<p></p>",
    tags: "",
    linkedTaskIds: [],
    attachments: [],
  }
}

export function noteToDraft(note: Note): NoteDraft {
  return {
    groupId: note.groupId || DEFAULT_NOTE_GROUP_ID,
    title: note.title,
    content: normalizeNoteContent(note.content),
    tags: note.tags.join(", "),
    linkedTaskIds: note.linkedTaskIds,
    attachments: note.attachments ?? [],
  }
}

export function parseNoteTags(tags: string, content = ""): string[] {
  const explicitTags = tags
    .split(/[,，]/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)

  const inlineTags = Array.from(content.matchAll(/(^|\s)#([\p{L}\p{N}_-]{1,24})/gu)).map((match) => match[2])

  return Array.from(new Set([...explicitTags, ...inlineTags].filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "zh-CN")
  )
}

export function normalizeNoteContent(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return "<p></p>"
  if (trimmed.startsWith("<")) return content
  return markdownToHtml(content)
}

export function markdownToHtml(content: string): string {
  const lines = content.split("\n")
  const html: string[] = []
  let inList = false
  let inOrderedList = false
  let inTaskList = false
  let inCodeBlock = false
  let codeLanguage = ""
  let codeLines: string[] = []

  function closeLists() {
    if (inList) {
      html.push("</ul>")
      inList = false
    }
    if (inOrderedList) {
      html.push("</ol>")
      inOrderedList = false
    }
    if (inTaskList) {
      html.push("</ul>")
      inTaskList = false
    }
  }

  function closeCodeBlock() {
    html.push(
      `<pre><code${codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : ""}>${escapeHtml(codeLines.join("\n"))}</code></pre>`
    )
    inCodeBlock = false
    codeLanguage = ""
    codeLines = []
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("```")) {
      if (inCodeBlock) {
        closeCodeBlock()
      } else {
        closeLists()
        inCodeBlock = true
        codeLanguage = trimmed.slice(3).trim()
        codeLines = []
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    if (!trimmed) {
      closeLists()
      html.push("<p></p>")
      continue
    }

    if (trimmed === "---" || trimmed === "***" || trimmed === "___") {
      closeLists()
      html.push("<hr>")
      continue
    }

    const taskMatch = trimmed.match(/^[-*]\s+\[( |x|X)\]\s+(.+)$/)
    if (taskMatch) {
      if (!inTaskList) {
        closeLists()
        html.push('<ul data-type="taskList">')
        inTaskList = true
      }
      const checked = taskMatch[1].toLowerCase() === "x" ? ' data-checked="true"' : ' data-checked="false"'
      html.push(`<li data-type="taskItem"${checked}><label><input type="checkbox"${checked.includes("true") ? " checked" : ""}></label><div><p>${formatInlineMarkdown(taskMatch[2])}</p></div></li>`)
      continue
    }

    if (trimmed.startsWith("- ")) {
      if (!inList) {
        closeLists()
        html.push("<ul>")
        inList = true
      }
      html.push(`<li><p>${formatInlineMarkdown(trimmed.slice(2))}</p></li>`)
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      if (!inOrderedList) {
        closeLists()
        html.push("<ol>")
        inOrderedList = true
      }
      html.push(`<li><p>${formatInlineMarkdown(orderedMatch[1])}</p></li>`)
      continue
    }

    closeLists()

    if (trimmed.startsWith("### ")) {
      html.push(`<h3>${formatInlineMarkdown(trimmed.slice(4))}</h3>`)
    } else if (trimmed.startsWith("## ")) {
      html.push(`<h2>${formatInlineMarkdown(trimmed.slice(3))}</h2>`)
    } else if (trimmed.startsWith("# ")) {
      html.push(`<h1>${formatInlineMarkdown(trimmed.slice(2))}</h1>`)
    } else if (trimmed.startsWith("> ")) {
      html.push(`<blockquote><p>${formatInlineMarkdown(trimmed.slice(2))}</p></blockquote>`)
    } else {
      html.push(`<p>${formatInlineMarkdown(trimmed)}</p>`)
    }
  }

  if (inCodeBlock) {
    closeCodeBlock()
  }
  closeLists()

  return html.join("")
}

function formatInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/g, '<img src="$2" alt="$1" title="$3">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

export function getPlainText(content: string): string {
  return normalizeNoteContent(content)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

export function getNoteSummary(content: string, maxLength = 120): string {
  const plainText = getPlainText(content)
  if (plainText.length <= maxLength) return plainText
  return `${plainText.slice(0, maxLength).trim()}...`
}

export function getWordCount(content: string): number {
  return getPlainText(content).replace(/\s/g, "").length
}

export function formatRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: zhCN })
}

export function getTagTone(tag: string): string {
  const sum = Array.from(tag).reduce((value, char) => value + char.charCodeAt(0), 0)
  return tagToneClasses[sum % tagToneClasses.length]
}

export function highlightText(text: string, query: string): ReactNode {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return text

  const chunks = text.split(new RegExp(`(${escapeRegExp(normalizedQuery)})`, "gi"))
  return chunks.map((chunk, index) =>
    chunk.toLowerCase() === normalizedQuery.toLowerCase() ? (
      <mark className="rounded bg-[var(--ff-brand-soft)] px-0.5 text-inherit" key={`${chunk}-${index}`}>
        {chunk}
      </mark>
    ) : (
      chunk
    )
  )
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export function renderNoteHtml(content: string): ReactNode {
  return (
    <div
      className="ff-note-content"
      dangerouslySetInnerHTML={{ __html: normalizeNoteContent(content) }}
    />
  )
}

export interface NoteListGroup {
  id: string
  name: string
  description: string
  notes: Note[]
}

export function buildNoteListGroups(notes: Note[], noteGroups: NoteGroup[]): NoteListGroup[] {
  return [...noteGroups]
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description || "自定义分组，用来按项目、主题或场景收纳笔记。",
      notes: notes.filter((note) => (note.groupId || DEFAULT_NOTE_GROUP_ID) === group.id),
    }))
    .filter((group) => group.notes.length > 0)
}
