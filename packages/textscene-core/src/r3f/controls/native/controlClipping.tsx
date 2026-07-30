/**
 * Accumulated clip planes for the native Control canvas. A verified spike
 * (81/81 boundary samples exact across 4 nesting levels) established that
 * clip PLANES, not stencil, are correct here: the on-screen 2D canvas
 * requests no stencil buffer at all (`World2DCanvas.tsx`'s `<Canvas>` never
 * asks for one, and three defaults it off), so a stencil-based clip would be
 * a silent no-op everywhere, not a fallback.
 *
 * `ScrollContainer` (`nodes/2d/ui/scrollcontainer/NativeComponent.tsx`) is the
 * first real contributor: it builds its own subtree's 4 planes from
 * `localRectClipPlanes` (this node's own full rect — `Control::clip_contents`
 * clips to `Rect2(Point2(), get_size())` regardless of any scrollbar
 * reservation), transforms them into world space via its own group's
 * `matrixWorld` (clipping is evaluated against the fragment's WORLD position,
 * so a plane expressed only in this node's LOCAL frame would be wrong for any
 * node that isn't the scene root), merges the result onto whatever it
 * inherited with `withAdditionalClipPlanes`, and provides the merged list to
 * its subtree via `ControlClipProvider`. Planes are per-MATERIAL state
 * (`THREE.Material.clippingPlanes`), not per-geometry, so every leaf material
 * must read `useControlClipPlanes` and spread it — `controlQuad.tsx` and
 * `StyleBoxQuad.tsx` both do, which is what lets ScrollContainer's own
 * scrollbar chrome (built from `StyleBoxQuad`) and every descendant Control
 * inherit the clip for free.
 */
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import type { Rect2 } from './rect';

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

/**
 * The 4 axis-aligned "keep inside" planes for `rect`, in the SAME LOCAL frame
 * `rect.ts` documents everywhere else (Godot pixels, +Y down, (0,0) at this
 * node's own top-left) — Y is negated here, at this conversion boundary, the
 * same point every other `native/` module negates it (the walker's own
 * `[rect.x, -rect.y, 0]`).
 *
 * These are LOCAL planes: a caller whose node sits anywhere but the scene
 * root must transform each one by its own group's `matrixWorld`
 * (`plane.clone().applyMatrix4(matrixWorld)`) before merging it with
 * `withAdditionalClipPlanes` — `clippingPlanes` is evaluated against the
 * fragment's WORLD position, so an untransformed plane would only be correct
 * for a node with no ancestor offset at all.
 */
export function localRectClipPlanes(rect: Rect2): THREE.Plane[] {
  const left = rect.x;
  const right = rect.x + rect.w;
  const top = -rect.y;
  const bottom = -(rect.y + rect.h);
  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), -left), // keep x >= left
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), right), // keep x <= right
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -bottom), // keep y >= bottom
    new THREE.Plane(new THREE.Vector3(0, -1, 0), top), // keep y <= top
  ];
}

/** 4 planes × (normal.x, normal.y, normal.z, constant). */
const PLANE_FLOATS = 16;

function flattenPlanes(planes: readonly THREE.Plane[], out: Float64Array): void {
  planes.forEach((p, i) => {
    out[i * 4] = p.normal.x;
    out[i * 4 + 1] = p.normal.y;
    out[i * 4 + 2] = p.normal.z;
    out[i * 4 + 3] = p.constant;
  });
}

function sameFloats(a: Float64Array, b: Float64Array): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * `localRect` clipped in WORLD space and merged onto whatever this node
 * inherited — the whole mechanism a Control needs to clip its own content.
 *
 * Attach the returned `anchorRef` to the group whose local frame `localRect`
 * is expressed in; the returned `clippingPlanes` go on every material that
 * must be clipped, and (for a node that clips its subtree) into a
 * `ControlClipProvider`.
 *
 * The effect deliberately has NO dependency array: an ancestor's world
 * transform is not a React value it could list — it is whatever three composed
 * through the WHOLE tree by the time refs settle, not just this node's own
 * rect — so it must re-sample after every render, exactly like
 * `useShadowLightPose` samples every FRAME for the identical reason. What
 * stops that same-every-render effect from calling `setState` forever is the
 * float comparison against the previous computation, not a deps rule.
 */
export function useWorldClipPlanes(localRect: Rect2): {
  anchorRef: RefObject<THREE.Group | null>;
  clippingPlanes: readonly THREE.Plane[];
} {
  const inherited = useControlClipPlanes();
  const anchorRef = useRef<THREE.Group>(null);
  const [ownPlanes, setOwnPlanes] = useState<readonly THREE.Plane[]>([]);
  const previousFloats = useRef<Float64Array | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchor.updateWorldMatrix(true, false);
    const local = localRectClipPlanes(localRect);
    const world = local.map((p) => p.clone().applyMatrix4(anchor.matrixWorld));
    const floats = new Float64Array(PLANE_FLOATS);
    flattenPlanes(world, floats);
    if (previousFloats.current && sameFloats(previousFloats.current, floats)) return;
    previousFloats.current = floats;
    setOwnPlanes(world);
  });

  // Memoised, not recomputed inline: this is a context VALUE, and
  // `withAdditionalClipPlanes` necessarily returns a fresh array once this node
  // contributes planes of its own. A fresh identity per render re-renders every
  // descendant consumer, and `TextRun` keys its `ShaderMaterial` off this array.
  const clippingPlanes = useMemo(
    () => withAdditionalClipPlanes(inherited, ownPlanes),
    [inherited, ownPlanes]
  );

  return { anchorRef, clippingPlanes };
}
