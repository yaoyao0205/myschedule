import { LucideIcon } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { EmptyState } from "../ui/EmptyState"
import { SkeletonLoader } from "../ui/SkeletonLoader"

interface ModulePlaceholderProps {
  icon: LucideIcon
  title: string
  description: string
}

export function ModulePlaceholder({ icon: Icon, title, description }: ModulePlaceholderProps) {
  const navigate = useNavigate()

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <section className="ff-page-header">
        <div className="grid h-14 w-14 place-items-center rounded-xl bg-[var(--ff-brand-soft)] text-[var(--ff-brand)]">
          <Icon className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-medium tracking-tight text-[var(--ff-ink-900)] dark:text-[var(--ff-text)]">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonLoader key={index} />
        ))}
      </div>

      <EmptyState
        title="模块还在施工"
        description="这里先用骨架屏表达加载形态，后续接入真实数据时不会出现突兀的 spinner。"
        actionLabel="回到任务清单"
        onAction={() => navigate("/tasks")}
      />
    </div>
  )
}
