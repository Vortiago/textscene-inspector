/**
 * AudioStreamPlayer3D types.
 *
 * Property surface matches the linter validators in linterParser.ts.
 * AudioStreamPlayer3D is non-rendered in the viewport (no audio output
 * in the previewer); the R3F component renders a small speaker-icon
 * gizmo at the node's transform so it remains spatially visible.
 */

import type { Node3DProperties } from '../../base/node3d/types';
import type { AudioStreamBaseProperties } from '../types';

/**
 * Attenuation models (Godot Server3D::AttenuationModel).
 */
export enum AttenuationModel {
  ATTENUATION_INVERSE_DISTANCE = 0,
  ATTENUATION_INVERSE_SQUARE_DISTANCE = 1,
  ATTENUATION_LOGARITHMIC = 2,
  ATTENUATION_DISABLED = 3,
}

/**
 * Doppler tracking modes (Godot AudioStreamPlayer3D::DopplerTracking).
 */
export enum DopplerTracking {
  DOPPLER_TRACKING_DISABLED = 0,
  DOPPLER_TRACKING_IDLE_STEP = 1,
  DOPPLER_TRACKING_PHYSICS_STEP = 2,
}

export interface AudioStreamPlayer3DProperties
  extends Node3DProperties,
    AudioStreamBaseProperties {
  /** Attenuation model (default: INVERSE_DISTANCE). */
  attenuation_model: AttenuationModel;

  /**
   * Distance at which the audio is heard at full volume. Drives the
   * range-sphere helper gizmo in the editor view.
   * Default: 10.0.
   */
  unit_size: number;

  /** Maximum distance audio can be heard (0 = unlimited). Default: 0. */
  max_distance: number;

  /** Maximum volume in dB (default: 3.0). */
  max_db: number;

  /** Attenuation filter cutoff frequency in Hz (default: 5000.0). */
  attenuation_filter_cutoff_hz: number;

  /** Attenuation filter strength in dB (default: -24.0). */
  attenuation_filter_db: number;

  /** Doppler tracking mode (default: DISABLED). */
  doppler_tracking: DopplerTracking;

  /** Panning strength 0..1 (default: 1.0). */
  panning_strength: number;

  /** Area mask bitmask for Area3D overrides (default: 1). */
  area_mask: number;

  /** Whether emission cone is enabled (default: false). */
  emission_angle_enabled: boolean;

  /** Emission cone half-angle in degrees 0..90 (default: 45.0). */
  emission_angle_degrees: number;

  /** Attenuation outside the emission cone in dB (default: -12.0). */
  emission_angle_filter_attenuation_db: number;
}
