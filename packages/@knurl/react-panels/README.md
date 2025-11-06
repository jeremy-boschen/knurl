# @knurl/react-panels

A lightweight, zero-dependency React panel library with pixel and percentage-based sizing support.

## Features

- 🎯 Pixel-based (`"200px"`) and percentage-based (`"50%"`) sizing
- 🔄 Horizontal and vertical layouts
- 🪆 Nested panel support
- 🎮 Imperative API for programmatic control
- 🖱️ Draggable resize handles with callbacks
- ⚛️ React 19+ and modern browsers only
- 📦 Zero dependencies (except React)
- 📘 Full TypeScript support

## Installation

```bash
yarn add @knurl/react-panels
```

## Usage

### Basic Example

```tsx
import { Panel, PanelGroup } from '@knurl/react-panels';
import '@knurl/react-panels/style.css';

function App() {
  return (
    <PanelGroup direction="horizontal">
      <Panel defaultSize="50%" minSize="20%" maxSize="80%">
        Left Panel
      </Panel>
      <Panel defaultSize="50%" minSize="100px">
        Right Panel
      </Panel>
    </PanelGroup>
  );
}
```

### Imperative API

```tsx
import { useRef } from 'react';
import { Panel, PanelGroup, PanelGroupHandle } from '@knurl/react-panels';

function App() {
  const panelGroupRef = useRef<PanelGroupHandle>(null);

  const handleCollapse = () => {
    // Set first panel to 0px, second panel takes remaining space
    panelGroupRef.current?.setSizes(['0px', '100%']);
  };

  const handleReset = () => {
    panelGroupRef.current?.setSizes(['50%', '50%']);
  };

  return (
    <div>
      <button onClick={handleCollapse}>Collapse Left</button>
      <button onClick={handleReset}>Reset</button>
      <PanelGroup ref={panelGroupRef} direction="horizontal">
        <Panel defaultSize="50%">Left Panel</Panel>
        <Panel defaultSize="50%">Right Panel</Panel>
      </PanelGroup>
    </div>
  );
}
```

### Nested Panels

```tsx
<PanelGroup direction="horizontal">
  <Panel defaultSize="50%">
    <PanelGroup direction="vertical">
      <Panel defaultSize="50%">Top</Panel>
      <Panel defaultSize="50%">Bottom</Panel>
    </PanelGroup>
  </Panel>
  <Panel defaultSize="50%">Right Side</Panel>
</PanelGroup>
```

### Resize Callbacks

```tsx
<PanelGroup
  direction="horizontal"
  onResizeStart={() => console.log('Resize started')}
  onResize={(sizes) => console.log('Current sizes:', sizes)}
  onResizeEnd={(sizes) => console.log('Final sizes:', sizes)}
>
  <Panel defaultSize="50%">Left</Panel>
  <Panel defaultSize="50%">Right</Panel>
</PanelGroup>
```

## API

### `<PanelGroup>`

Container for panels with resize functionality.

#### Props

- `direction?: 'horizontal' | 'vertical'` - Layout direction (default: `'horizontal'`)
- `className?: string` - CSS class name
- `style?: React.CSSProperties` - Inline styles
- `onResize?: (sizes: PanelSize[]) => void` - Called during resize with current sizes
- `onResizeStart?: () => void` - Called when resize starts
- `onResizeEnd?: (sizes: PanelSize[]) => void` - Called when resize ends

#### Imperative Handle

Access via ref:

- `setSizes(sizes: PanelSize[])` - Set panel sizes programmatically
- `getSizes(): PanelSize[]` - Get current panel sizes

### `<Panel>`

Individual panel component.

#### Props

- `defaultSize?: PanelSize` - Initial size (e.g., `"50%"`, `"200px"`)
- `minSize?: PanelSize` - Minimum size constraint
- `maxSize?: PanelSize` - Maximum size constraint
- `className?: string` - CSS class name
- `style?: React.CSSProperties` - Inline styles
- `children?: ReactNode` - Panel content

### Types

```typescript
type PanelSize = `${number}px` | `${number}%`;
type Direction = 'horizontal' | 'vertical';

interface PanelGroupHandle {
  setSizes: (sizes: PanelSize[]) => void;
  getSizes: () => PanelSize[];
}
```

## Size Calculation

When using `setSizes()`, the library intelligently handles mixed units:

```tsx
// First panel gets exactly 200px, second panel fills remaining space
setSizes(['200px', '100%']);
// Result: second panel = calc(100% - 200px)

// Both panels get percentage-based sizes
setSizes(['30%', '70%']);
// Result: splits container 30/70
```

## License

Apache-2.0
