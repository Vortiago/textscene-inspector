/**
 * A `ResourceLoader` over files a test can edit, read through `busServing`: a path
 * outside `files` loads as missing, and one in `heldPaths` never settles. Test-only, like
 * the rest of `testing/`, and it never imports `vitest`.
 */
import { ResourceLoader } from '../ResourceLoader';
import { busServing } from './servingFileBus';

export function loaderServing(
  files: Record<string, string> = {},
  heldPaths: readonly string[] = []
): ResourceLoader {
  const { bus, provider } = busServing(files, heldPaths);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  return loader;
}
