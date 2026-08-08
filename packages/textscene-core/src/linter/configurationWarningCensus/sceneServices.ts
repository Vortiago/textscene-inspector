/**
 * Scene-level service nodes: multiplayer replication, shader globals, timers
 * and viewports — nodes that configure the tree rather than draw in it.
 *
 * `MultiplayerSpawner` and `MultiplayerSynchronizer` each push once over two
 * disjuncts whose verdicts differ (an unset NodePath is in the file; whether it
 * RESOLVES is not), so each becomes two rows.
 */
import type { WarningRow } from './types.js';

export const sceneServiceWarnings: Readonly<Record<string, readonly WarningRow[]>> = {
  MultiplayerSpawner: [
    {
      at: 'multiplayer_spawner.cpp:92',
      says: 'a valid Spawn Path NodePath must be set',
      verdict: {
        declined: 'default-omitted',
        because: 'spawn_path field-initialises to NodePath("") (multiplayer_spawner.h:54), which is the trigger itself',
      },
    },
    {
      at: 'multiplayer_spawner.cpp:92',
      says: 'Spawn Path does not resolve to a Node',
      verdict: { rule: 'multiplayerspawner-spawn-path-dangling' },
    },
  ],

  MultiplayerSynchronizer: [
    {
      at: 'multiplayer_synchronizer.cpp:150',
      says: 'a valid Root Path NodePath must be set',
      verdict: {
        declined: 'default-omitted',
        because: 'root_path field-initialises to NodePath("..") (multiplayer_synchronizer.h:55), not empty, so absence is not the trigger',
      },
    },
    {
      at: 'multiplayer_synchronizer.cpp:150',
      says: 'Root Path does not resolve to a Node',
      verdict: { rule: 'multiplayersynchronizer-root-path-dangling' },
    },
  ],

  ShaderGlobalsOverride: [
    {
      at: 'shader_globals_override.cpp:282',
      says: 'inactive because another node of the same type is in the scene',
      verdict: { rule: 'shaderglobalsoverride-multiple-in-scene' },
    },
  ],

  Timer: [
    {
      at: 'timer.cpp:205',
      says: 'very low wait times behave differently across frame rates',
      verdict: { rule: 'timer-low-wait-time' },
    },
  ],

  Viewport: [
    {
      at: 'viewport.cpp:3711',
      says: 'size must be at least 2 pixels on both dimensions to render anything',
      verdict: { rule: 'viewport-size-too-small' },
    },
  ],
};
