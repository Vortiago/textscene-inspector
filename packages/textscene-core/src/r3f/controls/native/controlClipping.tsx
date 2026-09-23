/**
 * The accumulated canvas clip for the native Control canvas, as clip planes: the 2D `<Canvas>` in
 * `World2DCanvas.tsx` has no stencil buffer. The clip is a rounded rect first and planes second, as
 * Godot's scissor is (`servers/rendering/renderer_canvas_cull.cpp:412-424`). Planes are
 * per-material, so every leaf material spreads `useControlClipPlanes`. See `controlClipping.md`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { round as godotRound } from '../../../godot/math';
import * as THREE from 'three';
import type { Rect2 } from './rect';

/**
 * What a clipping Control publishes to its subtree. `rect` is the rounded clip in
 * absolute Godot canvas pixels (+Y down): Godot rounds there, and the 2D world
 * maps onto it with y negated. It is null for a rotated chain, where `planes` alone clips.
 */
export interface ControlClip {
  readonly planes: readonly THREE.Plane[];
  readonly rect: Rect2 | null;
}

/** No enclosing clipper: nothing is cut and there is no rect to intersect against. */
export const NO_CONTROL_CLIP: ControlClip = { planes: [], rect: null };

const ControlClipContext = createContext<ControlClip>(NO_CONTROL_CLIP);
ControlClipContext.displayName = 'ControlClipContext';

export const ControlClipProvider = ControlClipContext.Provider;

/** The whole accumulated clip: planes, and the rect a nested clipper intersects against. */
export function useControlClip(): ControlClip {
  return useContext(ControlClipContext);
}

/** The clip planes of every enclosing Control, empty outside any provider. */
export function useControlClipPlanes(): readonly THREE.Plane[] {
  return useControlClip().planes;
}

/**
 * Appends a node's own planes to the inherited ones, which only narrows. With no
 * own planes it returns `inherited` itself, so a Provider re-renders no consumer.
 * Only the unquantized path accumulates: with a rect, the result is 4 planes.
 */
export function withAdditionalClipPlanes(
  inherited: readonly THREE.Plane[],
  own: readonly THREE.Plane[]
): readonly THREE.Plane[] {
  return own.length === 0 ? inherited : [...inherited, ...own];
}

/**
 * The 4 "keep inside" planes for a +Y-down `rect`, negating Y here (`rect.ts`).
 * `clippingPlanes` test the fragment's world position, so planes from a
 * node-local rect need the group's `matrixWorld`. Planes from the absolute
 * canvas rect are already world planes.
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

/**
 * How far a basis vector may lean off its axis and still count as axis-aligned.
 * Three writes exact zeros for a zero-rotation Euler, so this absorbs
 * composition slack, not a near-miss angle.
 */
const AXIS_ALIGNMENT_EPSILON = 1e-6;

/**
 * A node-local `rect` as an absolute canvas rect, or null when `matrixWorld`
 * rotates and the caller must use rotated planes. Like `Transform2D::xform(Rect2)`,
 * a negative scale flips an edge and the result is the corner-wise extent.
 */
export function worldClipRect(rect: Rect2, matrixWorld: THREE.Matrix4): Rect2 | null {
  const e = matrixWorld.elements;
  // Column-major: e[1] is the X basis's Y component, e[4] the Y basis's X one.
  if (Math.abs(e[1]!) > AXIS_ALIGNMENT_EPSILON || Math.abs(e[4]!) > AXIS_ALIGNMENT_EPSILON) {
    return null;
  }
  const topLeft = new THREE.Vector3(rect.x, -rect.y, 0).applyMatrix4(matrixWorld);
  const bottomRight = new THREE.Vector3(rect.x + rect.w, -(rect.y + rect.h), 0).applyMatrix4(matrixWorld);
  return {
    x: Math.min(topLeft.x, bottomRight.x),
    y: -Math.max(topLeft.y, bottomRight.y),
    w: Math.abs(bottomRight.x - topLeft.x),
    h: Math.abs(topLeft.y - bottomRight.y),
  };
}

/** What a missed intersection collapses to. */
const EMPTY_RECT: Rect2 = { x: 0, y: 0, w: 0, h: 0 };

