import React, { useState } from 'react';
import { useModelStore, type ModelStatusId } from './modelStore';
import { MODEL_CATALOG, type ModelDescriptor } from '../offscreen/modelCatalog';
import { requestModelCommand } from '../offscreen/client';

const STATUS_LABELS: Record<ModelStatusId, { label: string; className: string }> = {
  not_downloaded: { label: 'Not downloaded', className: 'bg-gray-100 text-gray-500' },
  downloading: { label: 'Downloading…', className: 'bg-blue-100 text-blue-700' },
  ready: { label: 'Ready on device', className: 'bg-green-100 text-green-700' },
  error: { label: 'Download failed', className: 'bg-red-100 text-red-700' },
};

function statusFor(modelId: string, downloaded: string[], status: Record<string, ModelStatusId>): ModelStatusId {
  return status[modelId] ?? (downloaded.includes(modelId) ? 'ready' : 'not_downloaded');
}

/**
 * "Detection Model" tab of the settings page. Lets the user choose which
 * on-device model to use and download / refresh / delete models from a curated
 * catalog of suitable Transformers.js models.
 */
const ModelManager: React.FC = () => {
  const { selectedModelId, downloadedModels, modelStatus, setSelectedModel } = useModelStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (action: 'download' | 'refresh' | 'delete', model: ModelDescriptor) => {
    setBusyId(model.id);
    setActionError(null);
    try {
      await requestModelCommand(action, model.id);
    } catch (error) {
      setActionError(
        `Could not ${action} "${model.name}": ${String((error as Error)?.message ?? error)}`
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-6">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-gray-800">Detection Model</h2>
        <p className="text-sm text-gray-500 mt-1">
          The machine-learning model used to analyse comments. It is downloaded once and runs
          100% on-device. Delete models you no longer need to free up space.
        </p>
      </div>

      <div className="p-4 space-y-3">
        {MODEL_CATALOG.map((model) => {
          const status = statusFor(model.id, downloadedModels, modelStatus);
          const statusMeta = STATUS_LABELS[status];
          const isSelected = selectedModelId === model.id;
          const canDownload = status === 'not_downloaded' || status === 'error';
          const isDownloaded = downloadedModels.includes(model.id);
          const disabled = busyId !== null;

          return (
            <div
              key={model.id}
              className={`p-3 rounded-lg border ${
                isSelected ? 'border-blue-500 ring-1 ring-blue-200 bg-blue-50' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <label className="flex items-start gap-3 cursor-pointer flex-1">
                  <input
                    type="radio"
                    name="noh8-model"
                    checked={isSelected}
                    onChange={() => setSelectedModel(model.id)}
                    className="mt-1 accent-blue-600"
                  />
                  <span>
                    <span className="text-sm font-medium text-gray-800 block">{model.name}</span>
                    <span className="text-xs text-gray-500 block mt-0.5">{model.description}</span>
                  </span>
                </label>

                <span
                  className={`shrink-0 text-xs px-2 py-1 rounded-full ${statusMeta.className}`}
                  data-testid={`status-${model.id}`}
                >
                  {statusMeta.label}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                {canDownload && (
                  <button
                    type="button"
                    disabled={disabled || busyId === model.id}
                    onClick={() => run('download', model)}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {busyId === model.id ? 'Downloading…' : 'Download'}
                  </button>
                )}
                {isDownloaded && (
                  <>
                    <button
                      type="button"
                      disabled={disabled || busyId === model.id}
                      onClick={() => run('refresh', model)}
                      className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      {busyId === model.id ? 'Refreshing…' : 'Refresh'}
                    </button>
                    <button
                      type="button"
                      disabled={disabled || busyId === model.id}
                      onClick={() => run('delete', model)}
                      className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {actionError && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {actionError}
          </p>
        )}
      </div>
    </div>
  );
};

export default ModelManager;