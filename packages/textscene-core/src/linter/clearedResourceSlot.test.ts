/**
 * One invariant, over every resource slot a semantic rule branches on:
 *
 *   writing `key = null` must say exactly what omitting `key` says, and both
 *   must say the one thing the rule owes an empty slot.
 *
 * Both spellings reach a `Ref<T>` setter as an invalid Ref — `variant_parser.cpp:699`
 * reads the bare token as `Variant()`, and `variant.cpp:543` converts NIL to a null
 * object — so every `is_null()` / `!is_valid()` check in Godot answers the same for
 * the two. A rule that treats them differently is reporting a distinction the engine
 * does not make.
 *
 * The defect is uniform and easy to reintroduce: `'null'` is a TRUTHY string, so a
 * `!ref` or `ref === undefined` guard steps over it, and `checkResourceExists` then
 * deliberately answers `true` for a cleared slot — so the value falls through both
 * branches and nothing is reported. Twenty-five sites drifted this way one rule at a
 * time, which is why the rule is asserted here once rather than per slice.
 *
 * Each row therefore pins the LITERAL diagnostics, rule name and severity alike, that
 * both spellings must produce. Comparing the two runs to each other cannot see the
 * shared predicate failing open, because that silences both arms equally and the two
 * empty results still match; comparing each to a stated answer can. Severity is part
 * of that answer, since the inverse defect is a rule that INVENTS a dangling-reference
 * error for a slot the author cleared on purpose.
 *
 * The table's floor is derived, not declared: `SLOTS` must name every property the
 * shared predicates are asked about anywhere in `src`, so a slot cannot be swept
 * without also being answered for here.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lint, node, scene, subResource } from './testing/testkit.js';
import '../linter/index.js';

interface Slot {
  /** The source file, relative to `src`, whose call site this row answers for. */
  site: string;
  /** The node type under test. */
  type: string;
  /** The resource-slot property whose two spellings must agree. */
  prop: string;
  /** Other properties the rule is gated on (autoplay, a layer count, a sibling texture). */
  props?: Record<string, string | number | boolean>;
  /** A parent heading the node needs to be legal, and the node's `parent` path. */
  parent?: { block: string; path: string };
  /** Extra scene blocks, e.g. a sub-resource the accept case would reference. */
  extra?: string[];
  /**
   * `severity ruleName` per diagnostic, sorted: everything the empty slot owes,
   * and nothing else. `[]` states that silence is the answer.
   */
  expected: string[];
}

const staticBody3d = node('StaticBody3D', {}, { name: 'Body' });
const staticBody2d = node('StaticBody2D', {}, { name: 'Body' });

/** A decodable `tile_map_data`: the 2-byte format header plus one 12-byte cell record. */
const oneTile = 'PackedByteArray("AAAAAAAAAAAAAAAAAAA=")';

/** Attach one call site to the rows that answer for it. */
function at(site: string, rows: Omit<Slot, 'site'>[]): Slot[] {
  return rows.map((row) => ({ ...row, site }));
}

/**
 * Every slot the shared predicates are asked about, grouped by the call site that
 * asks. The expectations are measured from the rules, and the warnings among them
 * are the null-resource arm of that class's own `get_configuration_warnings()`.
 */
