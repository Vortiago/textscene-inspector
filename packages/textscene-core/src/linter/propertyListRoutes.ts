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

// `MultiplayerSpawner` is absent: its `scenes/<i>/…` keys carry no storage bit
// (`multiplayer_spawner.cpp:72,83`), and `SceneState::save` skips such a key
// (`packed_scene.cpp:865-867`).

// `PROPERTY_USAGE_NO_EDITOR` is `STORAGE` alone (`object.h:132`), so its key is
// serialised. `PROPERTY_USAGE_DEFAULT` is `STORAGE | EDITOR` (`object.h:131`) and
// applies with no usage argument. Only an explicit usage list without the storage
// bit excludes a key, and one function can mix both shapes.
export const ROWS: readonly RouteRow[] = [
  ...skeletonRoutes,
  ...animationRoutes,
  ...audioRoutes,
  ...spatialNodeRoutes,
  ...shaderParameterRoutes,
  ...controlRoutes,
];
