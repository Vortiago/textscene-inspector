/**
 * The ONE owner of the full-clear choreography shared by
 * `ResourceLoader.clearCaches` and the test fake (which must mirror it
 * exactly — order is the contract here, and a comment-synced copy would
 * drift):
 *
 *   1. snapshot each processor's cached AND in-flight paths — in-flight
 *      completions are dropped as cleared-era flights, so without an
 *      announcement a consumer waiting on one would hang `pending` forever;
 *   2. clear the byte layer (when present) and every processor cache;
 *   3. announce every snapshotted path via `invalidated` — after the cache
 *      resets, so synchronous re-requests from handlers observe only
 *      fully-reset caches;
 *   4. clear metadata LAST — scene re-requests validate their registration
 *      synchronously during step 3, and the consumers being healed are
 *      exactly the ones whose register effects will not re-run.
 */
import type { ResourceEventBus, ResourceType } from './ResourceEventBus';
import { clearMaterialParseCache } from './processing/materialProcessing';

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
  const cleared: [ResourceType, string[]][] = entries.map(([type, proc]) => [
    type,
    [...new Set([...proc.cachedPaths(), ...proc.inflightPaths()])],
  ]);
  opts.clearFileBus?.();
  // Module-scope memo, so no processor's clearCache reaches it.
  clearMaterialParseCache();
  for (const [, proc] of entries) {
    proc.clearCache();
  }
  opts.log?.();
  for (const [type, paths] of cleared) {
    for (const path of paths) {
      opts.eventBus.emit(type, 'invalidated', path);
    }
  }
  opts.metadata.clear();
}
