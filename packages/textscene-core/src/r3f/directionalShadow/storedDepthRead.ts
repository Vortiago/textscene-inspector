import type * as THREE from 'three';
import { filtersTwoBytesExactly } from './twoByteFilterProbe.js';

/** `?storedDepthRead=sampled` or `fetched` forces a lit surface's read of the stored depth on any GPU. */
type StoredDepthRead = 'sampled' | 'fetched' | 'probed';

const FORCED_READS: readonly StoredDepthRead[] = ['sampled', 'fetched'];

function storedDepthReadOf(search: string): StoredDepthRead {
  const named = new URLSearchParams(search).get('storedDepthRead');
  return FORCED_READS.find((read) => read === named) ?? 'probed';
}

/** Read once, when the module loads, so every surface on the page reads one way. */
const LOADED_READ: StoredDepthRead =
  typeof window === 'undefined' ? 'probed' : storedDepthReadOf(window.location.search);

/** Whether a lit surface on `renderer` reads the stored depth with one filtered sample. */
export function readsStoredDepthSampled(renderer: THREE.WebGLRenderer): boolean {
  if (LOADED_READ === 'probed') return filtersTwoBytesExactly(renderer);
  return LOADED_READ === 'sampled';
}
