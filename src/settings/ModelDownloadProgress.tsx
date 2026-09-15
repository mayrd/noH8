/**
 * Model download-progress presentation: size lines, "x of y · z%" progress
 * text, and the per-model progress bar. Pure presentational helpers so the
 * stateful `ModelManager` stays small; all strings flow through the shared
 * i18n seam.
 */
import React from 'react';
import { formatBytes } from '../offscreen/modelCatalog';
import type { DownloadDetail } from './modelStore';
import { t } from '../shared/i18n';

/** "Download size: 64.5 MB" / "On device · 64.5 MB" line under the model name. */
export const ModelSizeLine: React.FC<{ modelId: string; sizeBytes: number; downloaded: boolean }> = ({
  modelId,
  sizeBytes,
  downloaded,
}) => (
  <span className="text-xs text-gray-400 block mt-0.5" data-testid={`size-${modelId}`}>
    {downloaded
      ? t('models.downloadedSize', { size: formatBytes(sizeBytes) })
      : t('models.size', { size: formatBytes(sizeBytes) })}
  </span>
);

/** Resolve the "x of y · z%" progress text from byte detail + legacy percent. */
export function progressTextFor(
  detail: DownloadDetail | undefined,
  legacyPercent: number | undefined
): string {
  const percent = detail?.percent ?? legacyPercent ?? 0;
  if (detail && detail.totalBytes > 0) {
    return t('models.download.progress', {
      loaded: formatBytes(detail.loadedBytes),
      total: formatBytes(detail.totalBytes),
      percent,
    });
  }
  return `${percent}%`;
}

/** Per-model download progress bar with byte-level text + current file name. */
export const DownloadProgressBar: React.FC<{
  modelId: string;
  detail: DownloadDetail | undefined;
  legacyPercent: number | undefined;
}> = ({ modelId, detail, legacyPercent }) => (
  <div className="mt-4" data-testid={`progress-${modelId}`}>
    <div className="flex justify-between text-xs text-gray-500 mb-1">
      <span>{t('models.downloadingFromHub')}</span>
      <span data-testid={`progress-text-${modelId}`}>
        {progressTextFor(detail, legacyPercent)}
      </span>
    </div>
    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
      <div
        className="h-full rounded-full bg-noh8-600 transition-all duration-200"
        style={{ width: `${detail?.percent ?? legacyPercent ?? 0}%` }}
        data-testid={`progress-bar-${modelId}`}
      />
    </div>
    {(detail?.file ?? null) && (
      <div className="mt-1 text-xs text-gray-400 truncate" data-testid={`progress-file-${modelId}`}>
        {t('models.download.file', { file: String(detail?.file) })}
      </div>
    )}
  </div>
);
