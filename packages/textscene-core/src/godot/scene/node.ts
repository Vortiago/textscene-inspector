/** Godot 4.6.3's Node facts a scene's properties carry. */

import { enumNamesByValue, relabelEnumNames } from '../classdb/enumNames.js';

/** `Node::AutoTranslateMode` (`scene/main/node.h:126-130`). */
const AutoTranslateMode = {
  INHERIT: 0,
  ALWAYS: 1,
  DISABLED: 2,
} as const;

/** Each auto translate mode by its integer, spelled as its constant without `AUTO_TRANSLATE_MODE_`. */
export const AUTO_TRANSLATE_MODE_NAMES = enumNamesByValue(AutoTranslateMode);

/** Each auto translate mode by its integer, as `node.cpp:4069` and the Node validator spell it. */
export const NODE_AUTO_TRANSLATE_MODE_NAMES = relabelEnumNames(
  AUTO_TRANSLATE_MODE_NAMES,
  (name) => `AUTO_TRANSLATE_MODE_${name}`
);

/** `Node::ProcessMode` (`scene/main/node.h:75-81`, 4.7.2 `:79-85`). */
const ProcessMode = {
  PROCESS_MODE_INHERIT: 0,
  PROCESS_MODE_PAUSABLE: 1,
  PROCESS_MODE_WHEN_PAUSED: 2,
  PROCESS_MODE_ALWAYS: 3,
  PROCESS_MODE_DISABLED: 4,
} as const;

/** `Node::ProcessThreadGroup` (`node.h:83-87`, 4.7.2 `:87-91`). */
const ProcessThreadGroup = {
  PROCESS_THREAD_GROUP_INHERIT: 0,
  PROCESS_THREAD_GROUP_MAIN_THREAD: 1,
  PROCESS_THREAD_GROUP_SUB_THREAD: 2,
} as const;

/**
 * `Node::ProcessThreadMessages` without `FLAG_PROCESS_THREAD_MESSAGES_ALL`, the union that
 * `process_thread_messages`' hint does not list (`node.h:89-93`, 4.7.2 `:93-97`).
 */
const ProcessThreadMessages = {
  FLAG_PROCESS_THREAD_MESSAGES: 1,
  FLAG_PROCESS_THREAD_MESSAGES_PHYSICS: 2,
} as const;

/** `Node::PhysicsInterpolationMode` (`node.h:95-99`, 4.7.2 `:99-103`). */
const PhysicsInterpolationMode = {
  PHYSICS_INTERPOLATION_MODE_INHERIT: 0,
  PHYSICS_INTERPOLATION_MODE_ON: 1,
  PHYSICS_INTERPOLATION_MODE_OFF: 2,
} as const;

export const NODE_PROCESS_MODE_NAMES = enumNamesByValue(ProcessMode);
export const NODE_PROCESS_THREAD_GROUP_NAMES = enumNamesByValue(ProcessThreadGroup);
export const NODE_PROCESS_THREAD_MESSAGES_NAMES = enumNamesByValue(ProcessThreadMessages);
export const NODE_PHYSICS_INTERPOLATION_MODE_NAMES = enumNamesByValue(PhysicsInterpolationMode);
