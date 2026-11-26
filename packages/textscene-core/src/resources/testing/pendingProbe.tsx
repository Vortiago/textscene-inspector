import { usePendingLoads } from '../ResourceLoaderContext';
import type { WorkCount } from '../workCount';

/** Test-only: reads the pending count of the view it renders in. */
export interface PendingProbe extends Pick<WorkCount, 'pending' | 'subscribe'> {
  /** Render this inside the view under test. */
  Probe: () => null;
}

/** `pending` and `subscribe` throw before `Probe` renders. */
export function createPendingProbe(): PendingProbe {
  let loads: WorkCount | null = null;
  const rendered = (): WorkCount => {
    if (!loads) throw new Error('expected the probe to render inside a ResourceLoaderProvider, found none');
    return loads;
  };
  return {
    Probe() {
      loads = usePendingLoads();
      return null;
    },
    pending: () => rendered().pending(),
    subscribe: (listener) => rendered().subscribe(listener),
  };
}
