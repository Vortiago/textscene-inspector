/**
 * The animation tier and the three audio players.
 *
 * Both families are shared-helper cases: `AnimationMixer` has no `parser.ts` of
 * its own, and each audio player's parser delegates to `parseAudioBase`, which
 * a per-file scrape of `properties.X` cannot see.
 */

import type { AsymmetryEntry } from './types.js';

/**
 * Keys read by the parseAudioBase shared helper (not captured by the per-file
 * scrape of each audio player's parser.ts); each linterParser.ts registers
 * them explicitly.
 */
const AUDIO_BASE_KEYS = [
  'stream', 'volume_db', 'pitch_scale', 'playing', 'autoplay',
  'stream_paused', 'bus', 'max_polyphony',
] as const;

export const animationAndAudioAsymmetries: Readonly<Record<string, AsymmetryEntry>> = {
  // -------------------------------------------------------------------------
  // Animation
  // -------------------------------------------------------------------------

  // AnimationMixer has no parser.ts of its own (an abstract tier, like
  // CanvasItem/GeometryInstance3D above), so every key it registers is
  // linter-only from its own perspective; both AnimationPlayer and
  // AnimationTree inherit this entry via the base-walk.
  AnimationMixer: {
    linterOnly: [
      // animation_mixer.cpp:72-81: read literally (properties.libraries) by
      // AnimationPlayer's own parser.ts — symmetric there already — but
      // AnimationTree never touches libraries at all: it resolves clips
      // through the referenced AnimationPlayer instead.
      'libraries',
      // animation_mixer.cpp:129-134: read through a loop over
      // Object.keys(properties) (AnimationPlayer's extractLibraries), the
      // same computed-key blind spot as OptionButton's popup/item_#/* above —
      // the parser DOES read it, just not visibly to the scrape.
      // AnimationTree, again, has no use for it directly.
      'libraries/*',
    ],
    renderGap: [
      // animation_mixer.cpp:58-71: a legacy 3.x per-animation compat key.
      // Godot itself resolves and plays these clips through the default
      // library; AnimationPlayer's parser.ts never extracts anims/<name> at
      // all (only linter.ts's semantic existence-check ever reads it), so a
      // hand-authored legacy scene shows NO animations here though Godot
      // plays them fine — a real, unimplemented rendering gap, not a
      // deliberate scope decision.
      'anims/*',
    ],
    reason: 'The AnimationMixer base has no parser of its own. libraries/libraries* are read by AnimationPlayer (directly or through a scrape-blind loop) but not by AnimationTree, which needs neither; anims/<name> is a genuine legacy-format rendering gap nothing currently closes.',
  },

  AnimationPlayer: {
    parserOnly: [
      // animation_player.cpp:1038-1039: PROPERTY_HINT_NONE + PROPERTY_USAGE_NONE
      // with an empty setter method name, getter-only, never serialised into a
      // real .tscn, so the linter carries no validator for either. The parser
      // still reads them defensively (falls back to 0.0 on a parse failure).
      'current_animation_length',
      'current_animation_position',
    ],
    linterOnly: [
      // Editor and movie-writer plumbing: quitting the engine after a movie
      // render, and the auto-capture blend Godot runs when a playback STARTS.
      // Neither bears on the single frame a static preview shows.
      'movie_quit_on_finish', 'playback_auto_capture',
      'playback_auto_capture_duration', 'playback_auto_capture_ease_type',
      'playback_auto_capture_transition_type',
      // animation_player.cpp:38-39,71-73: legacy back-compat alias for
      // current_animation, which the parser already reads directly and
      // literally (properties.current_animation). Never pushed by
      // _get_property_list, so Godot itself never writes this key; only a
      // hand-edited scene using ONLY the alias (never current_animation
      // itself) would differ, which is not a shape any real export produces.
      'playback/play',
      // animation_player.cpp:130-138: a per-animation "next" override — pure
      // playback SEQUENCING, no bearing on which single frame is shown.
      'next/*',
      // animation_player.cpp:144: cross-fade duration between two clips — a
      // transition property with no effect on a frozen single-clip frame.
      'blend_times',
      // AnimationMixer's own members, inherited through the tier. None of the
      // six below moves a frozen frame: `deterministic` and `reset_on_save`
      // are editor/runtime bookkeeping, the two root-motion keys describe
      // movement a static preview never applies, `audio_max_polyphony` is a
      // voice budget, and `callback_mode_discrete` only decides WHEN the mixer
      // updates, not what it produces. `active` is not among them — it decides
      // WHETHER the mixer applies anything — and neither are the other two
      // callback modes, which the parser reads for the inspector as the
      // canonical spelling of its deprecated `playback_process_mode` /
      // `method_call_mode` keys.
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
      // animation_tree.cpp:969-977: a per-AnimationNode dynamic parameter
      // tree (StateMachine current-state, BlendTree blend amounts, …). These
      // ARE runtime playback inputs, not fixed content: a static preview
      // shows the tree's initial pose regardless of a live parameter's value,
      // the same "runtime state, not content" shape AnimatedSprite2D's
      // autoplay/playing/speed_scale already have above.
      'parameters/*',
    ],
    reason: "AnimationTree's parameters/<path> tree is live playback STATE (current blend weight, active state-machine node), not authored content a static frame renders differently for.",
  },

  // -------------------------------------------------------------------------
  // Audio (parseAudioBase shared-helper pattern)
  // -------------------------------------------------------------------------

  AudioStreamPlayer: {
    linterOnly: [...AUDIO_BASE_KEYS, 'mix_target', 'playback_type'],
    reason: 'AudioStreamPlayer reads audio properties via parseAudioBase shared helper (not visible to per-file scrape); linter registers them explicitly. parser/parser.ts delegates entirely to helpers.',
  },

  AudioStreamPlayer2D: {
    linterOnly: AUDIO_BASE_KEYS,
    reason: 'AudioStreamPlayer2D reads audio base properties via parseAudioBase shared helper not captured by per-file scrape; linter registers them explicitly.',
  },

  AudioStreamPlayer3D: {
    // `playback_type` forwards into the same AudioStreamPlayerInternal setter as
    // its 2D twin's, so both carry it and neither draws anything from it.
    linterOnly: [...AUDIO_BASE_KEYS, 'playback_type'],
    reason: 'AudioStreamPlayer3D reads audio base properties via parseAudioBase shared helper not captured by per-file scrape; linter registers them explicitly. playback_type selects the AudioServer sampling path and never reaches a frame.',
  },
};
