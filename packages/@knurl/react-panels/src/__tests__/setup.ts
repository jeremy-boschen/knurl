import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = function() {
  return {
    width: 1000,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 1000,
    x: 0,
    y: 0,
    toJSON: () => {},
  };
};
