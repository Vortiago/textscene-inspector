/**
 * AnimatedSprite3D strict validators: only the members doc/classes/AnimatedSprite3D.xml lists
 * without an `overrides=` attribute, plus the `playing` key that the class refuses.
 */

// The SpriteBase3D tier, which pulls GeometryInstance3D, VisualInstance3D and Node3D. The
// base-walk delivers those keys, so re-declaring one here shadows it and duplicates the rule.
import '../sprites/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

// `_set` (sprite_3d.cpp:1494-1500, `#ifndef DISABLE_DEPRECATED`) forwards a legacy `frames` key to
// `set_sprite_frames`, and no `_get` branch writes it back. `godot/deprecatedTable.ts` maps it
// to `sprite_frames`, so a scene with the old spelling is checked by that validator.
validatorRegistry.registerAll('AnimatedSprite3D', {
  // sprite_3d.cpp:1539, ADD_PROPERTY(Variant::OBJECT, "sprite_frames",
  // PROPERTY_HINT_RESOURCE_TYPE, "SpriteFrames"). `Ref<SpriteFrames> frames` has
  // no constructor default, same default-null shape as Sprite3D.texture.
  sprite_frames: v.resourceReference('sprite_frames'),

  // sprite_3d.cpp:1540, ADD_PROPERTY(Variant::STRING_NAME, "animation", PROPERTY_HINT_ENUM, "").
  // get_animation returns StringName (sprite_3d.h:269), so Godot writes `&"name"`
  // (variant_parser.cpp:2147-2151). Only the literal shape is checkable: the name list comes
  // from the live SpriteFrames, in editor-only _validate_property (sprite_3d.cpp:1073-1101, :1067).
  animation: v.stringName('animation'),

  // sprite_3d.cpp:1541, STRING_NAME "autoplay" with PROPERTY_USAGE_NO_EDITOR, which implies STORAGE
  // (object.h:132). set_autoplay/get_autoplay (sprite_3d.cpp:1343-1353) use a plain String, so
  // Godot writes a bare `"name"`. `v.stringName` also accepts a hand-authored `&"name"`, which
  // Variant coerces to String on load.
  autoplay: v.stringName('autoplay'),

  // sprite_3d.cpp:1542, INT "frame", no hint. set_frame (sprite_3d.cpp:1246-1248) forwards to
  // set_frame_and_progress, whose `if (p_frame < 0) { frame = 0; }` (sprite_3d.cpp:1271) corrects
  // the write: an ADR-0032 error. The ceiling (sprite_3d.cpp:1273) is the animation's last frame,
  // in a SpriteFrames resource the linter cannot see, so it goes unchecked.
  frame: v.strictNonNegativeInt('frame', { enforced: 'sprite_3d.cpp:1271' }),

  // sprite_3d.cpp:1543, ADD_PROPERTY(Variant::FLOAT, "frame_progress", PROPERTY_HINT_NONE, "",
  // PROPERTY_USAGE_NO_EDITOR), which still serialises. set_frame_progress (sprite_3d.cpp:1254-1256)
  // is a bare assignment, and the doc's "between 0.0 and 1.0" is prose only, so ADR-0032 puts this
  // at the "nothing" tier: any float format, including inf/-inf/nan.
  frame_progress: v.float('frame_progress'),

  // sprite_3d.cpp:1544, ADD_PROPERTY(Variant::FLOAT, "speed_scale"), no hint. set_speed_scale
  // (sprite_3d.cpp:1289-1291) is a bare assignment. A negative value reverses playback and 0 halts
  // it (sprite_3d.cpp:1141, `if (speed == 0) { return; }`): documented behaviour, not a guard or
  // a hint, so this stays unbounded.
  speed_scale: v.float('speed_scale'),
});

// No ADD_PROPERTY declares it (sprite_3d.cpp:1539-1544), and the DISABLE_DEPRECATED `_set` has one
// arm, `frames` (:1494-1500), so the write is dropped, as on AnimatedSprite2D. `is_playing` is only
// a method binding (:1512). With no entry at all, `playing = true` would be silently accepted.
validatorRegistry.registerUnavailable('AnimatedSprite3D', {
  playing: {
    reason: `it is a method, not a property: play() starts playback, and only 'autoplay' is serialised`,
    cite: 'sprite_3d.cpp:1494-1500',
  },
});
