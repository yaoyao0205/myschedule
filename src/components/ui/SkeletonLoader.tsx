import { cn } from "../../lib/cn"
import { TheoMascot } from "../brand/TheoMascot"

interface SkeletonLoaderProps {
  className?: string
  lines?: number
}

export function SkeletonLoader({ className, lines = 3 }: SkeletonLoaderProps) {
  return (
    <div className={cn("ff-card relative p-4", className)} aria-hidden="true">
      <div className="ff-skeleton h-4 w-28 rounded-full" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <div
            className={cn("ff-skeleton h-3 rounded-full", index === lines - 1 ? "w-2/3" : "w-full")}
            key={index}
          />
        ))}
      </div>
      <TheoMascot className="absolute bottom-3 right-3 opacity-70" pose="idle" size={16} />
    </div>
  )
}
