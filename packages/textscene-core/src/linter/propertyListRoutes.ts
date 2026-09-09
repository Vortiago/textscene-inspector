/**
 * `ADD_PROPERTY` is one of four ways a property reaches a `.tscn`. The other
 * three are `PropertyListHelper`/`register_property`, `ADD_ARRAY_COUNT`, and a
 * hand-rolled `_set`/`_get`/property-list override — which is NOT always
 * underscore-prefixed (`ChainIK3D::get_property_list` has none, and that class
 * serialises a whole nested `settings/<i>/joints/<j>/` family while declaring
 * zero `ADD_PROPERTY` and zero XML `<member>`).
 *
 * `baseChainCompleteness`/`ownValidatorCoverage` sweep every DECLARED property.
 * A key that arrives through one of these other three routes was never
 * declared anywhere a sweep over `ADD_PROPERTY`/XML could find it, so a type
 * can carry a whole family of them and still read as fully covered while
 * `StrictTscnParser` (`if (!validator) return;`) silently accepts every value
 * on that family. That is the gap this file closes: every class here was
 * confirmed by reading its override to genuinely introduce a key none of the
 * other guards would ever see.
 *
 * It is a POPULATION, not a proof of completeness. Nothing scrapes the engine
 * to find the next such override — `godot-source-decoupling` forbids reading
 * the checkout at test time — so a class whose override nobody has read yet is
 * absent from here and invisible everywhere else, which is how
 * `AudioStreamPlayer`'s `parameters/` family (142 files in the scraped corpus)
 * went unlisted. Adding a row is how that is fixed, one reading at a time.
 *
 * `MultiplayerSpawner` is the one class this population excludes: its
 * `scenes/<i>/…` pushes carry `PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_ARRAY`
 * with no storage bit (`multiplayer_spawner.cpp:72,83`), and
 * `SceneState::save` skips any property lacking `PROPERTY_USAGE_STORAGE`
 * (`packed_scene.cpp:865-867`), so that family never reaches a `.tscn` at all.
 *
 * Two facts govern most `validated`/`unimplemented` calls below.
 * `PROPERTY_USAGE_NO_EDITOR` equals `PROPERTY_USAGE_STORAGE` alone
 * (`object.h:132`): it hides a key from the inspector and nothing more, so
 * such a key IS serialised. `PROPERTY_USAGE_DEFAULT` is `STORAGE | EDITOR`
 * (`object.h:131`), and a `PropertyInfo` built with no usage argument at all
 * defaults to it. Only an EXPLICIT usage list that omits the storage bit
 * excludes a key, and several classes below mix both shapes across keys of
 * the SAME function.
 *
 * `sample` is a concrete key exactly as it would land in a `.tscn`, chosen so
 * `validatorRegistry.findValidator` can be called on it directly. For a
 * `validated` row that proves the family resolves on every concrete
 * registered type descending from the declaring class (the base-walk
 * mechanism `settingsFamilySeam.test.ts` exercises in depth for the two
 * `settings/` seam owners, `ChainIK3D` and `BoneConstraint3D` — this file does
 * not re-assert the SHADOW/delegation contract that file already covers, only
 * that a validator resolves at all). For an `unimplemented` row the same call
 * is asserted to still be `null`, so fixing the gap requires editing this
 * table rather than leaving a stale row behind.
 *
 * ## Where the rows live
 *
 * One part per family in `propertyListRoutes/`, concatenated here.
 * `propertyListRouteCoverage.test.ts` is the guard that reads them, and nothing
 * outside a test imports this, so it reaches no shipped bundle.
 */

import type { RouteRow } from './propertyListRoutes/types.js';
import { animationRoutes } from './propertyListRoutes/animation.js';
import { audioRoutes } from './propertyListRoutes/audio.js';
import { controlRoutes } from './propertyListRoutes/controls.js';
import { shaderParameterRoutes } from './propertyListRoutes/shaderParameters.js';
import { skeletonRoutes } from './propertyListRoutes/skeletons.js';
import { spatialNodeRoutes } from './propertyListRoutes/spatialNodes.js';

export type { RouteRow } from './propertyListRoutes/types.js';

export const ROWS: readonly RouteRow[] = [
  ...skeletonRoutes,
  ...animationRoutes,
  ...audioRoutes,
  ...spatialNodeRoutes,
  ...shaderParameterRoutes,
  ...controlRoutes,
];
