import React, { useState } from 'react';
import { useModelStore, type ModelStatusId } from './modelStore';
import { MODEL_CATALOG, type ModelDescriptor } from '../offscreen/modelCatalog';
import { requestModelCommand } from '../offscreen/client';
import { classifyModelFailure, type ModelFailureKind } from './modelFailure';
import { t } from '../shared/i18n';

const STATUS_LABELS: Record<ModelStatusId, { label: string; className: string; icon: string }> = {
  not_downloaded: { label: t('models.status.notDownloaded'), className: 'bg-gray-100 text-gray-500', icon: '○' },
  downloading: { label: t('models.status.downloading'), className: 'bg-blue-100 text-blue-700', icon: '↻' },
  ready: { label: t('models.status.ready'), className: 'bg-green-100 text-green-700', icon: '✓' },
  error: { label: t('models.status.error'), className: 'bg-red-100 text-red-700', icon: '⚠' },
};

function statusFor(
  modelId: string,
  downloaded: string[],
  status: Record<string, ModelStatusId>
): ModelStatusId {
  return status[modelId] ?? (downloaded.includes(modelId) ? 'ready' : 'not_downloaded');
}

/**
 * "Detection Model" section of the settings page. Lets the user choose which
 * on-device model to use and download / refresh / delete models from a curated
 * catalog of suitable Transformers.js models.
 */
const ModelManager: React.FC = () => {
  const { selectedModelId, downloadedModels, modelStatus, downloadProgress, setSelectedModel } =
    useModelStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** (M16) Classified failure kind per model, shown with a retry affordance. */
  const [failureKinds, setFailureKinds] = useState<Record<string, ModelFailureKind>>({});
  const [notice, setNotice] = useState<{
    modelId: string;
    kind: 'success' | 'error';
    text: string;
  } | null>(null);

  // (M16) Nudge when the persisted selection no longer resolves in the catalog,
  // instead of silently running the heuristic fallback forever.
  const selectedModelIsStale =
    selectedModelId !== null &&
    selectedModelId !== undefined &&
    !MODEL_CATALOG.some((model) => model.id === selectedModelId);

  const run = async (
    action: 'download' | 'refresh' | 'delete',
    model: ModelDescriptor
  ) => {
    setBusyId(model.id);
    setActionError(null);
    setNotice(null);
    try {
      await requestModelCommand(action, model.id);
      if (action === 'download') {
        setFailureKinds((prev) => {
          const { [model.id]: _cleared, ...rest } = prev;
          return rest;
        });
        setNotice({
          modelId: model.id,
          kind: 'success',
          text: t('models.download.success', { name: model.name }),
        });
      }
    } catch (error) {
      const message = t('models.action.failed', {
        action: t(`models.action.${action}` as 'models.action.download'),
        name: model.name,
        error: String((error as Error)?.message ?? error),
      });
      if (action === 'download') {
        const kind = classifyModelFailure(error);
        setFailureKinds((prev) => ({ ...prev, [model.id]: kind }));
      }
      setActionError(message);
      setNotice({ modelId: model.id, kind: 'error', text: message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div data-testid="model-manager">
      {/* Section header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-800">{t('models.title')}</h2>
        <p className="text-sm text-gray-500 mt-1">
          {t('models.desc')}
        </p>
      </div>

      {/* M16: stale-model nudge — the persisted selection is no longer in the catalog. */}
      {selectedModelIsStale && (
        <p
          data-testid="stale-model-warning"
          role="alert"
          className="mb-6 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3"
        >
          {t('models.staleSelected', { modelId: String(selectedModelId) })}
        </p>
      )}

      {/* Model cards */}
      <div className="space-y-4">
        {MODEL_CATALOG.map((model) => {
          const status = statusFor(model.id, downloadedModels, modelStatus);
          const statusMeta = STATUS_LABELS[status];
          const isSelected = selectedModelId === model.id;
          const canDownload = status === 'not_downloaded' || status === 'error';
          const isDownloaded = downloadedModels.includes(model.id);
          const isBusy = busyId === model.id;

          return (
            <div
              key={model.id}
              data-model-id={model.id}
              data-testid={`model-card-${model.id}`}
              className={
                isSelected
                  ? 'rounded-xl border border-noh8-500 ring-2 ring-noh8-200 bg-noh8-50 p-4 transition-all'
                  : 'rounded-xl border border-gray-200 bg-white hover:border-gray-300 p-4 transition-all'
              }
            >
              {/* Top row: selection + status */}
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-start gap-3 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="noh8-model"
                    checked={isSelected}
                    onChange={() => setSelectedModel(model.id)}
                    aria-label={model.name}
                    className="mt-1 accent-noh8-600"
                  />
                  <span className="flex-1">
                    <span className="text-sm font-medium text-gray-800 block">{model.name}</span>
                    <span className="text-xs text-gray-500 block mt-0.5">{model.description}</span>
                    <span className="text-xs text-gray-400 block mt-0.5">{t('models.mode', { mode: model.mode })}</span>
                  </span>
                </label>

                <span
                  className={`shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${statusMeta.className}`}
                  data-testid={`status-${model.id}`}
                >
                  <span>{statusMeta.icon}</span>
                  {statusMeta.label}
                </span>
              </div>

              {/* Download progress */}
              {status === 'downloading' && (
                <div className="mt-4" data-testid={`progress-${model.id}`}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{t('models.downloadingFromHub')}</span>
                    <span>{downloadProgress[model.id] ?? 0}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-noh8-600 transition-all duration-200"
                      style={{ width: `${downloadProgress[model.id] ?? 0}%` }}
                      data-testid={`progress-bar-${model.id}`}
                    />
                  </div>
                </div>
              )}

              {/* Success / error feedback for the last action */}
              {notice?.modelId === model.id && (
                <p
                  data-testid={`notice-${model.id}`}
                  className={`mt-4 text-xs font-medium rounded-lg p-2.5 ${
                    notice.kind === 'success'
                      ? 'text-green-700 bg-green-50 border border-green-200'
                      : 'text-red-700 bg-red-50 border border-red-200'
                  }`}
                >
                  {notice.text}
                </p>
              )}

              {/* M16: classified failure explanation + retry affordance */}
              {status === 'error' && (
                <>
                  <p
                    data-testid={`failure-${model.id}`}
                    className="mt-4 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5"
                  >
                    {t(`models.failure.${failureKinds[model.id] ?? 'unknown'}` as
                      | 'models.failure.network'
                      | 'models.failure.corrupt'
                      | 'models.failure.quota'
                      | 'models.failure.unknown')}
                  </p>
                  <button
                    type="button"
                    data-testid={`retry-${model.id}`}
                    disabled={busyId !== null}
                    onClick={() => run('download', model)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-noh8-600 rounded-lg hover:bg-noh8-700 disabled:opacity-50 transition-colors"
                  >
                    {isBusy ? t('models.status.downloading') : t('models.button.retry')}
                  </button>
                </>
              )}

              {/* Action buttons */}
              <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                {canDownload && (
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => run('download', model)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-noh8-600 rounded-lg hover:bg-noh8-700 disabled:opacity-50 transition-colors"
                  >
                    {isBusy ? t('models.status.downloading') : t('models.button.download')}
                  </button>
                )}
                {isDownloaded && (
                  <>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => run('refresh', model)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      {isBusy ? t('models.button.refreshing') : t('models.button.refresh')}
                    </button>
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => run('delete', model)}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      {t('models.button.delete')}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {actionError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
};

export default ModelManager;
