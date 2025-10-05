import { Component, type ErrorInfo, type ReactNode } from "react"

import { AlertTriangleIcon } from "lucide-react"
import { toast } from "sonner"

interface Props {
  children: ReactNode
  fallback?: ReactNode | ((error: Error) => ReactNode)
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the console
    console.error("Error caught by ErrorBoundary:", error, errorInfo)

    // Show a toast notification
    toast.error("An error occurred", {
      description: error.message || "Something went wrong",
      icon: <AlertTriangleIcon className="w-8 h-8" />,
    })
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      const { fallback } = this.props
      const error = this.state.error ?? new Error("Unknown error")
      if (typeof fallback === "function") {
        return fallback(error)
      }
      // You can render any custom fallback UI
      return (
        fallback || (
          <div className="rounded border border-error bg-red-50 p-4 text-error">
            <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>
            <p className="mb-2">{this.state.error?.message || "An unexpected error occurred"}</p>
            <button
              type="button"
              className="rounded bg-error px-3 py-1 text-white hover:bg-error"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        )
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
