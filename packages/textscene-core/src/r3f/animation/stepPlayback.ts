/**
 * A pure per-frame reducer: from the previous and current play state and the
 * playhead, it decides which transition fired and what the driver does next.
 * Each driver's `useFrame` calls it and carries out the returned command.
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

/**
 * 'ensure-playing' starts or keeps the action running. 'seek' samples at
 * `transportTime` while paused, and 'hold-paused' keeps it paused. 'stop-and-restore'
 * stops every action and restores the authored pose. 'none': already stopped.
 */
export type PlaybackCommand =
  | 'ensure-playing'
  | 'seek'
  | 'hold-paused'
  | 'stop-and-restore'
  | 'none';

export interface StepPlaybackResult {
  command: PlaybackCommand;
  /** A start, a resume or a clip switch: the local clock re-seeds from the transport. */
  resume: boolean;
  /**
   * True only on the playing → paused edge, where the throttled last report can
   * be stale: the adapter calls `reportTime(liveTime, { immediate: true })` when
   * liveTime is non-null. False on the stop edge, since `stop()` resets the playhead.
   */
  flushTime: boolean;
}

export function stepPlayback(input: StepPlaybackInput): StepPlaybackResult {
  const { prevState, state, prevTime, transportTime, clipChanged } = input;

  switch (state) {
    case 'playing': {
      // Fresh entry: was not playing before, or the clip switched mid-play.
      const resume = prevState !== 'playing' || clipChanged;
      return { command: 'ensure-playing', resume, flushTime: false };
    }

    case 'paused': {
      // Flush only on the playing → paused edge.
      const flushTime = prevState === 'playing';
      // Seek when the scrub position changed: on a scrub, and on entry from the
      // 'stopped' sentinel 0 to another position.
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
