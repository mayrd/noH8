import type { BaseAdapter } from './baseAdapter';

// Vite's import.meta.glob returns a map of file paths to import functions
const adapters = import.meta.glob('./*.ts', { eager: false });

export async function getEnabledAdapters(platforms: string[]): Promise<BaseAdapter[]> {
  const enabledAdapters: BaseAdapter[] = [];

  for (const platform of platforms) {
    const importFn = adapters[platform];
    if (importFn) {
      const module = await importFn();
      if (module && module.default) {
        enabledAdapters.push(await module.default());
      }
    }
  }

  return enabledAdapters;
}

// Helper for tests to list available adapters
export function getAvailableAdapterNames(): string[] {
  return Object.keys(adapters);
}
