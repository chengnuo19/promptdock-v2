export type RectLike = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

export type ViewportSize = { width: number; height: number };
export type ElementSize = { width: number; height: number };

export type ButtonPosition = {
  left: number;
  top: number;
  placement: 'right' | 'above';
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const calculateButtonPosition = (
  anchor: RectLike,
  viewport: ViewportSize,
  button: ElementSize,
  gap = 8,
  edge = 8,
): ButtonPosition => {
  const fitsRight = anchor.right + gap + button.width <= viewport.width - edge;
  const placement = fitsRight ? 'right' : 'above';
  const rawLeft = fitsRight ? anchor.right + gap : anchor.right - button.width;
  const rawTop = fitsRight
    ? anchor.top + (anchor.height - button.height) / 2
    : anchor.top - gap - button.height;

  return {
    left: Math.round(clamp(rawLeft, edge, viewport.width - button.width - edge)),
    top: Math.round(clamp(rawTop, edge, viewport.height - button.height - edge)),
    placement,
  };
};

