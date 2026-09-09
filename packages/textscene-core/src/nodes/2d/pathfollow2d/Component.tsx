/**
 * <PathFollow2D> — positions its children along the parent Path2D's curve.
 *
 * It reads the nearest ancestor Path2D's curve via Path2DCurveContext, samples
 * the point at absolute `progress` — the only one of the two position keys a
 * scene file can carry, and unwrapped whatever `loop` says, for the reason
 * `computeFollowTransform` gives —
 * nudges it by `h_offset` (along the tangent) / `v_offset` (perpendicular),
 * and rotates children to the tangent when `rotates`. That computed transform —
 * conjugated by diag(1,-1,1) like every Node2D — drives the group (Godot derives
 * the follower's transform from the curve, overriding the authored position).
 *
 * With no curve in scope it falls back to its authored Node2D transform (matching
 * PathFollow3D / ADR-0008) — e.g. godot-open-rpg's gamepiece.tscn sets the curve
 * at runtime, so nothing to follow statically. A small selection-gated dot marks
 * the follow point (ADR-0018).
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { GizmoLine } from '../../../r3f/components/GizmoLine';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { useParentPath2DCurve } from '../../../r3f/contexts/Path2DCurveContext';
import { node2dGroupProps, node2dGroupSpread } from '../../../r3f/node2dTransform';
import { useCanvasItemRenderOrder } from '../../../r3f/contexts/PaintOrderContext';
import {
  accumulateCanvasItemZ,
  useEffectiveZ,
} from '../../../r3f/lighting2d/canvasItemPlacement';
import {
  Modulate2DContext,
  multiplyModulate,
  useParentModulate,
} from '../../../r3f/canvasItemModulate';
import type { Curve2DSampler } from '../../../resources/curves/curve2d';
import type { PathFollow2DProperties } from './types';

/** Godot editor path-follow handle color (orange). */
const FOLLOW_COLOR = 0xffa733;

// A small diamond marker (radius 6 px) at the follow point.
const FOLLOW_DOT_POSITIONS = new Float32Array([
  -6, 0, 0, 0, -6, 0,
  0, -6, 0, 6, 0, 0,
  6, 0, 0, 0, 6, 0,
  0, 6, 0, -6, 0, 0,
]);

export function PathFollow2D({ node, children }: NodeComponentProps) {
  const props = node.properties as PathFollow2DProperties;
  const sampler = useParentPath2DCurve();
  const gizmoVisible = useGizmoVisible();

  const parentModulate = useParentModulate();
  const modulate = useMemo(
    () => multiplyModulate(parentModulate, props.modulate),
    [parentModulate, props.modulate]
  );

  const followTransform = useMemo(
    () => computeFollowTransform(sampler, props),
    [sampler, props]
  );

  const dot = gizmoVisible ? <FollowDot /> : null;
  const renderOrder = useCanvasItemRenderOrder(node, accumulateCanvasItemZ(useEffectiveZ(), props));

  // No curve in scope → behave like a plain Node2D at the authored transform.
  if (!followTransform) {
    return (
      <Node2D node={node}>
        {dot}
        {children}
      </Node2D>
    );
  }

  return (
    // This branch replaces `<Node2D>`'s group with one at the sampled curve
    // position, so it has to carry the canvas draw-order key `<CanvasItem2D>`
    // would have put there — three reads a drawn object's place from its
    // nearest enclosing group, and a bare one sinks the dot behind the canvas.
    <group
      name={node.name}
      {...followTransform}
      visible={props.visible !== false}
      renderOrder={renderOrder}
    >
      {dot}
      <Modulate2DContext.Provider value={modulate}>{children}</Modulate2DContext.Provider>
    </group>
  );
}

/**
 * Sample the curve and build the conjugated group transform, or null when there
 * is no usable curve. Coordinates are Path2D-local Godot pixels; node2dGroupProps
 * applies the +Y-down → three conjugation (negate Y, negate rotation).
 */
function computeFollowTransform(
  sampler: Curve2DSampler | null,
  props: PathFollow2DProperties
):
  | { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }
  | { matrix: THREE.Matrix4; matrixAutoUpdate: false }
  | null {
  if (!sampler || sampler.length <= 0) return null;

  // `progress` alone, unwrapped. Godot applies a node's stored properties
  // BEFORE parenting it (packed_scene.cpp:492 sets, :541 parents) and binds
  // `PathFollow2D::path` only on enter-tree, so `set_progress_ratio` refuses
  // every authored ratio (path_2d.cpp:472) and `set_progress`'s own wrap/clamp
  // branch is skipped for want of a curve. What is left is the raw value and
  // the sampler's clamp (curve.cpp:1079) — which is why `loop` does not wrap a
  // scene-loaded progress either, measured both ways against 4.6.3.
  const sample = sampler.sampleAt(props.progress ?? 0);
  // Tangent + perpendicular (Godot space): h_offset along tangent, v_offset normal.
  const cos = Math.cos(sample.angle);
  const sin = Math.sin(sample.angle);
  const x = sample.x + cos * props.h_offset - sin * props.v_offset;
  const y = sample.y + sin * props.h_offset + cos * props.v_offset;

  return node2dGroupSpread(
    node2dGroupProps(
      {
        position: { x, y },
        rotation: props.rotates ? sample.angle : 0,
        scale: props.scale,
        skew: 0,
      }
    )
  );
}

function FollowDot() {
  return <GizmoLine positions={FOLLOW_DOT_POSITIONS} color={FOLLOW_COLOR} />;
}
