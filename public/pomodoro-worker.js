let timerId = null
let endsAt = 0

function stopTimer() {
  if (timerId) {
    clearInterval(timerId)
    timerId = null
  }
}

function emitTick() {
  const now = Date.now()
  const remainingSeconds = Math.max(0, Math.ceil((endsAt - now) / 1000))
  self.postMessage({ now, remainingSeconds, type: "tick" })

  if (remainingSeconds <= 0) {
    stopTimer()
    self.postMessage({ now: Date.now(), type: "complete" })
  }
}

self.onmessage = (event) => {
  const message = event.data

  if (message.type === "start") {
    endsAt = message.endsAt
    stopTimer()
    emitTick()
    timerId = setInterval(emitTick, 1000)
  }

  if (message.type === "stop") {
    stopTimer()
  }
}
