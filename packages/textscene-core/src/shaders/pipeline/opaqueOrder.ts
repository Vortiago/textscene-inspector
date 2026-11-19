import type * as THREE from 'three';
import type { RenderItem } from 'three/src/renderers/webgl/WebGLRenderLists.js';

/** An opaque draw that tests the stencil, which Godot's opaque pass draws last. */
const testsStencil = (item: RenderItem): boolean => item.material.stencilWrite;

/** three's `painterSortStable` with Mobile's stencil rule after groups (`render_forward_mobile.h:347`). */
function godotOpaqueOrder(a: RenderItem, b: RenderItem): number {
  if (a.groupOrder !== b.groupOrder) return a.groupOrder - b.groupOrder;
  if (testsStencil(a) !== testsStencil(b)) return Number(testsStencil(a)) - Number(testsStencil(b));
  if (a.renderOrder !== b.renderOrder) return a.renderOrder - b.renderOrder;
  if (a.material.id !== b.material.id) return a.material.id - b.material.id;
  if (a.materialVariant !== b.materialVariant) return a.materialVariant - b.materialVariant;
  if (a.z !== b.z) return a.z - b.z;
  return a.id - b.id;
}

/** Replaces any opaque sort. Forward+ and gl_compatibility draw alike after their stencil prepass. */
export function installGodotOpaqueOrder(renderer: THREE.WebGLRenderer): void {
  renderer.setOpaqueSort(godotOpaqueOrder);
}
