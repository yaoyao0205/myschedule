import { Component, type ErrorInfo, type ReactNode } from "react"

interface PageErrorBoundaryProps {
  children: ReactNode
  resetKey: string
}

interface PageErrorBoundaryState {
  error: Error | null
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error }
  }

  componentDidUpdate(previousProps: PageErrorBoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("myschedule page render failed", error, errorInfo)
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <section className="ff-card mx-auto max-w-2xl p-6">
        <p className="text-sm font-semibold text-[var(--ff-brand-text)]">页面暂时没有渲染成功</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--ff-ink-900)]">我们把空白页拦住了</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--ff-muted)]">
          当前页面遇到了一个运行时错误。你可以切换到其他 TAB 再回来，或者刷新应用继续使用。
        </p>
        <button className="ff-button-primary mt-5 px-4 py-3 text-sm" type="button" onClick={() => window.location.reload()}>
          刷新应用
        </button>
      </section>
    )
  }
}
