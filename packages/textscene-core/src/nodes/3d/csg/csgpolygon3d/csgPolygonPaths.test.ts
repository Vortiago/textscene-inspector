/**
 * The `path_node` pass has to handle both shapes the corpus actually writes, and they
 * point in opposite directions: `csg.tscn`'s Road names a SIBLING (`../Path3D`) while
 * `racetrack_csg.tscn` names a CHILD (`Path3D`). A resolver that assumed either one
 * would silently drop the other's geometry.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { TscnParser } from '../../../../parser/TscnParser';
import { resolveCsgPolygonPaths } from './csgPolygonPaths';
import * as logger from '../../../../logger';
import type { CSGPolygon3DProperties } from '../../../../nodes/3d/csg/csgpolygon3d/types';
import type { TscnNode } from '../../../../parser/types';

const CURVE = `[sub_resource type="Curve3D" id="Curve3D_road"]
_data = {
"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -4, 0, 0, 0, 0, 0, 0, 3, 0, -6),
"tilts": PackedFloat32Array(0, 0, 0)
}
point_count = 3`;

function parse(body: string) {
  const scene = new TscnParser().parse(`[gd_scene load_steps=2 format=3]\n\n${CURVE}\n\n${body}\n`);
  return resolveCsgPolygonPaths(scene.nodes, scene.internalResources);
}

function find(nodes: TscnNode[], name: string): TscnNode | undefined {
  for (const node of nodes) {
    if (node.name === name) return node;
    const hit = find(node.children, name);
    if (hit) return hit;
  }
  return undefined;
}

function resolvedOf(nodes: TscnNode[], name: string) {
  return (find(nodes, name)!.properties as CSGPolygon3DProperties).resolvedPath;
}

/** The Road shape: a CSGPolygon3D and its Path3D as siblings under a holder. */
const SIBLING_SCENE = `[node name="Root" type="Node3D"]

[node name="Road" type="Node3D" parent="."]

[node name="RoadTop" type="CSGPolygon3D" parent="Road"]
mode = 2
path_node = NodePath("../Path3D")
path_local = true

[node name="Path3D" type="Path3D" parent="Road"]
curve = SubResource("Curve3D_road")`;

/** The racetrack shape: the Path3D is a CHILD of the polygon. */
const CHILD_SCENE = `[node name="Root" type="Node3D"]

[node name="Racetrack" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("Path3D")
path_local = true

[node name="Path3D" type="Path3D" parent="Racetrack"]
curve = SubResource("Curve3D_road")`;

