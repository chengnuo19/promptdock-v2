import { ImagePlus, RotateCcw, Upload } from 'lucide-react';
import { useRef } from 'react';
import type { SiteAdapter } from '../../types';
import { usePhotoBatch } from './usePhotoBatch';

export const PhotoBatchPanel = ({ adapter }: { adapter: SiteAdapter }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const batch = usePhotoBatch(adapter);
  const total = batch.batches.length;
  const complete = total > 0 && batch.imported && batch.batchIndex === total - 1;

  return (
    <section className="pd-section" aria-labelledby="photo-batch-title">
      <div className="pd-section-header">
        <div>
          <h2 id="photo-batch-title">图片分批</h2>
          <p>只附加图片，由你在网页中手动发送。</p>
        </div>
        <button className="pd-icon-button" type="button" onClick={batch.reset} disabled={!batch.files.length} aria-label="重置图片批次">
          <RotateCcw size={16} />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={event => {
          if (event.target.files) batch.selectFiles(event.target.files);
          event.target.value = '';
        }}
      />

      <div className="pd-field-row">
        <label htmlFor="pd-batch-size">每批数量</label>
        <input
          id="pd-batch-size"
          className="pd-number-input"
          type="number"
          min={1}
          max={10}
          value={batch.batchSize}
          onChange={event => batch.setBatchSize(Number(event.target.value))}
        />
      </div>

      <button className="pd-button pd-button-secondary pd-full" type="button" onClick={() => inputRef.current?.click()}>
        <ImagePlus size={17} /> 选择图片
      </button>

      {batch.files.length > 0 && (
        <div className="pd-info-card">
          <strong>{batch.files.length} 张图片</strong>
          <span>第 {batch.batchIndex + 1} / {total} 批 · 当前 {batch.currentBatch.length} 张</span>
        </div>
      )}

      <div className="pd-action-row">
        <button
          className="pd-button pd-button-primary"
          type="button"
          disabled={!batch.currentBatch.length || batch.imported}
          onClick={() => void batch.importCurrent()}
        >
          <Upload size={17} /> 附加当前批次
        </button>
        <button
          className="pd-button pd-button-secondary"
          type="button"
          disabled={!batch.imported || complete}
          onClick={batch.nextBatch}
        >
          下一批
        </button>
      </div>

      <p className={batch.error ? 'pd-status pd-status-error' : 'pd-status'} role="status">
        {complete ? '全部批次已完成。' : batch.error || batch.status}
      </p>
    </section>
  );
};

