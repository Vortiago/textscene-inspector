/**
 * Shared audio-stream base properties — the fields common to
 * AudioStreamPlayer / 2D / 3D. Each node's property interface extends this
 * alongside its node-base (Node / Node2D / Node3D) properties. The parse-side
 * counterpart is `parseAudioBase`.
 */

export interface AudioStreamBaseProperties {
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
