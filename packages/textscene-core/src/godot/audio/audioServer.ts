/** AudioServer's enums, which every AudioStreamPlayer forwards to. */

/**
 * `AudioServer::PlaybackType` (`servers/audio/audio_server.h:194-199`), one core enum: all
 * three AudioStreamPlayers forward to `AudioStreamPlayerInternal::set_playback_type`
 * (audio_stream_player_internal.cpp:337-339), and no common ancestor declares it.
 */
export const PLAYBACK_TYPE = {
  0: 'DEFAULT',
  1: 'STREAM',
  2: 'SAMPLE',
} as const;
