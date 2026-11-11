/**
 * The freelook speed readout: Godot's indicator bar, icon and "m/s" label at the viewport's left
 * edge (`draw_indicator_bar`, `node_3d_editor_plugin.cpp:3676-3698`), shown for a moment after
 * each wheel change of the flight speed. A DOM overlay, so a capture paints it out (ADR-0024).
 */
import { useEffect, useState } from 'react';
import { useFreelookState } from '../../contexts/ViewportActionsContext.js';
import { VIEWPORT_SPEED_ICON_URL } from './viewportSpeedIcon.js';
import styles from './FreelookSpeedReadout.module.css';

/** `ZOOM_FREELOOK_INDICATOR_DELAY_S`: how long Godot draws the indicator after a change. */
const INDICATOR_MS = 1500;

const ICON_MASK = { maskImage: `url("${VIEWPORT_SPEED_ICON_URL}")` };

/** Godot shows two decimals below 1 m/s and one from there up (`node_3d_editor_plugin.cpp:3902`). */
function formatSpeed(unitsPerSecond: number): string {
  return `${unitsPerSecond.toFixed(unitsPerSecond < 1 ? 2 : 1)} m/s`;
}

export function FreelookSpeedReadout() {
  const freelook = useFreelookState();
  const speedChangeCount = freelook?.speedChangeCount ?? 0;
  /** The change count the readout last timed out on: a newer count shows it again. */
  const [expiredCount, setExpiredCount] = useState(0);

  useEffect(() => {
    if (speedChangeCount === 0) return undefined;
    const timer = setTimeout(() => setExpiredCount(speedChangeCount), INDICATOR_MS);
    return () => clearTimeout(timer);
  }, [speedChangeCount]);

  if (!freelook || speedChangeCount === expiredCount) return null;

  return (
    <div className={styles.root} data-testid="freelook-speed-readout" role="status">
      <div className={styles.bar}>
        <div
          className={styles.fill}
          data-testid="freelook-speed-fill"
          style={{ height: `${freelook.speedFraction * 100}%` }}
        />
      </div>
      <span className={styles.icon} style={ICON_MASK}>
        <img className={styles.iconInk} src={VIEWPORT_SPEED_ICON_URL} alt="" />
      </span>
      <span className={styles.label}>{formatSpeed(freelook.speed)}</span>
    </div>
  );
}