/**
 * `Rect2::intersection` (`core/math/rect2.h:148-163`): the overlap, or a zero
 * rect when there is none. Godot's `intersects()` is strict, so two rects that
 * merely touch do not intersect.
 */
export function intersectClipRects(a: Rect2, b: Rect2): Rect2 {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= x || bottom <= y) return EMPTY_RECT;
  return { x, y, w: right - x, h: bottom - y };
}


/**
 * Godot's whole-pixel clip rect (`renderer_canvas_cull.cpp:422-423`): position and
 * size round independently, so the far edge is `round(position) + round(size)`.
 */
export function quantizeClipRect(rect: Rect2): Rect2 {
  return {
    x: godotRound(rect.x),
    y: godotRound(rect.y),
    w: godotRound(rect.w),
    h: godotRound(rect.h),
  };
}

/** 4 planes × (normal.x, normal.y, normal.z, constant), plus a has-rect flag. */
const CLIP_FLOATS = 17;

function clipSignature(clip: ControlClip, out: Float64Array): void {
  out.fill(0);
  clip.planes.forEach((p, i) => {
    out[i * 4] = p.normal.x;
    out[i * 4 + 1] = p.normal.y;
    out[i * 4 + 2] = p.normal.z;
    out[i * 4 + 3] = p.constant;
  });
  out[CLIP_FLOATS - 1] = clip.rect === null ? 0 : 1;
}

function sameFloats(a: Float64Array, b: Float64Array): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * `localRect` on the canvas, quantized like Godot's scissor and merged onto the
 * inherited clip. Attach `anchorRef` to the group whose frame `localRect` is in,
 * put `clippingPlanes` on each clipped material, and publish `clip` through a
 * `ControlClipProvider` to clip a subtree.
 */
export function useWorldClipPlanes(localRect: Rect2): {
  anchorRef: RefObject<THREE.Group | null>;
  clippingPlanes: readonly THREE.Plane[];
  clip: ControlClip;
} {
  const inherited = useControlClip();
  const anchorRef = useRef<THREE.Group>(null);
  const [own, setOwn] = useState<ControlClip>(NO_CONTROL_CLIP);
  const previousFloats = useRef<Float64Array | null>(null);

  // No dependency array: an ancestor's world transform is no React value, so this
  // re-samples after every render. The float comparison below stops the loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchor.updateWorldMatrix(true, false);
    // Planes inherited without a rect come from a rotated ancestor. A quantized
    // rect here would claim to be the whole clip and drop them below.
    const quantizable = inherited.rect !== null || inherited.planes.length === 0;
    const world = quantizable ? worldClipRect(localRect, anchor.matrixWorld) : null;
    let next: ControlClip;
    if (world === null) {
      const planes = localRectClipPlanes(localRect).map((p) => p.clone().applyMatrix4(anchor.matrixWorld));
      next = { planes, rect: null };
    } else {
      const rect = quantizeClipRect(inherited.rect ? intersectClipRects(inherited.rect, world) : world);
      next = { planes: localRectClipPlanes(rect), rect };
    }
    const floats = new Float64Array(CLIP_FLOATS);
    clipSignature(next, floats);
    if (previousFloats.current && sameFloats(previousFloats.current, floats)) return;
    previousFloats.current = floats;
    setOwn(next);
  });

  // Memoised: a context value, and `withAdditionalClipPlanes` returns a fresh
  // array once this node adds planes. A fresh identity re-renders every consumer,
  // and `TextRun` keys its `ShaderMaterial` off this array.
  const clippingPlanes = useMemo(
    () =>
      inherited.rect !== null && own.rect !== null
        ? // The intersection already carries the ancestor's boundary, and
          // Godot's scissor is this node's own rect alone.
          own.planes
        : withAdditionalClipPlanes(inherited.planes, own.planes),
    [inherited, own]
  );

  const clip = useMemo<ControlClip>(
    () => ({ planes: clippingPlanes, rect: own.rect }),
    [clippingPlanes, own.rect]
  );

  return { anchorRef, clippingPlanes, clip };
}
