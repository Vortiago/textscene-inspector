/**
 * The animation tier and the three audio players. The audio players read their
 * shared keys through `parseAudioBase`, which the scan follows, so only keys no
 * player's parser reads are listed.
 */

import type { AsymmetryEntry } from './types.js';

export const animationAndAudioAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // AnimationMixer is an abstract tier with no parser.ts, so every key it
  // registers is linter-only here. AnimationPlayer and AnimationTree inherit
  // this entry through the base-walk.
  AnimationMixer: {
    linterOnly: [
      // animation_mixer.cpp:72-81: AnimationPlayer's parser.ts reads
      // properties.libraries. AnimationTree resolves clips through the
      // referenced AnimationPlayer instead.
      'libraries',
      // animation_mixer.cpp:129-134: AnimationPlayer's extractLibraries reads it
      // in a loop over Object.keys(properties), a computed key the scrape cannot
      // see. AnimationTree has no use for it.
      'libraries/*',
    ],
    renderGap: [
      // animation_mixer.cpp:58-71: a legacy 3.x per-animation key that Godot
      // plays through the default library. AnimationPlayer's parser.ts never
      // extracts anims/<name>, so such a scene shows no animations here.
      'anims/*',
    ],
    reason: 'The AnimationMixer base has no parser of its own. libraries/libraries* are read by AnimationPlayer (directly or through a scrape-blind loop) but not by AnimationTree, which needs neither; anims/<name> is a genuine legacy-format rendering gap nothing currently closes.',
  },

  AnimationPlayer: {
    parserOnly: [
      // animation_player.cpp:1038-1039: PROPERTY_USAGE_NONE and getter-only, so
      // never serialised and never validated. The parser still reads them,
      // falling back to 0.0 on a parse failure.
      'current_animation_length',
      'current_animation_position',
    ],
    linterOnly: [
      // Editor and movie-writer plumbing: quitting the engine after a movie
      // render, and the auto-capture blend Godot runs when a playback starts.
      // Neither bears on the single frame a static preview shows.
      'movie_quit_on_finish', 'playback_auto_capture',
      'playback_auto_capture_duration', 'playback_auto_capture_ease_type',
      'playback_auto_capture_transition_type',
      // animation_player.cpp:38-39,71-73: a back-compat alias for
      // current_animation, which the parser reads. _get_property_list never
      // pushes it, so Godot never writes it.
      'playback/play',
      // animation_player.cpp:130-138: a per-animation "next" override, pure
      // playback sequencing with no bearing on the frame shown.
      'next/*',
      // animation_player.cpp:144: cross-fade duration between two clips, with no
      // effect on a frozen single-clip frame.
      'blend_times',
      // AnimationMixer members that move no frozen frame: bookkeeping, root
      // motion a preview never applies, a voice budget, and when the mixer
      // updates. `active` and the other two callback modes are read, the latter
      // as the canonical spelling of `playback_process_mode`/`method_call_mode`.
      'deterministic',
      'reset_on_save',
      'root_motion_track',
      'root_motion_local',
      'audio_max_polyphony',
      'callback_mode_discrete',
    ],
    reason: 'current_animation_length/current_animation_position are getter-only and PROPERTY_USAGE_NONE in Godot, so they can never appear in a real .tscn and carry no validator; playback/play, next/<name>, blend_times and the inherited AnimationMixer members have no bearing on which single frame a static preview shows.',
  },

  AnimationTree: {
    linterOnly: [
      // animation_tree.cpp:969-977: a per-AnimationNode parameter tree
      // (state-machine state, blend amounts): runtime playback input. A static
      // preview shows the initial pose whatever the value.
      'parameters/*',
    ],
    reason: "AnimationTree's parameters/<path> tree is live playback STATE (current blend weight, active state-machine node), not authored content a static frame renders differently for.",
  },

  AudioStreamPlayer: {
    // `mix_target` picks the output channels and `playback_type` the
    // AudioServer sampling path. Neither reaches a frame.
    linterOnly: ['mix_target', 'playback_type'],
    reason: 'mix_target and playback_type route audio output and never reach a frame; the shared keys are read through parseAudioBase.',
  },

  AudioStreamPlayer2D: {
    reason: 'No asymmetries; every key is read directly or through parseAudioBase.',
  },

  AudioStreamPlayer3D: {
    // `playback_type` forwards into the same AudioStreamPlayerInternal setter as
    // its 2D twin's, so both carry it and neither draws anything from it.
    linterOnly: ['playback_type'],
    reason: 'playback_type selects the AudioServer sampling path and never reaches a frame; the shared keys are read through parseAudioBase.',
  },
};
