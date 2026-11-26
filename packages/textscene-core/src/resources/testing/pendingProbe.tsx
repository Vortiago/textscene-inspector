import { useViewWork } from '../ResourceLoaderContext';
import type { ViewWork } from '../viewWork';
import type { WorkCount } from '../workCount';

/** Test-only: reads the pending loads, and the rest of the work, of the view it renders in. */
export interface PendingProbe extends Pick<WorkCount, 'pending' | 'subscribe'> {
  /** Render this inside the view under test. */
  Probe: () => null;
  work(): ViewWork;
}

/** `pending`, `subscribe` and `work` throw before `Probe` renders. */
export function createPendingProbe(): PendingProbe {
  let viewWork: ViewWork | null = null;
  const rendered = (): ViewWork => {
    if (!viewWork)
      throw new Error('expected the probe to render inside a ResourceLoaderProvider, found none');
    return viewWork;
  };
  return {
    Probe() {
      viewWork = useViewWork();
      return null;
    },
    pending: () => rendered().resources.pending(),
    subscribe: (listener) => rendered().resources.subscribe(listener),
    work: rendered,
  };
}