const SLOTS: Slot[] = [
  ...at('linter/physics/castLinterRule.ts', [
    { type: 'ShapeCast2D', prop: 'shape', expected: ['warning shapecast2d-missing-shape'] },
    { type: 'ShapeCast3D', prop: 'shape', expected: ['warning shapecast3d-missing-shape'] },
  ]),
  // The inverse defect: a cleared slot must not read as a dangling reference.
  ...at('linter/physics/collisionShapeLinterRule.ts', [
    {
      type: 'CollisionShape2D',
      prop: 'shape',
      parent: { block: staticBody2d, path: '.' },
      expected: ['warning collisionshape2d-requires-shape'],
    },
    {
      type: 'CollisionShape3D',
      prop: 'shape',
      parent: { block: staticBody3d, path: '.' },
      expected: ['warning collisionshape3d-requires-shape'],
    },
  ]),
  ...at('linter/physics/navigationRegionLinterRule.ts', [
    {
      type: 'NavigationRegion2D',
      prop: 'navigation_polygon',
      expected: ['warning navigationregion2d-requires-navigation-polygon'],
    },
    {
      type: 'NavigationRegion3D',
      prop: 'navigation_mesh',
      expected: ['warning navigationregion3d-requires-navigation-mesh'],
    },
  ]),
  ...at('nodes/2d/animatedsprite2d/linter.ts', [
    {
      type: 'AnimatedSprite2D',
      prop: 'sprite_frames',
      expected: ['warning animatedsprite2d-requires-spriteframes'],
    },
    {
      // `set_animation` ERR_FAILs and clears the name when frames is null
      // (animated_sprite_2d.cpp), so the named animation is an error, not advice.
      type: 'AnimatedSprite2D',
      prop: 'sprite_frames',
      props: { animation: '&"walk"' },
      expected: [
        'error animatedsprite2d-animation-no-spriteframes',
        'warning animatedsprite2d-requires-spriteframes',
      ],
    },
  ]),
  ...at('nodes/2d/lightoccluder2d/linter.ts', [
    { type: 'LightOccluder2D', prop: 'occluder', expected: ['warning lightoccluder2d-requires-occluder'] },
  ]),
  ...at('nodes/2d/particles/gpuparticles2d/linter.ts', [
    {
      type: 'GPUParticles2D',
      prop: 'process_material',
      expected: ['warning gpuparticles2d-missing-process-material'],
    },
  ]),
  ...at('nodes/2d/path2d/linter.ts', [
    { type: 'Path2D', prop: 'curve', expected: ['warning path2d-missing-curve'] },
  ]),
  ...at('nodes/2d/pointlight2d/linter.ts', [
    { type: 'PointLight2D', prop: 'texture', expected: ['warning pointlight2d-requires-texture'] },
  ]),
  ...at('nodes/2d/sprite2d/linter.ts', [
    { type: 'Sprite2D', prop: 'texture', expected: ['warning sprite2d-requires-texture'] },
  ]),
  ...at('nodes/2d/tiles/tilemap/linter.ts', [
    {
      type: 'TileMap',
      prop: 'tile_set',
      props: { 'layer_0/tile_data': 'PackedInt32Array(0, 0, 0)' },
      expected: ['warning tilemap-deprecated', 'warning tilemap-requires-tileset'],
    },
  ]),
  ...at('nodes/2d/tiles/tilemaplayer/linter.ts', [
    {
      type: 'TileMapLayer',
      prop: 'tile_set',
      props: { tile_map_data: oneTile },
      expected: ['warning tilemaplayer-requires-tileset'],
    },
  ]),
  ...at('nodes/2d/ui/basebutton/linter.ts', [
    {
      // Silence is the whole answer, and it bites: `toggle_mode` defaults false on a
      // plain Button, so a predicate that read `null` as a group would warn here.
      type: 'Button',
      prop: 'button_group',
      expected: [],
    },
  ]),
  ...at('nodes/3d/animatedsprite3d/linter.ts', [
    {
      type: 'AnimatedSprite3D',
      prop: 'sprite_frames',
      expected: ['warning animatedsprite3d-requires-spriteframes'],
    },
    {
      type: 'AnimatedSprite3D',
      prop: 'sprite_frames',
      props: { animation: '&"walk"' },
      expected: [
        'error animatedsprite3d-animation-no-spriteframes',
        'warning animatedsprite3d-requires-spriteframes',
      ],
    },
  ]),
  ...at('nodes/3d/csg/linter.ts', [
    { type: 'CSGMesh3D', prop: 'mesh', expected: ['warning csgmesh3d-requires-mesh'] },
  ]),
  // One texture slot per Decal row: each is separately capable of standing in for
  // "has a texture", so each has to be seen as empty on its own.
  ...at('nodes/3d/decal/linter.ts', [
    { type: 'Decal', prop: 'texture_albedo', expected: ['warning decal-requires-texture'] },
    { type: 'Decal', prop: 'texture_normal', expected: ['warning decal-requires-texture'] },
    { type: 'Decal', prop: 'texture_orm', expected: ['warning decal-requires-texture'] },
    { type: 'Decal', prop: 'texture_emission', expected: ['warning decal-requires-texture'] },
  ]),
  ...at('nodes/3d/gridmap/linter.ts', [
    { type: 'GridMap', prop: 'mesh_library', expected: ['warning gridmap-requires-mesh-library'] },
  ]),
  ...at('nodes/3d/occluderinstance3d/linter.ts', [
    {
      type: 'OccluderInstance3D',
      prop: 'occluder',
      expected: ['warning occluderinstance3d-missing-occluder'],
    },
  ]),
  ...at('nodes/3d/particles/cpuparticles3d/linter.ts', [
    { type: 'CPUParticles3D', prop: 'mesh', expected: ['warning cpuparticles3d-requires-mesh'] },
  ]),
  // Every draw pass, not just the first: an empty pass is what Godot writes for an
  // index below the count, so each index has to read as empty rather than dangling.
  ...at('nodes/3d/particles/gpuparticles3d/linter.ts', [
    ...['process_material', 'draw_pass_1', 'draw_pass_2', 'draw_pass_3', 'draw_pass_4'].map(
      (prop) => ({
        type: 'GPUParticles3D',
        prop,
        expected: [
          'warning gpuparticles3d-missing-process-material',
          'warning gpuparticles3d-no-draw-pass-mesh',
        ],
      })
    ),
  ]),
  ...at('nodes/3d/sprite3d/linter.ts', [
    { type: 'Sprite3D', prop: 'texture', expected: ['warning sprite3d-requires-texture'] },
  ]),
  ...at('nodes/3d/voxelgi/linter.ts', [
    { type: 'VoxelGI', prop: 'data', expected: ['warning voxelgi-missing-data'] },
  ]),
  // Both slots answer with the same warning: it is a conjunction over the two
  // (world_environment.cpp:187), so clearing either one leaves both empty here.
  ...at('nodes/3d/worldenvironment/linter.ts', [
    {
      type: 'WorldEnvironment',
      prop: 'environment',
      expected: ['warning worldenvironment-requires-environment'],
    },
    {
      type: 'WorldEnvironment',
      prop: 'camera_attributes',
      expected: ['warning worldenvironment-requires-environment'],
    },
  ]),
  ...at('nodes/animation/animationtree/linter.ts', [
    { type: 'AnimationTree', prop: 'tree_root', expected: ['warning animationtree-missing-tree-root'] },
  ]),
  ...at('nodes/audio/audiostreamplayer/linter.ts', [
    {
      type: 'AudioStreamPlayer',
      prop: 'stream',
      props: { autoplay: true },
      expected: ['warning audiostreamplayer-autoplay-without-stream'],
    },
  ]),
  ...at('nodes/audio/audiostreamplayer2d/linter.ts', [
    {
      type: 'AudioStreamPlayer2D',
      prop: 'stream',
      props: { autoplay: true },
      expected: ['warning audiostreamplayer2d-autoplay-without-stream'],
    },
  ]),
  ...at('nodes/audio/audiostreamplayer3d/linter.ts', [
    {
      // No autoplay arm on this twin, deliberately: the slice takes an empty
      // stream as the serialised default and audio_stream_player_3d.cpp
      // declares no configuration warning for it. The row is here for the
      // dangling-reference arm and to keep the sweep's coverage total honest.
      type: 'AudioStreamPlayer3D',
      prop: 'stream',
      props: { autoplay: true },
      expected: [],
    },
  ]),
  ...at('nodes/paths/path3d/linter.ts', [
    { type: 'Path3D', prop: 'curve', expected: ['warning path3d-requires-curve'] },
  ]),
  ...at('nodes/physics/3d/softbody3d/linter.ts', [
    { type: 'SoftBody3D', prop: 'mesh', expected: ['warning valid-softbody3d-mesh'] },
  ]),
];

