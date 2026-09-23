/**
 * VehicleWheel3D property surface. A field stays `undefined` when unauthored: the
 * consumer (inspector, gizmo) applies Godot's default, so "authored the default"
 * and "authored nothing" stay distinct. They are simulation inputs (ADR-0005), and
 * they are parsed because they describe the wheel's geometry.
 */

import type { Node3DProperties } from '../../../base/node3d/types';

/**
 * Godot 4.6 VehicleWheel3D defaults (doc/classes/VehicleWheel3D.xml), shared by
 * the inspector formatter and the gizmo so a corrected default reaches both.
 */
export const VEHICLE_WHEEL_3D_DEFAULTS = {
  wheel_radius: 0.5,
  wheel_rest_length: 0.15,
  wheel_friction_slip: 10.5,
  wheel_roll_influence: 0.1,
  suspension_stiffness: 5.88,
  suspension_travel: 0.2,
  suspension_max_force: 6000,
  damping_compression: 0.83,
  damping_relaxation: 0.88,
  use_as_traction: false,
  use_as_steering: false,
} as const;

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
