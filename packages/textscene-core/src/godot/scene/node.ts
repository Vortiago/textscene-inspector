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
