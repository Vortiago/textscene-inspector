/** AudioServer's enums, which every AudioStreamPlayer forwards to. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `AudioServer::PlaybackType` (`servers/audio/audio_server.h:194-199`), one core enum: all
 * three AudioStreamPlayers forward to `AudioStreamPlayerInternal::set_playback_type`
 * (audio_stream_player_internal.cpp:337-339), and no common ancestor declares it.
 */
export const PlaybackType = {
  DEFAULT: 0,
  STREAM: 1,
  SAMPLE: 2,
} as const;

export const PLAYBACK_TYPE_NAMES = enumNamesByValue(PlaybackType);
