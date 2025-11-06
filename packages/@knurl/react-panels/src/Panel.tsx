import { forwardRef } from 'react';
import type { PanelProps } from './types';

export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  ({ children, className, style, defaultSize, minSize, maxSize, ...props }, ref) => {
    // Store constraints as data attributes for PanelGroup to read
    return (
      <div
        ref={ref}
        className={className}
        style={style}
        data-panel="true"
        data-default-size={defaultSize}
        data-min-size={minSize}
        data-max-size={maxSize}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Panel.displayName = 'Panel';
