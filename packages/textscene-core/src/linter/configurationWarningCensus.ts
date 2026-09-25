/**
 * Every configuration warning Godot raises (`Node::get_configuration_warnings()` overrides), one row per condition, each
 * implemented as a rule, covered by a validator, declined with a typed category or named `unimplemented`. The rows sit
 * in `configurationWarningCensus/`, one part per family. `configurationWarningCoverage.test.ts` checks each row reaches
 * every concrete heir, and `emitsGrounding.test.ts` takes a `configuration-warning` rule's `file.cpp:line` from its row's `at`.
 */
import type { WarningRow } from './configurationWarningCensus/types.js';
import { mergeDisjoint } from './mergeDisjoint.js';
import { canvasItemWarnings } from './configurationWarningCensus/canvasItems.js';
import { collisionShapeWarnings } from './configurationWarningCensus/collisionShapes.js';
import { giAndEnvironmentWarnings } from './configurationWarningCensus/giAndEnvironment.js';
import { guiWarnings } from './configurationWarningCensus/gui.js';
import { jointWarnings } from './configurationWarningCensus/joints.js';
import { lightWarnings } from './configurationWarningCensus/lights.js';
import { navigationWarnings } from './configurationWarningCensus/navigation.js';
import { particleWarnings } from './configurationWarningCensus/particles.js';
import { physicsBodyWarnings } from './configurationWarningCensus/physicsBodies.js';
import { sceneServiceWarnings } from './configurationWarningCensus/sceneServices.js';
import { skeletonWarnings } from './configurationWarningCensus/skeletons.js';
import { transformDriverWarnings } from './configurationWarningCensus/transformDrivers.js';
import { visualInstanceWarnings } from './configurationWarningCensus/visualInstances.js';
import { xrWarnings } from './configurationWarningCensus/xr.js';

export type { DeclineCategory, Verdict, WarningRow } from './configurationWarningCensus/types.js';

/**
 * The merged census, a module because two guards share it. Only tests import it, so it never ships. It is baked from
 * the 4.6.3 source because nothing here may read that checkout (`godot-source-decoupling.test.mjs`). To re-derive it, list
 * every `PackedStringArray <Class>::get_configuration_warnings` in `scene/` and `modules/`, keep the classes in the
 * registry's base-chain closure, and diff their `warnings.push_back` lines against the parts.
 */
export const WARNINGS: Readonly<Record<string, readonly WarningRow[]>> = mergeDisjoint(
  [
    // No part for `Node`, whose `node.cpp` override has no `push_back` and serves GDScript dispatch, or for `MissingNode`,
    // which no registered type descends from.
    canvasItemWarnings,
    collisionShapeWarnings,
    giAndEnvironmentWarnings,
    guiWarnings,
    jointWarnings,
    lightWarnings,
    navigationWarnings,
    particleWarnings,
    physicsBodyWarnings,
    sceneServiceWarnings,
    skeletonWarnings,
    transformDriverWarnings,
    visualInstanceWarnings,
    xrWarnings,
  ],
  'census rows'
);