/** The scene for one slot, with the property absent or explicitly cleared. */
function sceneFor(slot: Slot, value: 'absent' | 'null'): string {
  const props = { ...(slot.props ?? {}) };
  if (value === 'null') props[slot.prop] = 'null';
  const heading = node(slot.type, props, slot.parent ? { parent: slot.parent.path } : {});
  const blocks = [...(slot.extra ?? [])];
  if (slot.parent) blocks.push(slot.parent.block);
  blocks.push(heading);
  return scene(...blocks);
}

/** Rule name + severity per diagnostic, sorted — the comparable shape of a lint result. */
function shapeOf(content: string): string[] {
  return lint(content)
    .map((d) => `${d.severity} ${d.ruleName}`)
    .sort();
}

const SRC = join(import.meta.dirname, '..');
/** Where the predicates live: its own calls are the definition, not a slot. */
const PREDICATE_MODULE = 'linter/resourceChecker.ts';
const HELPER_CALL_RE = /\b(?:resourceSlotIsEmpty|heldResource)\(([^()]*)\)/g;
/** The same calls counted without their argument, so one the pair above cannot bracket is still seen. */
const HELPER_OPENER_RE = /\b(?:resourceSlotIsEmpty|heldResource)\(/g;
const DOT_KEY_RE = /\.([A-Za-z_$][\w$]*)\s*$/;
const QUOTED_KEY_RE = /\[\s*['"]([^'"]+)['"]\s*\]\s*$/;
const COMPUTED_KEY_RE = /\[\s*([A-Za-z_$][\w$]*)\s*\]\s*$/;
/** A `.tscn` property key, which is how a resolved literal is told from a stray one. */
const PROPERTY_KEY_RE = /^[a-z][a-z0-9_]*$/;

/** Every non-test source file under `src`, relative to it. */
function sourceFiles(dir: string = SRC): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      found.push(relative(SRC, full));
    }
  }
  return found;
}

