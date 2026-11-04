/**
 * The ShapeCast3D editor gizmo, per shape_cast_3d_gizmo_plugin.cpp:60-66: the origin→target sweep
 * line first, then the shape's debug wireframe at the sweep's end, where the safe fraction of 1 of
 * the editor pose puts it (shape_cast_3d.cpp:498-515). The node's own debug material never varies.
 */

import { useMemo } from 'react';
import type { TscnInternalResource } from '../../../../parser/types';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { warn } from '../../../../logger';
import type { Rgba } from '../../../../godot/math/math.js';
import type { Vector3 } from '../../../../godot/math/vector.js';
import { castTargetLine } from '../../shared/castTarget';
import { useCastGizmoLook, type CastGizmoLook } from '../../shared/castGizmoLook';
import { shapeDebugLines } from '../../shared/shapeDebugLines';
import { useConvexDebugLines } from '../../shared/useConvexDebugLines';

interface ShapeCastGizmoProps {
  /** The effective `target_position`, Godot's default when unauthored. */
  target: Vector3;
  /** The resolved shape resource, or null while it is absent or still loading. */
  shape: TscnInternalResource | null;
  /** The authored `debug_shape_custom_color`, undefined when unauthored. */
  customColor?: Rgba;
  /** Whether the sweep casts. Godot default true, per shape_cast_3d.h:41. */
  enabled: boolean;
}

export function ShapeCastGizmo({ target, shape, customColor, enabled }: ShapeCastGizmoProps) {
  const look = useCastGizmoLook(customColor, enabled);
  const line = useMemo(() => castTargetLine(target), [target]);
  return (
    <>
      {line && <GizmoLine positions={line} color={look.color} opacity={look.opacity} />}
      {shape && <ShapeWireframe shape={shape} target={target} look={look} />}
    </>
  );
}

interface ShapeWireframeProps {
  shape: TscnInternalResource;
  target: Vector3;
  look: CastGizmoLook;
}

/** The shape's wireframe beside the sweep line, from Godot's `get_debug_mesh_lines` port. */
function ShapeWireframe({ shape, target, look }: ShapeWireframeProps) {
  return shape.type === 'ConvexPolygonShape3D' ? (
    <ConvexHullWireframe shape={shape} target={target} look={look} />
  ) : (
    <SyncWireframe shape={shape} target={target} look={look} />
  );
}

interface WireframeGizmoProps {
  target: Vector3;
  look: CastGizmoLook;
}

/** The wireframe Godot's sync debug-line ports draw, or the unit box a type without a port falls back to. */
function SyncWireframe({ shape, target, look }: WireframeGizmoProps & { shape: TscnInternalResource }) {
  const wire = useMemo(() => {
    const lines = shapeDebugLines(shape);
    if (lines) return lines;
    // Types without a port draw nothing here, as Godot's hull refuses a degenerate cloud; the
    // sweep line still shows the cast.
    warn(`[ShapeCast3D] Shape type "${shape.type}" has no wireframe port, drawing nothing for it.`);
    return null;
  }, [shape]);
  return <Wireframe wire={wire} target={target} look={look} />;
}

/** The wireframe of a convex shape, which draws once the lazy hull builder loads. */
function ConvexHullWireframe({ shape, target, look }: WireframeGizmoProps & { shape: TscnInternalResource }) {
  return <Wireframe wire={useConvexDebugLines(shape)} target={target} look={look} />;
}

/** The built wireframe at the sweep's end: each vertex plus the whole target. */
function Wireframe({ wire, target, look }: WireframeGizmoProps & { wire: Float32Array | null }) {
  const offset = useMemo(() => {
    // The wireframe sits at the sweep's end, where the editor pose's safe fraction of 1 puts it
    // (shape_cast_3d.cpp:502-507).
    if (!wire) return null;
    return offsetByTarget(wire, target);
  }, [wire, target]);
  if (!offset) return null;
  return <GizmoLine positions={offset} color={look.color} opacity={look.opacity} />;
}

/** Each wireframe vertex plus the target, the offset Godot's loop applies componentwise. */
function offsetByTarget(lines: Float32Array, { x, y, z }: Vector3): Float32Array {
  const offset = new Float32Array(lines.length);
  for (let i = 0; i < lines.length; i += 3) {
    offset[i] = lines[i]! + x;
    offset[i + 1] = lines[i + 1]! + y;
    offset[i + 2] = lines[i + 2]! + z;
  }
  return offset;
}
