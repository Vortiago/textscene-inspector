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
  /**
   * Ordered frame texture refs (e.g. `ExtResource("2")`), `null` where the
   * frame's texture slot holds none.
   *
   * A blank frame is a real, round-trippable Godot state — the writer emits a
   * null `Ref` as `null` (sprite_frames.cpp:184) and `_set_animations` reads it
   * back (:222) — so it occupies a slot rather than shortening the animation.
   */
  frames: (string | null)[];
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
