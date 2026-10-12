import { describe, expect, it } from 'vitest';
import { clampBatchSize, createImageBatches, filterImageFiles } from './batch';

const image = (name: string) => new File(['x'], name, { type: 'image/png' });

describe('photo batches', () => {
  it('keeps only image files and preserves order', () => {
    const files = [image('1.png'), new File(['x'], 'note.txt', { type: 'text/plain' }), image('2.png')];
    expect(filterImageFiles(files).map(file => file.name)).toEqual(['1.png', '2.png']);
  });

  it('uses a safe one-to-ten batch size', () => {
    expect(clampBatchSize(0)).toBe(1);
    expect(clampBatchSize(6)).toBe(6);
    expect(clampBatchSize(99)).toBe(10);
    expect(createImageBatches(Array.from({ length: 12 }, (_, index) => image(`${index}.png`)), 10))
      .toHaveLength(2);
  });
});

