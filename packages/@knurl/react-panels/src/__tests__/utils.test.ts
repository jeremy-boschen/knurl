import { describe, it, expect } from 'vitest';
import { parseSize, formatSize, convertToPixels, convertFromPixels, calculateSizes } from '../utils';
import type { PanelSize } from '../types';

describe('utils', () => {
  describe('parseSize', () => {
    it('parses pixel values correctly', () => {
      const result = parseSize('100px' as PanelSize);
      expect(result.value).toBe(100);
      expect(result.unit).toBe('px');
      expect(result.original).toBe('100px');
    });

    it('parses percentage values correctly', () => {
      const result = parseSize('50%' as PanelSize);
      expect(result.value).toBe(50);
      expect(result.unit).toBe('%');
      expect(result.original).toBe('50%');
    });

    it('throws on invalid format', () => {
      expect(() => parseSize('invalid' as PanelSize)).toThrow();
    });
  });

  describe('formatSize', () => {
    it('formats pixel values correctly', () => {
      expect(formatSize(100, 'px')).toBe('100px');
    });

    it('formats percentage values correctly', () => {
      expect(formatSize(50, '%')).toBe('50%');
    });
  });

  describe('convertToPixels', () => {
    it('returns pixel value unchanged', () => {
      const size = parseSize('100px' as PanelSize);
      expect(convertToPixels(size, 1000)).toBe(100);
    });

    it('converts percentage to pixels', () => {
      const size = parseSize('50%' as PanelSize);
      expect(convertToPixels(size, 1000)).toBe(500);
    });
  });

  describe('convertFromPixels', () => {
    it('returns pixel value unchanged', () => {
      expect(convertFromPixels(100, 1000, 'px')).toBe(100);
    });

    it('converts pixels to percentage', () => {
      expect(convertFromPixels(500, 1000, '%')).toBe(50);
    });
  });

  describe('calculateSizes', () => {
    it('calculates sizes correctly for percentages', () => {
      const sizes: PanelSize[] = ['50%' as PanelSize, '50%' as PanelSize];
      const result = calculateSizes(sizes, 1000, [{}, {}]);
      expect(result).toEqual([500, 500]);
    });

    it('calculates sizes correctly for pixels', () => {
      const sizes: PanelSize[] = ['200px' as PanelSize, '800px' as PanelSize];
      const result = calculateSizes(sizes, 1000, [{}, {}]);
      expect(result).toEqual([200, 800]);
    });

    it('handles mixed units correctly', () => {
      const sizes: PanelSize[] = ['200px' as PanelSize, '80%' as PanelSize];
      const result = calculateSizes(sizes, 1000, [{}, {}]);
      expect(result[0]).toBe(200);
      expect(result[1]).toBe(800);
    });

    it('applies min constraints', () => {
      const sizes: PanelSize[] = ['10px' as PanelSize, '990px' as PanelSize];
      const constraints = [{ minSize: '50px' as PanelSize }, {}];
      const result = calculateSizes(sizes, 1000, constraints);
      expect(result[0]).toBeGreaterThanOrEqual(50);
    });

    it('applies max constraints', () => {
      const sizes: PanelSize[] = ['900px' as PanelSize, '100px' as PanelSize];
      const constraints = [{ maxSize: '700px' as PanelSize }, {}];
      const result = calculateSizes(sizes, 1000, constraints);
      expect(result[0]).toBeLessThanOrEqual(700);
    });
  });
});
