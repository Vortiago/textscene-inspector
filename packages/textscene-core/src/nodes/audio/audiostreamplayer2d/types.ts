/**
 * AudioStreamPlayer2D types.
 *
 * Property surface matches the linter validators in linterParser.ts.
 * AudioStreamPlayer2D is positional (extends Node2D).
 */

import type { Node2DProperties } from '../../base/node2d/types';
import type { AudioStreamBaseProperties } from '../types';
import { PlaybackType } from '../../../godot/audio/audioServer';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

export interface AudioStreamPlayer2DProperties extends Node2DProperties, AudioStreamBaseProperties {
  /** Maximum distance the audio can be heard, in pixels (default: 2000). */
  max_distance: number;

  /** Attenuation amount (default: 1). */
  attenuation: number;

  /** Panning strength, at least 0 (default: 1.0). */
  panning_strength: number;

  /** Area mask bitmask for Area2D overrides (default: 1). */
  area_mask: number;

  /** Playback type / resource processing method (default: DEFAULT). */
  playback_type: EnumValue<typeof PlaybackType>;
}
