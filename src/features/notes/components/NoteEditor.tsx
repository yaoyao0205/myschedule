import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { mergeAttributes, Node } from "@tiptap/core"
import { DOMParser as ProseMirrorDOMParser } from "@tiptap/pm/model"
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Highlight from "@tiptap/extension-highlight"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
import Image from "@tiptap/extension-image"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight"
import { all, createLowlight } from "lowlight"
import { motion } from "framer-motion"
import {
  Bold,
  Check,
  ChevronDown,
  Code2,
  CopyPlus,
  FileClock,
  FolderKanban,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Pilcrow,
  MoreHorizontal,
  Strikethrough,
  Tags,
  UnderlineIcon,
  Video,
  WifiOff,
  X,
} from "lucide-react"
import { BottomSheet } from "../../../components/ui/BottomSheet"
import { ErrorBanner } from "../../../components/ui/ErrorBanner"
import { cn } from "../../../lib/cn"
import { createId } from "../../../lib/ids"
import type { Task } from "../../tasks/types"
import type { Note, NoteAttachment, NoteDraft, NoteGroup } from "../types"
import { escapeHtml, formatRelativeTime, markdownToHtml, noteToDraft } from "../utils"
import { RichCodeBlock } from "./RichCodeBlock"

const lowlight = createLowlight(all)

function normalizeUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  if (/^(https?:|mailto:|tel:|data:|blob:)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }
      reject(new Error("文件读取失败"))
    }
    reader.onerror = () => reject(new Error("文件读取失败"))
    reader.readAsDataURL(file)
  })
}

function looksLikeMarkdown(text: string) {
  const trimmed = text.trim()
  return /(^|\n)\s{0,3}#{1,6}\s+\S/.test(trimmed)
    || /(^|\n)\s{0,3}([-*+]|\d+\.)\s+\S/.test(trimmed)
    || /(^|\n)\s{0,3}>\s+\S/.test(trimmed)
    || /(^|\n)\s{0,3}```/.test(trimmed)
    || /(^|\n)\s{0,3}[-*+]\s+\[[ xX]\]\s+\S/.test(trimmed)
    || /!\[[^\]]*\]\([^)]+\)/.test(trimmed)
    || /\[[^\]]+\]\([^)]+\)/.test(trimmed)
    || /\*\*[^*]+\*\*/.test(trimmed)
    || /`[^`]+`/.test(trimmed)
}

const VideoBlock = Node.create({
  name: "videoBlock",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      src: {
        default: null,
      },
      title: {
        default: null,
      },
    }
  },
  parseHTML() {
    return [{ tag: "video[src]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "video",
      mergeAttributes(HTMLAttributes, {
        class: "ff-note-video",
        controls: "true",
        playsinline: "true",
        preload: "metadata",
      }),
    ]
  },
})

interface NoteEditorProps {
  note: Note
  noteGroups: NoteGroup[]
  reusableTags: string[]
  tasks: Task[]
  onClose: () => void
  onSave: (draft: NoteDraft) => void
}

