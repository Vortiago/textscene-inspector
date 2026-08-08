/**
 * The accumulated canvas clip for the native Control canvas. A verified spike
 * (81/81 boundary samples exact across 4 nesting levels) established that clip
 * PLANES, not stencil, are correct here: the on-screen 2D canvas requests no
 * stencil buffer at all (`World2DCanvas.tsx`'s `<Canvas>` never asks for one,
 * and three defaults it off), so a stencil-based clip would be a silent no-op
 * everywhere, not a fallback.
 *
 * The clip is a RECT first and planes second, because Godot's is. A clipping
 * canvas item resolves to exactly one `final_clip_rect` and that rect alone
 * becomes the scissor — `servers/rendering/renderer_canvas_cull.cpp:412-424`:
 *
 *     if (p_canvas_clip != nullptr) {
 *         ci->final_clip_rect = p_canvas_clip->final_clip_rect.intersection(global_rect);
 *     } else {
 *         ci->final_clip_rect = p_clip_rect.intersection(global_rect);
 *     }
 *     if (ci->final_clip_rect.size.width < 0.5 || ci->final_clip_rect.size.height < 0.5) {
 *         return;
 *     }
 *     ci->final_clip_rect.position = ci->final_clip_rect.position.round();
 *     ci->final_clip_rect.size = ci->final_clip_rect.size.round();
 *
 * Three consequences this module exists to reproduce:
 *
 * 1. A nested clip INTERSECTS the enclosing rect and then rounds the result, so
 *    a chain of clippers is one rect, never a growing plane list. That is why
 *    the context carries the rect and not only the planes: rounding a plane set
 *    that has already been narrowed by an ancestor cannot recover which edges
 *    came from where, and the intersection has to happen before the rounding.
 * 2. POSITION and SIZE are rounded SEPARATELY. `round(pos) + round(size)` is
 *    not `round(pos + size)` once `pos` carries a fraction, so a whole-pixel
 *    scissor and a plane cutting at the exact fractional edge disagree by a
 *    whole column or row there. Where the origin is integral the two collapse
 *    into the same rule for every size fraction, which is the overwhelmingly
 *    common case: `Control::_update_canvas_item_transform` snaps a Control's
 *    own draw transform to whole pixels (`controlPixelSnap.ts`). Only a scaled
 *    or otherwise fractionally placed ancestor reopens the gap.
 * 3. The `< 0.5` early-out needs no separate modelling: a size below half a
 *    pixel rounds to zero, and a zero-size rect's own planes keep no fragment
 *    and reach every descendant, exactly as skipping the subtree would.
 *
 * `ScrollContainer` (`nodes/2d/ui/scrollcontainer/Component.tsx`) is the first
 * real contributor: it hands `useWorldClipPlanes` its own full rect
 * (`Control::clip_contents` clips to `Rect2(Point2(), get_size())` regardless
 * of any scrollbar reservation, `scene/gui/control.cpp:3948`) and publishes the
 * result to its subtree with `ControlClipProvider`. Planes are per-MATERIAL
 * state (`THREE.Material.clippingPlanes`), not per-geometry, so every leaf
 * material must read `useControlClipPlanes` and spread it — `controlQuad.tsx`
 * and `StyleBoxQuad.tsx` both do, which is what lets ScrollContainer's own
 * scrollbar chrome (built from `StyleBoxQuad`) and every descendant Control
 * inherit the clip for free.
 *
 * RESIDUAL: the unclipped root intersects against the viewport rect in Godot
 * (`p_clip_rect`), which this module treats as unbounded. It can only matter
 * for a clipper that BOTH starts outside the viewport and sits at a fractional
 * origin, where clamping the start to the viewport's whole-pixel edge would
 * change which of the two roundings applies. Also unmodelled: Godot's
 * `global_rect` is `Transform2D::xform(Rect2)`, the AABB of the transformed
 * rect, so a ROTATED clipper scissors its bounding box rather than its rotated
 * outline. A rotated chain here keeps the rotated planes instead and is
 * excluded from quantization rather than silently squared off.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import type { Rect2 } from './rect';

/**
 * What a clipping Control publishes to its subtree.
 *
 * `rect` is the accumulated, already-rounded clip rect in Godot canvas pixels
 * (+Y down) — the frame `Rect2` uses everywhere else, but absolute rather than
 * node-local, because that is the frame Godot rounds in and the one the 2D
 * world canvas maps one-to-one onto (world x = canvas x, world y = -canvas y).
 * It is null when the chain is not axis-aligned, where `planes` alone carries
 * the clip.
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

/** The whole accumulated clip — planes plus the rect a nested clipper intersects against. */
export function useControlClip(): ControlClip {
  return useContext(ControlClipContext);
}

