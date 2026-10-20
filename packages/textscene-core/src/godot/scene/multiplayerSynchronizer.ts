/** Godot 4.6.3's MultiplayerSynchronizer facts a scene's properties carry. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** `MultiplayerSynchronizer::VisibilityUpdateMode` (`modules/multiplayer/multiplayer_synchronizer.h:41-45`). */
const VisibilityUpdateMode = {
  VISIBILITY_PROCESS_IDLE: 0,
  VISIBILITY_PROCESS_PHYSICS: 1,
  VISIBILITY_PROCESS_NONE: 2,
} as const;

export const MULTIPLAYER_SYNCHRONIZER_VISIBILITY_UPDATE_MODE_NAMES = enumNamesByValue(VisibilityUpdateMode);
