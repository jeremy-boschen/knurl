import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  useCallback,
  Children,
  cloneElement,
  isValidElement,
  type ReactElement
} from 'react';
import type { PanelGroupProps, PanelGroupHandle, PanelSize, PanelProps } from './types';
import { ResizeHandle } from './ResizeHandle';
import { parseSize, formatSize, calculateSizes, convertToPixels, convertFromPixels, clampSize } from './utils';

export const PanelGroup = forwardRef<PanelGroupHandle, PanelGroupProps>(
  ({ children, direction = 'horizontal', className, style, onResize, onResizeStart, onResizeEnd }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [panelSizes, setPanelSizes] = useState<PanelSize[]>([]);
    const [pixelSizes, setPixelSizes] = useState<number[]>([]);
    const currentPixelSizesRef = useRef<number[]>([]);
    const constraintsRef = useRef<Array<{ minSize?: PanelSize; maxSize?: PanelSize }>>([]);
    const originalUnitsRef = useRef<Array<'px' | '%'>>([]);
    const isDraggingRef = useRef(false);

    // Initialize panel sizes and constraints
    useEffect(() => {
      // Extract panel children inside useEffect to avoid dependency issues
      const panelChildren = Children.toArray(children).filter(
        (child): child is ReactElement<PanelProps> =>
          isValidElement(child)
      );

      const panelCount = panelChildren.length;
      if (panelCount === 0) return;

      const newConstraints: Array<{ minSize?: PanelSize; maxSize?: PanelSize }> = [];
      const newSizes: PanelSize[] = [];
      const newUnits: Array<'px' | '%'> = [];

      panelChildren.forEach((child) => {
        const props = child.props as PanelProps;
        const defaultSize = props.defaultSize;
        const minSize = props.minSize;
        const maxSize = props.maxSize;

        newConstraints.push({ minSize, maxSize });

        if (defaultSize) {
          newSizes.push(defaultSize);
          newUnits.push(parseSize(defaultSize).unit);
        } else {
          // Default to equal percentage distribution
          const equalPercent = Math.floor(10000 / panelCount) / 100;
          newSizes.push(`${equalPercent}%` as PanelSize);
          newUnits.push('%');
        }
      });

      constraintsRef.current = newConstraints;
      originalUnitsRef.current = newUnits;
      setPanelSizes(newSizes);
    }, [children]);

    // Calculate pixel sizes whenever panel sizes or container changes
    useEffect(() => {
      if (!containerRef.current || panelSizes.length === 0) return;

      const updateSizes = () => {
        if (!containerRef.current || isDraggingRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const containerSize = direction === 'horizontal' ? rect.width : rect.height;

        const pixels = calculateSizes(panelSizes, containerSize, constraintsRef.current);
        currentPixelSizesRef.current = pixels;
        setPixelSizes(pixels);
      };

      updateSizes();

      const resizeObserver = new ResizeObserver(updateSizes);
      resizeObserver.observe(containerRef.current);

      return () => resizeObserver.disconnect();
    }, [panelSizes, direction]);

    // Imperative API
    useImperativeHandle(
      ref,
      () => ({
        setSizes: (sizes: PanelSize[]) => {
          const panelChildren = Children.toArray(children).filter(
            (child): child is ReactElement<PanelProps> =>
              isValidElement(child)
          );
          const panelCount = panelChildren.length;

          if (sizes.length !== panelCount) {
            console.warn(
              `setSizes: Expected ${panelCount} sizes, got ${sizes.length}. Ignoring.`
            );
            return;
          }

          setPanelSizes(sizes);

          // Update original units for future resize operations
          originalUnitsRef.current = sizes.map(size => parseSize(size).unit);
        },
        getSizes: () => panelSizes
      }),
      [panelSizes, children]
    );

    // Handle resize drag
    const handleResize = useCallback(
      (handleIndex: number, delta: number) => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const containerSize = direction === 'horizontal' ? rect.width : rect.height;

        // Update the two panels adjacent to the handle
        const leftIndex = handleIndex;
        const rightIndex = handleIndex + 1;

        // Use ref to get current sizes (not stale state)
        const currentSizes = currentPixelSizesRef.current;
        const newPixelSizes = [...currentSizes];

        const expectedTotal = currentSizes[leftIndex] + currentSizes[rightIndex];

        // Calculate constraints in pixels
        const leftConstraints = constraintsRef.current[leftIndex];
        const rightConstraints = constraintsRef.current[rightIndex];

        const leftMinPx = leftConstraints?.minSize
          ? convertToPixels(parseSize(leftConstraints.minSize), containerSize)
          : 0;
        const leftMaxPx = leftConstraints?.maxSize
          ? convertToPixels(parseSize(leftConstraints.maxSize), containerSize)
          : Infinity;
        const rightMinPx = rightConstraints?.minSize
          ? convertToPixels(parseSize(rightConstraints.minSize), containerSize)
          : 0;
        const rightMaxPx = rightConstraints?.maxSize
          ? convertToPixels(parseSize(rightConstraints.maxSize), containerSize)
          : Infinity;

        // Apply delta and constraints while maintaining total size
        let newLeft = currentSizes[leftIndex] + delta;
        let newRight = expectedTotal - newLeft;

        // Clamp left panel
        newLeft = clampSize(newLeft, leftMinPx, leftMaxPx);
        newRight = expectedTotal - newLeft;

        // Check if right panel violates constraints after left was clamped
        if (newRight < rightMinPx) {
          newRight = rightMinPx;
          newLeft = expectedTotal - newRight;
          newLeft = clampSize(newLeft, leftMinPx, leftMaxPx);
        } else if (newRight > rightMaxPx) {
          newRight = rightMaxPx;
          newLeft = expectedTotal - newRight;
          newLeft = clampSize(newLeft, leftMinPx, leftMaxPx);
        }

        // Final adjustment to guarantee total is maintained
        newRight = expectedTotal - newLeft;

        newPixelSizes[leftIndex] = newLeft;
        newPixelSizes[rightIndex] = newRight;

        // Update ref immediately for next drag event
        currentPixelSizesRef.current = newPixelSizes;

        // During drag, only update pixel sizes (not panel sizes)
        // This prevents the useEffect from recalculating and causing jumps
        setPixelSizes(newPixelSizes);

        // Convert to sizes for callback only
        const newSizes = newPixelSizes.map((px, i) => {
          const unit = originalUnitsRef.current[i];
          const value = convertFromPixels(px, containerSize, unit);
          return formatSize(value, unit);
        });

        onResize?.(newSizes);
      },
      [direction, onResize]
    );

    const handleResizeStart = useCallback(() => {
      isDraggingRef.current = true;
      onResizeStart?.();
    }, [onResizeStart]);

    const handleResizeEnd = useCallback(() => {
      isDraggingRef.current = false;

      // Update panelSizes to match the final pixelSizes
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const containerSize = direction === 'horizontal' ? rect.width : rect.height;

      // Use ref to get final sizes
      const newSizes = currentPixelSizesRef.current.map((px, i) => {
        const unit = originalUnitsRef.current[i];
        const value = convertFromPixels(px, containerSize, unit);
        return formatSize(value, unit);
      });

      setPanelSizes(newSizes);
      onResizeEnd?.(newSizes);
    }, [direction, onResizeEnd]);

    const flexDirection = direction === 'horizontal' ? 'row' : 'column';

    return (
      <div
        ref={containerRef}
        className={className}
        style={{
          display: 'flex',
          flexDirection,
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          ...style
        }}
        data-panel-group={direction}
      >
        {Children.map(children, (child, index) => {
          if (!isValidElement(child)) return child;

          const props = child.props as PanelProps;
          const panelStyle: React.CSSProperties = {
            ...props.style,
            flex: 'none',
            overflow: 'hidden',
            ...(direction === 'horizontal'
              ? { width: `${pixelSizes[index] || 0}px`, height: '100%' }
              : { height: `${pixelSizes[index] || 0}px`, width: '100%' })
          };

          const panel = cloneElement(child, {
            style: panelStyle
          } as Partial<PanelProps>);

          // Add resize handle after each panel except the last one
          const totalPanels = Children.count(children);
          if (index < totalPanels - 1) {
            return (
              <>
                {panel}
                <ResizeHandle
                  direction={direction}
                  onDragStart={handleResizeStart}
                  onDrag={(delta) => handleResize(index, delta)}
                  onDragEnd={handleResizeEnd}
                />
              </>
            );
          }

          return panel;
        })}
      </div>
    );
  }
);

PanelGroup.displayName = 'PanelGroup';
