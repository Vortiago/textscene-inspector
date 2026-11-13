/**
 * The fold of a skipped chain from the canvas item pass. The y-sort lift folds below the sort
 * root, whose material a deferring chain takes. The Control walker folds below the Control above,
 * or from a chain start, which defers to nothing unless it is a root of the tree.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene } from '../../parser/types';
import { liveTreeOf } from '../liveSceneTree';
import { contextOver } from '../liveSceneTree.testkit';
import { canvasItemPass } from './canvasItemPass';
import { canvasStateBetween } from './canvasStateBetween';
import '../nodes/index';

const MATERIALS = `[sub_resource type="CanvasItemMaterial" id="add"]
blend_mode = 1

[sub_resource type="CanvasItemMaterial" id="mul"]
blend_mode = 3
`;

function sceneOf(body: string): TscnScene {
  return new TscnParser().parse(`[gd_scene format=3]\n\n${MATERIALS}\n${body}`);
}

function between(scene: TscnScene, above: string | null, itemParent: string) {
  const results = canvasItemPass(liveTreeOf(scene.nodes, contextOver(scene, {})));
  return canvasStateBetween(results, above, itemParent);
}

/** A sort root `Root` with `Outer`, then `Inner`, below it, each with its own lines. */
function chainUnderRoot(outer: string, inner: string): TscnScene {
  return sceneOf(`[node name="Root" type="Node2D"]
material = SubResource("mul")

[node name="Outer" type="Node2D" parent="."]
${outer}

[node name="Inner" type="Node2D" parent="Outer"]
${inner}
`);
}

describe('canvasStateBetween', () => {
  it('composes the transforms outermost first, and stops below `above`', () => {
    const scene = chainUnderRoot(
      `position = Vector2(100, 0)\nrotation = ${Math.PI / 2}`,
      'position = Vector2(10, 0)'
    );
    const { transform } = between(scene, 'Root', 'Root/Outer/Inner');
    // Inner's origin (10, 0) turns a quarter to (0, 10), then moves by (100, 0).
    expect(transform.tx).toBeCloseTo(100, 5);
    expect(transform.ty).toBeCloseTo(10, 5);
    expect(transform.c).toBeCloseTo(-1, 5);
  });

  it('multiplies each modulate and never a self_modulate', () => {
    const scene = chainUnderRoot(
      'modulate = Color(0.5, 1, 1, 1)\nself_modulate = Color(0, 0, 0, 0)',
      'modulate = Color(1, 0.5, 1, 0.5)'
    );
    expect(between(scene, 'Root', 'Root/Outer/Inner').modulate).toEqual({ r: 0.5, g: 0.5, b: 1, a: 0.5 });
  });

  it('lists each z step outermost first, so an absolute step can restart the sum', () => {
    const scene = chainUnderRoot('z_index = 3', 'z_index = -2\nz_as_relative = false');
    expect(between(scene, 'Root', 'Root/Outer/Inner').z).toEqual([
      { zIndex: 3, zAsRelative: true },
      { zIndex: -2, zAsRelative: false },
    ]);
  });

  it('lets the innermost link that names a filter or repeat win', () => {
    const scene = chainUnderRoot('texture_filter = 1\ntexture_repeat = 3', 'texture_filter = 2');
    expect(between(scene, 'Root', 'Root/Outer/Inner').sampler).toEqual({ filter: 2, repeat: 3 });
  });

  it("reads a Control link's z, sampler and material, which its parse holds in camel case", () => {
    const scene = sceneOf(`[node name="Root" type="Node2D"]

[node name="Outer" type="Node2D" parent="."]
material = SubResource("add")

[node name="Link" type="Control" parent="Outer"]
z_index = 2
z_as_relative = false
texture_filter = 1
texture_repeat = 2
use_parent_material = true
`);
    const folded = between(scene, 'Root', 'Root/Outer/Link');
    expect(folded.z).toEqual([
      { zIndex: 0, zAsRelative: true },
      { zIndex: 2, zAsRelative: false },
    ]);
    expect(folded.sampler).toEqual({ filter: 1, repeat: 2 });
    expect(folded.material).toMatchObject({ kind: 'own', ref: 'SubResource("add")' });
  });

  it.each([
    ['the innermost own material', 'material = SubResource("mul")', 'material = SubResource("add")', 'own'],
    [
      'the material above a `use_parent_material` link',
      'material = SubResource("add")',
      'use_parent_material = true',
      'own',
    ],
    ['no material when the innermost link names none', 'material = SubResource("add")', '', 'none'],
    [
      "the sort root's material when every link defers",
      'use_parent_material = true',
      'use_parent_material = true',
      'inherit',
    ],
  ])('hands a `use_parent_material` item %s', (_, outer, inner, kind) => {
    const material = between(chainUnderRoot(outer, inner), 'Root', 'Root/Outer/Inner').material;
    expect(material.kind).toBe(kind);
    if (material.kind === 'own') expect(material.ref).toBe('SubResource("add")');
  });

  it('defers to nothing from a chain that starts below a node that is no canvas item', () => {
    const scene = sceneOf(`[node name="Root" type="Control"]

[node name="Group" type="Node" parent="."]

[node name="Item" type="Node2D" parent="Group"]
use_parent_material = true
`);
    expect(between(scene, 'Root', 'Root/Group/Item').material).toEqual({ kind: 'none' });
  });

  it('starts the chain at a `top_level` link, leaving out the links above it', () => {
    const scene = sceneOf(`[node name="Root" type="Node2D"]

[node name="Tinted" type="Node2D" parent="."]
position = Vector2(300, 200)
modulate = Color(0.2, 0.4, 0.9, 1)
use_parent_material = true

[node name="Top" type="Node2D" parent="Tinted"]
top_level = true
position = Vector2(50, 60)
use_parent_material = true
`);
    expect(between(scene, null, 'Root/Tinted/Top')).toMatchObject({
      transform: { tx: 50, ty: 60 },
      modulate: { r: 1, g: 1, b: 1, a: 1 },
      material: { kind: 'none' },
    });
  });

  it('gives the empty chain for a parent that is `above`', () => {
    const scene = chainUnderRoot('modulate = Color(0, 0, 0, 1)', '');
    expect(between(scene, 'Root/Outer', 'Root/Outer')).toMatchObject({
      z: [],
      material: { kind: 'inherit' },
    });
  });
});
