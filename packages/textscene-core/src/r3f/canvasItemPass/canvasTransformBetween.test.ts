/**
 * The transform of a skipped chain of the canvas item pass. The rest of what the chain hands down
 * comes from the pass itself.
 */
import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene } from '../../parser/types';
import { liveTreeOf } from '../liveSceneTree';
import { contextOver } from '../liveSceneTree.testkit';
import { canvasItemPass } from './canvasItemPass';
import { canvasTransformBetween } from './canvasTransformBetween';
import '../nodes/index';

function sceneOf(body: string): TscnScene {
  return new TscnParser().parse(`[gd_scene format=3]\n\n${body}`);
}

function between(scene: TscnScene, above: string | null, itemParent: string) {
  const results = canvasItemPass(liveTreeOf(scene.nodes, contextOver(scene, {})));
  return canvasTransformBetween(results, above, itemParent);
}

const IDENTITY = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/** A root `Root` with `Outer`, then `Inner`, below it, each with its own lines. */
function chainUnderRoot(outer: string, inner: string): TscnScene {
  return sceneOf(`[node name="Root" type="Node2D"]
position = Vector2(1000, 1000)

[node name="Outer" type="Node2D" parent="."]
${outer}

[node name="Inner" type="Node2D" parent="Outer"]
${inner}
`);
}

describe('canvasTransformBetween', () => {
  it('composes the transforms outermost first, and stops below `above`', () => {
    const scene = chainUnderRoot(
      `position = Vector2(100, 0)\nrotation = ${Math.PI / 2}`,
      'position = Vector2(10, 0)'
    );
    const transform = between(scene, 'Root', 'Root/Outer/Inner');
    // Inner's origin (10, 0) turns a quarter to (0, 10), then moves by (100, 0).
    expect(transform.tx).toBeCloseTo(100, 5);
    expect(transform.ty).toBeCloseTo(10, 5);
    expect(transform.c).toBeCloseTo(-1, 5);
  });

  it('adds no transform for a Control link, whose solved rect the caller composes', () => {
    const scene = sceneOf(`[node name="Root" type="Node2D"]

[node name="Link" type="Control" parent="."]
offset_left = 300.0
offset_top = 200.0
`);
    expect(between(scene, null, 'Root/Link')).toEqual(IDENTITY);
  });

  it('starts the chain at a `top_level` link, leaving out the links above it', () => {
    const scene = sceneOf(`[node name="Root" type="Node2D"]

[node name="Tinted" type="Node2D" parent="."]
position = Vector2(300, 200)

[node name="Top" type="Node2D" parent="Tinted"]
top_level = true
position = Vector2(50, 60)
`);
    expect(between(scene, null, 'Root/Tinted/Top')).toMatchObject({ tx: 50, ty: 60 });
  });

  it('gives the identity for a parent that is `above`', () => {
    const scene = chainUnderRoot('position = Vector2(5, 5)', '');
    expect(between(scene, 'Root/Outer', 'Root/Outer')).toEqual(IDENTITY);
  });
});
