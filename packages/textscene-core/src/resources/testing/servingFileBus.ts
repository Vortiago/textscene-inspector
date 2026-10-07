/**
 * A `FileEventBus` over files a test can edit: `files` is read on every load, so a
 * write to it is what the next load sees. Test-only, like the rest of `testing/`,
 * and it never imports `vitest`.
 */
import { FileEventBus } from '../FileEventBus';
import type { ResourceProvider } from '../ResourceProvider';

export function busServing(files: Record<string, string>) {
  /** Every path the provider was asked to load, in order. */
  const loads: string[] = [];
  const provider: ResourceProvider = {
    loadResource: async (path: string) => {
      loads.push(path);
      return files[path] ?? null;
    },
  };
  return { bus: new FileEventBus(provider), provider, files, loads };
}
