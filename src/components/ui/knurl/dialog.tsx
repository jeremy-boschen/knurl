import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"
import * as React from "react"
import Draggable from "react-draggable"

import { DialogOverlay } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ───────────────────────────────────────────────────────────────────────────────
//  Types
// ───────────────────────────────────────────────────────────────────────────────
export type Size = { width: number; height: number }
export type ResizableSize = { min: Size; initial?: Size }

// ───────────────────────────────────────────────────────────────────────────────
//  useResizable Hook
// ───────────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────────
// Custom resize handles component for corner-only resizing
// ───────────────────────────────────────────────────────────────────────────────
const ResizeHandle = React.forwardRef<
  HTMLDivElement,
  {
    dialogId: string
    onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void
  }
>(({ dialogId, onMouseDown }, ref) => {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: OK for the resize handle
    <div
      ref={ref}
      className={cn(
        `resize-handle-${dialogId} absolute w-4 h-4 transition-opacity duration-200 rounded-sm`,
        "bottom-0 right-0 cursor-se-resize opacity-60 hover:opacity-100",
      )}
      onMouseDown={onMouseDown}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      >
        <path d="M5 15.5 L15.5 5" />
        <path d="M8.5 15.5 L15.5 8.5" />
        <path d="M12 15.5 L15.5 12" />
      </svg>
    </div>
  )
})
ResizeHandle.displayName = "ResizeHandle"

