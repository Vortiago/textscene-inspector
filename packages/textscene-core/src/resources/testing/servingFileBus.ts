/**
 * A `FileEventBus` over files a test can edit: `files` is read on every load, so a
 * write to it is what the next load sees. A load of a path in `heldPaths` never settles, to hold
 * a consumer mid-load. Test-only, like the rest of `testing/`, and it never imports `vitest`.
 */
import { FileEventBus } from '../FileEventBus';
import type { ResourceProvider } from '../ResourceProvider';

export function busServing(files: Record<string, string>, heldPaths: readonly string[] = []) {
  /** Every path the provider was asked to load, in order. */
  const loads: string[] = [];
  const provider: ResourceProvider = {
    loadResource: async (path: string) => {
      loads.push(path);
      if (heldPaths.includes(path)) return new Promise<never>(() => {});
      return files[path] ?? null;
    },
  };
  return { bus: new FileEventBus(provider), provider, files, loads };
}
