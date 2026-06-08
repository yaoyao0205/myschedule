import { useEffect, useState } from "react"
import { WifiOff } from "lucide-react"

function getOnlineStatus() {
  return typeof navigator === "undefined" ? true : navigator.onLine
}

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(getOnlineStatus)

  useEffect(() => {
    function updateStatus() {
      setIsOnline(getOnlineStatus())
    }

    window.addEventListener("online", updateStatus)
    window.addEventListener("offline", updateStatus)
    return () => {
      window.removeEventListener("online", updateStatus)
      window.removeEventListener("offline", updateStatus)
    }
  }, [])

  if (isOnline) {
    return null
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[80] border-b border-[var(--ff-warning)]/30 bg-[var(--ff-warning-soft)] px-4 py-2 text-sm font-medium text-[var(--ff-warning)]">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" />
        当前处于离线状态，已保存的数据仍可浏览，新同步会在网络恢复后继续。
      </div>
    </div>
  )
}