// ───────────────────────────────────────────────────────────────────────────────
// Context for sharing parent state with children (e.g., DialogHeader)
// ───────────────────────────────────────────────────────────────────────────────
interface DialogContextValue {
  dialogId: string
  isDraggable: boolean
  isResizable: boolean
  showCloseButton: boolean
  size: ResizableSize | undefined
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

export function useDialogContext() {
  const context = React.useContext(DialogContext)
  if (!context) {
    // This should not happen if components are used correctly within a Dialog
    throw new Error("useDialogContext must be used within a Dialog provider")
  }
  return context
}

// ───────────────────────────────────────────────────────────────────────────────
// Dialog Root - The new main component that holds state
// ───────────────────────────────────────────────────────────────────────────────
export type DialogProps = Omit<React.ComponentProps<typeof DialogPrimitive.Root>, "children"> & {
  children: React.ReactNode
  showCloseButton?: boolean
  draggable?: boolean
} & (
    | { resizable?: false; size?: never } // If not resizable, size is not allowed.
    | { resizable: true; size: ResizableSize } // If resizable, size is required.
  )

export function Dialog({ children, showCloseButton = true, draggable = true, ...props }: DialogProps) {
  const dialogId = React.useId()

  const isResizable = "resizable" in props && props.resizable === true
  const resizableSize = isResizable ? props.size : undefined

  const contextValue: DialogContextValue = React.useMemo(
    () => ({
      dialogId,
      isDraggable: draggable,
      isResizable,
      showCloseButton,
      size: resizableSize,
    }),
    [dialogId, draggable, isResizable, showCloseButton, resizableSize],
  )

  // We remove resizable and size from props before passing them down to Radix,
  // as they are not valid props for DialogPrimitive.Root.
  const { resizable: _u1, size: _u2, ...rest } = props

  return (
    <DialogPrimitive.Root {...rest}>
      <DialogContext.Provider value={contextValue}>{children}</DialogContext.Provider>
    </DialogPrimitive.Root>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// DialogContent - Now consumes context
// ───────────────────────────────────────────────────────────────────────────────
export type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content>

export function DialogContent({ className, children, ...props }: DialogContentProps) {
  const { dialogId, isDraggable, isResizable, showCloseButton, size: resizableSize } = useDialogContext()

  // This ref is for the draggable wrapper.
  const draggableRef = React.useRef<HTMLDivElement>(null)

  // --- Resizing logic, formerly in `useResizable` hook ---
  const [size, setSize] = React.useState<Size | undefined>(() =>
    isResizable ? (resizableSize?.initial ?? resizableSize?.min) : undefined,
  )
  const [isResizing, setIsResizing] = React.useState(false)
  const minSize = React.useMemo(() => resizableSize?.min ?? { width: 0, height: 0 }, [resizableSize?.min])
  const dragStartRef = React.useRef<{ mouseX: number; mouseY: number; width: number; height: number } | null>(null)

  const onResizeMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isResizable || !size) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        width: size.width,
        height: size.height,
      }
      setIsResizing(true)
    },
    [isResizable, size],
  )

  // Effect for locking the cursor style during a resize operation.
  React.useEffect(() => {
    if (!isResizing) {
      return
    }
    document.body.style.cursor = "se-resize"
    document.body.style.userSelect = "none"
    return () => {
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [isResizing])

  // Effect for handling the resize logic via document-level event listeners.
  React.useEffect(() => {
    if (!isResizing) {
      return
    }

    const onMove = (e: MouseEvent) => {
      const start = dragStartRef.current
      if (!start || !draggableRef.current) {
        return
      }
      const dx = e.clientX - start.mouseX
      const dy = e.clientY - start.mouseY
      const newW = Math.max(minSize.width, start.width + dx)
      const newH = Math.max(minSize.height, start.height + dy)
      draggableRef.current.style.width = `${newW}px`
      draggableRef.current.style.height = `${newH}px`
    }

    const onUp = (e: MouseEvent) => {
      if (dragStartRef.current) {
        const start = dragStartRef.current
        const dx = e.clientX - start.mouseX
        const dy = e.clientY - start.mouseY
        const newW = Math.max(minSize.width, start.width + dx)
        const newH = Math.max(minSize.height, start.height + dy)
        setSize({ width: newW, height: newH })
      }
      setIsResizing(false)
      dragStartRef.current = null
    }

    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    return () => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
    }
  }, [isResizing, minSize])

  // We need a ref to track the resizing state that we can check in our
  // interaction handler. We use `useLayoutEffect` to ensure this ref is updated
  // synchronously after a render but before the browser has a chance to paint,
  // which is necessary to correctly handle the event race condition.
  const isResizingRef = React.useRef(isResizing)
  React.useLayoutEffect(() => {
    isResizingRef.current = isResizing
  }, [isResizing])

  // Prevent the dialog from closing if a resize is in progress.
  const handleOutsideInteraction = React.useCallback(
    // biome-ignore lint/suspicious/noExplicitAny: Radix event-type is not exported
    (event: any) => {
      // We check the ref here because its value will be current even if the
      // state has changed in a pending re-render.
      if (isResizingRef.current) {
        event.preventDefault()
      }
    },
    [], // This callback never needs to be recreated.
  )

  // Apply width/height styles only if the dialog is resizable. Otherwise, let CSS handle it.
  const containerStyle = size ? { width: `${size.width}px`, height: `${size.height}px` } : {}

  return (
    <DialogPrimitive.Portal data-slot="dialog-portal">
      <DialogOverlay />

      {/* Full-viewport bounds for dragging; center by default */}
      <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
        <Draggable
          nodeRef={draggableRef}
          handle={`.draggable-dialog-title.draggable-dialog-${dialogId}`}
          bounds="parent"
          disabled={!isDraggable}
        >
          <div
            ref={draggableRef}
            className="pointer-events-auto group relative flex"
            // The size style is applied here. If not resizable, the style object is empty.
            style={containerStyle}
          >
            {/* Let Radix render a real element; do NOT use asChild */}
            <DialogPrimitive.Content
              data-slot="dialog-content"
              data-dialog-id={dialogId}
              onPointerDownOutside={handleOutsideInteraction}
              onInteractOutside={handleOutsideInteraction}
              {...props} // Pass forwarded ref here
              className={cn(
                "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 z-50 flex flex-col gap-4 rounded-lg border p-6 shadow-lg duration-200",
                // If resizable, the content must grow to fill the sized container.
                // Using flex-1 is more robust than w-full/h-full for this.
                isResizable ? "flex-1" : "max-w-lg",
                className,
              )}
            >
              {children}

              {showCloseButton && (
                <DialogPrimitive.Close
                  data-slot="dialog-close"
                  className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
                >
                  <XIcon />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              )}
              {/* The resize handle is only rendered if the dialog is resizable. */}
              {isResizable && <ResizeHandle dialogId={dialogId} onMouseDown={onResizeMouseDown} />}
            </DialogPrimitive.Content>
          </div>
        </Draggable>
      </div>
    </DialogPrimitive.Portal>
  )
}

// ───────────────────────────────────────────────────────────────────────────────
// ───────────────────────────────────────────────────────────────────────────────
// DialogHeader — drop-in replacement that auto-acts as a drag handle
// ───────────────────────────────────────────────────────────────────────────────
export function DialogTitle({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { dialogId, isDraggable } = useDialogContext()
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-lg leading-none font-semibold",

        // When movable, make this the drag handle (interactive children should add .no-drag)
        isDraggable && `draggable-dialog-title draggable-dialog-${dialogId} select-none cursor-move`,
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Title>
  )
}

export {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
} from "@/components/ui/dialog"
