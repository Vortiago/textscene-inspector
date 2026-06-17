/**
 * Animation dock tab — the DOM transport surface for AnimationPlayer preview.
 * Reads and drives the scene-level AnimationTransport: clip selector,
 * play/pause/stop, and a timeline scrubber with an m:ss.cc readout.
 */

import { useAnimationTransport } from '../../contexts/AnimationTransportContext';
import styles from './AnimationPanel.module.css';

/** Formats a duration in seconds as `m:ss.cc` (minutes:seconds.centiseconds). */
export function formatTimecode(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const rem = safe - minutes * 60;
  let secs = Math.floor(rem);
  let centis = Math.round((rem - secs) * 100);
  if (centis === 100) {
    centis = 0;
    secs += 1;
  }
  return `${minutes}:${pad(secs)}.${pad(centis)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function AnimationPanel() {
  const transport = useAnimationTransport();

  if (transport.clips.length === 0) {
    return <div className={styles.empty}>No animations in this scene.</div>;
  }

  const playing = transport.playState === 'playing';

  return (
    <div className={styles.panel}>
      <label className={styles.row}>
        <span className={styles.label}>Animation</span>
        <select
          className={styles.select}
          value={transport.selectedClip ?? ''}
          onChange={(e) => transport.selectClip(e.target.value)}
        >
          {transport.clips.map((clip) => (
            <option key={clip} value={clip}>
              {clip === transport.autoplayClip ? `★ ${clip}` : clip}
            </option>
          ))}
        </select>
      </label>

      <div className={styles.controls}>
        {playing ? (
          <button type="button" onClick={() => transport.pause()}>
            Pause
          </button>
        ) : (
          <button type="button" onClick={() => transport.play()}>
            Play
          </button>
        )}
        <button type="button" onClick={() => transport.stop()}>
          Stop
        </button>
        <span className={styles.timecode} data-testid="timecode">
          {formatTimecode(transport.time)} / {formatTimecode(transport.duration)}
        </span>
      </div>

      <input
        className={styles.scrubber}
        type="range"
        aria-label="Timeline"
        min={0}
        max={transport.duration}
        step={0.01}
        value={transport.time}
        onChange={(e) => transport.seek(parseFloat(e.target.value))}
      />
    </div>
  );
}
