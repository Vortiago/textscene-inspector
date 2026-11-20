import { createStoreContext } from '../hooks/createStoreContext.js';
import type { FrameStats } from './frameStats.js';

// An external store, so a published window re-renders only the overlay. Null until a window is published.
export const {
  Provider: FrameStatsProvider,
  /** The store a running profile publishes into. */
  useStore: useFrameStatsStore,
  /** The latest window, re-rendering the caller on each new one. */
  useValue: useFrameStats,
} = createStoreContext<FrameStats | null>(null, 'FrameStatsContext');
