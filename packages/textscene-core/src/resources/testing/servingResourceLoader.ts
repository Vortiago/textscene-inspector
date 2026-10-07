/**
 * A `ResourceLoader` over a fixed set of files: a path outside `files` loads as
 * missing. Test-only, like the rest of `testing/`, and it never imports `vitest`.
 */
import { FileEventBus } from '../FileEventBus';
import { ResourceLoader } from '../ResourceLoader';
import type { ResourceProvider } from '../ResourceProvider';

export function loaderServing(files: Readonly<Record<string, string>> = {}): ResourceLoader {
  const provider: ResourceProvider = {
    loadResource: async (path: string) => files[path] ?? null,
  };
  const loader = new ResourceLoader(new FileEventBus(provider));
  loader.setProvider(provider);
  return loader;
}
