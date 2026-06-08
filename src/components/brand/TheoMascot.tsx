import type { CSSProperties } from "react"
import { cn } from "../../lib/cn"

export type TheoPose =
  | "idle"
  | "focused"
  | "celebrating"
  | "sleeping"
  | "curious"
  | "annoyed"
  | "helping"
  | "demanding"

export type TheoSkin = "default" | "orange" | "black" | "ragdoll" | "gold" | "midnight"

interface TheoMascotProps {
  animated?: boolean
  className?: string
  pose?: TheoPose
  size?: number
  skin?: TheoSkin
  title?: string
}

const skinTokens: Record<TheoSkin, { eye: string; fur: string; point: string }> = {
  default: { eye: "var(--ff-brand)", fur: "var(--ff-cream)", point: "var(--ff-point)" },
  orange: { eye: "#d97706", fur: "#fed7aa", point: "#ea580c" },
  black: { eye: "#22c55e", fur: "#18181b", point: "#09090b" },
  ragdoll: { eye: "var(--ff-brand)", fur: "#f4f5f7", point: "var(--ff-ink-200)" },
  gold: { eye: "var(--ff-brand)", fur: "var(--ff-cream)", point: "#d4a017" },
  midnight: { eye: "var(--ff-brand)", fur: "#161b24", point: "var(--ff-ink-500)" },
}

export function TheoMascot({
  animated = true,
  className,
  pose = "idle",
  size = 48,
  skin = "default",
  title = "西奥",
}: TheoMascotProps) {
  const palette = skinTokens[skin]
  const isSleeping = pose === "sleeping"
  const isFocused = pose === "focused"
  const isAnnoyed = pose === "annoyed"
  const isCelebrating = pose === "celebrating"
  const isHelping = pose === "helping"
  const isDemanding = pose === "demanding"
  const isCurious = pose === "curious"

  return (
    <svg
      aria-label={title}
      className={cn("ff-theo", animated && "ff-theo-animated", `ff-theo-${pose}`, className)}
      fill="none"
      height={size}
      role="img"
      style={
        {
          "--ff-theo-eye": palette.eye,
          "--ff-theo-fur": palette.fur,
          "--ff-theo-point": palette.point,
        } as CSSProperties
      }
      viewBox="0 0 120 120"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {isCelebrating ? (
        <g className="ff-theo-fish-confetti" stroke="var(--ff-theo-eye)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5">
          <path d="M22 30c5-4 10-4 15 0-5 4-10 4-15 0Z" />
          <path d="M30 30l-4-4M30 30l-4 4" />
          <path d="M83 24c5-4 10-4 15 0-5 4-10 4-15 0Z" />
          <path d="M91 24l-4-4M91 24l-4 4" />
          <path d="M94 72c4-3 8-3 12 0-4 3-8 3-12 0Z" />
        </g>
      ) : null}

      {isSleeping ? (
        <g className="ff-theo-z" fill="var(--ff-theo-eye)" opacity="0.75">
          <path d="M82 24h13l-10 12h11" />
          <path d="M94 12h10l-8 9h9" opacity="0.55" />
        </g>
      ) : null}

      <path
        className="ff-theo-tail"
        d={
          isAnnoyed
            ? "M86 79c18-20 18-43 2-55"
            : isFocused
              ? "M88 87c19 10 31-5 18-17-9-8-22 0-19 12"
              : isSleeping
                ? "M35 83c-18 9-18 27 3 28 15 0 21-14 8-23"
                : "M86 84c18 2 26-14 14-24-8-7-20 0-17 12"
        }
        stroke="var(--ff-theo-point)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      />

      <g className={cn(isCelebrating && "ff-theo-hop", isCurious && "ff-theo-tilt")}>
        <path
          d={isFocused || isSleeping ? "M31 78c6-20 46-22 56-2 7 15-2 26-26 26-25 0-35-8-30-24Z" : "M34 67c0-21 10-34 26-34s26 13 26 34c0 24-9 36-26 36S34 91 34 67Z"}
          fill="var(--ff-theo-fur)"
          stroke="var(--ff-theo-point)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          className="ff-theo-ear"
          d="M42 42 35 22l19 11M78 42l7-20-19 11"
          fill="var(--ff-theo-point)"
          stroke="var(--ff-theo-point)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M42 42c6-9 30-9 36 0 8 12 6 32-18 32S34 54 42 42Z"
          fill="var(--ff-theo-fur)"
          stroke="var(--ff-theo-point)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path d="M50 43c4-5 16-5 20 0l-5 8H55l-5-8Z" fill="var(--ff-theo-point)" opacity="0.38" />

        {isSleeping ? (
          <g stroke="var(--ff-theo-eye)" strokeLinecap="round" strokeWidth="2">
            <path d="M50 55c3 3 6 3 9 0" />
            <path d="M66 55c3 3 6 3 9 0" />
          </g>
        ) : isFocused ? (
          <g stroke="var(--ff-theo-eye)" strokeLinecap="round" strokeWidth="2">
            <path d="M50 55h10" />
            <path d="M66 55h10" />
          </g>
        ) : isAnnoyed ? (
          <g stroke="var(--ff-theo-eye)" strokeLinecap="round" strokeWidth="2">
            <path d="M49 52l10 4" />
            <path d="M75 52l-10 4" />
          </g>
        ) : isDemanding ? (
          <g fill="var(--ff-theo-eye)">
            <circle cx="55" cy="55" r="5" />
            <circle cx="70" cy="55" r="5" />
          </g>
        ) : (
          <g className="ff-theo-eyes" fill="var(--ff-theo-eye)">
            <ellipse cx="55" cy="55" rx={isCelebrating ? 5 : 3.4} ry={isCelebrating ? 5 : 4.4} />
            <ellipse cx="70" cy="55" rx={isCelebrating ? 5 : 3.4} ry={isCelebrating ? 5 : 4.4} />
          </g>
        )}

        <path d="M62 60v5" stroke="var(--ff-theo-point)" strokeLinecap="round" strokeWidth="1.5" />
        <path d="M58 67c2 2 6 2 8 0" stroke="var(--ff-theo-point)" strokeLinecap="round" strokeWidth="1.5" />

        <g stroke="var(--ff-theo-point)" strokeLinecap="round" strokeWidth="1.5" opacity="0.7">
          <path d="M45 62h-12M47 66h-14M75 62h12M73 66h14" />
        </g>

        {isCelebrating ? (
          <g stroke="var(--ff-theo-point)" strokeLinecap="round" strokeWidth="4">
            <path d="M38 78 24 63" />
            <path d="M82 78 96 63" />
          </g>
        ) : isHelping ? (
          <path d="M82 78c10 0 16-4 21-12" stroke="var(--ff-theo-point)" strokeLinecap="round" strokeWidth="4" />
        ) : (
          <g stroke="var(--ff-theo-point)" strokeLinecap="round" strokeWidth="4">
            <path d="M44 91h-13" />
            <path d="M76 91h13" />
          </g>
        )}

        {skin === "gold" ? (
          <path d="M47 76c8 5 18 5 26 0" stroke="#d4a017" strokeLinecap="round" strokeWidth="3" />
        ) : null}
      </g>
    </svg>
  )
}
