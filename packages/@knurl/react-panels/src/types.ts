import type { ReactNode } from 'react';

export type PanelSize = `${number}px` | `${number}%`;

export type Direction = 'horizontal' | 'vertical';

export interface PanelProps {
  children?: ReactNode;
  defaultSize?: PanelSize;
  minSize?: PanelSize;
  maxSize?: PanelSize;
  className?: string;
  style?: React.CSSProperties;
}

export interface PanelGroupProps {
  children: ReactNode;
  direction?: Direction;
  className?: string;
  style?: React.CSSProperties;
  onResize?: (sizes: PanelSize[]) => void;
  onResizeStart?: () => void;
  onResizeEnd?: (sizes: PanelSize[]) => void;
}

export interface PanelGroupHandle {
  setSizes: (sizes: PanelSize[]) => void;
  getSizes: () => PanelSize[];
}

export interface ParsedSize {
  value: number;
  unit: 'px' | '%';
  original: PanelSize;
}
