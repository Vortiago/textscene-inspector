/**
 * Animation: the legacy compatibility keys `AnimationPlayer` still answers for,
 * and `AnimationTree`'s fully dynamic `parameters/` tree.
 */

import type { RouteRow } from './types.js';

export const animationRoutes: readonly RouteRow[] = [
  // --- Animation: legacy compat keys and a fully dynamic parameter tree ---
  {
    // #ifndef DISABLE_DEPRECATED (on by default). Never enumerated by
    // _get_property_list, so a 3.x scene's `anims/Walk = SubResource(...)` is
    // read by _set alone (animation_mixer.cpp:58-71). Registered under the
    // new abstract 'AnimationMixer' tier (nodes/animation/animationmixer/),
    // the same shared-key shape canvasitem/shared uses for CanvasItem.
    type: 'AnimationMixer',
    at: 'animation_mixer.cpp:58-71',
    sample: 'anims/Walk',
    verdict: { validated: true },
  },
  {
    // Bare "libraries" replaces the whole AnimationLibrary set as one
    // Dictionary (animation_mixer.cpp:72-81), also DISABLE_DEPRECATED-gated.
    // Dictionary-shape check only, the same depth GraphEdit's type_names uses.
    type: 'AnimationMixer',
    at: 'animation_mixer.cpp:72-81',
    sample: 'libraries',
    verdict: { validated: true },
  },
  {
    // _get_libraries_property_usage() (animation_mixer.cpp:125-127) returns
    // PROPERTY_USAGE_STORAGE unconditionally on AnimationMixer, so every
    // library is always serialised.
    type: 'AnimationMixer',
    at: 'animation_mixer.cpp:129-134',
    sample: 'libraries/Main',
    verdict: { validated: true },
  },
  {
    // "For backward compatibility." (animation_player.cpp:38-39,71-73). Never
    // pushed by _get_property_list, so only a hand-edited/legacy scene's
    // playback/play key ever reaches _set — straight into set_current_animation,
    // the SAME field `current_animation` sets. `current_animation` itself is
    // `v.any()`, not quotedString (this row's original note was stale: no
    // quotedString check exists on it to match), so the alias gets the SAME
    // permissive `v.any()` rather than a stricter one — registering a tighter
    // check on the alias than the canonical key would itself be a bug.
    type: 'AnimationPlayer',
    at: 'animation_player.cpp:38-39',
    sample: 'playback/play',
    verdict: { validated: true },
  },
  {
    // Conditionally pushed: only for an animation with a "next" override set
    // (animation_player.cpp:130-138). Usage NO_EDITOR|INTERNAL still carries
    // storage (object.h:132).
    type: 'AnimationPlayer',
    at: 'animation_player.cpp:130-138',
    sample: 'next/Attack',
    verdict: { validated: true },
  },
  {
    // Flat Array of (from, to, time) triples. ERR_FAIL_COND_V(len % 3, false)
    // (animation_player.cpp:46) is a real enforced whole-value bound: a
    // malformed length is refused outright, not merely hinted. Only the COUNT
    // is checked — `Variant::operator StringName()`/`operator float()` both
    // coerce a mismatched element rather than failing (variant.cpp:1545-1553),
    // so Godot itself loads a non-string/non-number element without complaint.
    type: 'AnimationPlayer',
    at: 'animation_player.cpp:144',
    sample: 'blend_times',
    verdict: { validated: true },
  },
  {
    // method_call_mode / playback_process_mode / playback_active — three
    // #ifndef DISABLE_DEPRECATED aliases (animation_player.cpp:54-61,93-100),
    // ALL already registered.
    type: 'AnimationPlayer',
    at: 'animation_player.cpp:54-61',
    sample: 'playback_active',
    verdict: { validated: true },
  },
  {
    type: 'AnimationTree',
    at: 'animation_tree.cpp:924-929',
    sample: 'process_callback',
    verdict: { validated: true },
  },
  {
    // Built recursively from each AnimationNode's own get_parameter_list
    // (animation_tree.cpp:767-829), so the PropertyInfo for a given leaf comes
    // from a different C++ class per graph shape — genuinely dynamic, but the
    // KEY PREFIX ("parameters/") is fixed, same shape as ShaderGlobalsOverride's
    // params/*, which already has a deliberately permissive validator.
    type: 'AnimationTree',
    at: 'animation_tree.cpp:969-977',
    sample: 'parameters/conditions/idle',
    verdict: { validated: true },
  },

];
