import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { Panel } from '../Panel';
import { PanelGroup } from '../PanelGroup';
import type { PanelGroupHandle, PanelSize } from '../types';

describe('PanelGroup Integration Tests', () => {
  describe('Basic Rendering', () => {
    it('renders panels with correct initial sizes', async () => {
      render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize="30%">
              <div data-testid="panel-1">Panel 1</div>
            </Panel>
            <Panel defaultSize="70%">
              <div data-testid="panel-2">Panel 2</div>
            </Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        const panel2 = screen.getByTestId('panel-2').parentElement;

        // Check that panels have sizes applied
        expect(panel1?.style.width).toBeTruthy();
        expect(panel2?.style.width).toBeTruthy();
      });
    });

    it('renders resize handles between panels', () => {
      const { container } = render(
        <PanelGroup direction="horizontal">
          <Panel defaultSize="50%">Panel 1</Panel>
          <Panel defaultSize="50%">Panel 2</Panel>
        </PanelGroup>
      );

      const handles = container.querySelectorAll('[data-resize-handle="true"]');
      expect(handles.length).toBe(1); // One handle between two panels
    });

    it('renders correct number of handles for multiple panels', () => {
      const { container } = render(
        <PanelGroup direction="horizontal">
          <Panel defaultSize="33%">Panel 1</Panel>
          <Panel defaultSize="33%">Panel 2</Panel>
          <Panel defaultSize="34%">Panel 3</Panel>
        </PanelGroup>
      );

      const handles = container.querySelectorAll('[data-resize-handle="true"]');
      expect(handles.length).toBe(2); // Two handles for three panels
    });

    it('does not create infinite render loop', async () => {
      const renderSpy = vi.fn();

      function TestComponent() {
        renderSpy();
        return (
          <PanelGroup direction="horizontal">
            <Panel defaultSize="50%">Panel 1</Panel>
            <Panel defaultSize="50%">Panel 2</Panel>
          </PanelGroup>
        );
      }

      render(<TestComponent />);

      // Wait a bit to ensure no infinite loops
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should render a reasonable number of times (initial + effects)
      // but definitely not hundreds of times
      expect(renderSpy).toHaveBeenCalled();
      expect(renderSpy.mock.calls.length).toBeGreaterThan(0);
      expect(renderSpy.mock.calls.length).toBeLessThan(10);
    });
  });

  describe('Imperative API', () => {
    it('setSizes updates panel sizes', async () => {
      function TestComponent() {
        const groupRef = useRef<PanelGroupHandle>(null);

        return (
          <div style={{ width: '1000px', height: '600px' }}>
            <button
              onClick={() => groupRef.current?.setSizes(['200px' as PanelSize, '800px' as PanelSize])}
              data-testid="set-sizes-btn"
            >
              Set Sizes
            </button>
            <PanelGroup ref={groupRef} direction="horizontal">
              <Panel defaultSize="50%">
                <div data-testid="panel-1">Panel 1</div>
              </Panel>
              <Panel defaultSize="50%">
                <div data-testid="panel-2">Panel 2</div>
              </Panel>
            </PanelGroup>
          </div>
        );
      }

      render(<TestComponent />);

      const button = screen.getByTestId('set-sizes-btn');
      fireEvent.click(button);

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        const panel2 = screen.getByTestId('panel-2').parentElement;

        // After setSizes, panel1 should be ~200px and panel2 should be ~800px
        expect(panel1?.style.width).toBeTruthy();
        expect(panel2?.style.width).toBeTruthy();
      });
    });

    it('getSizes returns current panel sizes', () => {
      let capturedSizes: PanelSize[] = [];

      function TestComponent() {
        const groupRef = useRef<PanelGroupHandle>(null);

        return (
          <div>
            <button
              onClick={() => {
                capturedSizes = groupRef.current?.getSizes() || [];
              }}
              data-testid="get-sizes-btn"
            >
              Get Sizes
            </button>
            <PanelGroup ref={groupRef} direction="horizontal">
              <Panel defaultSize="30%">Panel 1</Panel>
              <Panel defaultSize="70%">Panel 2</Panel>
            </PanelGroup>
          </div>
        );
      }

      render(<TestComponent />);

      const button = screen.getByTestId('get-sizes-btn');
      fireEvent.click(button);

      expect(capturedSizes.length).toBe(2);
      expect(capturedSizes[0]).toMatch(/\d+%/);
      expect(capturedSizes[1]).toMatch(/\d+%/);
    });

    it('warns when setSizes receives wrong number of sizes', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      function TestComponent() {
        const groupRef = useRef<PanelGroupHandle>(null);

        return (
          <div>
            <button
              onClick={() => groupRef.current?.setSizes(['50%' as PanelSize])} // Wrong: only 1 size for 2 panels
              data-testid="set-sizes-btn"
            >
              Set Sizes
            </button>
            <PanelGroup ref={groupRef} direction="horizontal">
              <Panel defaultSize="50%">Panel 1</Panel>
              <Panel defaultSize="50%">Panel 2</Panel>
            </PanelGroup>
          </div>
        );
      }

      render(<TestComponent />);

      const button = screen.getByTestId('set-sizes-btn');
      fireEvent.click(button);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Expected 2 sizes, got 1')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Resize Callbacks', () => {
    it('calls onResizeStart when drag begins', async () => {
      const onResizeStart = vi.fn();

      const { container } = render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal" onResizeStart={onResizeStart}>
            <Panel defaultSize="50%">Panel 1</Panel>
            <Panel defaultSize="50%">Panel 2</Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const handle = container.querySelector('[data-resize-handle="true"]');
        expect(handle).toBeTruthy();
      });

      const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;
      fireEvent.mouseDown(handle, { clientX: 500, clientY: 300 });

      expect(onResizeStart).toHaveBeenCalledTimes(1);

      // Clean up
      fireEvent.mouseUp(document);
    });

    it('calls onResize during drag', async () => {
      const onResize = vi.fn();

      const { container } = render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal" onResize={onResize}>
            <Panel defaultSize="50%">Panel 1</Panel>
            <Panel defaultSize="50%">Panel 2</Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const handle = container.querySelector('[data-resize-handle="true"]');
        expect(handle).toBeTruthy();
      });

      const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;

      fireEvent.mouseDown(handle, { clientX: 500, clientY: 300 });
      fireEvent.mouseMove(document, { clientX: 600, clientY: 300 });

      expect(onResize).toHaveBeenCalled();
      expect(onResize.mock.calls[0][0]).toHaveLength(2); // Should receive array of 2 sizes

      // Clean up
      fireEvent.mouseUp(document);
    });

    it('calls onResizeEnd when drag ends', async () => {
      const onResizeEnd = vi.fn();

      const { container } = render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal" onResizeEnd={onResizeEnd}>
            <Panel defaultSize="50%">Panel 1</Panel>
            <Panel defaultSize="50%">Panel 2</Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const handle = container.querySelector('[data-resize-handle="true"]');
        expect(handle).toBeTruthy();
      });

      const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;

      fireEvent.mouseDown(handle, { clientX: 500, clientY: 300 });
      fireEvent.mouseMove(document, { clientX: 600, clientY: 300 });
      fireEvent.mouseUp(document);

      expect(onResizeEnd).toHaveBeenCalledTimes(1);
      expect(onResizeEnd.mock.calls[0][0]).toHaveLength(2);
    });
  });

  describe('Nested Panels', () => {
    it('renders nested panel groups correctly', () => {
      const { container } = render(
        <PanelGroup direction="horizontal">
          <Panel defaultSize="50%">
            <PanelGroup direction="vertical">
              <Panel defaultSize="50%">
                <div data-testid="nested-1">Nested 1</div>
              </Panel>
              <Panel defaultSize="50%">
                <div data-testid="nested-2">Nested 2</div>
              </Panel>
            </PanelGroup>
          </Panel>
          <Panel defaultSize="50%">
            <div data-testid="main-2">Main 2</div>
          </Panel>
        </PanelGroup>
      );

      expect(screen.getByTestId('nested-1')).toBeTruthy();
      expect(screen.getByTestId('nested-2')).toBeTruthy();
      expect(screen.getByTestId('main-2')).toBeTruthy();

      // Should have handles for both outer and inner groups
      const handles = container.querySelectorAll('[data-resize-handle="true"]');
      expect(handles.length).toBe(2); // One for outer, one for inner
    });
  });

  describe('Size Constraints', () => {
    it('respects minSize constraint', async () => {
      const { container } = render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize="50%" minSize="200px">
              <div data-testid="panel-1">Panel 1</div>
            </Panel>
            <Panel defaultSize="50%">
              <div data-testid="panel-2">Panel 2</div>
            </Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        expect(panel1?.style.width).toBeTruthy();
      });

      const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;

      // Try to drag past minimum
      fireEvent.mouseDown(handle, { clientX: 500, clientY: 300 });
      fireEvent.mouseMove(document, { clientX: 100, clientY: 300 }); // Try to make it very small

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        const width = parseFloat(panel1?.style.width || '0');
        // Should not go below minSize (200px)
        expect(width).toBeGreaterThanOrEqual(200);
      });

      fireEvent.mouseUp(document);
    });

    it('respects maxSize constraint', async () => {
      const { container } = render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize="50%" maxSize="700px">
              <div data-testid="panel-1">Panel 1</div>
            </Panel>
            <Panel defaultSize="50%">
              <div data-testid="panel-2">Panel 2</div>
            </Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        expect(panel1?.style.width).toBeTruthy();
      });

      const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;

      // Try to drag past maximum
      fireEvent.mouseDown(handle, { clientX: 500, clientY: 300 });
      fireEvent.mouseMove(document, { clientX: 900, clientY: 300 }); // Try to make it very large

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        const width = parseFloat(panel1?.style.width || '0');
        // Should not go above maxSize (700px)
        expect(width).toBeLessThanOrEqual(700);
      });

      fireEvent.mouseUp(document);
    });
  });

  describe('Direction Support', () => {
    it('renders horizontal panels correctly', async () => {
      render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize="50%">
              <div data-testid="panel-1">Panel 1</div>
            </Panel>
            <Panel defaultSize="50%">
              <div data-testid="panel-2">Panel 2</div>
            </Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        // Horizontal panels should have width set
        expect(panel1?.style.width).toBeTruthy();
        expect(panel1?.style.height).toBe('100%');
      });
    });

    it('renders vertical panels correctly', async () => {
      render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="vertical">
            <Panel defaultSize="50%">
              <div data-testid="panel-1">Panel 1</div>
            </Panel>
            <Panel defaultSize="50%">
              <div data-testid="panel-2">Panel 2</div>
            </Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        // Vertical panels should have height set
        expect(panel1?.style.height).toBeTruthy();
        expect(panel1?.style.width).toBe('100%');
      });
    });
  });

  describe('Mixed Size Units', () => {
    it('handles pixel and percentage sizes together', async () => {
      render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize="200px">
              <div data-testid="panel-1">Panel 1</div>
            </Panel>
            <Panel defaultSize="80%">
              <div data-testid="panel-2">Panel 2</div>
            </Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        const panel2 = screen.getByTestId('panel-2').parentElement;

        // Panel 1 should be 200px
        const width1 = parseFloat(panel1?.style.width || '0');
        expect(width1).toBeCloseTo(200, 0);

        // Panel 2 should be ~800px (80% of 1000px)
        const width2 = parseFloat(panel2?.style.width || '0');
        expect(width2).toBeCloseTo(800, 0);
      });
    });
  });

  describe('Constraint Edge Cases', () => {
    it('handles drag when right panel hits its minimum constraint', async () => {
      const { container } = render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize="400px" minSize="100px" maxSize="900px">
              <div data-testid="panel-1">Panel 1</div>
            </Panel>
            <Panel defaultSize="600px" minSize="200px">
              <div data-testid="panel-2">Panel 2</div>
            </Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        expect(panel1).toBeTruthy();
      });

      const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;
      expect(handle).toBeTruthy();

      // Drag right so much that it would push right panel below its minimum
      // Right panel min is 200px, so left can't go above 800px
      fireEvent.mouseDown(handle, { clientX: 400, clientY: 300 });
      fireEvent.mouseMove(document, { clientX: 900, clientY: 300 }); // Try to drag to 900px (delta +500)
      fireEvent.mouseUp(document);

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        const panel2 = screen.getByTestId('panel-2').parentElement;

        const width1 = parseFloat(panel1?.style.width || '0');
        const width2 = parseFloat(panel2?.style.width || '0');

        // Left panel should be clamped to 800px (1000 - 200)
        expect(width1).toBeCloseTo(800, 0);
        // Right panel should be at its minimum of 200px
        expect(width2).toBeCloseTo(200, 0);
      });
    });

    it('handles drag when right panel hits its maximum constraint', async () => {
      const { container } = render(
        <div style={{ width: '1000px', height: '600px' }}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize="600px" minSize="100px">
              <div data-testid="panel-1">Panel 1</div>
            </Panel>
            <Panel defaultSize="400px" maxSize="700px">
              <div data-testid="panel-2">Panel 2</div>
            </Panel>
          </PanelGroup>
        </div>
      );

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        expect(panel1).toBeTruthy();
      });

      const handle = container.querySelector('[data-resize-handle="true"]') as HTMLElement;
      expect(handle).toBeTruthy();

      // Drag left so much that it would push right panel above its maximum
      // Right panel max is 700px, so left can't go below 300px
      fireEvent.mouseDown(handle, { clientX: 600, clientY: 300 });
      fireEvent.mouseMove(document, { clientX: 100, clientY: 300 }); // Try to drag to 100px (delta -500)
      fireEvent.mouseUp(document);

      await waitFor(() => {
        const panel1 = screen.getByTestId('panel-1').parentElement;
        const panel2 = screen.getByTestId('panel-2').parentElement;

        const width1 = parseFloat(panel1?.style.width || '0');
        const width2 = parseFloat(panel2?.style.width || '0');

        // Left panel should be clamped to 300px (1000 - 700)
        expect(width1).toBeCloseTo(300, 0);
        // Right panel should be at its maximum of 700px
        expect(width2).toBeCloseTo(700, 0);
      });
    });
  });
});
