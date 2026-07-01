/**
 * AudioStreamPlayer2D types.
 *
 * Property surface matches the linter validators in linterParser.ts.
 * AudioStreamPlayer2D is positional (extends Node2D).
 */

import type { Node2DProperties } from '../../base/node2d/types';

/**
 * Playback type (Godot AudioStreamPlayer::PlaybackType).
 */
export enum PlaybackType {
  STREAM = 0,
  SAMPLE = 1,
  MAX = 2,
}

export interface AudioStreamPlayer2DProperties extends Node2DProperties {
  /** Stream resource reference (ExtResource or SubResource). */
  stream?: string;

  /** Volume in decibels (default: 0). */
  volume_db: number;

  /** Pitch scale (default: 1.0). */
  pitch_scale: number;

  /** Currently playing (default: false). */
  playing: boolean;

  /** Start playing automatically (default: false). */
  autoplay: boolean;

  /** Stream playback paused (default: false). */
  stream_paused: boolean;

  /** Audio bus name (StringName or string). */
  bus: string;

  /** Maximum simultaneous voices (default: 1). */
  max_polyphony: number;

  /** Maximum distance audio can be heard (default: 0 = unlimited). */
  max_distance: number;

  /** Attenuation amount (default: 1). */
  attenuation: number;

  /** Panning strength 0..1 (default: 1.0). */
  panning_strength: number;

  /** Area mask bitmask for Area2D overrides (default: 1). */
  area_mask: number;

  /** Playback type / resource processing method (default: STREAM). */
  playback_type: PlaybackType;
}
