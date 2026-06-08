import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Eye, FilePlus2, FolderKanban, ImageIcon, Link2, Pencil, Pin, Search, Trash2, Video, X } from "lucide-react"
import { siameseCopy } from "../../../components/brand/copy"
import { useTopBarSlot } from "../../../components/layout/topBarSlot"
import { BottomSheet } from "../../../components/ui/BottomSheet"
import { EmptyState } from "../../../components/ui/EmptyState"
import { useToast } from "../../../components/ui/ToastProvider"
import { cn } from "../../../lib/cn"
import { useTaskStore } from "../../tasks/store/taskStore"
import type { Task } from "../../tasks/types"
import { DEFAULT_NOTE_GROUP_ID, type Note, type NoteDraft, type NoteGroup } from "../types"
import { useNoteStore } from "../store/noteStore"
import {
  buildNoteListGroups,
  createEmptyNoteDraft,
  formatRelativeTime,
  getNoteSummary,
  getPlainText,
  getTagTone,
  getWordCount,
  highlightText,
  type NoteListGroup,
  renderNoteHtml,
} from "../utils"
import { NoteEditor } from "./NoteEditor"
import { createNoteDraftFromLink } from "../linkImport"

export function NotesPage() {
  const { notes, noteGroups, addNoteGroup, addNote, updateNote, deleteNote, togglePinned } = useNoteStore()
  const { tasks, toggleTask } = useTaskStore()
  const { notify } = useToast()
  const topBarSlot = useTopBarSlot()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [activeGroupId, setActiveGroupId] = useState("all")
  const [activeTag, setActiveTag] = useState("all")
  const [newGroupName, setNewGroupName] = useState("")
  const [editingNote, setEditingNote] = useState<Note | undefined>()
  const [viewingNote, setViewingNote] = useState<Note | undefined>()
  const [editorOpen, setEditorOpen] = useState(false)
  const [linkImportOpen, setLinkImportOpen] = useState(false)
  const [linkImportValue, setLinkImportValue] = useState("")
  const [linkImportLoading, setLinkImportLoading] = useState(false)

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 300)
    return () => window.clearTimeout(timeout)
  }, [query])

  const tags = useMemo(() => Array.from(new Set(notes.flatMap((note) => note.tags))).sort(), [notes])
  const filteredNotes = useMemo(() => {
    const normalizedQuery = debouncedQuery.trim().toLowerCase()

    return notes
      .filter((note) => {
        const matchesGroup = activeGroupId === "all" || note.groupId === activeGroupId
        if (!matchesGroup) return false
        const matchesTag = activeTag === "all" || note.tags.includes(activeTag)
        if (!matchesTag) return false
        if (!normalizedQuery) return true

        const attachmentText = (note.attachments ?? [])
          .flatMap((attachment) => [attachment.name, attachment.ocrText ?? ""])
          .join(" ")
        const haystack = [note.title, getPlainText(note.content), attachmentText, ...note.tags].join(" ").toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .sort((left, right) => {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      })
  }, [activeGroupId, activeTag, debouncedQuery, notes])

  const pinnedNotes = filteredNotes.filter((note) => note.pinned)
  const regularNotes = filteredNotes.filter((note) => !note.pinned)
  const regularNoteGroups = useMemo(
    () => buildNoteListGroups(regularNotes, activeGroupId === "all" ? noteGroups : noteGroups.filter((group) => group.id === activeGroupId)),
    [activeGroupId, noteGroups, regularNotes]
  )
  const notesByGroupCount = useMemo(
    () =>
      noteGroups.reduce<Record<string, number>>((counts, group) => {
        counts[group.id] = notes.filter((note) => (note.groupId || DEFAULT_NOTE_GROUP_ID) === group.id).length
        return counts
      }, {}),
    [noteGroups, notes]
  )
  const activeNote = editingNote ? notes.find((note) => note.id === editingNote.id) ?? editingNote : undefined
  const activeViewingNote = viewingNote ? notes.find((note) => note.id === viewingNote.id) ?? viewingNote : undefined

  function handleCreate() {
    const draft = createEmptyNoteDraft()
    const groupId = activeGroupId === "all" ? draft.groupId : activeGroupId
    const note = addNote({ ...draft, groupId })
    setEditingNote(note)
    setEditorOpen(true)
    notify("已创建本地笔记草稿", "success")
  }

  function handleEdit(note: Note) {
    setEditingNote(note)
    setViewingNote(undefined)
    setEditorOpen(true)
  }

  function handleView(note: Note) {
    setViewingNote(note)
  }

  function handleSave(draft: NoteDraft) {
    if (editingNote) {
      updateNote(editingNote.id, draft)
    }
  }

  async function handleImportLink() {
    if (!linkImportValue.trim()) {
      notify("先粘贴一段分享链接", "info")
      return
    }

    setLinkImportLoading(true)
    try {
      const groupId = activeGroupId === "all" ? undefined : activeGroupId
      const draft = await createNoteDraftFromLink(linkImportValue, groupId)
      const note = addNote(draft)
      setLinkImportOpen(false)
      setLinkImportValue("")
      setEditingNote(note)
      setViewingNote(undefined)
      setEditorOpen(true)
      notify("链接已解析成本地笔记", "success")
    } catch {
      notify("没有识别到可解析的链接", "warning")
    } finally {
      setLinkImportLoading(false)
    }
  }

  function handleDelete(noteId: string) {
    deleteNote(noteId)
    notify("笔记已删除", "info")
  }

  function clearFilters() {
    setQuery("")
    setDebouncedQuery("")
    setActiveGroupId("all")
    setActiveTag("all")
  }

  function handleAddNoteGroup() {
    const groupId = addNoteGroup(newGroupName)
    if (!groupId) {
      notify("先写一个分组名称", "info")
      return
    }
    setNewGroupName("")
    setActiveGroupId(groupId)
    notify("笔记分组已创建", "success")
  }

  useEffect(() => {
    const filtersPanel = (
      <div className="space-y-2">
        <div className="flex min-w-0 items-center gap-2 lg:hidden">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
            <button
              className={cn("whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold", activeGroupId === "all" ? "ff-tag-active" : "ff-button-secondary")}
              type="button"
              onClick={() => setActiveGroupId("all")}
            >
              🗂️ 全部分组
            </button>
            {noteGroups.map((group) => (
              <button
                className={cn("whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold", activeGroupId === group.id ? "ff-tag-active" : "ff-button-secondary")}
                key={group.id}
                type="button"
                onClick={() => setActiveGroupId(group.id)}
              >
                <FolderKanban className="h-4 w-4" />
                {group.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto">
          <button
            className={cn("whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold", activeTag === "all" ? "ff-tag-active" : "ff-button-secondary")}
            type="button"
            onClick={() => setActiveTag("all")}
          >
            🏷️ 全部
          </button>
          {tags.map((tag) => (
            <button
              className={cn("whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold", activeTag === tag ? "ff-tag-active" : "ff-button-secondary")}
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>
    )

    const desktopSearchInput = (
      <div className="flex min-w-0 items-center justify-end gap-2">
        <label className="ff-input flex min-h-10 w-full max-w-xs items-center gap-2 px-3 text-[var(--ff-ink-500)]">
          <Search className="h-4 w-4 shrink-0" />
          <input
            className="w-full bg-transparent text-sm text-[var(--ff-ink-900)] outline-none placeholder:text-[var(--ff-ink-400)] dark:text-[var(--ff-text)]"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索笔记"
          />
        </label>
        <button className="ff-button-secondary h-10 shrink-0 rounded-2xl px-4 text-sm" type="button" onClick={() => setLinkImportOpen(true)}>
          <Link2 className="h-4 w-4" />
          链接导入
        </button>
        <button className="ff-button-primary h-10 shrink-0 rounded-2xl px-4 text-sm" type="button" onClick={handleCreate}>
          <FilePlus2 className="h-4 w-4" />
          新建笔记
        </button>
      </div>
    )

    topBarSlot?.setTopBarSlot({
      desktop: desktopSearchInput,
      mobileAction: (
        <button className="ff-button-primary h-10 w-10 shrink-0 rounded-2xl p-0" type="button" aria-label="新建笔记" onClick={handleCreate}>
          <FilePlus2 className="h-4 w-4" />
        </button>
      ),
      mobilePanel: (
        <div className="space-y-2">
          <label className="ff-input flex h-10 min-h-10 items-center gap-2 px-3 text-[var(--ff-ink-500)]">
            <Search className="h-4 w-4 shrink-0" />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ff-ink-900)] outline-none placeholder:text-[var(--ff-ink-400)] dark:text-[var(--ff-text)]"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索"
            />
          </label>
          <button className="ff-button-secondary h-10 w-full justify-center rounded-2xl px-4 text-sm" type="button" onClick={() => setLinkImportOpen(true)}>
            <Link2 className="h-4 w-4" />
            链接导入
          </button>
          {filtersPanel}
        </div>
      ),
    })

    return () => topBarSlot?.setTopBarSlot(null)
  }, [activeGroupId, activeTag, newGroupName, query, tags, noteGroups, topBarSlot])

  return (
    <div className="mx-auto grid h-full min-h-0 w-full max-w-7xl grid-rows-[minmax(0,1fr)]">

      <button
        className="ff-button-primary fixed bottom-24 right-5 z-30 grid h-12 w-12 place-items-center rounded-full p-0 shadow-[0_12px_28px_rgba(59,125,216,0.22)] sm:bottom-6 sm:right-6"
        type="button"
        onClick={handleCreate}
        aria-label="新建笔记"
        title="新建笔记"
      >
        <FilePlus2 className="h-5 w-5" />
      </button>

      <div className="grid min-h-0 gap-2 lg:grid-cols-[240px_minmax(0,1fr)]">
        <NoteGroupSidebar
          activeGroupId={activeGroupId}
          allCount={notes.length}
          groupCounts={notesByGroupCount}
          groups={noteGroups}
          newGroupName={newGroupName}
          onAddGroup={handleAddNoteGroup}
          onCreateNote={handleCreate}
          onNewGroupNameChange={setNewGroupName}
          onSelectGroup={setActiveGroupId}
        />

        {filteredNotes.length === 0 ? (
          <EmptyState
            title={notes.length === 0 ? siameseCopy.empty.notes : "没有匹配的笔记"}
            description={notes.length === 0 ? "先留着，灵感会自己冒泡。🫧" : "清空条件后再看一遍。🔎"}
            actionLabel={notes.length === 0 ? "写下第一篇笔记" : "清空筛选"}
            onAction={notes.length === 0 ? handleCreate : clearFilters}
            pose="curious"
          />
        ) : (
          <div className="min-h-0 overflow-y-auto pr-1">
            <div className="space-y-6">
            {pinnedNotes.length ? (
              <section>
                <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[var(--ff-brand-text)] dark:text-[var(--ff-brand-text)]">
                  <Pin className="h-4 w-4" />
                  📌 已钉住
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {pinnedNotes.map((note) => (
                    <NoteCard
                      activeQuery={debouncedQuery}
                      key={note.id}
                      note={note}
                      tasks={tasks}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onView={handleView}
                      onTogglePinned={togglePinned}
                      onToggleTask={toggleTask}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {regularNoteGroups.map((group) => (
              <NoteGroupSection
                activeQuery={debouncedQuery}
                group={group}
                key={group.id}
                tasks={tasks}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onView={handleView}
                onTogglePinned={togglePinned}
                onToggleTask={toggleTask}
              />
            ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {editorOpen && activeNote ? (
          <NoteEditor
            key={activeNote.id}
            note={activeNote}
            noteGroups={noteGroups}
            reusableTags={tags}
            tasks={tasks}
            onClose={() => {
              setEditorOpen(false)
              setEditingNote(undefined)
            }}
            onSave={handleSave}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {activeViewingNote ? (
          <NoteViewer
            note={activeViewingNote}
            tasks={tasks}
            onClose={() => setViewingNote(undefined)}
            onEdit={() => handleEdit(activeViewingNote)}
            onToggleTask={toggleTask}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {linkImportOpen ? (
          <LinkImportSheet
            loading={linkImportLoading}
            value={linkImportValue}
            onChange={setLinkImportValue}
            onClose={() => setLinkImportOpen(false)}
            onImport={handleImportLink}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

interface NoteCardProps {
  activeQuery: string
  note: Note
  tasks: Task[]
  onDelete: (noteId: string) => void
  onEdit: (note: Note) => void
  onView: (note: Note) => void
  onTogglePinned: (noteId: string) => void
  onToggleTask: (taskId: string) => void
}

interface NoteGroupSidebarProps {
  activeGroupId: string
  allCount: number
  groupCounts: Record<string, number>
  groups: NoteGroup[]
  newGroupName: string
  onAddGroup: () => void
  onCreateNote: () => void
  onNewGroupNameChange: (value: string) => void
  onSelectGroup: (groupId: string) => void
}

function NoteGroupSidebar({
  activeGroupId,
  allCount,
  groupCounts,
  groups,
  newGroupName,
  onAddGroup,
  onCreateNote,
  onNewGroupNameChange,
  onSelectGroup,
}: NoteGroupSidebarProps) {
  return (
    <aside className="ff-glass-panel hidden min-h-0 flex-col gap-2 rounded-[18px] p-2 sm:rounded-[24px] lg:flex">
      <div className="flex items-center justify-between px-1">
        <p className="ff-mono text-[10px] uppercase tracking-[0.22em] text-[var(--ff-muted)]">note groups</p>
        <button
          className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--ff-brand-text)] hover:bg-[var(--ff-brand-soft)]"
          type="button"
          onClick={onCreateNote}
        >
          + 笔记
        </button>
      </div>

      <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
        <button
          className={cn("flex min-h-10 w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-semibold transition", activeGroupId === "all" ? "ff-tag-active" : "ff-button-secondary")}
          type="button"
          onClick={() => onSelectGroup("all")}
        >
          <span>🗂️ 全部分组</span>
          <span className="ff-mono text-[10px] opacity-60">{allCount}</span>
        </button>

        {groups.map((group) => (
          <button
            className={cn("flex min-h-10 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition", activeGroupId === group.id ? "ff-tag-active" : "ff-button-secondary")}
            key={group.id}
            type="button"
            onClick={() => onSelectGroup(group.id)}
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <FolderKanban className="h-4 w-4 shrink-0" />
              <span className="truncate">{group.name}</span>
            </span>
            <span className="ff-mono shrink-0 text-[10px] opacity-60">{groupCounts[group.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <label className="ff-input flex min-h-10 w-full items-center gap-2 overflow-hidden rounded-2xl px-3 text-sm text-[var(--ff-ink-500)] focus-within:border-black/20 focus-within:bg-white/72 focus-within:shadow-[0_0_0_4px_rgba(17,19,26,0.06)]">
        <input
          className="min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-[var(--ff-text)] outline-none ring-0 placeholder:text-[var(--ff-ink-400)] focus:outline-none focus:ring-0 focus-visible:outline-none"
          value={newGroupName}
          onChange={(event) => onNewGroupNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onAddGroup()
          }}
          placeholder="新分组名"
        />
        <button className="min-h-8 shrink-0 rounded-xl bg-black px-3 text-sm font-semibold text-[#f8f6f0] transition hover:bg-black/80" type="button" onClick={onAddGroup}>
          新建
        </button>
      </label>
    </aside>
  )
}

interface NoteGroupSectionProps {
  activeQuery: string
  group: NoteListGroup
  tasks: Task[]
  onDelete: (noteId: string) => void
  onEdit: (note: Note) => void
  onView: (note: Note) => void
  onTogglePinned: (noteId: string) => void
  onToggleTask: (taskId: string) => void
}

function NoteGroupSection({
  activeQuery,
  group,
  onDelete,
  onEdit,
  onTogglePinned,
  onToggleTask,
  onView,
  tasks,
}: NoteGroupSectionProps) {
  return (
    <section className="ff-glass-panel overflow-hidden rounded-[18px] p-2.5 sm:rounded-[26px] sm:p-3">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--ff-border)] px-1 pb-2 sm:pb-2.5">
        <div className="min-w-0">
          <p className="ff-mono text-[9px] uppercase tracking-[0.22em] text-[var(--ff-muted)] sm:text-[10px]">note group ✨</p>
          <h2 className="ff-display mt-0.5 text-lg text-[var(--ff-text)] sm:text-xl">🗂️ {group.name}</h2>
          <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-[var(--ff-muted)] sm:line-clamp-2">{group.description}</p>
        </div>
        <span className="ff-mono shrink-0 rounded-full border border-black/10 bg-white/52 px-2.5 py-1 text-xs font-medium text-[var(--ff-muted)] sm:px-3">
          {group.notes.length}
        </span>
      </div>

      <div className="columns-1 gap-4 pt-3 lg:columns-2">
        {group.notes.map((note) => (
          <NoteCard
            activeQuery={activeQuery}
            key={note.id}
            note={note}
            tasks={tasks}
            onDelete={onDelete}
            onEdit={onEdit}
            onView={onView}
            onTogglePinned={onTogglePinned}
            onToggleTask={onToggleTask}
          />
        ))}
      </div>
    </section>
  )
}

function NoteCard({ activeQuery, note, tasks, onDelete, onEdit, onTogglePinned, onToggleTask, onView }: NoteCardProps) {
  const linkedTasks = tasks.filter((task) => note.linkedTaskIds.includes(task.id))
  const summary = getNoteSummary(note.content)
  const attachmentCount = note.attachments?.length ?? 0

  return (
    <motion.article
      className={cn(
        "ff-card group mb-4 break-inside-avoid p-4 transition hover:border-[var(--ff-border-strong)]",
        note.pinned && "border-[var(--ff-brand)]"
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onDoubleClick={() => onView(note)}
      layout
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-medium text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">
            {note.pinned ? <Pin className="mr-1 inline h-4 w-4 text-[var(--ff-brand)]" /> : null}
            {note.title}
          </h2>
        </div>
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
          <button className="ff-icon-button h-11 w-11 text-[var(--ff-ink-400)] hover:text-[var(--ff-brand)]" type="button" aria-label={note.pinned ? "取消钉住" : "钉住笔记"} onClick={() => onTogglePinned(note.id)}>
            <Pin className="h-4 w-4" />
          </button>
          <button className="ff-icon-button h-11 w-11 text-[var(--ff-ink-400)] hover:text-[var(--ff-brand)]" type="button" aria-label="查看笔记" onClick={() => onView(note)}>
            <Eye className="h-4 w-4" />
          </button>
          <button className="ff-icon-button h-11 w-11 text-[var(--ff-ink-400)] hover:text-[var(--ff-brand)]" type="button" aria-label="编辑笔记" onClick={() => onEdit(note)}>
            <Pencil className="h-4 w-4" />
          </button>
          <button className="ff-icon-button ff-danger-action h-11 w-11 text-slate-400" type="button" aria-label="删除笔记" onClick={() => onDelete(note.id)}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <p className="ff-line-clamp-3 mt-3 text-sm leading-6 text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">
        {highlightText(summary || "空白笔记 ✨", activeQuery)}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[var(--ff-ink-400)] dark:text-[var(--ff-muted)]">
        <span>{formatRelativeTime(note.updatedAt)}</span>
        <span>·</span>
        <span>{getWordCount(note.content)} 字</span>
        {attachmentCount ? (
          <>
            <span>·</span>
            <span>{attachmentCount} 个附件</span>
          </>
        ) : null}
        {note.tags.map((tag) => (
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", getTagTone(tag))} key={tag}>
            #{tag}
          </span>
        ))}
      </div>

      {linkedTasks.length ? (
        <div className="mt-4 space-y-2">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Link2 className="h-3.5 w-3.5" />
            🔗 引用任务
          </p>
          {linkedTasks.map((task) => (
            <div className="ff-card-muted flex items-center justify-between gap-3 px-3 py-2 text-sm text-slate-600 dark:text-slate-300" key={task.id}>
              <span className="truncate">{task.title}</span>
              <button className="ff-tag shrink-0" type="button" onClick={() => onToggleTask(task.id)}>
                {task.completed ? "完成" : "进行中"}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </motion.article>
  )
}

function NoteViewer({
  note,
  onClose,
  onEdit,
  onToggleTask,
  tasks,
}: {
  note: Note
  onClose: () => void
  onEdit: () => void
  onToggleTask: (taskId: string) => void
  tasks: Task[]
}) {
  const linkedTasks = tasks.filter((task) => note.linkedTaskIds.includes(task.id))

  return (
    <motion.div
      className="fixed inset-0 z-40 grid items-end px-3 pb-3 sm:items-center sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      <button className="absolute inset-0 min-h-0 w-full bg-slate-950/30 backdrop-blur-sm" type="button" aria-label="关闭笔记查看" onClick={onClose} />
      <motion.article
        className="ff-bottom-sheet-panel relative mx-auto grid max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-[var(--ff-surface)] shadow-[var(--ff-shadow-lg)]"
        role="dialog"
        aria-modal="true"
        aria-label="查看笔记"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--ff-border)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">{formatRelativeTime(note.updatedAt)} · {getWordCount(note.content)} 字</p>
            <h2 className="mt-1 truncate text-xl font-semibold text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">{note.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className="ff-button-secondary px-3 py-2 text-sm" type="button" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
              编辑
            </button>
            <button className="ff-icon-button h-11 w-11" type="button" aria-label="关闭" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">
          {note.tags.length ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {note.tags.map((tag) => (
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", getTagTone(tag))} key={tag}>#{tag}</span>
              ))}
            </div>
          ) : null}
          {renderNoteHtml(note.content)}
          {note.attachments?.length ? <NoteAttachmentPreview attachments={note.attachments} /> : null}
          {linkedTasks.length ? (
            <div className="mt-6 rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-4">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">
                <Link2 className="h-4 w-4 text-[var(--ff-brand)]" />
                🔗 引用任务
              </h3>
              <div className="mt-3 space-y-2">
                {linkedTasks.map((task) => (
                  <button className="ff-card-muted flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm" type="button" key={task.id} onClick={() => onToggleTask(task.id)}>
                    <span className={cn("truncate text-slate-600 dark:text-slate-300", task.completed && "line-through opacity-50")}>{task.title}</span>
                    <span className="ff-tag shrink-0">{task.completed ? "完成" : "进行中"}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </motion.article>
    </motion.div>
  )
}

function NoteAttachmentPreview({ attachments }: { attachments: NonNullable<Note["attachments"]> }) {
  return (
    <section className="mt-6 rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] p-4">
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">
        <ImageIcon className="h-4 w-4 text-[var(--ff-brand)]" />
        附件
      </h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <article className="overflow-hidden rounded-xl border border-[var(--ff-border)] bg-[var(--ff-surface)]" key={attachment.id}>
            {attachment.type === "image" ? (
              <img className="max-h-56 w-full object-contain" src={attachment.src} alt={attachment.name} />
            ) : (
              <video className="max-h-56 w-full bg-black" src={attachment.src} title={attachment.name} controls playsInline />
            )}
            <div className="p-3">
              <p className="truncate text-sm font-semibold text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">
                {attachment.type === "image" ? <ImageIcon className="mr-1 inline h-4 w-4" /> : <Video className="mr-1 inline h-4 w-4" />}
                {attachment.name}
              </p>
              {attachment.ocrText ? (
                <p className="ff-line-clamp-3 mt-2 text-xs leading-5 text-[var(--ff-ink-500)] dark:text-[var(--ff-muted)]">
                  {attachment.ocrText}
                </p>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function LinkImportSheet({
  loading,
  onChange,
  onClose,
  onImport,
  value,
}: {
  loading: boolean
  onChange: (value: string) => void
  onClose: () => void
  onImport: () => void
  value: string
}) {
  return (
    <BottomSheet ariaLabel="链接导入" className="max-w-xl overflow-hidden" onClose={onClose}>
      <div className="border-b border-[var(--ff-border)] px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ff-mono text-[10px] uppercase tracking-[0.24em] text-[var(--ff-muted)]">link import</p>
            <h2 className="ff-display mt-1 text-2xl text-[var(--ff-text)]">🔗 链接导入</h2>
          </div>
          <button className="ff-icon-button h-10 w-10" type="button" aria-label="关闭链接导入" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        <label className="block">
          <span className="text-sm font-medium text-[var(--ff-ink-700)] dark:text-[var(--ff-text)]">粘贴第三方分享链接</span>
          <textarea
            autoFocus
            className="ff-input mt-2 min-h-40 w-full resize-none px-4 py-3 text-sm leading-6 outline-none"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="例如：复制小红书分享文案或网页链接，粘贴到这里"
          />
        </label>

        <div className="mt-3 rounded-2xl border border-[var(--ff-border)] bg-[var(--ff-surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ff-muted)]">
          支持小红书短链、普通网页链接和带分享文案的内容。能抓到网页信息时会自动补标题、摘要和封面；抓不到时也会保留原链接。
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-[var(--ff-border)] px-5 py-4">
        <button className="ff-button-secondary px-4 py-3 text-sm" type="button" onClick={onClose}>
          取消
        </button>
        <button className="ff-button-primary px-4 py-3 text-sm" type="button" disabled={loading} onClick={onImport}>
          <Link2 className="h-4 w-4" />
          {loading ? "解析中" : "解析为笔记"}
        </button>
      </div>
    </BottomSheet>
  )
}
