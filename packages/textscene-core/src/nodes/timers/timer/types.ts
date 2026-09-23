/** Timer property surface. */

import type { NodeProperties } from '../../node/types';

export interface TimerProperties extends NodeProperties {
  /** Time (seconds) between timeouts. Godot default is 1.0. */
  wait_time?: number;
  /** Whether the timer starts automatically when the scene loads. */
  autostart?: boolean;
  /** Whether the timer stops after firing once (rather than looping). */
  one_shot?: boolean;
  paused?: boolean;
  /** TimerProcessCallback: 0 = PHYSICS, 1 = IDLE. Godot default is 1 (IDLE). */
  process_callback?: number;
  /** Whether the timer ignores `Engine.time_scale` and always ticks at real-time speed. */
  ignore_time_scale?: boolean;
}
