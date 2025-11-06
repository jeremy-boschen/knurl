import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Panel } from '../Panel';

describe('Panel', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <Panel defaultSize="50%">
        Test Content
      </Panel>
    );

    expect(getByText('Test Content')).toBeTruthy();
  });

  it('applies className correctly', () => {
    const { container } = render(
      <Panel className="test-class" defaultSize="50%">
        Content
      </Panel>
    );

    expect(container.firstChild).toHaveClass('test-class');
  });

  it('sets data attributes correctly', () => {
    const { container } = render(
      <Panel
        defaultSize="30%"
        minSize="10%"
        maxSize="70%"
      >
        Content
      </Panel>
    );

    const panel = container.firstChild as HTMLElement;
    expect(panel.getAttribute('data-panel')).toBe('true');
    expect(panel.getAttribute('data-default-size')).toBe('30%');
    expect(panel.getAttribute('data-min-size')).toBe('10%');
    expect(panel.getAttribute('data-max-size')).toBe('70%');
  });
});
