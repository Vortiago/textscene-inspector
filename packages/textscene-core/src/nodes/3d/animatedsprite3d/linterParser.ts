/**
 * AnimatedSprite3D strict validators for linting.
 *
 * Declare only AnimatedSprite3D's OWN members — the ones doc/classes/AnimatedSprite3D.xml
 * lists without an `overrides=` attribute. Everything from SpriteBase3D up is
 * registered on the ancestor (`../sprites/shared/linterParser.ts`, the
 * SpriteBase3D tier, imported below) and delivered by the NODE_BASE_TYPES
 * base-walk, so re-declaring an inherited key shadows it and duplicates the
 * rule.
 *
 * `playing` is deliberately NOT a member here: unlike AnimatedSprite2D, this
 * class exposes it only through `is_playing()` (sprite_3d.h:266) with no setter
 * and no `ADD_PROPERTY` (sprite_3d.cpp:1502-1545), so it never reaches a `.tscn`.
 *
 * `autoplay` and `frame_progress` both carry `PROPERTY_USAGE_NO_EDITOR`
 * (sprite_3d.cpp:1541, :1543). That hides them from the inspector, but
 * `PROPERTY_USAGE_NO_EDITOR` still implies `PROPERTY_USAGE_STORAGE`
 * (object.h:132), so both DO serialise and both get a validator below.
 *
 * `AnimatedSprite3D::_set` (sprite_3d.cpp:1494-1500, `#ifndef DISABLE_DEPRECATED`)
 * accepts a legacy `frames` key and forwards it to `set_sprite_frames` — a 3.x
 * scene upgrade path. There is no matching `_get` branch, so Godot never WRITES
 * `frames` itself; it only reads one from an already-converted `.tscn`. No
 * validator here: `sprite_frames` already covers the format that key carries,
 * and `frames` isn't a key this class's own `ADD_PROPERTY`/`_bind_methods`
 * declares, so it is load-compatibility, not a property to strict-validate.
 */

// The tier holding every SpriteBase3D member, which in turn pulls
// GeometryInstance3D/VisualInstance3D/Node3D, so this module answers for
// every key AnimatedSprite3D is chained to.
import '../sprites/shared/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('AnimatedSprite3D', {
  // sprite_3d.cpp:1539, ADD_PROPERTY(Variant::OBJECT, "sprite_frames",
  // PROPERTY_HINT_RESOURCE_TYPE, "SpriteFrames"). `Ref<SpriteFrames> frames` has
  // no constructor default, same default-null shape as Sprite3D.texture — every
  // other default-null Ref<T> slot in this codebase (Sprite3D.texture,
  // MeshInstance3D.mesh, GridMap.mesh_library, …) gets the plain, non-nullable
  // form, so this matches rather than reaching for `nullableResourceReference`.
  sprite_frames: v.resourceReference('sprite_frames'),

  // sprite_3d.cpp:1540, ADD_PROPERTY(Variant::STRING_NAME, "animation",
  // PROPERTY_HINT_ENUM, ""). get_animation returns StringName (sprite_3d.h:269),
  // so Godot writes `&"name"` (variant_parser.cpp:2147-2151 stores every
  // STRING_NAME variant that way). The ENUM hint's value list is populated from
  // the live SpriteFrames by _validate_property (sprite_3d.cpp:1073-1101,
  // editor-only — `if (!Engine::get_singleton()->is_editor_hint()) return;` gates
  // the frame/animation re-hint at :1067), which this static linter cannot see,
  // so there is no closed set of names to check against — only the literal
  // shape is a real, checkable format.
  animation: v.stringName('animation'),

  // sprite_3d.cpp:1541, ADD_PROPERTY(Variant::STRING_NAME, "autoplay",
  // PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR). set_autoplay/get_autoplay
  // (sprite_3d.cpp:1343-1353) both take and return a plain String despite the
  // declared STRING_NAME type — the GETTER decides the serialised form, so Godot
  // writes a bare `"name"`, not `&"name"`. `v.stringName` accepts either
  // spelling, which covers a hand-authored `&"name"` too (Variant coerces
  // StringName -> String on load).
  autoplay: v.stringName('autoplay'),

  // sprite_3d.cpp:1542, ADD_PROPERTY(Variant::INT, "frame") — no hint at bind
  // time. set_frame (sprite_3d.cpp:1246-1248) forwards to
  // set_frame_and_progress, whose `if (p_frame < 0) { frame = 0; }`
  // (sprite_3d.cpp:1271) enforces a floor of 0 by silently correcting the
  // write — an ADR-0032 error. The ceiling clamps to the live animation's last
  // frame in the same function (sprite_3d.cpp:1273), but that count lives in a
  // SpriteFrames resource this linter cannot see, so no ceiling is checked here.
  frame: v.strictNonNegativeInt('frame', { enforced: 'sprite_3d.cpp:1271' }),

  // sprite_3d.cpp:1543, ADD_PROPERTY(Variant::FLOAT, "frame_progress",
  // PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR). set_frame_progress
  // (sprite_3d.cpp:1254-1256) is a bare assignment — the doc's "between 0.0 and
  // 1.0" is prose only, never a hint and never a clamp, so ADR-0032 puts this at
  // the "nothing" tier: any float format, including inf/-inf/nan.
  frame_progress: v.float('frame_progress'),

  // sprite_3d.cpp:1544, ADD_PROPERTY(Variant::FLOAT, "speed_scale") — no hint.
  // set_speed_scale (sprite_3d.cpp:1289-1291) is a bare assignment; a negative
  // value reverses playback and 0 halts it (NOTIFICATION_INTERNAL_PROCESS,
  // sprite_3d.cpp:1141, `if (speed == 0) { return; }`), both doc-documented
  // behaviour rather than a setter guard or a hint, so this stays unbounded.
  speed_scale: v.float('speed_scale'),
});
