/**
 * Audio: the `parameters/<name>` family every AudioStreamPlayer answers for.
 */

import type { RouteRow } from './types.js';

export const audioRoutes: readonly RouteRow[] = [
  {
    // All three players delegate `_set`/`_get`/`_get_property_list` to
    // AudioStreamPlayerInternal, which pushes one key per parameter the assigned
    // stream declares (audio_stream_player_internal.cpp:235-251). The usage bit
    // clears only at the stream's default (:245-247), so a non-default one is serialised.
    type: 'AudioStreamPlayer',
    at: 'audio_stream_player_internal.cpp:235-251',
    sample: 'parameters/looping',
    verdict: {
      declined: 'runtime-shaped',
      because:
        "the leaf names and their Variant types come from the assigned AudioStream's get_parameter_list() (audio_stream_player_internal.cpp:239-240), which the linter does not load, so `parameters/` has a fixed prefix but no knowable leaf set or value grammar; a wildcard accepting every leaf would report exactly what silently accepting the key already does",
    },
  },
];
