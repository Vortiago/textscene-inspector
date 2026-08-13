/**
 * One invariant, over every resource slot a semantic rule branches on:
 *
 *   writing `key = null` must say exactly what omitting `key` says.
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
 * Severity is compared too, not just the rule names: the inverse defect is a rule
 * that INVENTS a dangling-reference error for a slot the author cleared on purpose.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene, subResource } from './testing/testkit.js';
import '../linter/index.js';

interface Slot {
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
}

const staticBody3d = node('StaticBody3D', {}, { name: 'Body' });
const staticBody2d = node('StaticBody2D', {}, { name: 'Body' });

/**
 * Every slot the sweep found. Grouped by the guard shape that produced the
 * defect, because the two need different predicates to stay fixed.
 */
const SLOTS: Slot[] = [
  // `=== undefined` guards: `'null'` is defined, so the branch is skipped.
  { type: 'ShapeCast2D', prop: 'shape' },
  { type: 'ShapeCast3D', prop: 'shape' },
  { type: 'PointLight2D', prop: 'texture' },
  { type: 'OccluderInstance3D', prop: 'occluder' },
  { type: 'AudioStreamPlayer', prop: 'stream', props: { autoplay: true } },
  { type: 'AudioStreamPlayer2D', prop: 'stream', props: { autoplay: true } },

  // Falsy guards: `'null'` is truthy, so the branch is skipped.
  { type: 'NavigationRegion2D', prop: 'navigation_polygon' },
  { type: 'NavigationRegion3D', prop: 'navigation_mesh' },
  { type: 'GPUParticles3D', prop: 'process_material' },
  { type: 'GPUParticles2D', prop: 'process_material' },
  { type: 'LightOccluder2D', prop: 'occluder' },
  { type: 'CSGMesh3D', prop: 'mesh' },
  { type: 'SoftBody3D', prop: 'mesh' },
  { type: 'VoxelGI', prop: 'data' },
  { type: 'AnimatedSprite2D', prop: 'sprite_frames' },
  { type: 'AnimatedSprite2D', prop: 'sprite_frames', props: { animation: '&"walk"' } },
  { type: 'AnimatedSprite3D', prop: 'sprite_frames' },
  { type: 'AnimatedSprite3D', prop: 'sprite_frames', props: { animation: '&"walk"' } },
  { type: 'Path2D', prop: 'curve' },
  { type: 'Path3D', prop: 'curve' },
  { type: 'Sprite2D', prop: 'texture' },
  { type: 'Sprite3D', prop: 'texture' },
  { type: 'GridMap', prop: 'mesh_library' },
  { type: 'CPUParticles3D', prop: 'mesh' },
  { type: 'TileMapLayer', prop: 'tile_set', props: { tile_map_data: 'PackedByteArray("AAAAAA==")' } },
  { type: 'Decal', prop: 'texture_albedo' },
  // The albedo-less pairing: a cleared normal slot is not a set one.
  { type: 'Decal', prop: 'texture_normal' },

  // The inverse defect: a cleared slot must not read as a dangling reference.
  {
    type: 'CollisionShape2D',
    prop: 'shape',
    parent: { block: staticBody2d, path: '.' },
  },
  {
    type: 'CollisionShape3D',
    prop: 'shape',
    parent: { block: staticBody3d, path: '.' },
  },
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

describe('an explicitly cleared resource slot reads as an empty one', () => {
  it.each(SLOTS.map((s) => [`${s.type}.${s.prop}`, s] as const))(
    '%s = null says what omitting it says',
    (_label, slot) => {
      expect(shapeOf(sceneFor(slot, 'null'))).toEqual(shapeOf(sceneFor(slot, 'absent')));
    }
  );

  it('covers every slot the sweep found, so a shrunk table cannot pass vacuously', () => {
    expect(SLOTS.length).toBeGreaterThanOrEqual(29);
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
