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
 * **89 of those classes are in scope**, carrying **189 rows** between them.
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
 * The table below removes that difference. Every row is one `warnings.push_back`
 * in the engine, and carries either the `ruleName` that reports it, a validator
 * that already covers it, a typed decline, or a named `unimplemented` gap. There
 * is no fifth state: a row with no verdict does not compile.
 *
 * ## Reaching the leaves is the whole point
 *
 * Godot declares a warning on the class that OWNS the condition, which is often
 * an abstract base — `CollisionObject3D`, `Light3D`, `CSGShape3D`, `XRNode3D`.
 * The types that actually appear in a `.tscn` are its descendants. And
 * `RuleRegistry` applicability is **exact-match by design**
 * (`RuleRegistry.ts:getRulesForNodeType`), so a rule listing
 * `applicableNodeTypes: ['Light3D']` fires for a name no scene file contains and
 * for none of `DirectionalLight3D`/`OmniLight3D`/`SpotLight3D`.
 *
 * So an `implemented` row is not satisfied by the rule merely existing. It is
 * satisfied when the rule reaches EVERY concrete registered type that descends
 * from the declaring class. That is the check this guard exists for; the rest is
 * bookkeeping.
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
 * and diff the `warnings.push_back` lines against the rows here.
 */

import { describe, it, expect } from 'vitest';
import { nodeRegistry } from '../core/NodeRegistry.js';
import { ruleRegistry } from './RuleRegistry.js';
import { validatorRegistry } from './ValidatorRegistry.js';
import { descendsFrom } from './nodeBaseTypes.js';
import '../parser/TscnParser.js'; // side-effect: every slice registers its parser
import './index.js'; // side-effect: every slice registers its rules

type DeclineCategory = 'runtime-only' | 'instance-opaque' | 'default-omitted' | 'editor-only';

type Verdict =
  /** The `ruleName` a rule emits for this exact condition. */
  | { readonly rule: string }
  /**
   * Already reported, but by a format validator rather than a rule — given as
   * `Type.key`.
   *
   * The obligation is that an author is TOLD, not that a `LintRule` exists.
   * `LineEdit.secret_character` is the case that forced this: Godot warns when
   * more than one character is given, and `secretCharacterValidator` already
   * rejects exactly that, at error tier. Adding a warning-tier rule beside it
   * would report one defect twice and weaken it, so the honest verdict is
   * "covered, elsewhere" rather than a third state that reads as a gap.
   */
  | { readonly validator: string }
  /** Not checkable from one `.tscn`, for a reason of the named kind. */
  | { readonly declined: DeclineCategory; readonly because: string }
  /**
   * Checkable from a `.tscn`, and not yet checked. A live gap, not a decision.
   *
   * This arm exists so the guard can ship green while still naming every
   * outstanding obligation — the alternative is a red suite, which gets disabled.
   * The string names what the rule would check, so the list doubles as the work
   * queue it was derived from. Entries only ever leave this arm for `rule`.
   */
  | { readonly unimplemented: string };

interface WarningRow {
  /** `file.cpp:line` of the `warnings.push_back`, in the 4.6.3 tree. */
  readonly at: string;
  /** What Godot tells the author, compressed to a clause. */
  readonly says: string;
  readonly verdict: Verdict;
  /**
   * The visibility check Godot wraps around this `push_back`, when there is one.
   *
   * Ten of the 92 overrides gate part of their body on visibility, and the two
   * spellings are different rules, not synonyms:
   *
   * - `visible` is the node's OWN flag (`node_3d.cpp:1127-1130`), so
   *   `isExplicitlyHidden` answers it with no walk at all;
   * - `visible-in-tree` is the family cascade (`node_3d.cpp:1131-1143` for
   *   Node3D, `canvas_item.cpp:62-64` for CanvasItem), which `parentType.ts`'s
   *   `visibleInTreeVerdict` reproduces.
   *
   * Absence means Godot raises the warning regardless of visibility. That is
   * per-`push_back`, not per-class: `XROrigin3D` and `OpenXRCompositionLayer`
   * each gate some of their rows and leave the rest unconditional.
   *
   * A gate reaches the same leaves the row does, since it is the same override
   * body every heir inherits. Nothing here asserts it — a table checked against
   * a declaration would be true by construction and would never see a hidden
   * node still warning. The rules are held to it by a hidden-node case in each
   * slice's own `linter.test.ts`; this column is the derivation record that
   * says which slices owe one.
   */
  readonly gate?: 'visible-in-tree' | 'visible';
  /**
   * The concrete types this row reaches, when that is NOT every descendant of
   * the declaring class.
   *
   * Every override in the tree opens with
   * `PackedStringArray warnings = <Parent>::get_configuration_warnings();`, so a
   * base class's warnings normally do reach every leaf. Three things break that,
   * and all three need spelling out here rather than being left to a reader:
   *
   * - a guard of the form `if (get_class() == "Container")`, which confines the
   *   row to the base class itself (`container.cpp:210`);
   * - an override that starts a FRESH `PackedStringArray warnings;` and never
   *   calls its parent, which cuts that leaf off from the base's rows —
   *   `OpenXRRenderModel` (`openxr_render_model.cpp:147`) and
   *   `OpenXRRenderModelManager` (`openxr_render_model_manager.cpp:200`) are the
   *   only two in the closure that do this;
   * - this repo implementing ONE Godot condition as several rules, one per
   *   concrete family, rather than one rule with a base-walking matcher — the
   *   `CollisionObject2D`/`CollisionObject3D` "needs a collision shape" warning
   *   is four separate rule names (`area*`, `staticbody*`, `characterbody*`,
   *   `rigidbody*`), each reaching only its own family, so the single Godot row
   *   becomes several `WarningRow`s here, each with its own slice of `appliesTo`.
   */
  readonly appliesTo?: readonly string[];
}

