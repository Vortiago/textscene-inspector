/**
 * Every configuration warning Godot raises is implemented as a rule, or declined.
 *
 * `Node::get_configuration_warnings()` is the engine's own authoring linter.
 * 92 classes in the 4.6.3 tree override it, and every warning they raise is a
 * mistake Godot itself thinks is worth telling an author about. This repo had
 * implemented many of them and had no way to know which. Coverage was whatever
 * the slice author happened to notice, and a warning nobody implemented was
 * indistinguishable from one somebody had decided against.
 *
 * **90 of those classes are in scope**, carrying **196 rows** between them.
 * Neither number is a `push_back` count, and the gaps are the interesting part:
 *
 * - `Node` itself contributes nothing — `node.cpp`'s override has zero
 *   `push_back` calls and exists only for the GDScript virtual dispatch.
 * - `MissingNode` is out of scope: no registered type descends from it.
 * - A row is one CONDITION, not one `push_back`. `Joint2D`/`Joint3D` each
 *   surface five mutually-exclusive strings through a single push, and
 *   `MultiplayerSpawner`/`MultiplayerSynchronizer` each push once over two
 *   disjuncts whose verdicts differ — so those become five and two rows.
 * - A row is also split where THIS repo implements one Godot condition as
 *   several per-family rules, since each needs its own reach check.
 *
 * The table removes that difference. Every row is one `warnings.push_back`
 * in the engine, and carries either the `ruleName` that reports it, a validator
 * that already covers it, a typed decline, or a named `unimplemented` gap. There
 * is no fifth state: a row with no verdict does not compile.
 *
 * ## Who reads it
 *
 * `configurationWarningCoverage.test.ts` checks each row is implemented and
 * reaches every concrete heir. `emitsGrounding.test.ts` reads it the other way
 * round: a rule whose `EmitGrounding` says `configuration-warning` gets its
 * `file.cpp:line` from the `at` of the row naming it, so the citation is stated
 * once. That is why this table is a module rather than a `const` inside one
 * test — it is data two guards share, not one guard's fixture. Nothing outside
 * a test imports it, so it never reaches the shipped bundle.
 *
 * ## Where the rows live
 *
 * The rows themselves sit in `configurationWarningCensus/`, one part per node
 * family, and this module merges them. `WARNINGS` and the row types keep this
 * path, so nothing that reads the census changes: a reader after one family
 * opens that part, a guard that sweeps the table imports this.
 *
 * ## The decline categories, and why they are typed
 *
 * A free-text reason turns 189 rows into a rubber stamp. The category is what a
 * reader can audit at a glance, and what makes a tired decline visible next to a
 * principled one:
 *
 * - `runtime-only` — needs a live tree, resolved resource contents, engine or OS
 *   state, or a project setting. None of it is in the scene file.
 * - `instance-opaque` — the deciding fact lives in a sub-scene behind
 *   `instance=`, which the linter never opens.
 * - `default-omitted` — the triggering value IS the serialised default, so Godot
 *   writes no key at all. Flagging its absence would demand a line the engine
 *   never emits.
 * - `editor-only` — the class or the check is `TOOLS_ENABLED`.
 *
 * ## Keeping the table honest
 *
 * It is a baked literal, derived once by reading the 4.6.3 source, because
 * nothing in this repo may read that checkout (`godot-source-decoupling.test.mjs`).
 * To re-derive it for a new Godot release, list every
 * `PackedStringArray <Class>::get_configuration_warnings` in `scene/` and
 * `modules/`, keep those whose class is in this registry's base-chain closure,
 * and diff the `warnings.push_back` lines against the rows in
 * `configurationWarningCensus/`.
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

export const WARNINGS: Readonly<Record<string, readonly WarningRow[]>> = mergeDisjoint(
  [
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
