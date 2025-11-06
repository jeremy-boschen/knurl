import type { PanelSize, ParsedSize } from './types';

export function parseSize(size: PanelSize): ParsedSize {
  const match = size.match(/^(\d+(?:\.\d+)?)(px|%)$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}. Expected format: "123px" or "45%"`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2] as 'px' | '%';

  return { value, unit, original: size };
}

export function formatSize(value: number, unit: 'px' | '%'): PanelSize {
  return `${value}${unit}` as PanelSize;
}

export function convertToPixels(size: ParsedSize, containerSize: number): number {
  if (size.unit === 'px') {
    return size.value;
  }
  return (size.value / 100) * containerSize;
}

export function convertFromPixels(pixels: number, containerSize: number, targetUnit: 'px' | '%'): number {
  if (targetUnit === 'px') {
    return pixels;
  }
  return (pixels / containerSize) * 100;
}

export function clampSize(size: number, min: number | undefined, max: number | undefined): number {
  let clamped = size;
  if (min !== undefined) {
    clamped = Math.max(clamped, min);
  }
  if (max !== undefined) {
    clamped = Math.min(clamped, max);
  }
  return clamped;
}

export function calculateSizes(
  requestedSizes: PanelSize[],
  containerSize: number,
  panelConstraints: Array<{
    minSize?: PanelSize;
    maxSize?: PanelSize;
  }>
): number[] {
  // Parse all sizes
  const parsed = requestedSizes.map(parseSize);

  // Convert to pixels
  let pixelSizes = parsed.map(p => convertToPixels(p, containerSize));

  // Apply constraints
  pixelSizes = pixelSizes.map((size, i) => {
    const constraints = panelConstraints[i];
    const minPx = constraints?.minSize ? convertToPixels(parseSize(constraints.minSize), containerSize) : undefined;
    const maxPx = constraints?.maxSize ? convertToPixels(parseSize(constraints.maxSize), containerSize) : undefined;
    return clampSize(size, minPx, maxPx);
  });

  // Calculate total and adjust if needed
  const total = pixelSizes.reduce((sum, size) => sum + size, 0);

  if (Math.abs(total - containerSize) > 0.1) {
    // Distribute the difference proportionally
    const diff = containerSize - total;
    const adjustablePanels = pixelSizes.map((_, i) => i);

    if (adjustablePanels.length > 0) {
      // Add difference to the last panel (which is often "100%" fill)
      const lastIndex = pixelSizes.length - 1;
      pixelSizes[lastIndex] += diff;

      // Re-apply constraints
      const constraints = panelConstraints[lastIndex];
      const minPx = constraints?.minSize ? convertToPixels(parseSize(constraints.minSize), containerSize) : undefined;
      const maxPx = constraints?.maxSize ? convertToPixels(parseSize(constraints.maxSize), containerSize) : undefined;
      pixelSizes[lastIndex] = clampSize(pixelSizes[lastIndex], minPx, maxPx);
    }
  }

  return pixelSizes;
}
