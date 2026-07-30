/**
 * The VehicleWheel3D editor gizmo, ported from Godot's
 * editor/scene/3d/gizmos/physics/vehicle_body_3d_gizmo_plugin.cpp.
 *
 * Five parts, all line segments: the wheel circle in the YZ plane at
 * `wheel_radius`; a four-section spring coil wound around it at 0.2 scale; the
 * suspension travel line from the origin up to `wheel_rest_length`; an axle tick
 * at each end of that line; and a forward arrow at y = −radius pointing +Z, which
 * is what makes a mirrored or back-to-front wheel obvious.
 *
 * The loop runs i = 0…360 inclusive, so the final segment spans 360°→370° and
 * overlaps the first. That overlap is Godot's, kept deliberately: the gizmo is a
 * parity artefact, and "tidying" it would put our vertex buffer out of step with
 * the engine's for no visible gain.
 */

import { useMemo } from 'react';
import { GizmoLine } from '../../../../r3f/components/GizmoLine';
import { useGodotLinearColor } from '../../../../r3f/godotColor';
import { DEFAULT_COLLISION_DEBUG_COLOR } from '../../shared/debugColor';

/** Godot's `skip`: degrees per circle segment. */
const SKIP = 10;
/** Godot's `springsec`: coil turns drawn along the suspension. */
const SPRING_SECTIONS = 4;
/** Godot scales the coil down by this factor. */
const COIL_SCALE = 0.2;

interface WheelGizmoProps {
  /** Effective wheel_radius (Godot default 0.5). */
  radius: number;
  /** Effective wheel_rest_length (Godot default 0.15). */
  restLength: number;
}

export function WheelGizmo({ radius, restLength }: WheelGizmoProps) {
  const positions = useMemo(() => buildWheelGizmo(radius, restLength), [radius, restLength]);
  const color = useGodotLinearColor(DEFAULT_COLLISION_DEBUG_COLOR);
  return <GizmoLine positions={positions} color={color} />;
}

function buildWheelGizmo(radius: number, restLength: number): Float32Array {
  const points: number[] = [];
  const push = (x: number, y: number, z: number): void => {
    points.push(x, y, z);
  };

  const r = radius;
  const t = restLength * 5;
  const section = t / SPRING_SECTIONS;

  for (let i = 0; i <= 360; i += SKIP) {
    const ra = (i * Math.PI) / 180;
    const rb = ((i + SKIP) * Math.PI) / 180;
    const ax = Math.sin(ra) * r;
    const ay = Math.cos(ra) * r;
    const bx = Math.sin(rb) * r;
    const by = Math.cos(rb) * r;

    // The wheel circle, in the YZ plane.
    push(0, ax, ay);
    push(0, bx, by);

    // The spring coil, wound around the suspension axis.
    for (let j = 0; j < SPRING_SECTIONS; j += 1) {
      push(ax * COIL_SCALE, ((i / 360) * section + j * section) * COIL_SCALE, ay * COIL_SCALE);
      push(
        bx * COIL_SCALE,
        (((i + SKIP) / 360) * section + j * section) * COIL_SCALE,
        by * COIL_SCALE
      );
    }
  }

  // Suspension travel.
  push(0, 0, 0);
  push(0, restLength, 0);

  // Axle ticks at both ends of the travel.
  push(r * 0.2, restLength, 0);
  push(-r * 0.2, restLength, 0);
  push(r * 0.2, 0, 0);
  push(-r * 0.2, 0, 0);

  // Forward arrow.
  push(0, -r, 0);
  push(0, -r, r * 2);
  push(0, -r, r * 2);
  push(r * 2 * 0.2, -r, r * 2 * 0.8);
  push(0, -r, r * 2);
  push(-r * 2 * 0.2, -r, r * 2 * 0.8);

  return new Float32Array(points);
}
