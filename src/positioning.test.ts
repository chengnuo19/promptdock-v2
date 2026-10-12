import { describe, expect, it } from 'vitest';
import { calculateButtonPosition } from './positioning';

describe('button positioning', () => {
  it('places the button outside the composer on the right when space is available', () => {
    expect(calculateButtonPosition(
      { left: 100, right: 600, top: 500, bottom: 560, width: 500, height: 60 },
      { width: 1000, height: 800 },
      { width: 36, height: 36 },
    )).toEqual({ left: 608, top: 512, placement: 'right' });
  });

  it('moves above-right and clamps to the viewport when the right side is blocked', () => {
    expect(calculateButtonPosition(
      { left: 300, right: 990, top: 12, bottom: 72, width: 690, height: 60 },
      { width: 1000, height: 800 },
      { width: 36, height: 36 },
    )).toEqual({ left: 954, top: 8, placement: 'above' });
  });
});
