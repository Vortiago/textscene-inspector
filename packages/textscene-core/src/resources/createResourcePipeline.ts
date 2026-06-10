/**
 * Wire a host `ResourceProvider` into the resource pipeline.
 *
 * Every host (web previewer, VS Code webview) builds the same three-step
 * sequence: a `FileEventBus` over the provider, a `ResourceLoader` over the
 * bus, then `loader.setProvider(provider)`. That construction ORDER is an
 * invariant; this factory owns it so a pipeline change (an extra processor,
 * a reorder, a cache preload) lands once instead of drifting between hosts.
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
