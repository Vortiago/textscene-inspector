import type * as THREE from 'three';
import * as logger from '../../logger.js';
import type { StoredDepthRead } from '../../shaders/spatial/directionalShadowDepth.js';
import { filtersTwoBytesExactly } from './twoByteFilterProbe.js';

/** `?storedDepthRead=sampled`, `float` or `fetched` forces the page's read of the stored depth on any GPU. */
const FORCED_READS: readonly StoredDepthRead[] = ['sampled', 'float', 'fetched'];

function forcedReadOf(search: string): StoredDepthRead | null {
  const named = new URLSearchParams(search).get('storedDepthRead');
  return FORCED_READS.find((read) => read === named) ?? null;
}

/** Read once, when the module loads. */
const FORCED_READ: StoredDepthRead | null =
  typeof window === 'undefined' ? null : forcedReadOf(window.location.search);

/** A float colour needs both: a linear filter of R32F and a draw into it. */
function filtersFloatColour(renderer: THREE.WebGLRenderer): boolean {
  const gl = renderer.getContext();
  return (
    gl.getExtension('OES_texture_float_linear') !== null && gl.getExtension('EXT_color_buffer_float') !== null
  );
}

/** The read the probe picks: one sample wherever it matches the stored depth, the hand filter elsewhere. */
function probedRead(renderer: THREE.WebGLRenderer): StoredDepthRead {
  if (filtersTwoBytesExactly(renderer)) return 'sampled';
  return filtersFloatColour(renderer) ? 'float' : 'fetched';
}

/** Written once per page by `decideStoredDepthRead`: every canvas shares one sun atlas and its read. */
let pageRead: StoredDepthRead | null = null;

/** The forced read, or the probe's where the GPU cannot draw a forced float colour. */
function readOf(renderer: THREE.WebGLRenderer): StoredDepthRead {
  if (FORCED_READ === null) return probedRead(renderer);
  if (FORCED_READ !== 'float' || filtersFloatColour(renderer)) return FORCED_READ;
  const probed = probedRead(renderer);
  logger.warn(
    `storedDepthRead=float needs a filtered float colour this GPU lacks, so the page reads ${probed}`
  );
  return probed;
}

/** Picks the page's read on the first canvas's renderer, before any shadow or lit program draws. */
export function decideStoredDepthRead(renderer: THREE.WebGLRenderer): StoredDepthRead {
  pageRead ??= readOf(renderer);
  return pageRead;
}

/** The page's read, or the hand filter, which reads the two bytes on any GPU, before a canvas decides. */
export function storedDepthRead(): StoredDepthRead {
  return pageRead ?? 'fetched';
}
