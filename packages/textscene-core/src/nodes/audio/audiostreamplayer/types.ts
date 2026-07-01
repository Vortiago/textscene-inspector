/**
 * AudioStreamPlayer types.
 *
 * Property surface matches the linter validators in linterParser.ts.
 * AudioStreamPlayer is non-spatial (extends Node, not Node2D/Node3D).
 */

import type { NodeProperties } from '../../node/types';

export interface AudioStreamPlayerProperties extends NodeProperties {
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
}
