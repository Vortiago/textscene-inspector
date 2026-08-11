/**
 * SpriteFrames slice types — the decoded form of a `SpriteFrames` resource.
 *
 * Godot's `SpriteFrames` (`scene/resources/sprite_frames.h`) is a name → `Anim`
 * map; each `Anim` carries its ordered frames (texture + duration), `speed`
 * (fps) and `loop`. Frame textures stay RAW REFS here (`ExtResource("2")`,
 * `SubResource("AtlasTexture_…")`): resolving one needs the owning file's
 * resource tables, which is the AtlasTexture slice's job, not this decode's.
 */

/** One parsed SpriteFrames animation: ordered frames plus playback timing. */
export interface SpriteFramesAnimation {
  name: string;
  /** Ordered frame texture refs (e.g. `ExtResource("2")`). */
  frames: string[];
  /** Per-frame duration multipliers, parallel to `frames` (Godot default 1.0). */
  durations: number[];
  /** Playback rate in frames/second (`speed`; Godot default 5). */
  fps: number;
  /** Whether the animation loops (Godot default true). */
  loop: boolean;
}

/** A decoded SpriteFrames resource: every animation it declares, by name. */
export interface SpriteFramesData {
  /** animation name → its parsed frames + timing. */
  animations: Map<string, SpriteFramesAnimation>;
}
