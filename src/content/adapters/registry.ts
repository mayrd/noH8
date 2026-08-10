/// <reference types="vite/client" />
import type { BaseAdapter } from './baseAdapter';

// Vite's import.meta.glob returns a map of file paths to import functions
const adapters = import.meta.glob('./*.ts', { eager: false }) as Record<
  string,
  () => Promise<any>
>;

export async function getEnabledAdapters(platforms: string[]): Promise<BaseAdapter[]> {
  const enabledAdapters: BaseAdapter[] = [];

  for (const platform of platforms) {
    // Construct the expected import path (e.g., './youtubeAdapter.ts')
    const importPath = `./${platform}Adapter.ts`;
    const importFn = adapters[importPath];
    
    if (importFn) {
      try {
        const module = await importFn();
        if (module && module.default) {
          enabledAdapters.push(await new module.default());
        }
      } catch (error) {
        console.warn(`Failed to load adapter for platform ${platform}:`, error);
      }
    }
  }

  return enabledAdapters;
}

// Helper for tests to list available adapters
export function getAvailableAdapterNames(): string[] {
  return Object.keys(adapters)
    .map(path => {
      const match = path.match(/^\.\/([a-zA-Z]+)Adapter\.ts$/);
      return match ? match[1] : null;
    })
    .filter((name): name is string => name !== null && name !== 'base');
}