describe('resolveCsgPolygonPaths', () => {
  afterEach(() => vi.restoreAllMocks());

  /** A polygon addressing its Path3D by unique name from an unrelated branch. */
  const UNIQUE_SCENE = `[node name="Root" type="Node3D"]

[node name="Holder" type="Node3D" parent="."]

[node name="Racetrack" type="CSGPolygon3D" parent="Holder"]
mode = 2
path_node = NodePath("%Track")
path_local = true

[node name="Elsewhere" type="Node3D" parent="."]

[node name="Path3D" type="Path3D" parent="Elsewhere"]
unique_name_in_owner = true
curve = SubResource("Curve3D_road")`;

  it('resolves a %UniqueName path_node', () => {
    const scene = UNIQUE_SCENE.replace('name="Path3D" type="Path3D"', 'name="Track" type="Path3D"');
    const resolved = resolvedOf(parse(scene), 'Racetrack');
    expect(resolved).toBeDefined();
    expect(resolved!.curvePoints).toHaveLength(3);
  });

  it('warns with the literal when no node claims the unique name', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    resolvedOf(parse(UNIQUE_SCENE), 'Racetrack');
    expect(warn).toHaveBeenCalledTimes(1);
    // The literal as written: a resolved path would be a name no node can hold.
    expect(warn.mock.calls[0]![0]).toContain('%Track');
    expect(warn.mock.calls[0]![0]).not.toContain('Holder/Racetrack/%Track');
  });

  it('resolves a SIBLING path_node (csg.tscn:365, the Road)', () => {
    const resolved = resolvedOf(parse(SIBLING_SCENE), 'RoadTop');
    expect(resolved).toBeDefined();
    expect(resolved!.curvePoints).toHaveLength(3);
  });

  it('resolves a CHILD path_node (racetrack_csg.tscn:60)', () => {
    const resolved = resolvedOf(parse(CHILD_SCENE), 'Racetrack');
    expect(resolved).toBeDefined();
    expect(resolved!.curvePoints).toHaveLength(3);
  });

  it('leaves baseTransform null when path_local is on', () => {
    expect(resolvedOf(parse(SIBLING_SCENE), 'RoadTop')!.baseTransform).toBeNull();
  });

  it('supplies the Path3D’s GLOBAL transform when path_local is off', () => {
    // Godot uses the path's global frame as the sweep's base. The holder's translation
    // must therefore compose into the result, not just the Path3D's own.
    const scene = `[node name="Root" type="Node3D"]

[node name="Road" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 10, 0, 0)

[node name="RoadTop" type="CSGPolygon3D" parent="Road"]
mode = 2
path_node = NodePath("../Path3D")
path_local = false

[node name="Path3D" type="Path3D" parent="Road"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 5, 0)
curve = SubResource("Curve3D_road")`;
    const base = resolvedOf(parse(scene), 'RoadTop')!.baseTransform;
    expect(base).not.toBeNull();
    expect(base!.origin.x).toBeCloseTo(10, 5);
    expect(base!.origin.y).toBeCloseTo(5, 5);
  });

  it('ignores a path_node that points at something other than a Path3D', () => {
    const scene = `[node name="Root" type="Node3D"]

[node name="Poly" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("../Decoy")

[node name="Decoy" type="Node3D" parent="."]`;
    expect(resolvedOf(parse(scene), 'Poly')).toBeUndefined();
  });

  it('ignores an unresolvable path_node', () => {
    const scene = `[node name="Root" type="Node3D"]

[node name="Poly" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("../Nowhere")`;
    expect(resolvedOf(parse(scene), 'Poly')).toBeUndefined();
  });

  it('ignores a Path3D whose curve has fewer than two points', () => {
    const scene = `[gd_scene load_steps=2 format=3]

[sub_resource type="Curve3D" id="Curve3D_stub"]
_data = {
"points": PackedVector3Array(0, 0, 0, 0, 0, 0, 0, 0, 0),
"tilts": PackedFloat32Array(0)
}
point_count = 1

[node name="Root" type="Node3D"]

[node name="Poly" type="CSGPolygon3D" parent="."]
mode = 2
path_node = NodePath("Path3D")

[node name="Path3D" type="Path3D" parent="Poly"]
curve = SubResource("Curve3D_stub")`;
    const parsed = new TscnParser().parse(scene);
    resolveCsgPolygonPaths(parsed.nodes, parsed.internalResources);
    expect(resolvedOf(parsed.nodes, 'Poly')).toBeUndefined();
  });

  // `Curve3D::set_point_count` drops the tail after `_data` loads (curve.cpp:1455-1456),
  // so the sweep follows two points, not the three `_data` lists.
  it('sweeps only the points point_count keeps', () => {
    const truncated = CURVE.replace('point_count = 3', 'point_count = 2');
    const parsed = new TscnParser().parse(
      `[gd_scene load_steps=2 format=3]\n\n${truncated}\n\n${CHILD_SCENE}\n`
    );
    resolveCsgPolygonPaths(parsed.nodes, parsed.internalResources);
    expect(resolvedOf(parsed.nodes, 'Racetrack')!.curvePoints).toHaveLength(2);
  });

  // `Curve3D::_set_data` refuses a `_data` without "tilts" (curve.cpp:2280), and
  // `point_count = 3` then appends three origin points to the empty list
  // (curve.cpp:1459-1460): the sweep follows no authored point.
  it('sweeps only origin points when the curve has no "tilts"', () => {
    const noTilts = CURVE.replace(',\n"tilts": PackedFloat32Array(0, 0, 0)', '');
    const parsed = new TscnParser().parse(
      `[gd_scene load_steps=2 format=3]\n\n${noTilts}\n\n${CHILD_SCENE}\n`
    );
    resolveCsgPolygonPaths(parsed.nodes, parsed.internalResources);
    const positions = resolvedOf(parsed.nodes, 'Racetrack')!.curvePoints.map((p) => p.position);
    expect(positions).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ]);
  });

  it('does not touch polygons that are not in PATH mode', () => {
    const scene = `[node name="Root" type="Node3D"]

[node name="Poly" type="CSGPolygon3D" parent="."]
path_node = NodePath("Path3D")

[node name="Path3D" type="Path3D" parent="Poly"]
curve = SubResource("Curve3D_road")`;
    expect(resolvedOf(parse(scene), 'Poly')).toBeUndefined();
  });

  it('is idempotent', () => {
    const scene = new TscnParser().parse(
      `[gd_scene load_steps=2 format=3]\n\n${CURVE}\n\n${SIBLING_SCENE}\n`
    );
    resolveCsgPolygonPaths(scene.nodes, scene.internalResources);
    const first = resolvedOf(scene.nodes, 'RoadTop');
    resolveCsgPolygonPaths(scene.nodes, scene.internalResources);
    const second = resolvedOf(scene.nodes, 'RoadTop');
    expect(second).toEqual(first);
  });

  it('clears a stale resolvedPath when the path_node stops resolving', () => {
    // The pass mutates in place, so a node that resolved before an edit must not
    // keep its old curve once the edit points it somewhere else.
    const nodes = parse(SIBLING_SCENE);
    const poly = find(nodes, 'RoadTop')!.properties as CSGPolygon3DProperties;
    expect(poly.resolvedPath).toBeDefined();
    poly.pathNode = 'NodePath("../Nowhere")';
    resolveCsgPolygonPaths(nodes, []);
    expect(poly.resolvedPath).toBeUndefined();
  });
});
