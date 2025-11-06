import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ResizeHandle } from '../ResizeHandle';

describe('ResizeHandle', () => {
  it('sets cursor on document.body during drag', () => {
    const onDragStart = vi.fn();
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();

    // Store original body cursor
    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;

    const { container } = render(
      <ResizeHandle
        direction="horizontal"
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
      />
    );

    const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;
    expect(handle).toBeTruthy();

    // Before drag, body should have original cursor
    expect(document.body.style.cursor).toBe(originalCursor);

    // Start drag
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });

    // During drag, body should have col-resize cursor
    expect(document.body.style.cursor).toBe('col-resize');
    expect(document.body.style.userSelect).toBe('none');

    // Drag should be called
    fireEvent.mouseMove(document, { clientX: 150, clientY: 100 });
    expect(onDrag).toHaveBeenCalled();

    // End drag
    fireEvent.mouseUp(document);

    // After drag, body cursor should be restored
    expect(document.body.style.cursor).toBe(originalCursor);
    expect(document.body.style.userSelect).toBe(originalUserSelect);
  });

  it('sets row-resize cursor for vertical direction', () => {
    const onDragStart = vi.fn();
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();

    const { container } = render(
      <ResizeHandle
        direction="vertical"
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
      />
    );

    const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;
    expect(handle).toBeTruthy();

    // Start drag
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });

    // During drag, body should have row-resize cursor
    expect(document.body.style.cursor).toBe('row-resize');

    // End drag
    fireEvent.mouseUp(document);
  });

  it('restores previous cursor when ending drag', () => {
    const onDragStart = vi.fn();
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();

    // Set a custom cursor before drag
    document.body.style.cursor = 'pointer';
    document.body.style.userSelect = 'text';

    const { container } = render(
      <ResizeHandle
        direction="horizontal"
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
      />
    );

    const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;

    // Start drag
    fireEvent.mouseDown(handle, { clientX: 100, clientY: 100 });
    expect(document.body.style.cursor).toBe('col-resize');

    // End drag
    fireEvent.mouseUp(document);

    // Should restore to 'pointer', not empty string
    expect(document.body.style.cursor).toBe('pointer');
    expect(document.body.style.userSelect).toBe('text');

    // Clean up
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
});