/** The clip planes accumulated by every enclosing Control — empty outside any provider. */
export function useControlClipPlanes(): readonly THREE.Plane[] {
  return useControlClip().planes;
}

/**
 * Merge a node's own clip planes onto what it inherited, inherited first (so
 * an ancestor's boundary is never overridden, only narrowed further). Returns
 * the SAME `inherited` reference when `own` is empty, so a Provider fed this
 * value back doesn't force every descendant consumer to re-render for no
 * reason.
 *
 * Only the unquantized fallback path accumulates: once a rect is in play the
 * intersection has already narrowed it and the result is 4 planes flat.
 */
export function withAdditionalClipPlanes(
  inherited: readonly THREE.Plane[],
  own: readonly THREE.Plane[]
): readonly THREE.Plane[] {
  return own.length === 0 ? inherited : [...inherited, ...own];
}

/**
 * The 4 axis-aligned "keep inside" planes for `rect`, in the SAME Y-DOWN Godot
 * pixel frame `rect.ts` documents everywhere else — Y is negated here, at this
 * conversion boundary, the same point every other `native/` module negates it
 * (the walker's own `[rect.x, -rect.y, 0]`).
 *
 * The frame is the caller's. Fed a node-LOCAL rect the planes are local and a
 * caller whose node sits anywhere but the scene root must transform each one by
 * its own group's `matrixWorld` before use, because `clippingPlanes` is
 * evaluated against the fragment's WORLD position. Fed the absolute canvas rect
 * this module quantizes, they are already world planes: the 2D world canvas is
 * Godot canvas pixels with Y negated.
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
 * Only an authored rotation produces a lean at all — three writes exact zeros
 * for a zero-rotation Euler — so this absorbs matrix-composition slack, not a
 * near-miss angle.
 */
const AXIS_ALIGNMENT_EPSILON = 1e-6;

/**
 * `rect`, expressed in this node's local frame, as an absolute canvas rect —
 * or null when `matrixWorld` rotates, where there is no axis-aligned rect to
 * quantize and the caller must fall back to rotated planes.
 *
 * Mirrors `Transform2D::xform(Rect2)` for the axis-aligned case: a negative
 * scale flips an edge, and the result is the corner-wise extent either way.
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

/** An empty clip rect — what a missed intersection collapses to. */
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
 * `Vector2::round` (`core/math/vector2.cpp:108-110`) is `Math::round`, which is
 * `std::round` (`core/math/math_funcs.h:625-630`) — half away from ZERO, unlike
 * JavaScript's half-up `Math.round`. The two differ on every negative half, and
 * a clip rect reaches negative coordinates whenever a Control hangs off the top
 * or left of the canvas.
 */
function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Godot's whole-pixel clip rect — `renderer_canvas_cull.cpp:422-423`, position
 * and size rounded INDEPENDENTLY, which is what makes the far edge
 * `round(position) + round(size)` rather than `round(position + size)`.
 */
export function quantizeClipRect(rect: Rect2): Rect2 {
  return {
    x: roundHalfAwayFromZero(rect.x),
    y: roundHalfAwayFromZero(rect.y),
    w: roundHalfAwayFromZero(rect.w),
    h: roundHalfAwayFromZero(rect.h),
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
 * `localRect` resolved against the canvas, quantized the way Godot quantizes a
 * scissor, and merged onto whatever this node inherited — the whole mechanism a
 * Control needs to clip its own content.
 *
 * Attach the returned `anchorRef` to the group whose local frame `localRect` is
 * expressed in; the returned `clippingPlanes` go on every material that must be
 * clipped, and a node that clips its SUBTREE publishes `clip` through a
 * `ControlClipProvider`.
 *
 * The effect deliberately has NO dependency array: an ancestor's world
 * transform is not a React value it could list — it is whatever three composed
 * through the WHOLE tree by the time refs settle, not just this node's own rect
 * — so it must re-sample after every render, exactly like `useShadowLightPose`
 * samples every FRAME for the identical reason. What stops that
 * same-every-render effect from calling `setState` forever is the float
 * comparison against the previous computation, not a deps rule.
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    anchor.updateWorldMatrix(true, false);
    // Planes inherited WITHOUT a rect come from a rotated ancestor and cannot
    // be folded into one: quantizing here would publish a rect that claims to
    // be the whole clip and drop them for everything below.
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

  // Memoised, not recomputed inline: this is a context VALUE, and
  // `withAdditionalClipPlanes` necessarily returns a fresh array once this node
  // contributes planes of its own. A fresh identity per render re-renders every
  // descendant consumer, and `TextRun` keys its `ShaderMaterial` off this array.
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
