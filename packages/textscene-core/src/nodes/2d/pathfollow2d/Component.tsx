/**
 * Places a PathFollow2D's children on the parent Path2D's curve, overriding the
 * authored position as Godot does. With no curve in scope it keeps its authored
 * Node2D transform (ADR-0008). A selection-gated dot marks the point (ADR-0018).
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
    // This group replaces `<Node2D>`'s, so it carries the canvas draw-order key
    // `<CanvasItem2D>` would have set. three reads a drawn object's place from its
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
 * Samples the curve and builds the group transform, or null when no curve is
 * usable. Coordinates are Path2D-local Godot pixels. `h_offset` moves along the
 * tangent, `v_offset` along the normal, and `rotates` turns to the tangent.
 */
function computeFollowTransform(
  sampler: Curve2DSampler | null,
  props: PathFollow2DProperties
):
  | { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }
  | { matrix: THREE.Matrix4; matrixAutoUpdate: false }
  | null {
  if (!sampler || sampler.length <= 0) return null;

  // `progress` alone, unwrapped, whatever `loop` says. Properties apply before
  // parenting (packed_scene.cpp:492 sets, :541 parents), so `set_progress_ratio`
  // refuses every ratio (path_2d.cpp:472) and `set_progress` skips its wrap. The
  // sampler's clamp (curve.cpp:1079) is all that is left.
  const sample = sampler.sampleAt(props.progress ?? 0);
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
