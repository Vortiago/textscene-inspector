/**
 * Animation: the legacy compatibility keys `AnimationPlayer` still answers for,
 * and `AnimationTree`'s fully dynamic `parameters/` tree.
 */

import type { RouteRow } from './types.js';

export const animationRoutes: readonly RouteRow[] = [
  {
    // #ifndef DISABLE_DEPRECATED, on by default. _get_property_list never
    // lists it, so a 3.x scene's `anims/Walk = SubResource(...)` reaches _set
    // alone (animation_mixer.cpp:58-71). Registered under the abstract
    // 'AnimationMixer' tier (nodes/animation/animationmixer/).
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
    // "For backward compatibility." (animation_player.cpp:38-39,71-73). Only a
    // hand-edited scene's playback/play reaches _set, into set_current_animation,
    // the field `current_animation` sets. Both use `v.any()`, since a tighter
    // check on the alias than on the canonical key would be a bug.
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
    // (animation_player.cpp:46) refuses a malformed length. Only the count is
    // checked: `operator StringName()` and `operator float()` coerce a
    // mismatched element (variant.cpp:1545-1553).
    type: 'AnimationPlayer',
    at: 'animation_player.cpp:144',
    sample: 'blend_times',
    verdict: { validated: true },
  },
  {
    // method_call_mode, playback_process_mode and playback_active: three
    // #ifndef DISABLE_DEPRECATED aliases (animation_player.cpp:54-61,93-100).
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
    // Built recursively from each AnimationNode's get_parameter_list
    // (animation_tree.cpp:767-829), so a leaf's PropertyInfo varies by graph,
    // but the "parameters/" prefix is fixed, like ShaderGlobalsOverride's
    // permissively validated params/*.
    type: 'AnimationTree',
    at: 'animation_tree.cpp:969-977',
    sample: 'parameters/conditions/idle',
    verdict: { validated: true },
  },

];
