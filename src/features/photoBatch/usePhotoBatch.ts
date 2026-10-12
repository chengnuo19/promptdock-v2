import { useMemo, useState } from 'react';
import type { SiteAdapter } from '../../types';
import { clampBatchSize, createImageBatches, DEFAULT_BATCH_SIZE, filterImageFiles } from './batch';

const attachmentError: Record<string, string> = {
  upload_input_not_found: '没有找到网页的图片上传入口，请刷新页面后重试。',
  site_rejected_files: '网页拒绝了这一批图片，请减少数量或检查格式。',
  timeout: '等待网页接收图片超时，请重试当前批次。',
  unknown: '图片附加失败，当前批次已保留。',
};

export const usePhotoBatch = (adapter: SiteAdapter) => {
  const [files, setFiles] = useState<File[]>([]);
  const [batchSize, setBatchSizeState] = useState(DEFAULT_BATCH_SIZE);
  const [batchIndex, setBatchIndex] = useState(0);
  const [imported, setImported] = useState(false);
  const [status, setStatus] = useState('请选择图片开始分批。');
  const [error, setError] = useState('');
  const batches = useMemo(() => createImageBatches(files, batchSize), [files, batchSize]);
  const currentBatch = batches[batchIndex] ?? [];

  const resetProgress = () => {
    setBatchIndex(0);
    setImported(false);
    setError('');
  };

  const selectFiles = (next: FileList | File[]) => {
    const images = filterImageFiles(next);
    setFiles(images);
    resetProgress();
    setStatus(images.length > 0 ? `已选择 ${images.length} 张图片。` : '没有选中可用图片。');
  };

  const setBatchSize = (value: number) => {
    setBatchSizeState(clampBatchSize(value));
    resetProgress();
    setStatus(files.length > 0 ? '批量大小已更新，将从第一批重新开始。' : '请选择图片开始分批。');
  };

  const importCurrent = async () => {
    if (currentBatch.length === 0) {
      setError('当前没有可附加的图片。');
      return;
    }
    setError('');
    setStatus('正在附加当前批次…');
    const result = await adapter.attachFiles(currentBatch);
    if (!result.ok) {
      setError(attachmentError[result.reason]);
      setStatus('当前批次尚未完成。');
      return;
    }
    setImported(true);
    setStatus('当前批次已附加，请在网页中手动发送，然后点击“下一批”。');
  };

  const nextBatch = () => {
    if (!imported || batchIndex >= batches.length - 1) return;
    setBatchIndex(index => index + 1);
    setImported(false);
    setError('');
    setStatus('下一批已准备好。');
  };

  const reset = () => {
    setFiles([]);
    setBatchIndex(0);
    setImported(false);
    setError('');
    setStatus('请选择图片开始分批。');
  };

  return {
    files,
    batchSize,
    batchIndex,
    batches,
    currentBatch,
    imported,
    status,
    error,
    selectFiles,
    setBatchSize,
    importCurrent,
    nextBatch,
    reset,
  };
};

