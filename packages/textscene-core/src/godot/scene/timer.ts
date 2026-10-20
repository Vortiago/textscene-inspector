/** Godot 4.6.3's Timer facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `Timer::TimerProcessCallback` (`scene/main/timer.h:52-55`). */
const TimerProcessCallback = {
  PHYSICS: 0,
  IDLE: 1,
} as const;

/** Each process callback by its integer, spelled as its constant without `TIMER_PROCESS_` (`timer.cpp:247-248`). */
export const TIMER_PROCESS_CALLBACK_NAMES = enumNamesByValue(TimerProcessCallback);
