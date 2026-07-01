/**
 * AudioStreamPlayer2D types.
 *
 * Property surface matches the linter validators in linterParser.ts.
 * AudioStreamPlayer2D is positional (extends Node2D).
 */

import type { Node2DProperties } from '../../base/node2d/types';
import type { AudioStreamBaseProperties } from '../types';

/**
 * Playback type (Godot AudioServer.PlaybackType). The default (0) defers to
 * the project's `audio/general/default_playback_type`. PLAYBACK_TYPE_MAX (3)
 * is the enum-size sentinel, not a selectable value, so it is omitted.
 */
export enum PlaybackType {
  DEFAULT = 0,
  STREAM = 1,
  SAMPLE = 2,
}

export interface AudioStreamPlayer2DProperties
  extends Node2DProperties,
    AudioStreamBaseProperties {
  /** Maximum distance the audio can be heard, in pixels (default: 2000). */
  max_distance: number;

  /** Attenuation amount (default: 1). */
  attenuation: number;

  /** Panning strength 0..1 (default: 1.0). */
  panning_strength: number;

  /** Area mask bitmask for Area2D overrides (default: 1). */
  area_mask: number;

  /** Playback type / resource processing method (default: DEFAULT). */
  playback_type: PlaybackType;
}
