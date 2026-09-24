/**
 * Wire a host `ResourceProvider` into the resource pipeline: a `FileEventBus` over the
 * provider, a `ResourceLoader` over the bus, then `loader.setProvider(provider)`. The
 * order is an invariant, owned here so every host builds the same pipeline.
 */
import { FileEventBus } from './FileEventBus';
import { ResourceLoader } from './ResourceLoader';
import type { ResourceProvider } from './ResourceProvider';

export interface ResourcePipeline<P extends ResourceProvider = ResourceProvider> {
  /** The host provider, returned with its concrete type preserved. */
  provider: P;
  loader: ResourceLoader;
}

export function createResourcePipeline<P extends ResourceProvider>(
  provider: P
): ResourcePipeline<P> {
  const bus = new FileEventBus(provider);
  const loader = new ResourceLoader(bus);
  loader.setProvider(provider);
  return { provider, loader };
}