const WARNINGS: Readonly<Record<string, readonly WarningRow[]>> = {
  AimModifier3D: [
    {
      at: 'aim_modifier_3d.cpp:103',
      says: 'forward axis and primary rotation axis must not be parallel',
      verdict: { rule: 'aimmodifier3d-parallel-rotation-axes' },
    },
  ],

  AnimatedSprite2D: [
    {
      at: 'animated_sprite_2d.cpp:594',
      says: 'requires a SpriteFrames resource to display frames',
      verdict: { rule: 'animatedsprite2d-requires-spriteframes' },
    },
  ],

  AnimatedSprite3D: [
    {
      at: 'sprite_3d.cpp:1469',
      says: 'requires a SpriteFrames resource to display frames',
      verdict: { rule: 'animatedsprite3d-requires-spriteframes' },
    },
  ],

  AnimationTree: [
    {
      at: 'animation_tree.cpp:720',
      says: 'no root AnimationNode for the graph is set',
      verdict: { rule: 'animationtree-missing-tree-root' },
    },
  ],

  BaseButton: [
    {
      at: 'base_button.cpp:526',
      says: 'ButtonGroup only arbitrates between toggle-mode buttons',
      verdict: { rule: 'button-group-without-toggle-mode' },
    },
  ],

  Bone2D: [
    {
      at: 'skeleton_2d.cpp:418',
      says: 'this Bone2D chain should end at a Skeleton2D node',
      verdict: { rule: 'bone2d-chain-does-not-terminate' },
    },
    {
      at: 'skeleton_2d.cpp:420',
      says: 'a Bone2D only works with a Skeleton2D or another Bone2D as parent',
      verdict: { rule: 'bone2d-invalid-parent' },
    },
    {
      at: 'skeleton_2d.cpp:425',
      says: 'this bone lacks a proper REST pose',
      verdict: { rule: 'bone2d-missing-rest-pose' },
    },
  ],

  BoneAttachment3D: [
    {
      at: 'bone_attachment_3d.cpp:65',
      says: 'external Skeleton3D node not set',
      verdict: { rule: 'boneattachment3d-external-skeleton-unset' },
    },
    {
      at: 'bone_attachment_3d.cpp:70',
      says: 'parent node is not a Skeleton3D node',
      verdict: { rule: 'boneattachment3d-parent-not-skeleton3d' },
    },
    {
      at: 'bone_attachment_3d.cpp:75',
      says: 'not bound to any bones',
      verdict: {
        declined: 'default-omitted',
        because: 'bone_idx field-initialises to -1 (bone_attachment_3d.cpp:348), which is the trigger itself',
      },
    },
  ],

  CanvasGroup: [
    {
      at: 'canvas_group.cpp:77',
      says: 'an ancestor clips its children, so this node cannot clip its own',
      verdict: { rule: 'canvasgroup-ancestor-clips-children' },
    },
    {
      at: 'canvas_group.cpp:83',
      says: 'nested inside another CanvasGroup',
      verdict: { rule: 'canvasgroup-nested-in-canvasgroup' },
    },
  ],

  CanvasItem: [
    {
      at: 'canvas_item.cpp:1309',
      says: 'an ancestor clips its children, so this node cannot clip its own',
      verdict: { rule: 'canvasitem-ancestor-clips-children' },
    },
    {
      at: 'canvas_item.cpp:1315',
      says: 'an ancestor is a CanvasGroup, so this node cannot clip its own children',
      verdict: { rule: 'canvasitem-ancestor-is-canvasgroup' },
    },
  ],

  CanvasModulate: [
    {
      at: 'canvas_modulate.cpp:123',
      says: 'more than one CanvasModulate in the scene, only one will be active',
      verdict: {
        declined: 'runtime-only',
        because: 'get_nodes_in_group("_canvas_modulate_" + canvas RID), a live-tree group query, canvas_modulate.cpp:120',
      },
      gate: 'visible-in-tree',
    },
  ],

  CollisionObject2D: [
    {
      at: 'collision_object_2d.cpp:588',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'area2d-needs-collision-shape' },
      appliesTo: ['Area2D'],
    },
    {
      at: 'collision_object_2d.cpp:588',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'staticbody2d-needs-collision-shape' },
      appliesTo: ['StaticBody2D', 'AnimatableBody2D'],
    },
    {
      at: 'collision_object_2d.cpp:588',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'characterbody2d-needs-collision-shape' },
      appliesTo: ['CharacterBody2D'],
    },
    {
      at: 'collision_object_2d.cpp:588',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'rigidbody2d-needs-collision-shape' },
      appliesTo: ['RigidBody2D', 'PhysicalBone2D'],
    },
  ],

  CollisionObject3D: [
    {
      at: 'collision_object_3d.cpp:739',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'area3d-needs-collision-shape' },
      appliesTo: ['Area3D'],
    },
    {
      at: 'collision_object_3d.cpp:739',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'staticbody3d-needs-collision-shape' },
      appliesTo: ['StaticBody3D', 'AnimatableBody3D'],
    },
    {
      at: 'collision_object_3d.cpp:739',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'characterbody3d-needs-collision-shape' },
      appliesTo: ['CharacterBody3D'],
    },
    {
      at: 'collision_object_3d.cpp:739',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'rigidbody3d-needs-collision-shape' },
      appliesTo: ['RigidBody3D', 'VehicleBody3D'],
    },
    {
      at: 'collision_object_3d.cpp:739',
      says: 'needs a collision shape to detect anything',
      verdict: { rule: 'physicalbone3d-needs-collision-shape' },
      appliesTo: ['PhysicalBone3D'],
    },
    {
      at: 'collision_object_3d.cpp:744',
      says: 'non-uniform scale will probably not function as expected',
      verdict: { rule: 'collisionobject3d-non-uniform-scale' },
    },
  ],

  CollisionPolygon2D: [
    {
      at: 'collision_polygon_2d.cpp:236',
      says: 'only serves to give a collision shape to a CollisionObject2D-derived parent',
      verdict: { rule: 'collisionpolygon2d-invalid-parent' },
    },
    {
      at: 'collision_polygon_2d.cpp:241',
      says: 'an empty polygon has no effect on collision',
      verdict: { rule: 'collisionpolygon2d-empty-polygon' },
    },
    {
      at: 'collision_polygon_2d.cpp:246',
      says: 'invalid polygon: at least 3 points needed in Solids build mode',
      verdict: { rule: 'collisionpolygon2d-insufficient-points' },
    },
    {
      at: 'collision_polygon_2d.cpp:249',
      says: 'invalid polygon: at least 2 points needed in Segments build mode',
      verdict: { rule: 'collisionpolygon2d-insufficient-points' },
    },
    {
      at: 'collision_polygon_2d.cpp:253',
      says: 'One Way Collision is ignored under an Area2D',
      verdict: { rule: 'collisionpolygon2d-one-way-ignored' },
    },
  ],

  CollisionPolygon3D: [
    {
      at: 'collision_polygon_3d.cpp:239',
      says: 'only serves to give a collision shape to a CollisionObject3D-derived parent',
      verdict: { rule: 'collisionpolygon3d-invalid-parent' },
    },
    {
      at: 'collision_polygon_3d.cpp:243',
      says: 'an empty polygon has no effect on collision',
      verdict: { rule: 'collisionpolygon3d-empty-polygon' },
    },
    {
      at: 'collision_polygon_3d.cpp:248',
      says: 'non-uniform scale will probably not function as expected',
      verdict: { rule: 'collisionpolygon3d-non-uniform-scale' },
    },
  ],

  CollisionShape2D: [
    {
      at: 'collision_shape_2d.cpp:176',
      says: 'only serves to give a collision shape to a CollisionObject2D-derived parent',
      verdict: { rule: 'collisionshape2d-invalid-parent' },
    },
    {
      at: 'collision_shape_2d.cpp:179',
      says: 'a shape resource must be provided to function',
      verdict: { rule: 'collisionshape2d-requires-shape' },
    },
    {
      at: 'collision_shape_2d.cpp:182',
      says: 'One Way Collision is ignored under an Area2D',
      verdict: { rule: 'collisionshape2d-one-way-ignored-under-area2d' },
    },
    {
      at: 'collision_shape_2d.cpp:188',
      says: 'has limited editing for polygon-based shapes, consider CollisionPolygon2D',
      verdict: { rule: 'collisionshape2d-polygon-shape-limited-editing' },
    },
  ],

  CollisionShape3D: [
    {
      at: 'collision_shape_3d.cpp:127',
      says: 'only serves to give a collision shape to a CollisionObject3D-derived parent',
      verdict: { rule: 'collisionshape3d-invalid-parent' },
    },
    {
      at: 'collision_shape_3d.cpp:131',
      says: 'a shape resource must be provided to function',
      verdict: { rule: 'collisionshape3d-requires-shape' },
    },
    {
      at: 'collision_shape_3d.cpp:141',
      says: 'ConcavePolygonShape3D will likely not behave well for a RigidBody3D/VehicleBody3D',
      verdict: { rule: 'collisionshape3d-concave-under-rigidbody' },
    },
    {
      at: 'collision_shape_3d.cpp:143',
      says: "WorldBoundaryShape3D doesn't support RigidBody3D in a non-static mode",
      verdict: { rule: 'collisionshape3d-worldboundary-under-rigidbody' },
    },
    {
      at: 'collision_shape_3d.cpp:149',
      says: 'ConcavePolygonShape3D will likely not behave well for a CharacterBody3D',
      verdict: { rule: 'collisionshape3d-concave-under-characterbody' },
    },
    {
      at: 'collision_shape_3d.cpp:155',
      says: 'non-uniform scale will probably not function as expected',
      verdict: { rule: 'collisionshape3d-non-uniform-scale' },
    },
  ],

  Container: [
    {
      at: 'container.cpp:211',
      says: "plain Container doesn't display anything on its own",
      verdict: { rule: 'container-no-script' },
      appliesTo: ['Container'],
    },
  ],

  Control: [
    {
      at: 'control.cpp:252',
      says: "tooltip won't be displayed because Mouse Filter is Ignore",
      verdict: { rule: 'control-tooltip-ignored-by-mouse-filter' },
    },
  ],

  CPUParticles2D: [
    {
      at: 'cpu_particles_2d.cpp:307',
      says: 'animation requires a CanvasItemMaterial with Particles Animation enabled',
      verdict: {
        declined: 'runtime-only',
        because: "resolved material's particles_animation VALUE, cpu_particles_2d.cpp:302,304",
      },
    },
  ],

  CPUParticles3D: [
    {
      at: 'cpu_particles_3d.cpp:234',
      says: 'nothing is visible because no mesh has been assigned',
      verdict: { rule: 'cpuparticles3d-requires-mesh' },
    },
    {
      at: 'cpu_particles_3d.cpp:238',
      says: 'animation requires a StandardMaterial3D with Particle Billboard mode',
      verdict: {
        declined: 'runtime-only',
        because: "resolved material's billboard-mode VALUE, cpu_particles_3d.cpp:215-238",
      },
    },
  ],

  CSGShape3D: [
    {
      at: 'csg_shape.cpp:982',
      says: 'has an empty (non-manifold) shape',
      verdict: {
        unimplemented:
          'full port needs live CSG geometry; narrower checkable slice: degenerate own geometry — CSGMesh3D with no mesh, CSGPolygon3D polygon under 3 points, zero/negative size/radius/height; reaches the 7 concrete CSG types',
      },
    },
  ],

  Decal: [
    {
      at: 'decal.cpp:179',
      says: 'only available with the Forward+ or Mobile renderer',
      verdict: {
        declined: 'runtime-only',
        because: 'OS::get_current_rendering_method() == "gl_compatibility"/"dummy", decal.cpp:179',
      },
    },
    {
      at: 'decal.cpp:184',
      says: 'no textures loaded into any texture property, so nothing will be visible',
      verdict: { rule: 'decal-requires-texture' },
    },
    {
      at: 'decal.cpp:188',
      says: 'has a Normal/ORM texture but no Albedo texture',
      verdict: { rule: 'decal-normal-orm-without-albedo' },
    },
    {
      at: 'decal.cpp:192',
      says: "Cull Mask has no bits enabled, so the decal won't paint anything",
      verdict: { rule: 'decal-empty-cull-mask' },
    },
  ],

  FogVolume: [
    {
      at: 'fog_volume.cpp:126',
      says: 'only visible with the Forward+ renderer',
      verdict: {
        declined: 'runtime-only',
        because: 'OS::get_current_rendering_method() != "forward_plus", fog_volume.cpp:126',
      },
    },
    {
      at: 'fog_volume.cpp:131',
      says: 'needs volumetric fog enabled in the Environment to be visible',
      verdict: {
        declined: 'runtime-only',
        because: "reads the live Viewport's World3D Environment, get_viewport()->find_world_3d()->get_environment(), fog_volume.cpp:123",
      },
    },
  ],

  GeometryInstance3D: [
    {
      at: 'visual_instance_3d.cpp:513',
      says: "visibility range End is non-zero but lower than Begin, so it's never visible",
      verdict: { rule: 'geometryinstance3d-visibility-range-end-before-begin' },
    },
    {
      at: 'visual_instance_3d.cpp:517',
      says: 'fades in over distance, but the begin fade margin is 0',
      verdict: { rule: 'geometryinstance3d-visibility-range-begin-fade-without-margin' },
    },
    {
      at: 'visual_instance_3d.cpp:521',
      says: 'fades out over distance, but the end fade margin is 0',
      verdict: { rule: 'geometryinstance3d-visibility-range-end-fade-without-margin' },
    },
    {
      at: 'visual_instance_3d.cpp:525',
      says: 'transparency only available with the Forward+ renderer',
      verdict: {
        declined: 'runtime-only',
        because: 'OS::get_current_rendering_method() != "forward_plus", visual_instance_3d.cpp:524',
      },
    },
    {
      at: 'visual_instance_3d.cpp:529',
      says: 'visibility-range fade transparency only available with the Forward+ renderer',
      verdict: {
        declined: 'runtime-only',
        because: 'OS::get_current_rendering_method() != "forward_plus", visual_instance_3d.cpp:528',
      },
    },
  ],

  GPUParticles2D: [
    {
      at: 'gpu_particles_2d.cpp:377',
      says: 'no material to process the particles is assigned',
      verdict: { rule: 'gpuparticles2d-missing-process-material' },
    },
    {
      at: 'gpu_particles_2d.cpp:386',
      says: 'animation requires a CanvasItemMaterial with Particles Animation enabled',
      verdict: {
        declined: 'runtime-only',
        because: "material and process_material property VALUES, gpu_particles_2d.cpp:379-385",
      },
    },
    {
      at: 'gpu_particles_2d.cpp:392',
      says: 'particle trails only available with the Forward+ or Mobile renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), gpu_particles_2d.cpp:391' },
    },
    {
      at: 'gpu_particles_2d.cpp:396',
      says: 'particle sub-emitters only available with the Forward+ or Mobile renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), gpu_particles_2d.cpp:395' },
    },
  ],

  GPUParticles3D: [
    {
      at: 'gpu_particles_3d.cpp:363',
      says: 'nothing is visible because meshes have not been assigned to draw passes',
      verdict: { rule: 'gpuparticles3d-no-draw-pass-mesh' },
    },
    {
      at: 'gpu_particles_3d.cpp:367',
      says: 'no material to process the particles is assigned',
      verdict: { rule: 'gpuparticles3d-missing-process-material' },
    },
    {
      at: 'gpu_particles_3d.cpp:373',
      says: 'animation requires a BaseMaterial3D with Particle Billboard mode',
      verdict: { declined: 'runtime-only', because: "resolved material's billboard-mode VALUE, gpu_particles_3d.cpp:370-372" },
    },
    {
      at: 'gpu_particles_3d.cpp:415',
      says: 'Trail meshes with a Skin causes the Skin to override Trail poses',
      verdict: { declined: 'runtime-only', because: 'resolved draw_pass/skin CONTENT, gpu_particles_3d.cpp:414' },
    },
    {
      at: 'gpu_particles_3d.cpp:417',
      says: 'Trails active, but neither Trail meshes nor a Skin were found',
      verdict: { declined: 'runtime-only', because: 'resolved draw_pass/skin CONTENT, gpu_particles_3d.cpp:416' },
    },
    {
      at: 'gpu_particles_3d.cpp:419',
      says: 'only one Trail mesh is supported without a Skin',
      verdict: { declined: 'runtime-only', because: 'resolved draw_pass count, gpu_particles_3d.cpp:418' },
    },
    {
      at: 'gpu_particles_3d.cpp:423',
      says: 'Trails enabled, but one or more mesh materials are missing or unset for trails',
      verdict: { declined: 'runtime-only', because: 'resolved draw_pass materials CONTENT, gpu_particles_3d.cpp:422' },
    },
    {
      at: 'gpu_particles_3d.cpp:426',
      says: 'particle trails only available with the Forward+ or Mobile renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), gpu_particles_3d.cpp:425' },
    },
    {
      at: 'gpu_particles_3d.cpp:431',
      says: 'particle sub-emitters only available with the Forward+ or Mobile renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), gpu_particles_3d.cpp:430' },
    },
  ],

  GPUParticlesCollisionSDF3D: [
    {
      at: 'gpu_particles_collision_3d.cpp:530',
      says: 'Bake Mask has no bits enabled, so baking produces no collision',
      verdict: { rule: 'gpuparticlescollisionsdf3d-empty-bake-mask' },
    },
  ],

  IterateIK3D: [
    {
      at: 'iterate_ik_3d.cpp:162',
      says: 'a setting has no target set',
      verdict: { rule: 'iterateik3d-setting-missing-target-node' },
    },
  ],

  Joint2D: [
    {
      at: 'joint_2d.cpp:81',
      says: 'Node A must be a PhysicsBody2D',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the class node_a resolves to, joint_2d.cpp:81',
      },
    },
    {
      at: 'joint_2d.cpp:83',
      says: 'Node B must be a PhysicsBody2D',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the class node_b resolves to, joint_2d.cpp:83',
      },
    },
    {
      at: 'joint_2d.cpp:79',
      says: 'Node A and Node B must both be PhysicsBody2Ds',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the classes node_a and node_b resolve to, joint_2d.cpp:79',
      },
    },
    {
      at: 'joint_2d.cpp:85',
      says: 'not connected to two PhysicsBody2Ds',
      verdict: { rule: 'joint-not-connected' },
    },
    {
      at: 'joint_2d.cpp:87',
      says: 'Node A and Node B must be different PhysicsBody2Ds',
      verdict: { rule: 'joint-same-body' },
    },
  ],

  Joint3D: [
    {
      at: 'joint_3d.cpp:77',
      says: 'Node A and Node B must both be PhysicsBody3Ds',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the classes node_a and node_b resolve to, joint_3d.cpp:77',
      },
    },
    {
      at: 'joint_3d.cpp:79',
      says: 'Node A must be a PhysicsBody3D',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the class node_a resolves to, joint_3d.cpp:79',
      },
    },
    {
      at: 'joint_3d.cpp:81',
      says: 'Node B must be a PhysicsBody3D',
      verdict: {
        declined: 'instance-opaque',
        because: 'needs the class node_b resolves to, joint_3d.cpp:81',
      },
    },
    {
      at: 'joint_3d.cpp:83',
      says: 'not connected to any PhysicsBody3Ds',
      verdict: { rule: 'joint-not-connected' },
    },
    {
      at: 'joint_3d.cpp:85',
      says: 'Node A and Node B must be different PhysicsBody3Ds',
      verdict: { rule: 'joint-same-body' },
    },
  ],

  Label: [
    {
      at: 'label.cpp:634',
      says: 'autowrap under a Container needs a custom minimum size',
      verdict: { rule: 'label-autowrap-needs-custom-minimum-size' },
    },
    {
      at: 'label.cpp:655',
      says: "the current font can't render one or more characters in the text",
      verdict: { declined: 'runtime-only', because: 'TextServer glyph shaping, label.cpp:647-659' },
    },
    {
      at: 'label.cpp:695',
      says: 'MSDF font pixel range is too small for some outlines/shadows',
      verdict: { declined: 'runtime-only', because: 'FontFile binary MSDF metadata, label.cpp:689-691' },
    },
  ],

  Light3D: [
    {
      at: 'light_3d.cpp:184',
      says: "a light's scale does not affect its visual size",
      verdict: { rule: 'light3d-non-unit-scale' },
    },
  ],

  LightmapGI: [
    {
      at: 'lightmap_gi.cpp:1808',
      says: "GPU doesn't support the RenderingDevice backends lightmap baking needs",
      verdict: { declined: 'runtime-only', because: 'DisplayServer::can_create_rendering_device(), lightmap_gi.cpp:1807' },
    },
    {
      at: 'lightmap_gi.cpp:1813',
      says: 'no baked shadowmask textures',
      verdict: {
        declined: 'runtime-only',
        because: "resolved LightmapGIData's has_shadowmask_textures() CONTENT, lightmap_gi.cpp:1812",
      },
    },
    {
      at: 'lightmap_gi.cpp:1817',
      says: 'lightmaps cannot be baked on this platform',
      verdict: { declined: 'runtime-only', because: 'OS::get_name(), an #ifdef ANDROID_ENABLED/APPLE_EMBEDDED_ENABLED branch, lightmap_gi.cpp:1816' },
    },
    {
      at: 'lightmap_gi.cpp:1819',
      says: 'the lightmapper_rd module was disabled at compile-time',
      verdict: { declined: 'runtime-only', because: 'compile-time #else branch when MODULE_LIGHTMAPPER_RD_ENABLED is unset, lightmap_gi.cpp:1806' },
    },
  ],

  LightOccluder2D: [
    {
      at: 'light_occluder_2d.cpp:270',
      says: 'an occluder polygon must be set to take effect',
      verdict: { rule: 'lightoccluder2d-requires-occluder' },
    },
    {
      at: 'light_occluder_2d.cpp:274',
      says: 'the occluder polygon has less than the required points',
      verdict: {
        declined: 'runtime-only',
        because: "resolved OccluderPolygon2D's polygon VALUE, light_occluder_2d.cpp:273",
      },
    },
  ],

  LineEdit: [
    {
      at: 'line_edit.cpp:3075',
      says: 'Secret Character supports only one character',
      verdict: { validator: 'LineEdit.secret_character' },
    },
  ],

  LookAtModifier3D: [
    {
      at: 'look_at_modifier_3d.cpp:73',
      says: 'forward axis and primary rotation axis must not be parallel',
      verdict: { rule: 'lookatmodifier3d-parallel-rotation-axes' },
    },
  ],

  MenuButton: [
    {
      at: 'menu_button.cpp:232',
      says: 'no popup menu assigned',
      verdict: { declined: 'editor-only', because: 'whole override inside #ifdef TOOLS_ENABLED, menu_button.cpp:229,235' },
    },
  ],

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

  NavigationAgent2D: [
    {
      at: 'navigation_agent_2d.cpp:726',
      says: 'can be used only under a Node2D-inheriting parent',
      verdict: { rule: 'navigationagent2d-parent-not-node2d' },
    },
  ],

  NavigationAgent3D: [
    {
      at: 'navigation_agent_3d.cpp:793',
      says: 'can be used only under a Node3D-inheriting parent',
      verdict: { rule: 'navigationagent3d-parent-not-node3d' },
    },
  ],

  NavigationLink2D: [
    {
      at: 'navigation_link_2d.cpp:335',
      says: 'start position should differ from the end position to be useful',
      verdict: { rule: 'navigationlink2d-coincident-endpoints' },
    },
  ],

  NavigationLink3D: [
    {
      at: 'navigation_link_3d.cpp:498',
      says: 'start position should differ from the end position to be useful',
      verdict: { rule: 'navigationlink3d-start-position-equals-end-position' },
    },
  ],

  NavigationObstacle2D: [
    {
      at: 'navigation_obstacle_2d.cpp:333',
      says: 'does not support negative or zero global scaling',
      verdict: { rule: 'navigationobstacle2d-non-positive-global-scale' },
    },
    {
      at: 'navigation_obstacle_2d.cpp:337',
      says: 'agent radius can only be scaled uniformly',
      verdict: { rule: 'navigationobstacle2d-non-uniform-global-scale' },
    },
    {
      at: 'navigation_obstacle_2d.cpp:341',
      says: 'skew has no effect on the agent radius',
      verdict: { rule: 'navigationobstacle2d-global-skew-ignored' },
    },
  ],

  NavigationObstacle3D: [
    {
      at: 'navigation_obstacle_3d.cpp:412',
      says: 'does not support non-Y-axis global rotation',
      verdict: { declined: 'runtime-only', because: 'get_global_rotation(), navigation_obstacle_3d.cpp:411' },
    },
    {
      at: 'navigation_obstacle_3d.cpp:417',
      says: 'does not support zero or negative global scaling',
      verdict: { declined: 'runtime-only', because: 'get_global_basis().get_scale(), navigation_obstacle_3d.cpp:415-416' },
    },
    {
      at: 'navigation_obstacle_3d.cpp:421',
      says: 'agent radius can only be scaled uniformly',
      verdict: { declined: 'runtime-only', because: 'get_global_basis().is_conformal(), navigation_obstacle_3d.cpp:420' },
    },
  ],

  NavigationRegion2D: [
    {
      at: 'navigation_region_2d.cpp:304',
      says: 'a NavigationPolygon resource must be set or created',
      verdict: { rule: 'navigationregion2d-requires-navigation-polygon' },
      gate: 'visible-in-tree',
    },
  ],

  NavigationRegion3D: [
    {
      at: 'navigation_region_3d.cpp:257',
      says: 'a NavigationMesh resource must be set or created',
      verdict: { rule: 'navigationregion3d-requires-navigation-mesh' },
      gate: 'visible-in-tree',
    },
  ],

  OccluderInstance3D: [
    {
      at: 'occluder_instance_3d.cpp:697',
      says: 'occlusion culling is disabled in the Project Settings',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET_CACHED("rendering/occlusion_culling/use_occlusion_culling"), occluder_instance_3d.cpp:696',
      },
    },
    {
      at: 'occluder_instance_3d.cpp:701',
      says: 'Bake Mask has no bits enabled',
      verdict: { rule: 'occluderinstance3d-empty-bake-mask' },
    },
    {
      at: 'occluder_instance_3d.cpp:705',
      says: 'no occluder mesh is defined in the Occluder property',
      verdict: { rule: 'occluderinstance3d-missing-occluder' },
    },
    {
      at: 'occluder_instance_3d.cpp:711',
      says: 'the occluder mesh has less than 3 vertices',
      verdict: {
        declined: 'runtime-only',
        because: "resolved ArrayOccluder3D's indices VALUE, occluder_instance_3d.cpp:709-710",
      },
    },
    {
      at: 'occluder_instance_3d.cpp:715',
      says: 'the polygon occluder has less than 3 vertices',
      verdict: {
        declined: 'runtime-only',
        because: "resolved PolygonOccluder3D's polygon VALUE, occluder_instance_3d.cpp:713-714",
      },
    },
  ],

  OmniLight3D: [
    {
      at: 'light_3d.cpp:624',
      says: 'projector texture only works with shadows active',
      verdict: { rule: 'omnilight3d-projector-without-shadow' },
    },
    {
      at: 'light_3d.cpp:628',
      says: 'projector textures not yet supported by the Compatibility renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), light_3d.cpp:627' },
    },
  ],

  OpenXRCompositionLayer: [
    {
      at: 'openxr_composition_layer.cpp:765',
      says: 'must have an XROrigin3D node as parent',
      verdict: { rule: 'openxrcompositionlayer-parent-not-xrorigin3d' },
      gate: 'visible',
    },
    {
      at: 'openxr_composition_layer.cpp:770',
      says: 'must have an orthonormalized transform (no scale or shearing)',
      verdict: { rule: 'openxrcompositionlayer-non-orthonormal-transform' },
    },
    {
      at: 'openxr_composition_layer.cpp:774',
      says: "hole punching won't work unless sort order is negative",
      verdict: { rule: 'openxrcompositionlayer-hole-punch-sort-order' },
    },
  ],

  OpenXRRenderModel: [
    {
      at: 'openxr_render_model.cpp:151',
      says: 'must be a child of an XROrigin3D or OpenXRRenderModelManager node',
      verdict: { rule: 'openxrrendermodel-parent-not-origin-or-manager' },
    },
    {
      at: 'openxr_render_model.cpp:155',
      says: 'the render model extension is not enabled in project settings',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET("xr/openxr/extensions/render_model"), openxr_render_model.cpp:154',
      },
    },
  ],

  OpenXRRenderModelManager: [
    {
      at: 'openxr_render_model_manager.cpp:205',
      says: 'must specify a tracker to make the node local to pose',
      verdict: { rule: 'openxrrendermodelmanager-tracker-required-for-local-pose' },
    },
    {
      at: 'openxr_render_model_manager.cpp:218',
      says: 'must be a child of an XROrigin3D node',
      verdict: { rule: 'openxrrendermodelmanager-parent-not-xrorigin3d' },
    },
    {
      at: 'openxr_render_model_manager.cpp:222',
      says: 'the render model extension is not enabled in project settings',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET("xr/openxr/extensions/render_model"), openxr_render_model_manager.cpp:221',
      },
    },
  ],

  OpenXRVisibilityMask: [
    {
      at: 'openxr_visibility_mask.cpp:73',
      says: 'must have an XRCamera3D node as parent',
      verdict: { rule: 'openxrvisibilitymask-parent-not-xrcamera3d' },
      gate: 'visible',
    },
  ],

  OptionButton: [
    {
      at: 'option_button.cpp:645',
      says: 'no options to select from',
      verdict: { declined: 'editor-only', because: '#ifdef TOOLS_ENABLED, option_button.cpp:642,648' },
    },
  ],

  ParallaxLayer: [
    {
      at: 'parallax_layer.cpp:139',
      says: 'only works with a ParallaxBackground parent',
      verdict: { rule: 'parallaxlayer-outside-parallaxbackground' },
    },
  ],

  PathFollow2D: [
    {
      at: 'path_2d.cpp:386',
      says: 'only works as a child of a Path2D node',
      verdict: { rule: 'pathfollow2d-invalid-parent' },
      gate: 'visible-in-tree',
    },
  ],

  PathFollow3D: [
    {
      at: 'path_3d.cpp:359',
      says: 'only works as a child of a Path3D node',
      verdict: { rule: 'pathfollow3d-invalid-parent' },
      gate: 'visible-in-tree',
    },
    {
      at: 'path_3d.cpp:363',
      says: 'ROTATION_ORIENTED requires Up Vector enabled on the parent Path3D curve',
      verdict: { rule: 'pathfollow3d-oriented-mode-requires-up-vector' },
      gate: 'visible-in-tree',
    },
  ],

  PhysicalBone2D: [
    {
      at: 'physical_bone_2d.cpp:113',
      says: 'requires a Skeleton2D ancestor to function',
      verdict: { rule: 'physicalbone2d-missing-skeleton-parent' },
    },
    {
      at: 'physical_bone_2d.cpp:116',
      says: 'no bone assigned',
      verdict: { rule: 'physicalbone2d-missing-bone-index' },
    },
    {
      at: 'physical_bone_2d.cpp:121',
      says: 'needs a Joint2D child to keep bones together',
      verdict: { rule: 'physicalbone2d-missing-joint-child' },
    },
  ],

  PhysicsBody2D: [
    {
      at: 'physics_body_2d.cpp:177',
      says: 'will not work correctly on a non-interpolated branch of the SceneTree',
      verdict: {
        declined: 'runtime-only',
        because: 'SceneTree::is_fti_enabled_in_project(), a project setting, physics_body_2d.cpp:176',
      },
    },
  ],

  PhysicsBody3D: [
    {
      at: 'physics_body_3d.cpp:218',
      says: 'will not work correctly on a non-interpolated branch of the SceneTree',
      verdict: {
        declined: 'runtime-only',
        because: 'SceneTree::is_fti_enabled_in_project(), a project setting, physics_body_3d.cpp:217',
      },
    },
  ],

  PointLight2D: [
    {
      at: 'light_2d.cpp:435',
      says: 'requires a texture to display',
      verdict: { rule: 'pointlight2d-requires-texture' },
    },
  ],

  PopupMenu: [
    {
      at: 'popup_menu.cpp:3075',
      says: 'has no visible items',
      verdict: { declined: 'editor-only', because: '#ifdef TOOLS_ENABLED, popup_menu.cpp:3068,3081' },
    },
  ],

  PopupPanel: [
    {
      at: 'popup.cpp:238',
      says: 'has no child controls',
      verdict: { declined: 'editor-only', because: '#ifdef TOOLS_ENABLED, popup.cpp:231,244' },
    },
  ],

  Range: [
    {
      at: 'range.cpp:76',
      says: 'Exp Edit requires Min Value >= 0',
      verdict: { rule: 'range-exp-edit-negative-min' },
    },
  ],

  RemoteTransform2D: [
    {
      at: 'remote_transform_2d.cpp:217',
      says: 'Path property must point to a valid Node2D node',
      verdict: { rule: 'remotetransform2d-invalid-remote-path' },
    },
  ],

  RemoteTransform3D: [
    {
      at: 'remote_transform_3d.cpp:209',
      says: 'Remote Path property must point to a valid Node3D node',
      verdict: { rule: 'remotetransform3d-invalid-remote-path' },
    },
  ],

  RetargetModifier3D: [
    {
      at: 'retarget_modifier_3d.cpp:36',
      says: 'there is no child Skeleton3D',
      verdict: { rule: 'retargetmodifier3d-no-child-skeleton' },
    },
  ],

  RigidBody2D: [
    {
      at: 'rigid_body_2d.cpp:648',
      says: 'size changes are overridden by the physics engine at runtime',
      verdict: { rule: 'rigidbody2d-scale-overridden-at-runtime' },
    },
  ],

  RigidBody3D: [
    {
      at: 'rigid_body_3d.cpp:667',
      says: 'scale changes are overridden by the physics engine at runtime',
      verdict: { rule: 'rigidbody3d-scale-overridden-at-runtime' },
    },
  ],

  ScrollContainer: [
    {
      at: 'scroll_container.cpp:784',
      says: 'is intended to work with a single child control',
      verdict: { rule: 'scrollcontainer-not-single-child' },
    },
  ],

  ShaderGlobalsOverride: [
    {
      at: 'shader_globals_override.cpp:282',
      says: 'inactive because another node of the same type is in the scene',
      verdict: { rule: 'shaderglobalsoverride-multiple-in-scene' },
    },
  ],

  ShapeCast2D: [
    {
      at: 'shape_cast_2d.cpp:408',
      says: 'cannot interact with anything without a Shape2D assigned',
      verdict: { rule: 'shapecast2d-missing-shape' },
    },
  ],

  ShapeCast3D: [
    {
      at: 'shape_cast_3d.cpp:186',
      says: 'cannot interact with anything without a Shape3D assigned',
      verdict: { rule: 'shapecast3d-missing-shape' },
    },
    {
      at: 'shape_cast_3d.cpp:189',
      says: 'does not support ConcavePolygonShape3D',
      verdict: { rule: 'shapecast3d-concave-shape' },
    },
  ],

  SkeletonModifier3D: [
    {
      at: 'skeleton_modifier_3d.cpp:36',
      says: 'Skeleton3D node not set; must be a child of Skeleton3D',
      verdict: { rule: 'skeletonmodifier3d-parent-not-skeleton3d' },
    },
  ],

  SoftBody3D: [
    {
      at: 'soft_body_3d.cpp:405',
      says: 'this body is ignored until a mesh is set',
      verdict: { rule: 'valid-softbody3d-mesh' },
    },
  ],

  SplineIK3D: [
    {
      at: 'spline_ik_3d.cpp:113',
      says: 'a setting has no Path3D set',
      verdict: { rule: 'splineik3d-setting-without-path-3d' },
    },
  ],

  SpotLight3D: [
    {
      at: 'light_3d.cpp:656',
      says: 'an angle wider than 90 degrees cannot cast shadows',
      verdict: { rule: 'spotlight3d-shadow-angle-too-wide' },
    },
    {
      at: 'light_3d.cpp:660',
      says: 'projector texture only works with shadows active',
      verdict: { rule: 'spotlight3d-projector-without-shadow' },
    },
    {
      at: 'light_3d.cpp:664',
      says: 'projector textures not yet supported by the Compatibility renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), light_3d.cpp:663' },
    },
  ],

  SpringBoneCollision3D: [
    {
      at: 'spring_bone_collision_3d.cpp:40',
      says: 'parent should be a SpringBoneSimulator3D node',
      verdict: { rule: 'springbonecollision3d-outside-springbonesimulator3d' },
    },
  ],

  SubViewportContainer: [
    {
      at: 'subviewport_container.cpp:280',
      says: "doesn't have a SubViewport child, so it can't display anything",
      verdict: { rule: 'subviewportcontainer-no-viewport' },
    },
    {
      at: 'subviewport_container.cpp:284',
      says: 'default mouse cursor shape has no effect',
      verdict: { rule: 'subviewportcontainer-non-arrow-cursor' },
    },
  ],

  TileMap: [
    {
      at: 'tile_map.cpp:843',
      says: 'deprecated, superseded by TileMapLayer nodes',
      verdict: { rule: 'tilemap-deprecated' },
    },
    {
      at: 'tile_map.cpp:856',
      says: 'a Y-sorted layer shares a Z-index with a non-Y-sorted layer',
      verdict: { rule: 'tilemap-y-sort-z-index-conflict' },
    },
    {
      at: 'tile_map.cpp:865',
      says: 'a layer is Y-sorted, but Y-sort is not enabled on the TileMap itself',
      verdict: { rule: 'tilemap-layer-y-sort-without-node' },
    },
    {
      at: 'tile_map.cpp:879',
      says: 'the TileMap is Y-sorted, but no layer has Y-sort enabled',
      verdict: { rule: 'tilemap-node-y-sort-without-layer' },
    },
    {
      at: 'tile_map.cpp:896',
      says: 'isometric TileSet will likely not look right without Y-sort',
      verdict: {
        declined: 'runtime-only',
        because: "referenced tile_set's tile_shape VALUE, tile_map.cpp:884",
      },
    },
  ],

  Timer: [
    {
      at: 'timer.cpp:205',
      says: 'very low wait times behave differently across frame rates',
      verdict: { rule: 'timer-low-wait-time' },
    },
  ],

  TwoBoneIK3D: [
    {
      at: 'two_bone_ik_3d.cpp:196',
      says: 'a setting has no target set',
      verdict: { rule: 'twoboneik3d-setting-missing-target-node' },
    },
  ],

  Viewport: [
    {
      at: 'viewport.cpp:3711',
      says: 'size must be at least 2 pixels on both dimensions to render anything',
      verdict: { rule: 'viewport-size-too-small' },
    },
  ],

  VoxelGI: [
    {
      at: 'voxel_gi.cpp:544',
      says: 'not supported by the Compatibility renderer yet',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), voxel_gi.cpp:543' },
    },
    {
      at: 'voxel_gi.cpp:546',
      says: 'not supported by the Dummy renderer',
      verdict: { declined: 'runtime-only', because: 'OS::get_current_rendering_method(), voxel_gi.cpp:545' },
    },
    {
      at: 'voxel_gi.cpp:548',
      says: 'no VoxelGI data set, so the node is disabled',
      verdict: { rule: 'voxelgi-missing-data' },
    },
  ],

  WorldEnvironment: [
    {
      at: 'world_environment.cpp:188',
      says: 'requires an Environment or a CameraAttributes resource to have any effect',
      verdict: { rule: 'worldenvironment-requires-environment' },
    },
    {
      at: 'world_environment.cpp:196',
      says: 'only the first Environment has an effect in a scene',
      verdict: {
        declined: 'runtime-only',
        because: "reads the live Viewport's World3D Environment, get_viewport()->find_world_3d()->get_environment(), world_environment.cpp:194",
      },
    },
    {
      at: 'world_environment.cpp:200',
      says: 'only one WorldEnvironment is allowed per scene',
      verdict: {
        declined: 'runtime-only',
        because: "reads the live Viewport's World3D CameraAttributes, get_viewport()->find_world_3d()->get_camera_attributes(), world_environment.cpp:199",
      },
    },
    {
      at: 'world_environment.cpp:204',
      says: 'only the first Compositor has an effect in a scene',
      verdict: {
        declined: 'runtime-only',
        because: "reads the live Viewport's World3D Compositor, get_viewport()->find_world_3d()->get_compositor(), world_environment.cpp:203",
      },
    },
  ],

  XRCamera3D: [
    {
      at: 'xr_nodes.cpp:102',
      says: 'may not function as expected without an XROrigin3D parent',
      verdict: { rule: 'xrcamera3d-parent-not-xrorigin3d' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:106',
      says: 'should have physics_interpolation_mode OFF to avoid jitter',
      verdict: {
        declined: 'runtime-only',
        because: 'SceneTree::is_fti_enabled_in_project(), a project setting, xr_nodes.cpp:105',
      },
      gate: 'visible',
    },
  ],

  XRHandModifier3D: [
    {
      at: 'xr_hand_modifier_3d.cpp:295',
      says: 'requires the OpenXR Hand Tracking extension to be enabled',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET("xr/openxr/extensions/hand_tracking"), xr_hand_modifier_3d.cpp:294',
      },
    },
  ],

  XRNode3D: [
    {
      at: 'xr_nodes.cpp:503',
      says: 'may not function as expected without an XROrigin3D parent',
      verdict: { rule: 'xrnode3d-parent-not-xrorigin3d' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:507',
      says: 'no tracker name is set',
      verdict: {
        declined: 'default-omitted',
        because: 'tracker_name field-initialises to "" (xr_nodes.h:81), which is the trigger itself',
      },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:511',
      says: 'no pose is set',
      verdict: { rule: 'xrnode3d-no-pose-set' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:515',
      says: 'should have physics_interpolation_mode OFF to avoid jitter',
      verdict: {
        declined: 'runtime-only',
        because: 'SceneTree::is_fti_enabled_in_project(), a project setting, xr_nodes.cpp:514',
      },
      gate: 'visible',
    },
  ],

  XROrigin3D: [
    {
      at: 'xr_nodes.cpp:695',
      says: 'requires an XRCamera3D child node',
      verdict: { rule: 'xrorigin3d-missing-camera-child' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:699',
      says: 'changing scale on XROrigin3D is not supported',
      verdict: { rule: 'xrorigin3d-unsupported-scale' },
      gate: 'visible',
    },
    {
      at: 'xr_nodes.cpp:705',
      says: 'XR shaders are not enabled in project settings',
      verdict: {
        declined: 'runtime-only',
        because: 'GLOBAL_GET("xr/shaders/enabled"), a project setting, unconditional outside the visibility gate, xr_nodes.cpp:704',
      },
    },
  ],
};

/**
 * Every row still in the `unimplemented` arm, by declaring class and source
 * line. Named rather than counted: a count says nothing when one gap is fixed
 * and another added in the same edit, and cannot distinguish a gap that became
 * a rule from one quietly re-typed to a decline.
 *
 * Down from 45 in one pass. The one that remains is close to permanent: Godot
 * decides `CSGShape3D`'s empty-or-non-manifold check from the combined boolean
 * brush (`csg_shape.cpp:981`, after `_get_brush()` folds the subtree at
 * `:453-511`), which no scene file describes. A narrower rule for a CSG leaf's
 * OWN degenerate geometry ships beside it, but that is a different condition
 * and is deliberately not credited to this row.
 */
const UNIMPLEMENTED_ROWS: readonly string[] = ['CSGShape3D csg_shape.cpp:982'];

/** Concrete, registered types a row applies to. */
function concreteHeirs(declaringClass: string, row?: WarningRow): string[] {
  const registered = nodeRegistry.getAllTypeNames();
  if (row?.appliesTo) return registered.filter((t) => row.appliesTo!.includes(t));
  return registered.filter((t) => t === declaringClass || descendsFrom(t, declaringClass));
}

function rulesEmitting(ruleName: string) {
  return ruleRegistry.getRules().filter((r) => r.meta.emits?.some((e) => e.ruleName === ruleName));
}

describe('Godot configuration-warning coverage', () => {
  it('every implemented row names a rule that actually emits it', () => {
    const missing: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('rule' in row.verdict)) continue;
        if (rulesEmitting(row.verdict.rule).length === 0) {
          missing.push(`${cls} ${row.at} claims '${row.verdict.rule}', which no registered rule emits`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  // A `get_configuration_warnings()` entry is advisory BY CONSTRUCTION: Godot
  // shows it in the editor dock and loads the scene regardless, so ADR-0032
  // puts every one of them at `warning` and none at `error`. That needs no
  // per-row data — it follows from the row being in this table at all.
  //
  // Without this, a row could claim `implemented` while its rule reported at a
  // tier the engine never justifies. PathFollow2D did exactly that, keeping
  // `error` after the PathFollow3D sibling was corrected, and every existing
  // check here passed: the rule existed, emitted the name and reached the type.
  it('every implemented row is reported at warning, never error', () => {
    const miscased: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('rule' in row.verdict)) continue;
        const ruleName = row.verdict.rule;
        for (const owner of rulesEmitting(ruleName)) {
          const emitted = owner.meta.emits?.find((e) => e.ruleName === ruleName);
          if (emitted && emitted.severity !== 'warning') {
            miscased.push(
              `${cls} ${row.at} '${ruleName}' is declared '${emitted.severity}' by ${owner.meta.name}; a configuration warning is advisory (ADR-0032)`
            );
          }
        }
      }
    }
    expect(miscased).toEqual([]);
  });

  it('every implemented row reaches every concrete heir of its declaring class', () => {
    const gaps: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('rule' in row.verdict)) continue;
        const heirs = concreteHeirs(cls, row);
        const owners = rulesEmitting(row.verdict.rule);
        const unreached = heirs.filter(
          (t) => !ruleRegistry.getRulesForNodeType(t).some((r) => owners.includes(r))
        );
        if (unreached.length > 0) {
          gaps.push(`${cls} ${row.at} '${row.verdict.rule}' never runs on ${unreached.join(', ')}`);
        }
      }
    }
    expect(gaps).toEqual([]);
  });

  it('every declaring class is reachable from a registered type', () => {
    const orphans = Object.keys(WARNINGS).filter((cls) => concreteHeirs(cls).length === 0);
    expect(orphans).toEqual([]);
  });

  it('every validator-covered row names a validator that resolves', () => {
    const missing: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('validator' in row.verdict)) continue;
        const [type = '', key = ''] = row.verdict.validator.split('.');
        if (!validatorRegistry.findValidator(type, key)) {
          missing.push(`${cls} ${row.at} points at ${row.verdict.validator}, which resolves nothing`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('every decline gives a reason that cites the engine', () => {
    const thin: string[] = [];
    for (const [cls, rows] of Object.entries(WARNINGS)) {
      for (const row of rows) {
        if (!('declined' in row.verdict)) continue;
        if (!/\.(cpp|h):\d+/.test(row.verdict.because)) {
          thin.push(`${cls} ${row.at}: "${row.verdict.because}" cites no source line`);
        }
      }
    }
    expect(thin).toEqual([]);
  });

  it('names exactly the rows still outstanding, not merely how many', () => {
    // The IDENTITIES, not a count. A bare integer cannot tell "a gap became a
    // rule" from "a gap was quietly re-typed to a decline", and says nothing at
    // all when one row is fixed while another is added in the same edit.
    // Pinning the `at` values makes every one of those show up as a diff here.
    const outstanding = Object.entries(WARNINGS)
      .flatMap(([cls, rows]) =>
        rows.filter((r) => 'unimplemented' in r.verdict).map((r) => `${cls} ${r.at}`)
      )
      .sort();
    expect(outstanding).toEqual(UNIMPLEMENTED_ROWS);
  });
});
