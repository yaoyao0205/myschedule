export function ActionToast({ feedback, onDismiss }) {
  if (!feedback) {
    return null
  }

  return (
    <div className="action-toast" role="status" aria-live="polite">
      <div>
        <p className="eyebrow">Recent Action</p>
        <strong>{feedback.title}</strong>
        {feedback.detail ? <p>{feedback.detail}</p> : null}
      </div>
      <button className="ghost-btn small-btn" type="button" onClick={onDismiss}>
        关闭
      </button>
    </div>
  )
}