/** The `.tscn` property keys among an expression's string literals, ascending. */
function keyLiterals(expression: string): string[] {
  return [...expression.matchAll(/['"]([^'"]*)['"]/g)]
    .map((m) => m[1]!)
    .filter((key) => PROPERTY_KEY_RE.test(key))
    .sort();
}

/**
 * The property keys a source-level identifier stands for.
 *
 * Follows the binding back to the literals: a `const` whose initialiser holds them
 * (an array of keys, or a ternary between two), or a name bound over such a const by
 * a `for`-`of` or an array callback, one derivation at a time.
 */
function keysBehind(source: string, identifier: string, hops = 0): string[] {
  if (hops > 3) return [];
  const initialiser = new RegExp(`\\bconst\\s+${identifier}\\s*=\\s*([^;]+);`).exec(source)?.[1];
  if (initialiser !== undefined) {
    const literals = keyLiterals(initialiser);
    if (literals.length > 0) return literals;
    // Derived from another list, e.g. `KEYS.filter(...)`: follow the receiver.
    const receiver = /^\s*(\w+)\s*\./.exec(initialiser)?.[1];
    return receiver ? keysBehind(source, receiver, hops + 1) : [];
  }
  const boundOver =
    new RegExp(`\\bfor\\s*\\(\\s*const\\s+${identifier}\\s+of\\s+(\\w+)`).exec(source)?.[1] ??
    new RegExp(`(\\w+)\\.\\w+\\(\\s*\\(?\\s*${identifier}\\s*\\)?\\s*=>`).exec(source)?.[1];
  return boundOver ? keysBehind(source, boundOver, hops + 1) : [];
}

/**
 * Every `<file> <prop>` the shared predicates are asked about, plus the call sites
 * whose argument could not be read back to a property key. An unreadable site is a
 * failure and not a skip: a slot that hides from this scan is exactly the slot that
 * would go un-answered below.
 */
function sweptSlots(): { slots: string[]; unreadable: string[] } {
  const slots = new Set<string>();
  const unreadable: string[] = [];
  for (const file of sourceFiles()) {
    if (file === PREDICATE_MODULE) continue;
    const source = readFileSync(join(SRC, file), 'utf8');
    let bracketed = 0;
    for (const [call, rawArg] of source.matchAll(HELPER_CALL_RE)) {
      bracketed++;
      const arg = rawArg!.trim();
      const literal = DOT_KEY_RE.exec(arg) ?? QUOTED_KEY_RE.exec(arg);
      const computed = COMPUTED_KEY_RE.exec(arg);
      const keys = literal ? [literal[1]!] : computed ? keysBehind(source, computed[1]!) : [];
      if (keys.length === 0) unreadable.push(`${file}: ${call}`);
      for (const key of keys) slots.add(`${file} ${key}`);
    }
    // Counted separately because a call whose argument nests parentheses does not
    // match the pair above AT ALL: it would be skipped in silence rather than
    // reported unreadable, which is the one way past this floor.
    const opened = [...source.matchAll(HELPER_OPENER_RE)].length;
    if (opened !== bracketed) {
      unreadable.push(`${file}: ${opened - bracketed} call(s) whose argument this scan cannot bracket`);
    }
  }
  return { slots: [...slots].sort(), unreadable };
}

describe('an explicitly cleared resource slot reads as an empty one', () => {
  it.each(SLOTS.map((s) => [`${s.type}.${s.prop}`, s] as const))(
    '%s = null says what omitting it says, and both say what the rule owes',
    (_label, slot) => {
      expect(shapeOf(sceneFor(slot, 'null'))).toEqual(slot.expected);
      expect(shapeOf(sceneFor(slot, 'absent'))).toEqual(slot.expected);
    }
  );

  it('answers for every slot the shared predicates are asked about', () => {
    const rows = [...new Set(SLOTS.map((s) => `${s.site} ${s.prop}`))].sort();
    expect(sweptSlots().slots).toEqual(rows);
  });

  it('reads every call site, so none can hide behind an argument this scan cannot follow', () => {
    expect(sweptSlots().unreadable).toEqual([]);
  });

  it('still reports a slot that names a resource nothing declares', () => {
    // The point is not silence. A dangling id is still an error — only the
    // deliberate `null` is exempt.
    const dangling = scene(
      staticBody3d,
      node('CollisionShape3D', { shape: 'SubResource("nope_1")' }, { parent: '.' })
    );
    expect(shapeOf(dangling).some((s) => s.startsWith('error '))).toBe(true);
  });

  it('still resolves a slot that names a declared resource', () => {
    const resolved = scene(
      subResource('BoxShape3D', {}, 'shape_1'),
      staticBody3d,
      node('CollisionShape3D', { shape: 'SubResource("shape_1")' }, { parent: '.' })
    );
    expect(shapeOf(resolved)).toEqual([]);
  });
});
