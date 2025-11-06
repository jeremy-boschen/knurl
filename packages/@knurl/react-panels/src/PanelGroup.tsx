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
    const constraintsRef = useRef<Array<{ minSize?: PanelSize; maxSize?: PanelSize }>>([]);
    const originalUnitsRef = useRef<Array<'px' | '%'>>([]);

    // Extract panel children (all valid React elements are considered panels)
    const panelChildren = Children.toArray(children).filter(
      (child): child is ReactElement<PanelProps> =>
        isValidElement(child)
    );

    const panelCount = panelChildren.length;

    // Initialize panel sizes and constraints
    useEffect(() => {
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
    }, [panelCount, panelChildren]);

    // Calculate pixel sizes whenever panel sizes or container changes
    useEffect(() => {
      if (!containerRef.current || panelSizes.length === 0) return;

      const updateSizes = () => {
        if (!containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const containerSize = direction === 'horizontal' ? rect.width : rect.height;

        const pixels = calculateSizes(panelSizes, containerSize, constraintsRef.current);
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
      [panelSizes, panelCount]
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

        const newPixelSizes = [...pixelSizes];
        newPixelSizes[leftIndex] += delta;
        newPixelSizes[rightIndex] -= delta;

        // Apply constraints
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

        newPixelSizes[leftIndex] = clampSize(newPixelSizes[leftIndex], leftMinPx, leftMaxPx);
        newPixelSizes[rightIndex] = clampSize(newPixelSizes[rightIndex], rightMinPx, rightMaxPx);

        // Ensure total equals container size
        const total = newPixelSizes[leftIndex] + newPixelSizes[rightIndex];
        const expectedTotal = pixelSizes[leftIndex] + pixelSizes[rightIndex];
        if (Math.abs(total - expectedTotal) > 0.1) {
          const correction = expectedTotal - total;
          newPixelSizes[rightIndex] += correction;
          newPixelSizes[rightIndex] = clampSize(newPixelSizes[rightIndex], rightMinPx, rightMaxPx);
        }

        setPixelSizes(newPixelSizes);

        // Convert back to original units for callback
        const newSizes = newPixelSizes.map((px, i) => {
          const unit = originalUnitsRef.current[i];
          const value = convertFromPixels(px, containerSize, unit);
          return formatSize(value, unit);
        });

        setPanelSizes(newSizes);
        onResize?.(newSizes);
      },
      [pixelSizes, direction, onResize]
    );

    const handleResizeStart = useCallback(() => {
      onResizeStart?.();
    }, [onResizeStart]);

    const handleResizeEnd = useCallback(() => {
      onResizeEnd?.(panelSizes);
    }, [onResizeEnd, panelSizes]);

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
          if (index < panelCount - 1) {
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
