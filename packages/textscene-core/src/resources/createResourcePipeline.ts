/**
 * Wire a host `ResourceProvider` into the resource pipeline: a `FileEventBus` over the
 * provider, a `ResourceLoader` over the bus, then `loader.setProvider(provider)`. The
 * order is an invariant, owned here so every host builds the same pipeline. A host
 * that can start a job worker passes `createWorker` (ADR-0042).
 */
import { FileEventBus } from './FileEventBus';
import { ResourceLoader, type ResourceLoaderOptions } from './ResourceLoader';
import type { ResourceProvider } from './ResourceProvider';

export interface ResourcePipeline<P extends ResourceProvider = ResourceProvider> {
  /** The host provider, returned with its concrete type preserved. */
  provider: P;
  loader: ResourceLoader;
  /** Stops listening to the provider's `watch` and stops the job worker. A later job starts a new worker. */
  dispose(): void;
}

export function createResourcePipeline<P extends ResourceProvider>(
  provider: P,
  options: ResourceLoaderOptions = {}
): ResourcePipeline<P> {
  const bus = new FileEventBus(provider);
  const loader = new ResourceLoader(bus, options);
  loader.setProvider(provider);
  const unwatch = provider.watch?.((path) => loader.provideFile(path));
  return {
    provider,
    loader,
    dispose() {
      unwatch?.();
      loader.jobRunner.dispose();
    },
  };
}
