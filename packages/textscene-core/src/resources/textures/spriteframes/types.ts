/**
 * The decoded form of Godot's `SpriteFrames` (`scene/resources/sprite_frames.h`):
 * a name to `Anim` map of ordered frames, `speed` and `loop`. Frame textures stay
 * raw refs, since resolving one needs the owning file's resource tables.
 */

/** One parsed SpriteFrames animation: ordered frames plus playback timing. */
export interface SpriteFramesAnimation {
  name: string;
  /**
   * Ordered frame texture refs (for example `ExtResource("2")`), `null` for an empty
   * slot. The writer emits a null `Ref` as `null` (sprite_frames.cpp:184) and
   * `_set_animations` reads it back (:222), so a blank frame keeps its slot.
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
  /** Animation name to its parsed frames and timing. */
  animations: Map<string, SpriteFramesAnimation>;
}
