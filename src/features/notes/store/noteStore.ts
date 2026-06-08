import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { createId } from "../../../lib/ids"
import { useTrashStore } from "../../trash/store/trashStore"
import { DEFAULT_NOTE_GROUP_ID, type Note, type NoteDraft, type NoteGroup } from "../types"
import { normalizeNoteContent, parseNoteTags } from "../utils"

interface NoteState {
  notes: Note[]
  noteGroups: NoteGroup[]
  addNoteGroup: (name: string) => string | null
  renameNoteGroup: (groupId: string, name: string) => void
  deleteNoteGroup: (groupId: string) => void
  addNote: (draft: NoteDraft) => Note
  updateNote: (noteId: string, draft: NoteDraft) => void
  deleteNote: (noteId: string) => void
  restoreNote: (note: Note) => void
  togglePinned: (noteId: string) => void
}

const initialNoteGroups: NoteGroup[] = [
  {
    id: DEFAULT_NOTE_GROUP_ID,
    name: "默认分组",
    description: "所有还没分类的笔记都会先放在这里。",
    color: "blue",
    createdAt: new Date().toISOString(),
    order: 1,
  },
]

const initialNotes: Note[] = [
  {
    id: "note-yaoyaoflow-roadmap",
    groupId: DEFAULT_NOTE_GROUP_ID,
    title: "yaoyaoflow 产品节奏",
    content: normalizeNoteContent(
      "# yaoyaoflow 产品节奏\n\n- 先把任务清单变成可靠工作台\n- 日历负责整理日程\n- 笔记承接任务背后的上下文\n\n## 本周重点\n\n**任务与日历打通**，让计划不是孤岛。"
    ),
    tags: ["产品", "规划"],
    linkedTaskIds: ["task-focus-setup", "task-calendar-review"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "note-meeting-template",
    groupId: DEFAULT_NOTE_GROUP_ID,
    title: "会议记录模板",
    content: normalizeNoteContent(
      "# 会议记录模板\n\n## 结论\n\n- \n\n## Action Items\n\n- `负责人` + `截止日期` + 下一步动作"
    ),
    tags: ["会议", "模板"],
    linkedTaskIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function createNoteFromDraft(draft: NoteDraft): Note {
  const now = new Date().toISOString()

  return {
    id: createId("note"),
    groupId: draft.groupId || DEFAULT_NOTE_GROUP_ID,
    title: draft.title.trim(),
    content: normalizeNoteContent(draft.content),
    tags: parseNoteTags(draft.tags, draft.content),
    linkedTaskIds: draft.linkedTaskIds,
    attachments: draft.attachments ?? [],
    pinned: false,
    versions: [],
    createdAt: now,
    updatedAt: now,
  }
}

function updateNoteFromDraft(note: Note, draft: NoteDraft): Note {
  const now = new Date().toISOString()
  const nextContent = normalizeNoteContent(draft.content)
  const nextTags = parseNoteTags(draft.tags, draft.content)
  const changed =
    note.title !== draft.title.trim() ||
    note.content !== nextContent ||
    note.tags.join("|") !== nextTags.join("|") ||
    note.linkedTaskIds.join("|") !== draft.linkedTaskIds.join("|") ||
    JSON.stringify(note.attachments ?? []) !== JSON.stringify(draft.attachments ?? []) ||
    (note.groupId || DEFAULT_NOTE_GROUP_ID) !== (draft.groupId || DEFAULT_NOTE_GROUP_ID)

  return {
    ...note,
    groupId: draft.groupId || DEFAULT_NOTE_GROUP_ID,
    title: draft.title.trim(),
    content: nextContent,
    tags: nextTags,
    linkedTaskIds: draft.linkedTaskIds,
    attachments: draft.attachments ?? [],
    versions: changed
      ? [
          {
            id: createId("version"),
            title: note.title,
            content: note.content,
            tags: note.tags,
            linkedTaskIds: note.linkedTaskIds,
            attachments: note.attachments ?? [],
            savedAt: now,
          },
          ...(note.versions ?? []),
        ].slice(0, 20)
      : note.versions ?? [],
    updatedAt: changed ? now : note.updatedAt,
  }
}

function normalizeNotes(notes: Note[]): Note[] {
  return notes.map((note) => ({
    ...note,
    groupId: note.groupId || DEFAULT_NOTE_GROUP_ID,
    tags: Array.isArray(note.tags) ? note.tags : [],
    linkedTaskIds: Array.isArray(note.linkedTaskIds) ? note.linkedTaskIds : [],
    attachments: Array.isArray(note.attachments) ? note.attachments : [],
    versions: Array.isArray(note.versions) ? note.versions : [],
  }))
}

function normalizeNoteGroups(noteGroups: NoteGroup[] | undefined): NoteGroup[] {
  const now = new Date().toISOString()
  const normalized = Array.isArray(noteGroups)
    ? noteGroups
        .map((group, index) => ({
          id: group.id || createId("note-group"),
          name: group.name?.trim() || "未命名分组",
          description: group.description ?? "",
          color: group.color || "blue",
          createdAt: group.createdAt ?? now,
          order: Number.isFinite(group.order) ? group.order : index + 1,
        }))
        .sort((left, right) => left.order - right.order)
    : []

  const hasDefault = normalized.some((group) => group.id === DEFAULT_NOTE_GROUP_ID)
  return hasDefault ? normalized : [...initialNoteGroups, ...normalized.map((group, index) => ({ ...group, order: index + 2 }))]
}

export const useNoteStore = create<NoteState>()(
  persist(
    (set) => ({
      notes: initialNotes,
      noteGroups: initialNoteGroups,
      addNoteGroup: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return null
        const id = createId("note-group")
        set((state) => ({
          noteGroups: [
            ...state.noteGroups,
            {
              id,
              name: trimmed,
              description: "",
              color: "blue",
              createdAt: new Date().toISOString(),
              order: state.noteGroups.length + 1,
            },
          ],
        }))
        return id
      },
      renameNoteGroup: (groupId, name) =>
        set((state) => {
          const trimmed = name.trim()
          if (!trimmed) return state
          return {
            noteGroups: state.noteGroups.map((group) => (group.id === groupId ? { ...group, name: trimmed } : group)),
          }
        }),
      deleteNoteGroup: (groupId) =>
        set((state) => {
          if (groupId === DEFAULT_NOTE_GROUP_ID) return state
          return {
            noteGroups: state.noteGroups.filter((group) => group.id !== groupId),
            notes: state.notes.map((note) =>
              note.groupId === groupId ? { ...note, groupId: DEFAULT_NOTE_GROUP_ID } : note
            ),
          }
        }),
      addNote: (draft) => {
        const note = createNoteFromDraft(draft)
        set((state) => ({
          notes: [note, ...state.notes],
        }))
        return note
      },
      updateNote: (noteId, draft) =>
        set((state) => ({
          notes: state.notes.map((note) => (note.id === noteId ? updateNoteFromDraft(note, draft) : note)),
        })),
      deleteNote: (noteId) =>
        set((state) => {
          const note = state.notes.find((item) => item.id === noteId)
          if (note) {
            useTrashStore.getState().addTrashItem({
              data: note,
              itemId: note.id,
              title: note.title,
              type: "note",
            })
          }
          return {
            notes: state.notes.filter((note) => note.id !== noteId),
          }
        }),
      restoreNote: (note) =>
        set((state) => ({
          notes: state.notes.some((item) => item.id === note.id) ? state.notes : [note, ...state.notes],
        })),
      togglePinned: (noteId) =>
        set((state) => ({
          notes: state.notes.map((note) => (note.id === noteId ? { ...note, pinned: !note.pinned } : note)),
        })),
    }),
    {
      name: "focusflow.notes.v1",
      storage: createJSONStorage(() => window.localStorage),
      version: 1,
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<NoteState> | undefined
        const noteGroups = normalizeNoteGroups(persistedState?.noteGroups as NoteGroup[] | undefined)
        const validGroupIds = new Set(noteGroups.map((group) => group.id))
        const notes = Array.isArray(persistedState?.notes)
          ? normalizeNotes(persistedState.notes as Note[]).map((note) => ({
              ...note,
              groupId: validGroupIds.has(note.groupId) ? note.groupId : DEFAULT_NOTE_GROUP_ID,
            }))
          : current.notes

        return {
          ...current,
          ...persistedState,
          noteGroups,
          notes,
        }
      },
      partialize: (state) => ({ noteGroups: state.noteGroups, notes: state.notes }),
    }
  )
)
