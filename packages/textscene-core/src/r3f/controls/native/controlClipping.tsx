/**
 * Accumulated clip planes for the native Control canvas. A verified spike
 * (81/81 boundary samples exact across 4 nesting levels) established that
 * clip PLANES, not stencil, are correct here: the on-screen 2D canvas
 * requests no stencil buffer at all (`World2DCanvas.tsx`'s `<Canvas>` never
 * asks for one, and three defaults it off), so a stencil-based clip would be
 * a silent no-op everywhere, not a fallback.
 *
 * This packet contributes no planes — the list is always empty end to end.
 * ScrollContainer (a later packet) is the first contributor: it will compute
 * its own content rect's planes and merge them with whatever it inherited via
 * `withAdditionalClipPlanes`, then provide the merged list to its subtree.
 * Planes are per-MATERIAL state (`THREE.Material.clippingPlanes`), not
 * per-geometry, so every leaf material must read this hook and spread it —
 * `controlQuad.tsx` and `ControlFallback.tsx` both do.
 */
import { createContext, useContext } from 'react';
import type * as THREE from 'three';

const ControlClipContext = createContext<readonly THREE.Plane[]>([]);
ControlClipContext.displayName = 'ControlClipContext';

export const ControlClipProvider = ControlClipContext.Provider;

/** The clip planes accumulated by every enclosing Control — empty outside any provider. */
export function useControlClipPlanes(): readonly THREE.Plane[] {
  return useContext(ControlClipContext);
}

/**
 * Merge a node's own clip planes onto what it inherited, inherited first (so
 * an ancestor's boundary is never overridden, only narrowed further). Returns
 * the SAME `inherited` reference when `own` is empty — the common case for
 * every Control until ScrollContainer lands — so a Provider fed this value
 * back doesn't force every descendant consumer to re-render for no reason.
 */
export function withAdditionalClipPlanes(
  inherited: readonly THREE.Plane[],
  own: readonly THREE.Plane[]
): readonly THREE.Plane[] {
  return own.length === 0 ? inherited : [...inherited, ...own];
}
