export const DEFAULT_BATCH_SIZE = 10;
export const MIN_BATCH_SIZE = 1;
export const MAX_BATCH_SIZE = 10;

export const clampBatchSize = (value: number): number => Math.max(
  MIN_BATCH_SIZE,
  Math.min(MAX_BATCH_SIZE, Math.round(Number.isFinite(value) ? value : DEFAULT_BATCH_SIZE)),
);

export const filterImageFiles = (files: File[] | FileList): File[] => Array.from(files)
  .filter(file => file.type.startsWith('image/'));

export const createImageBatches = (
  files: File[] | FileList,
  batchSize = DEFAULT_BATCH_SIZE,
): File[][] => {
  const size = clampBatchSize(batchSize);
  const images = filterImageFiles(files);
  const batches: File[][] = [];
  for (let index = 0; index < images.length; index += size) {
    batches.push(images.slice(index, index + size));
  }
  return batches;
};

