/**
 * The **Dependency hot-reload** sequence shared by `ResourceLoader.provideFile` and the
 * test fake: drop and announce everything built from the file or that read it. Nothing is
 * requested here, so nothing loads for a key no consumer holds.
 */
import type { ResourceType } from './ResourceEventBus';
import type { Dependent, DependencyGraph } from './dependencyGraph';
import { resourceFilePath } from './subResourcePath';

interface PathClearableProcessor {
  clearCache(path: string): void;
  isCached(path: string): boolean;
  isLoading(path: string): boolean;
}

export function runProvideFileSequence(opts: {
  /** The changed file, or an address inside it. */
  path: string;
  processors: ReadonlyMap<ResourceType, PathClearableProcessor>;
  /** The byte layer (the real loader's FileEventBus); omitted by the fake. */
  fileBus?: { invalidate(path: string): void };
  /** The reads the processors recorded; omitted by the fake, whose loads read nothing. */
  dependencies?: DependencyGraph;
}): void {
  // Bytes belong to a file, so an address clears its whole file.
  const file = resourceFilePath(opts.path);
  opts.fileBus?.invalidate(file);

  // Before the clears, whose announcements start the reloads that record edges anew.
  opts.dependencies?.prune(({ busType, key }: Dependent) => {
    const processor = opts.processors.get(busType);
    return processor !== undefined && (processor.isCached(key) || processor.isLoading(key));
  });
  const dependents = opts.dependencies?.release(file) ?? [];
  for (const processor of opts.processors.values()) processor.clearCache(file);
  for (const { busType, key } of dependents) opts.processors.get(busType)?.clearCache(key);
}