export function NoteEditor({ note, noteGroups, reusableTags, tasks, onClose, onSave }: NoteEditorProps) {
  const initialDraft = useMemo(() => noteToDraft(note), [note.id])
  const [title, setTitle] = useState(initialDraft.title)
  const [groupId, setGroupId] = useState(initialDraft.groupId)
  const [content, setContent] = useState(initialDraft.content)
  const [tags, setTags] = useState(initialDraft.tags)
  const [linkedTaskIds, setLinkedTaskIds] = useState(initialDraft.linkedTaskIds)
  const [attachments, setAttachments] = useState<NoteAttachment[]>(initialDraft.attachments ?? [])
  const [titleError, setTitleError] = useState(false)
  const [savedVisible, setSavedVisible] = useState(false)
  const [slashOpen, setSlashOpen] = useState(false)
  const [taskSearchOpen, setTaskSearchOpen] = useState(false)
  const [linkedTasksOpen, setLinkedTasksOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)
  const didMount = useRef(false)
  const imageFileInputRef = useRef<HTMLInputElement | null>(null)
  const videoFileInputRef = useRef<HTMLInputElement | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(RichCodeBlock)
        },
      }).configure({
        defaultLanguage: "plaintext",
        lowlight,
      }),
      Link.configure({
        autolink: true,
        openOnClick: false,
      }),
      Highlight.configure({ multicolor: true }),
      Underline,
      Placeholder.configure({
        placeholder: "输入 #、-、>、--- 或 / 快速开始...",
      }),
      Image,
      VideoBlock,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
    ],
    content: initialDraft.content,
    editorProps: {
      attributes: {
        class: "ff-tiptap-editor min-h-[360px] px-4 py-3 outline-none",
      },
      handlePaste(view, event) {
        const html = event.clipboardData?.getData("text/html")
        const text = event.clipboardData?.getData("text/plain")
        if (!text || html || !looksLikeMarkdown(text)) return false

        const document = new window.DOMParser().parseFromString(markdownToHtml(text), "text/html")
        const slice = ProseMirrorDOMParser.fromSchema(view.state.schema).parseSlice(document.body)
        view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView())
        return true
      },
    },
    onUpdate({ editor: activeEditor }) {
      setContent(activeEditor.getHTML())
      const cursor = activeEditor.state.selection.from
      const before = activeEditor.state.doc.textBetween(Math.max(0, cursor - 2), cursor, "\n", "\n")
      setSlashOpen(before.endsWith("/"))
      setTaskSearchOpen(before.endsWith("[["))
    },
  })

  useEffect(() => {
    setTitle(initialDraft.title)
    setGroupId(initialDraft.groupId)
    setContent(initialDraft.content)
    setTags(initialDraft.tags)
    setLinkedTaskIds(initialDraft.linkedTaskIds)
    setAttachments(initialDraft.attachments ?? [])
    setLinkedTasksOpen(false)
    editor?.commands.setContent(initialDraft.content, { emitUpdate: false })
  }, [editor, initialDraft])

  useEffect(() => {
    function updateOnlineState() {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener("online", updateOnlineState)
    window.addEventListener("offline", updateOnlineState)
    return () => {
      window.removeEventListener("online", updateOnlineState)
      window.removeEventListener("offline", updateOnlineState)
    }
  }, [])

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true
      return
    }

    const timeout = window.setTimeout(() => {
      saveDraft()
    }, 800)

    return () => window.clearTimeout(timeout)
  }, [attachments, content, groupId, linkedTaskIds, tags, title])

  function buildDraft(): NoteDraft {
    return {
      groupId,
      title: title.trim() || "未命名笔记",
      content,
      tags,
      linkedTaskIds,
      attachments,
    }
  }

  function saveDraft() {
    if (!title.trim()) {
      setTitleError(true)
      return
    }

    onSave(buildDraft())
    setSavedVisible(true)
    window.setTimeout(() => setSavedVisible(false), 1500)
  }

  function closeAfterSave() {
    saveDraft()
    onClose()
  }

  function setLink() {
    if (!editor) return
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("输入链接地址", previousUrl ?? "https://")
    if (url === null) return

    if (!url) {
      editor.chain().focus().unsetLink().run()
      return
    }

    const href = normalizeUrl(url)
    const selectionEmpty = editor.state.selection.empty
    if (selectionEmpty) {
      const text = window.prompt("显示文字", href)
      if (text === null) return
      editor.chain().focus().insertContent(`<a href="${escapeHtml(href)}">${escapeHtml(text || href)}</a>`).run()
      return
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href }).run()
  }

  function deleteTrigger(length: number) {
    if (!editor) return
    const cursor = editor.state.selection.from
    editor.chain().focus().deleteRange({ from: Math.max(0, cursor - length), to: cursor }).run()
  }

  function insertImage(deleteShortcut = true) {
    if (!editor) return
    const url = window.prompt("输入图片地址")
    if (!url) return
    if (deleteShortcut) deleteTrigger(1)
    editor.chain().focus().setImage({ src: normalizeUrl(url) }).run()
    setSlashOpen(false)
  }

  function insertVideo(deleteShortcut = true) {
    if (!editor) return
    const url = window.prompt("输入视频地址")
    if (!url) return
    if (deleteShortcut) deleteTrigger(1)
    editor.chain().focus().insertContent({ type: "videoBlock", attrs: { src: normalizeUrl(url), title: "视频" } }).run()
    setSlashOpen(false)
  }

  function insertImageFile(file: File) {
    if (!editor || !file.type.startsWith("image/")) return
    readFileAsDataUrl(file).then((src) => {
      const attachment: NoteAttachment = {
        id: createId("attachment"),
        type: "image",
        name: file.name,
        src,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
        ocrStatus: window.focusflowCalendarOCR ? "processing" : "idle",
      }
      setAttachments((current) => [attachment, ...current])
      editor.chain().focus().setImage({ src, alt: file.name, title: file.name }).run()
      setSlashOpen(false)

      if (window.focusflowCalendarOCR) {
        window.focusflowCalendarOCR
          .recognizeImage({ dataUrl: src })
          .then((result) => {
            setAttachments((current) =>
              current.map((item) =>
                item.id === attachment.id
                  ? { ...item, ocrText: result.text.trim(), ocrStatus: result.text.trim() ? "done" : "idle" }
                  : item
              )
            )
          })
          .catch(() => {
            setAttachments((current) =>
              current.map((item) => (item.id === attachment.id ? { ...item, ocrStatus: "failed" } : item))
            )
          })
      }
    })
  }

  function insertVideoFile(file: File) {
    if (!editor || !file.type.startsWith("video/")) return
    readFileAsDataUrl(file).then((src) => {
      const attachment: NoteAttachment = {
        id: createId("attachment"),
        type: "video",
        name: file.name,
        src,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
        ocrStatus: "idle",
      }
      setAttachments((current) => [attachment, ...current])
      editor.chain().focus().insertContent({ type: "videoBlock", attrs: { src, title: file.name } }).run()
      setSlashOpen(false)
    })
  }

  function insertAttachmentOcrText(attachment: NoteAttachment) {
    if (!editor || !attachment.ocrText?.trim()) return
    editor
      .chain()
      .focus()
      .insertContent(`<blockquote><p>${escapeHtml(attachment.ocrText.trim()).replace(/\n/g, "<br>")}</p></blockquote>`)
      .run()
  }

  function removeAttachment(attachmentId: string) {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId))
  }

  function importMarkdown(deleteShortcut = false) {
    if (!editor) return
    const markdown = window.prompt("粘贴 Markdown 内容")
    if (!markdown) return
    if (deleteShortcut) deleteTrigger(1)
    editor.chain().focus().insertContent(markdownToHtml(markdown)).run()
    setSlashOpen(false)
  }

  function insertCodeBlock(deleteShortcut = true) {
    if (!editor) return
    if (deleteShortcut) deleteTrigger(1)
    editor.chain().focus().setCodeBlock({ language: "typescript" }).run()
    setSlashOpen(false)
  }

  function insertTaskReference(task: Task) {
    if (!editor) return
    const cursor = editor.state.selection.from
    const before = editor.state.doc.textBetween(Math.max(0, cursor - 2), cursor, "\n", "\n")
    if (before.endsWith("[[")) {
      deleteTrigger(2)
    } else if (before.endsWith("/")) {
      deleteTrigger(1)
    }

    const dueDate = task.dueDate ? ` · ${task.dueDate}` : ""
    editor
      .chain()
      .focus()
      .insertContent(
        `<span class="ff-task-ref" data-task-id="${task.id}">${escapeHtml(task.title)} · ${task.completed ? "完成" : "进行中"}${dueDate}</span> `
      )
      .run()
    setLinkedTaskIds((current) => (current.includes(task.id) ? current : [...current, task.id]))
    setTaskSearchOpen(false)
    setSlashOpen(false)
  }

  function toggleLinkedTask(taskId: string) {
    setLinkedTaskIds((current) =>
      current.includes(taskId) ? current.filter((id) => id !== taskId) : [...current, taskId]
    )
  }

  function toggleReusableTag(tag: string) {
    const currentTags = tags
      .split(/[,，]/)
      .map((item) => item.trim().replace(/^#/, ""))
      .filter(Boolean)
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter((item) => item !== tag)
      : [...currentTags, tag]
    setTags(nextTags.join(", "))
  }

  const selectedTags = useMemo(
    () =>
      new Set(
        tags
          .split(/[,，]/)
          .map((tag) => tag.trim().replace(/^#/, ""))
          .filter(Boolean)
      ),
    [tags]
  )
  const linkedTasks = tasks.filter((task) => linkedTaskIds.includes(task.id))

  return (
    <BottomSheet ariaLabel="编辑笔记" className="max-w-6xl" onClose={closeAfterSave}>
      <div className="grid max-h-[92vh] overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-h-0 overflow-y-auto p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--ff-brand)]">Tiptap Editor</p>
              <h2 className="text-xl font-medium text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">富文本笔记</h2>
            </div>
            <div className="flex items-center gap-2">
              {savedVisible ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ff-teal-soft)] px-3 py-1 text-xs font-medium text-[var(--ff-teal-text)]">
                  <Check className="h-3.5 w-3.5" />
                  已保存
                </span>
              ) : null}
              <button className="ff-icon-button h-11 w-11" type="button" onClick={() => setHistoryOpen((value) => !value)} aria-label="更多">
                <MoreHorizontal className="h-5 w-5" />
              </button>
              <button className="ff-icon-button h-11 w-11" type="button" onClick={closeAfterSave} aria-label="关闭">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!isOnline ? (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--ff-warning)]/30 bg-[var(--ff-warning-soft)] px-3 py-2 text-sm font-medium text-[var(--ff-warning)]">
              <WifiOff className="h-4 w-4" />
              离线模式，稍后同步
            </div>
          ) : null}

          {titleError ? <ErrorBanner message="请先给笔记一个标题，方便之后搜索和关联任务。" /> : null}

          <label className="block">
            <span className="text-sm font-medium text-[var(--ff-ink-700)] dark:text-[var(--ff-text)]">标题</span>
            <input
              autoFocus
              className="ff-input mt-2 w-full px-4 py-3 text-base outline-none"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                setTitleError(false)
              }}
              placeholder="例如：下次产品会议记录"
            />
          </label>

          <div className="relative mt-4 overflow-hidden rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)]">
            {editor ? (
              <EditorToolbar
                editor={editor}
                onInsertCode={() => insertCodeBlock(false)}
                onLink={setLink}
                onImportMarkdown={() => importMarkdown(false)}
                onUploadImage={() => imageFileInputRef.current?.click()}
                onUploadVideo={() => videoFileInputRef.current?.click()}
              />
            ) : null}

            <input
              ref={imageFileInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) insertImageFile(file)
                event.target.value = ""
              }}
            />
            <input
              ref={videoFileInputRef}
              className="hidden"
              type="file"
              accept="video/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) insertVideoFile(file)
                event.target.value = ""
              }}
            />

            {editor ? (
              <BubbleMenu
                editor={editor}
                shouldShow={({ editor: activeEditor }) => !activeEditor.state.selection.empty}
                options={{ placement: "top" }}
              >
                <motion.div
                  className="ff-popover flex items-center gap-1 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-1"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <ToolbarButton active={editor.isActive("bold")} label="加粗" onClick={() => editor.chain().focus().toggleBold().run()} icon={<Bold className="h-4 w-4" />} />
                  <ToolbarButton active={editor.isActive("italic")} label="斜体" onClick={() => editor.chain().focus().toggleItalic().run()} icon={<Italic className="h-4 w-4" />} />
                  <ToolbarButton active={editor.isActive("underline")} label="下划线" onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineIcon className="h-4 w-4" />} />
                  <ToolbarButton active={editor.isActive("link")} label="链接" onClick={setLink} icon={<Link2 className="h-4 w-4" />} />
                  <ToolbarButton active={editor.isActive("highlight")} label="高亮" onClick={() => editor.chain().focus().toggleHighlight({ color: "#EBF2FC" }).run()} icon={<Highlighter className="h-4 w-4" />} />
                  <ToolbarButton active={editor.isActive("strike")} label="删除线" onClick={() => editor.chain().focus().toggleStrike().run()} icon={<Strikethrough className="h-4 w-4" />} />
                </motion.div>
              </BubbleMenu>
            ) : null}

            <EditorContent editor={editor} />

            {slashOpen ? (
              <CommandPanel
                onInsertCode={insertCodeBlock}
                onInsertImage={insertImage}
                onInsertVideo={insertVideo}
                onImportMarkdown={importMarkdown}
                onOpenTasks={() => {
                  setTaskSearchOpen(true)
                  setSlashOpen(false)
                }}
              />
            ) : null}

            {taskSearchOpen ? (
              <TaskReferencePanel tasks={tasks} onSelect={insertTaskReference} />
            ) : null}
          </div>
        </section>

        <aside className="min-h-0 overflow-y-auto border-t border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-4 lg:border-l lg:border-t-0">
          <label className="block">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ff-ink-700)] dark:text-[var(--ff-text)]">
              <FolderKanban className="h-4 w-4" />
              分组
            </span>
            <select
              className="ff-input mt-2 w-full px-4 py-3 text-sm outline-none"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            >
              {noteGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-5 block">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ff-ink-700)] dark:text-[var(--ff-text)]">
              <Tags className="h-4 w-4" />
              标签
            </span>
            <input
              className="ff-input mt-2 w-full px-4 py-3 text-sm outline-none"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="产品, 会议；正文输入 #标签 也会自动创建"
            />
          </label>
          {reusableTags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {reusableTags.map((tag) => {
                const active = selectedTags.has(tag)
                return (
                  <button
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium transition",
                      active
                        ? "border-[var(--ff-brand)] bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]"
                        : "border-[var(--ff-border)] bg-[var(--ff-surface)] text-[var(--ff-ink-500)] hover:border-[var(--ff-border-strong)]"
                    )}
                    type="button"
                    key={tag}
                    onClick={() => toggleReusableTag(tag)}
                  >
                    #{tag}
                  </button>
                )
              })}
            </div>
          ) : null}

          <div className="mt-5">
            <button
              className="flex w-full items-center justify-between gap-3 rounded-xl px-1 py-1 text-left text-sm font-semibold text-[var(--ff-ink-900)] transition hover:text-[var(--ff-brand)] dark:text-[var(--ff-text)]"
              type="button"
              aria-expanded={linkedTasksOpen}
              onClick={() => setLinkedTasksOpen((open) => !open)}
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <ListChecks className="h-4 w-4 shrink-0 text-[var(--ff-brand)]" />
                关联任务
                {linkedTasks.length ? (
                  <span className="rounded-full bg-[var(--ff-surface)] px-2 py-0.5 text-xs font-medium text-[var(--ff-ink-500)]">
                    {linkedTasks.length}
                  </span>
                ) : null}
              </span>
              <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--ff-ink-500)] transition", linkedTasksOpen && "rotate-180")} />
            </button>
            {linkedTasksOpen ? (
              <div className="mt-3 space-y-2">
                {tasks.map((task) => (
                  <label className="ff-card flex min-h-14 items-start gap-3 p-3 text-sm" key={task.id}>
                    <input
                      checked={linkedTaskIds.includes(task.id)}
                      className="mt-1 h-5 w-5 rounded border-[var(--ff-border)] text-[var(--ff-brand)] focus:ring-[var(--ff-brand)]"
                      type="checkbox"
                      onChange={() => toggleLinkedTask(task.id)}
                    />
                    <span className="min-w-0">
                      <strong className="block truncate text-[var(--ff-ink-700)] dark:text-[var(--ff-text)]">{task.title}</strong>
                      <span className="text-xs text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">
                        {task.completed ? "完成" : "进行中"} {task.dueDate ? `· ${task.dueDate}` : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {linkedTasks.length ? (
            <div className="mt-5 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-3">
              <p className="text-xs font-semibold text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">已插入引用</p>
              <div className="mt-2 space-y-2">
                {linkedTasks.map((task) => (
                  <div className="text-sm text-[var(--ff-ink-700)] dark:text-[var(--ff-text)]" key={task.id}>
                    {task.title}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <AttachmentLibrary
            attachments={attachments}
            onInsertOcrText={insertAttachmentOcrText}
            onRemove={removeAttachment}
          />

          {historyOpen ? (
            <div className="mt-5 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-3">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">
                <FileClock className="h-4 w-4 text-[var(--ff-brand)]" />
                版本历史
              </h3>
              <div className="mt-3 space-y-2">
                {(note.versions ?? []).length ? (
                  (note.versions ?? []).slice(0, 20).map((version) => (
                    <div className="rounded-lg bg-[var(--ff-surface-muted)] p-2 text-xs text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]" key={version.id}>
                      <p className="font-medium text-[var(--ff-ink-700)] dark:text-[var(--ff-text)]">{version.title || "未命名笔记"}</p>
                      <p>{formatRelativeTime(version.savedAt)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">保存后会自动记录最近 20 个版本。</p>
                )}
              </div>
            </div>
          ) : null}

          <div className="sticky bottom-0 mt-5 flex justify-end gap-3 bg-[var(--ff-surface-muted)] pt-3">
            <button className="ff-button-secondary px-4 py-3 text-sm" type="button" onClick={closeAfterSave}>
              完成
            </button>
          </div>
        </aside>
      </div>
    </BottomSheet>
  )
}

function EditorToolbar({
  editor,
  onInsertCode,
  onLink,
  onImportMarkdown,
  onUploadImage,
  onUploadVideo,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>
  onInsertCode: () => void
  onLink: () => void
  onImportMarkdown: () => void
  onUploadImage: () => void
  onUploadVideo: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-2">
      <ToolbarButton active={editor.isActive("bold")} label="加粗" onClick={() => editor.chain().focus().toggleBold().run()} icon={<Bold className="h-4 w-4" />} />
      <ToolbarButton active={editor.isActive("italic")} label="斜体" onClick={() => editor.chain().focus().toggleItalic().run()} icon={<Italic className="h-4 w-4" />} />
      <ToolbarButton active={editor.isActive("underline")} label="下划线" onClick={() => editor.chain().focus().toggleUnderline().run()} icon={<UnderlineIcon className="h-4 w-4" />} />
      <ToolbarButton active={editor.isActive("highlight")} label="高亮" onClick={() => editor.chain().focus().toggleHighlight({ color: "#F8E9A6" }).run()} icon={<Highlighter className="h-4 w-4" />} />
      <ToolbarButton active={editor.isActive("bulletList")} label="无序列表" onClick={() => editor.chain().focus().toggleBulletList().run()} icon={<List className="h-4 w-4" />} />
      <ToolbarButton active={editor.isActive("orderedList")} label="有序列表" onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={<ListOrdered className="h-4 w-4" />} />
      <ToolbarButton active={editor.isActive("taskList")} label="待办列表" onClick={() => editor.chain().focus().toggleTaskList().run()} icon={<ListChecks className="h-4 w-4" />} />
      <ToolbarButton active={editor.isActive("strike")} label="删除线" onClick={() => editor.chain().focus().toggleStrike().run()} icon={<Strikethrough className="h-4 w-4" />} />
      <ToolbarButton active={editor.isActive("link")} label="链接" onClick={onLink} icon={<Link2 className="h-4 w-4" />} />
      <ToolbarButton label="插入图片" onClick={onUploadImage} icon={<ImageIcon className="h-4 w-4" />} />
      <ToolbarButton label="插入视频" onClick={onUploadVideo} icon={<Video className="h-4 w-4" />} />
      <ToolbarButton label="导入 Markdown" onClick={onImportMarkdown} icon={<Pilcrow className="h-4 w-4" />} />
      <ToolbarButton active={editor.isActive("codeBlock")} label="代码块" onClick={onInsertCode} icon={<Code2 className="h-4 w-4" />} />
    </div>
  )
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "未知大小"
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

interface AttachmentLibraryProps {
  attachments: NoteAttachment[]
  onInsertOcrText: (attachment: NoteAttachment) => void
  onRemove: (attachmentId: string) => void
}

function AttachmentLibrary({ attachments, onInsertOcrText, onRemove }: AttachmentLibraryProps) {
  return (
    <div className="mt-5 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">
          <ImageIcon className="h-4 w-4 text-[var(--ff-brand)]" />
          附件库
        </h3>
        {attachments.length ? (
          <span className="rounded-full bg-[var(--ff-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--ff-ink-500)]">
            {attachments.length}
          </span>
        ) : null}
      </div>

      {attachments.length ? (
        <div className="mt-3 space-y-3">
          {attachments.map((attachment) => (
            <article className="rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-2" key={attachment.id}>
              <div className="flex gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface)]">
                  {attachment.type === "image" ? (
                    <img className="h-full w-full object-cover" src={attachment.src} alt={attachment.name} />
                  ) : (
                    <Video className="h-6 w-6 text-[var(--ff-ink-500)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">{attachment.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">
                    {attachment.type === "image" ? "图片" : "视频"} · {formatFileSize(attachment.size)}
                  </p>
                  {attachment.type === "image" ? (
                    <p className="mt-1 text-xs text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">
                      {attachment.ocrStatus === "processing"
                        ? "OCR 识别中..."
                        : attachment.ocrStatus === "failed"
                          ? "OCR 识别失败"
                          : attachment.ocrText
                            ? "已识别图片文字"
                            : "暂无 OCR 文本"}
                    </p>
                  ) : null}
                </div>
                <button className="ff-icon-button h-8 w-8 shrink-0" type="button" aria-label="移除附件" onClick={() => onRemove(attachment.id)}>
                  <X className="h-4 w-4" />
                </button>
              </div>

              {attachment.ocrText ? (
                <div className="mt-2 rounded-lg bg-[var(--ff-surface)] p-2">
                  <p className="ff-line-clamp-3 text-xs leading-5 text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">
                    {attachment.ocrText}
                  </p>
                  <button
                    className="mt-2 inline-flex items-center gap-1 rounded-lg border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] px-2.5 py-1.5 text-xs font-semibold text-[var(--ff-ink-700)] transition hover:border-[var(--ff-brand)] hover:text-[var(--ff-brand-text)] dark:text-[var(--ff-text)]"
                    type="button"
                    onClick={() => onInsertOcrText(attachment)}
                  >
                    <CopyPlus className="h-3.5 w-3.5" />
                    插入识别文字
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-[var(--ff-surface-muted)] p-3 text-sm text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">
          上传到笔记里的图片和视频会显示在这里。
        </p>
      )}
    </div>
  )
}

interface ToolbarButtonProps {
  active?: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}

function ToolbarButton({ active, icon, label, onClick }: ToolbarButtonProps) {
  return (
    <button
      className={cn(
        "grid h-9 min-h-9 w-9 min-w-9 place-items-center rounded-lg text-[var(--ff-ink-500)] transition hover:bg-[var(--ff-surface-muted)]",
        active && "bg-[var(--ff-brand-soft)] text-[var(--ff-brand-text)]"
      )}
      type="button"
      aria-label={label}
      onClick={onClick}
    >
      {icon}
    </button>
  )
}

interface CommandPanelProps {
  onInsertCode: () => void
  onInsertImage: () => void
  onInsertVideo: () => void
  onImportMarkdown: () => void
  onOpenTasks: () => void
}

function CommandPanel({ onInsertCode, onInsertImage, onInsertVideo, onImportMarkdown, onOpenTasks }: CommandPanelProps) {
  return (
    <motion.div
      className="ff-popover absolute left-4 top-16 z-20 w-64 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-2"
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <CommandButton icon={<ImageIcon className="h-4 w-4" />} label="插入图片链接" onClick={onInsertImage} />
      <CommandButton icon={<Video className="h-4 w-4" />} label="插入视频链接" onClick={onInsertVideo} />
      <CommandButton icon={<Pilcrow className="h-4 w-4" />} label="导入 Markdown" onClick={onImportMarkdown} />
      <CommandButton icon={<Code2 className="h-4 w-4" />} label="代码块" onClick={onInsertCode} />
      <CommandButton icon={<ListChecks className="h-4 w-4" />} label="任务关联" onClick={onOpenTasks} />
    </motion.div>
  )
}

interface CommandButtonProps {
  icon: ReactNode
  label: string
  onClick: () => void
}

function CommandButton({ icon, label, onClick }: CommandButtonProps) {
  return (
    <button
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--ff-ink-500)] hover:bg-[var(--ff-surface-muted)] dark:text-[var(--ff-muted)]"
      type="button"
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  )
}

interface TaskReferencePanelProps {
  tasks: Task[]
  onSelect: (task: Task) => void
}

function TaskReferencePanel({ tasks, onSelect }: TaskReferencePanelProps) {
  return (
    <motion.div
      className="ff-popover absolute left-4 top-16 z-30 w-80 rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)] p-2"
      initial={{ opacity: 0, scale: 0.96, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <p className="px-3 py-2 text-xs font-semibold text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">选择任务引用</p>
      {tasks.slice(0, 8).map((task) => (
        <button
          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--ff-surface-muted)]"
          type="button"
          key={task.id}
          onClick={() => onSelect(task)}
        >
          <span className="min-w-0 truncate text-[var(--ff-ink-700)] dark:text-[var(--ff-text)]">{task.title}</span>
          <span className="ff-tag shrink-0">{task.completed ? "完成" : "进行中"}</span>
        </button>
      ))}
    </motion.div>
  )
}
