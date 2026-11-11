/**
 * The Polygon skin scene pass over the Live scene tree. A Polygon2D attaches the Skeleton2D its
 * `skeleton` path names when `invert_enabled` is off and `bones` is not empty
 * (`polygon_2d.cpp:127-132`), and each `bones` entry finds its Bone2D from the skeleton
 * (`polygon_2d.cpp:257-266`).
 */

import { describe, expect, it } from 'vitest';
import { TscnParser } from '../../../parser/TscnParser';
import { liveTreeOf } from '../../../r3f/liveSceneTree';
import { contextOver } from '../../../r3f/liveSceneTree.testkit';
import { bindPolygonsToSkeletons, type PolygonSkeletonBinding } from './skeletonBinding';
import './index';
import '../bone2d/index';
import '../skeleton2d/index';

const SKELETON = `[node name="Skeleton" type="Skeleton2D" parent="."]
[node name="Upper" type="Bone2D" parent="Skeleton"]
rest = Transform2D(1, 0, 0, 1, 0, 0)
[node name="Lower" type="Bone2D" parent="Skeleton/Upper"]
position = Vector2(100, 0)
rest = Transform2D(1, 0, 0, 1, 100, 0)
[node name="Free" type="Bone2D" parent="Skeleton/Upper/Lower"]
`;

const STRIP = `polygon = PackedVector2Array(0, 0, 100, 0, 100, 10)
skeleton = NodePath("../Skeleton")
`;

const UPPER_STRIP = `${STRIP}bones = [NodePath("Upper"), PackedFloat32Array(1, 1, 1)]`;

function scene(polygonProperties: string, skeleton = SKELETON): string {
  return `[gd_scene format=3]
[node name="Root" type="Node2D"]
${skeleton}
[node name="Poly" type="Polygon2D" parent="."]
${polygonProperties}
`;
}

function bindingOf(content: string): PolygonSkeletonBinding | undefined {
  const main = new TscnParser().parse(content);
  return bindPolygonsToSkeletons(liveTreeOf(main.nodes, contextOver(main, {}))).get('Root/Poly');
}

describe('bindPolygonsToSkeletons', () => {
  it('binds the Skeleton2D the polygon names', () => {
    expect(bindingOf(scene(UPPER_STRIP))?.skeletonPath).toBe('Root/Skeleton');
  });

  it('weights each vertex to the bone its entry names', () => {
    const binding = bindingOf(
      scene(
        `${STRIP}bones = [NodePath("Upper"), PackedFloat32Array(1, 0, 0), NodePath("Upper/Lower"), PackedFloat32Array(0, 1, 1)]`
      )
    );
    expect(Array.from(binding!.influences.bones.filter((_, i) => i % 4 === 0))).toEqual([0, 1, 1]);
  });

  it('counts the vertices after the internal ones the outline drops', () => {
    const binding = bindingOf(
      scene(`polygon = PackedVector2Array(0, 0, 100, 0, 100, 10, 50, 5)
skeleton = NodePath("../Skeleton")
internal_vertex_count = 1
bones = [NodePath("Upper"), PackedFloat32Array(1, 1, 1)]`)
    );
    expect(binding!.influences.weights).toHaveLength(12);
    expect(binding!.influences.weights[8]).toBe(1);
  });

  it('skips an entry that names no Bone2D, so its vertices keep no weight', () => {
    const binding = bindingOf(scene(`${STRIP}bones = [NodePath("Missing"), PackedFloat32Array(1, 1, 1)]`));
    expect(Array.from(binding!.influences.weights)).toEqual(new Array(12).fill(0));
  });

  it('binds nothing with invert_enabled on', () => {
    expect(bindingOf(scene(`${UPPER_STRIP}\ninvert_enabled = true`))).toBeUndefined();
  });

  it('binds nothing without bones', () => {
    expect(bindingOf(scene(STRIP))).toBeUndefined();
  });

  it('binds nothing where the path names a node that is not a Skeleton2D', () => {
    const binding = bindingOf(scene(UPPER_STRIP, '[node name="Skeleton" type="Node2D" parent="."]'));
    expect(binding).toBeUndefined();
  });
});
