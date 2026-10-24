/**
 * Carries the frame profile's latest window from the canvas, where the profile runs, to the overlay
 * beside it. An external store, so a published window re-renders only the overlay.
 */

import { createStoreContext } from '../hooks/createStoreContext.js';
import type { FrameStats } from './frameStats.js';

/** Null while no profile runs, and before a running one publishes its first window. */
export const {
  Provider: FrameStatsProvider,
  /** The store a running profile publishes into. */
  useStore: useFrameStatsStore,
  /** The latest window, re-rendering the caller on each new one. */
  useValue: useFrameStats,
} = createStoreContext<FrameStats | null>(null, 'FrameStatsContext');
