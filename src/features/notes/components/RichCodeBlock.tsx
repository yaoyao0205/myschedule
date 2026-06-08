import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react"
import { Check, Copy } from "lucide-react"
import { useState } from "react"

const languages = ["plaintext", "javascript", "typescript", "html", "css", "json", "markdown"]

export function RichCodeBlock({ node, updateAttributes }: NodeViewProps) {
  const [copied, setCopied] = useState(false)
  const language = node.attrs.language ?? "plaintext"
  const lineCount = Math.max(1, node.textContent.split("\n").length)

  async function handleCopy() {
    await navigator.clipboard.writeText(node.textContent)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <NodeViewWrapper className="not-prose my-4 overflow-hidden rounded-xl border border-[var(--ff-border)] bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <select
          className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none"
          value={language}
          onChange={(event) => updateAttributes({ language: event.target.value })}
        >
          {languages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          className="inline-flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-lg px-2 text-xs text-slate-300 hover:bg-[rgba(228,231,237,0.10)]"
          type="button"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? "已复制" : "复制"}</span>
        </button>
      </div>
      <div className="grid grid-cols-[44px_minmax(0,1fr)]">
        <ol className="select-none border-r border-white/10 px-3 py-4 text-right font-mono text-xs leading-6 text-slate-500" aria-hidden="true">
          {Array.from({ length: lineCount }, (_, index) => (
            <li key={index}>{index + 1}</li>
          ))}
        </ol>
        <NodeViewContent className="ff-code-content overflow-x-auto p-4 font-mono text-sm leading-6" />
      </div>
    </NodeViewWrapper>
  )
}
