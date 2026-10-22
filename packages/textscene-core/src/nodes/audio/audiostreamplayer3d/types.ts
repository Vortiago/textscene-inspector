/**
 * AudioStreamPlayer3D types. The property surface matches the linterParser.ts validators. The
 * previewer plays no audio, so the R3F component draws a speaker gizmo at the node's transform.
 */

import type { Node3DProperties } from '../../base/node3d/types';
import type { AudioStreamBaseProperties } from '../types';
import { AttenuationModel, DopplerTracking } from '../../../godot/scene/audio';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

export interface AudioStreamPlayer3DProperties extends Node3DProperties, AudioStreamBaseProperties {
  /** Attenuation model (default: INVERSE_DISTANCE). */
  attenuation_model: EnumValue<typeof AttenuationModel>;

  /**
   * Distance at which the audio is heard at full volume. The range gizmo's
   * radius scales it. Default: 10.0.
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
  doppler_tracking: EnumValue<typeof DopplerTracking>;

  /** Panning strength, at least 0 (default: 1.0). */
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
