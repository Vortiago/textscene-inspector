/**
 * Every class whose property-list override adds a key family no `ADD_PROPERTY` or
 * XML sweep finds, so `StrictTscnParser` would accept any value there. It is a
 * population, not a proof: `godot-source-decoupling` forbids scraping the engine,
 * so an override nobody has read is invisible to every guard. Only tests import it.
 */

import type { RouteRow } from './propertyListRoutes/types.js';
import { animationRoutes } from './propertyListRoutes/animation.js';
import { audioRoutes } from './propertyListRoutes/audio.js';
import { controlRoutes } from './propertyListRoutes/controls.js';
import { shaderParameterRoutes } from './propertyListRoutes/shaderParameters.js';
import { skeletonRoutes } from './propertyListRoutes/skeletons.js';
import { spatialNodeRoutes } from './propertyListRoutes/spatialNodes.js';

export type { RouteRow } from './propertyListRoutes/types.js';

// A key without the storage bit gets no row, as `SceneState::save` skips it
// (`packed_scene.cpp:865-867`): `MultiplayerSpawner`'s `scenes/<i>/…`
// (`multiplayer_spawner.cpp:72,83`) has none. `propertyListRoutes.md` says which usage flags keep
// the bit.
export const ROWS: readonly RouteRow[] = [
  ...skeletonRoutes,
  ...animationRoutes,
  ...audioRoutes,
  ...spatialNodeRoutes,
  ...shaderParameterRoutes,
  ...controlRoutes,
];
