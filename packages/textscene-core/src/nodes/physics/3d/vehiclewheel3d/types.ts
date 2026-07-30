/**
 * VehicleWheel3D property surface.
 *
 * Every field is optional and stays `undefined` when unauthored: Godot's
 * defaults are applied where the value is consumed (inspector, gizmo), not at
 * parse time, so "authored the default" and "authored nothing" stay
 * distinguishable — which is what lets the linter compare only the pairs an
 * author actually set. Values are simulation inputs — a static preview runs no
 * physics (ADR-0005) — but the wheel's geometry is entirely described by them,
 * which is why they are parsed at all.
 */

import type { Node3DProperties } from '../../../base/node3d/types';

export interface VehicleWheel3DProperties extends Node3DProperties {
  /** Wheel radius in metres. Godot default 0.5. */
  wheel_radius?: number;
  /** How far the wheel lowers from its origin at rest. Godot default 0.15. */
  wheel_rest_length?: number;
  /** Grip, combined with surface friction. Godot default 10.5. */
  wheel_friction_slip?: number;
  /** Roll resistance, 0 tips easily, 1 resists. Godot default 0.1. */
  wheel_roll_influence?: number;
  /** Spring rate in N/mm. Godot default 5.88. */
  suspension_stiffness?: number;
  /** Suspension travel distance. Godot default 0.2. */
  suspension_travel?: number;
  /** Maximum force the spring resists. Godot default 6000. */
  suspension_max_force?: number;
  /** Damping while the wheel moves up. Godot default 0.83. */
  damping_compression?: number;
  /** Damping while the wheel moves down. Godot default 0.88. */
  damping_relaxation?: number;
  /** Whether engine force drives this wheel. Godot default false. */
  use_as_traction?: boolean;
  /** Whether this wheel turns when the vehicle steers. Godot default false. */
  use_as_steering?: boolean;
  /** Runtime acceleration input. Godot default 0. */
  engine_force?: number;
  /** Runtime braking input. Godot default 0. */
  brake?: number;
  /** Runtime steering angle in radians. Godot default 0. */
  steering?: number;
}
