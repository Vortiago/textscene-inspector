/**
 * Where one draw of a geometry instance sorts among that instance's draws. Godot keeps them newest
 * first (`render_forward_clustered.cpp:4147-4148`) and its alpha sort compares priority and depth
 * alone (`render_forward_clustered.h:713-717`), so in the alpha pass a later draw of one instance
 * draws first. Outside the alpha pass the later draw wins, measured with `pnpm ref:godot`.
 */

import type * as THREE from 'three';
import { perObject } from '../../utils/perObject';

/**
 * The step between two draws of one instance in three's order. An instance holds far fewer than
 * 1024 draws, so every extra draw stays within one unit of its surface.
 */
const DRAW_STEP = 1 / 1024;

/**
 * The draws one surface may hold: its own, its chain, the overlay and the overlay's chain. A leaf
 * that draws each surface as its own object lifts a surface's extra draws by this many steps for
 * each surface after it.
 */
const SURFACE_DRAW_SPAN = 32;

/**
 * The ordinal of an overlay whose mount cannot count the chains it follows: past every chain a
 * surface may hold, and inside the surface's span.
 */
export const OVERLAY_ORDINAL_PAST_CHAINS = SURFACE_DRAW_SPAN / 2;

/**
 * The `renderOrder` of an extra draw outside the alpha pass: the surface's own draw is ordinal 0,
 * each resolved `next_pass` link takes its index, a link that reads the stencil leaves a gap, and
 * the overlay draws one past the greatest ordinal a chain reached. Its draw also takes `orderByPass`.
 *
 * @canonical The draw order of a next_pass chain draw
 */
export function nextPassRenderOrder(ordinal: number): number {
  return ordinal * DRAW_STEP;
}

type DrawnObject = THREE.Object3D & { material?: THREE.Material | THREE.Material[] };

/** Whether three puts a draw of `object` in its transparent list (r187 `WebGLRenderLists.js:134`). */
function drawsInAlphaPass({ material }: DrawnObject): boolean {
  if (!Array.isArray(material)) return material?.transparent === true;
  // Indexed, not `.some`: no closure for each extra draw at each render.
  for (let i = 0; i < material.length; i++) {
    if (material[i]!.visible && material[i]!.transparent) return true;
  }
  return false;
}

/** What the sort of one draw reads at each render. */
interface PassSort {
  /** The surfaces the draw's leaf draws after the draw's own. Written only by `orderByPass`. */
  laterSurfaces: number;
}

/**
 * The sort of each draw `orderByPass` takes, made on the first call for that draw: it puts the
 * accessor on the draw's `renderOrder`, which stays its owner's to set as a `nextPassRenderOrder`.
 */
const passSortOf = perObject((object: THREE.Object3D): PassSort => {
  const sort: PassSort = { laterSurfaces: 0 };
  let authored = object.renderOrder;
  Object.defineProperty(object, 'renderOrder', {
    configurable: true,
    enumerable: true,
    get: () => (drawsInAlphaPass(object) ? alphaPassOrder(authored, sort.laterSurfaces) : authored),
    set: (order: number) => {
      authored = order;
    },
  });
  return sort;
});

/**
 * Sorts `object`, a draw of a surface, by the pass its material draws in at each render, since
 * the instance's fade can move it to the alpha pass between two renders. In the alpha pass an
 * extra draw draws before the surface it covers, and every draw of the surface draws after the
 * `laterSurfaces` surfaces Godot added after it. Null, an element's `ref` on release, sorts nothing.
 */
export function orderByPass(object: THREE.Object3D | null, laterSurfaces = 0): void {
  if (object) passSortOf(object).laterSurfaces = laterSurfaces;
}

/**
 * `authored` is a surface's render priority, a whole number (`material.cpp:64-66`), or an extra
 * draw's step past priority 0. Either stays inside its priority, turned round and lifted.
 */
function alphaPassOrder(authored: number, laterSurfaces: number): number {
  const priority = Math.round(authored);
  return priority - (authored - priority) + laterSurfaces * SURFACE_DRAW_SPAN * DRAW_STEP;
}
