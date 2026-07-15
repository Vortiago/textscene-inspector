/**
 * stepPlayback — pure per-frame transport-actuation reducer.
 *
 * From the previous/current play state and transport playhead it decides which
 * transition fired this frame and what the driver adapter must do next. Returns
 * a plain value: no THREE mutation, no React hook. Every driver's `useFrame`
 * is a thin adapter that calls this, then actuates the returned command.
 *
 * command values:
 *   'ensure-playing'   — start (or confirm already running) the action/loop.
 *   'seek'             — sample the mixer/sprite at `transportTime` (paused seek).
 *   'hold-paused'      — keep the action paused, no scrub.
 *   'stop-and-restore' — stop all actions and restore the authored pose.
 *   'none'             — already stopped, nothing to do.
 *
 * resume:
 *   true on fresh (re)entry into playback — the driver's local clock must be
 *   re-seeded from the transport (covers "start", "resume from pause", and
 *   "clip switch mid-play"). False on continuing playback.
 *
 * flushTime:
 *   true only on the playing → paused edge. The transport's `reportTime` is
 *   throttled; the last report before leaving 'playing' can be stale.
 *   Flushing once, immediately, on this edge keeps the paused readout accurate.
 *   Deliberately false on the playing → stopped edge: `stop()` already resets
 *   the transport playhead to 0 and a flush here would overwrite that reset,
 *   leaving the scrubber/timecode stuck at the pre-stop time while the pose
 *   shows the authored rest state (the stuck-scrubber bug).
 */
import type { PlayState } from '../contexts/AnimationTransportContext';

export interface StepPlaybackInput {
  prevState: PlayState;
  state: PlayState;
  prevTime: number;
  transportTime: number;
  /** The driver's current live playhead, for potential external use; null means no live playhead. */
  liveTime: number | null;
  /** True when the selected clip changed this frame. */
  clipChanged: boolean;
}

export type PlaybackCommand =
  | 'ensure-playing'
  | 'seek'
  | 'hold-paused'
  | 'stop-and-restore'
  | 'none';

export interface StepPlaybackResult {
  command: PlaybackCommand;
  /** Fresh (re)entry into playing — the local clock should be re-seeded. */
  resume: boolean;
  /**
   * True only on the playing → paused edge. The adapter must call
   * `reportTime(liveTime, { immediate: true })` when this is true and liveTime
   * is non-null. The reducer signals the edge; the adapter guards the null.
   */
  flushTime: boolean;
}

export function stepPlayback(input: StepPlaybackInput): StepPlaybackResult {
  const { prevState, state, prevTime, transportTime, clipChanged } = input;

  switch (state) {
    case 'playing': {
      // Fresh entry: was not playing before, OR the clip switched mid-play.
      const resume = prevState !== 'playing' || clipChanged;
      return { command: 'ensure-playing', resume, flushTime: false };
    }

    case 'paused': {
      // Flush only on the playing → paused edge.
      const flushTime = prevState === 'playing';
      // Seek when the transport scrub position changed — covers both the
      // initial paused-entry case (prevTime !== transportTime from the
      // 'stopped' sentinel 0 → some position) and ongoing scrubs.
      const seeked = transportTime !== prevTime;
      const command = seeked ? 'seek' : 'hold-paused';
      return { command, resume: false, flushTime };
    }

    case 'stopped': {
      // Only emit stop-and-restore on the first stopped frame (transition
      // edge). Subsequent stopped frames are no-ops to avoid double-restore.
      if (prevState !== 'stopped') {
        return { command: 'stop-and-restore', resume: false, flushTime: false };
      }
      return { command: 'none', resume: false, flushTime: false };
    }
  }
}
