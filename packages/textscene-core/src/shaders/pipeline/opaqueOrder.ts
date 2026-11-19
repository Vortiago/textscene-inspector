import type * as THREE from 'three';
import type { RenderItem } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import { isOpaqueSentinelOrder } from './opaqueSentinel.js';

/** An opaque draw with a stencil state, which Godot's opaque pass draws last (`FLAG_USES_STENCIL`). */
const usesStencil = (item: RenderItem): boolean => item.material.stencilWrite;

/** A sentinel keeps its end of the list, also against a stencil surface in a Group of the same order. */
const stencilRank = (a: RenderItem, b: RenderItem): number =>
  isOpaqueSentinelOrder(a.renderOrder) || isOpaqueSentinelOrder(b.renderOrder)
    ? 0
    : Number(usesStencil(a)) - Number(usesStencil(b));

/** three's `painterSortStable` with Mobile's stencil rule after groups (`render_forward_mobile.h:347`). */
function godotOpaqueOrder(a: RenderItem, b: RenderItem): number {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  const byStencil = stencilRank(a, b);
  if (byStencil !== 0) return byStencil;
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  if (a.material.id !== b.material.id) return a.material.id - b.material.id;
  if (a.materialVariant !== b.materialVariant) return a.materialVariant - b.materialVariant;
  if (a.z !== b.z) return a.z - b.z;
  return a.id - b.id;
}

/** Replaces any opaque sort, also a host's, and moves any `stencilWrite` material. Prepass order is moot. */
export function installGodotOpaqueOrder(renderer: THREE.WebGLRenderer): void {
  renderer.setOpaqueSort(godotOpaqueOrder);
}
