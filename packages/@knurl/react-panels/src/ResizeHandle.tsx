import { useCallback, useRef } from 'react';
import type { Direction } from './types';

interface ResizeHandleProps {
  direction: Direction;
  onDragStart: () => void;
  onDrag: (delta: number) => void;
  onDragEnd: () => void;
  className?: string;
}

export function ResizeHandle({
  direction,
  onDragStart,
  onDrag,
  onDragEnd,
  className
}: ResizeHandleProps) {
  const isDraggingRef = useRef(false);
  const startPosRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
      onDragStart();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;

        const currentPos = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
        const delta = currentPos - startPosRef.current;
        startPosRef.current = currentPos;

        onDrag(delta);
      };

      const handleMouseUp = () => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          onDragEnd();
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [direction, onDragStart, onDrag, onDragEnd]
  );

  const cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';

  return (
    <div
      className={className}
      onMouseDown={handleMouseDown}
      style={{
        cursor,
        userSelect: 'none',
        touchAction: 'none',
        ...(direction === 'horizontal'
          ? { width: '4px', height: '100%' }
          : { width: '100%', height: '4px' })
      }}
      data-resize-handle="true"
    />
  );
}
