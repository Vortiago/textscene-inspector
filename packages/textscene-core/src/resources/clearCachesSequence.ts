/**
 * The full-clear sequence shared by `ResourceLoader.clearCaches` and the test fake.
 * The order is the contract: snapshot, clear the caches, announce `invalidated`, then
 * clear the metadata.
 */
import type { ResourceEventBus, ResourceType } from './ResourceEventBus';

interface ClearableProcessor {
  cachedPaths(): string[];
  inflightPaths(): string[];
  clearCache(): void;
}

export function runClearCachesSequence(opts: {
  processors: Iterable<[ResourceType, ClearableProcessor]>;
  eventBus: ResourceEventBus;
  metadata: { clear(): void };
  /** Byte-layer clear (the real loader's FileEventBus); omitted by the fake. */
  clearFileBus?: () => void;
  /** Emitted between the cache resets and the announcement. */
  log?: () => void;
}): void {
  const entries = [...opts.processors];
  // In-flight paths too: their completions are dropped, so a consumer waiting on one
  // would hang `pending` without the announcement.
  const cleared: [ResourceType, string[]][] = entries.map(([type, proc]) => [
    type,
    [...new Set([...proc.cachedPaths(), ...proc.inflightPaths()])],
  ]);
  opts.clearFileBus?.();
  for (const [, proc] of entries) {
    proc.clearCache();
  }
  opts.log?.();
  // After the resets, so a handler's synchronous re-request sees reset caches.
  for (const [type, paths] of cleared) {
    for (const path of paths) {
      opts.eventBus.emit(type, 'invalidated', path);
    }
  }
  // Metadata last: scene re-requests validate their registration during the
  // announcement, and these consumers' register effects do not re-run.
  opts.metadata.clear();
}
