export const DEFAULT_NOTE_GROUP_ID = "note-group-default"

export interface Note {
  id: string
  groupId: string
  title: string
  content: string
  tags: string[]
  linkedTaskIds: string[]
  attachments?: NoteAttachment[]
  pinned?: boolean
  versions?: NoteVersion[]
  createdAt: string
  updatedAt: string
}

export interface NoteAttachment {
  id: string
  type: "image" | "video"
  name: string
  src: string
  mimeType: string
  size: number
  createdAt: string
  ocrText?: string
  ocrStatus?: "idle" | "processing" | "done" | "failed"
}

export interface NoteVersion {
  id: string
  title: string
  content: string
  tags: string[]
  linkedTaskIds: string[]
  attachments?: NoteAttachment[]
  savedAt: string
}

export interface NoteDraft {
  groupId: string
  title: string
  content: string
  tags: string
  linkedTaskIds: string[]
  attachments?: NoteAttachment[]
}

export interface NoteGroup {
  id: string
  name: string
  description?: string
  color: string
  createdAt: string
  order: number
}
