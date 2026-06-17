import { describe, it, expect } from 'vitest';
import { mergeInstanceRoot } from './mergeInstanceRoot';
import type { TscnNode } from '../parser/types';
// Register the real GridMap + Camera3D parsers so the merge can re-parse a
// type-specific instance override against the instanced root's type.
import '../nodes/3d/gridmap/index';
import '../nodes/3d/camera3d/index';
import type { GridMapProperties } from '../nodes/3d/gridmap/types';
import type { Camera3DProperties } from '../nodes/3d/camera3d/types';

function node(
  partial: Partial<TscnNode> & { name: string; type: string }
): TscnNode {
  return { children: [], properties: {}, ...partial };
}

describe('mergeInstanceRoot', () => {
  it('collapses a single-root .tscn so the instance node adopts the root type and children', () => {
    const instanceNode = node({
      name: 'Coin1',
      type: 'Node',
      instance: 'ExtResource("2_chew2")',
    });
    const root = node({
      name: 'Coin',
      type: 'Area3D',
      children: [node({ name: 'Circle', type: 'MeshInstance3D' })],
    });

    const merged = mergeInstanceRoot(instanceNode, { nodes: [root] });

    expect(merged).not.toBeNull();
    expect(merged!.name).toBe('Coin1');
    expect(merged!.type).toBe('Area3D');
    expect(merged!.children.map((c) => c.name)).toEqual(['Circle']);
  });

  it('lets the instance transform replace the root transform while preserving other root props', () => {
    const instanceNode = node({
      name: 'Coin1',
      type: 'Node',
      instance: 'ExtResource("2_chew2")',
      properties: { transform: 'INSTANCE_XFORM' },
    });
    const root = node({
      name: 'Coin',
      type: 'Area3D',
      properties: { transform: 'ROOT_XFORM', monitoring: true },
    });

    const merged = mergeInstanceRoot(instanceNode, { nodes: [root] });

    expect(merged!.properties.transform).toBe('INSTANCE_XFORM');
    expect((merged!.properties as Record<string, unknown>).monitoring).toBe(true);
  });

  it('does not let an undefined instance property clobber the root value', () => {
    // The base Node parser emits a `transform` key for EVERY node, set to
    // undefined when the .tscn has no transform line. A raw spread would let
    // that undefined erase the root's real transform — the platformer GridMap
    // bug (instance=grid_map.tscn with no transform override rendered the
    // level at the origin instead of (-16,-6,-12)).
    const instanceNode = node({
      name: 'GridMap',
      type: 'Node',
      instance: 'ExtResource("1_t0f53")',
      properties: { transform: undefined, visible: undefined },
    });
    const root = node({
      name: 'GridMap',
      type: 'GridMap',
      properties: { transform: 'ROOT_XFORM', cells: 'ROOT_CELLS', visible: false },
    });

    const merged = mergeInstanceRoot(instanceNode, { nodes: [root] });

    expect(merged!.properties.transform).toBe('ROOT_XFORM');
    expect((merged!.properties as Record<string, unknown>).cells).toBe('ROOT_CELLS');
    expect((merged!.properties as Record<string, unknown>).visible).toBe(false);
  });

  it('still lets a DEFINED instance property override the root value', () => {
    // Guard the fix's boundary: defined values (incl. falsy 0/false/"") win.
    const instanceNode = node({
      name: 'Coin1',
      type: 'Node',
      instance: 'ExtResource("2_chew2")',
      properties: { transform: 'INSTANCE_XFORM', visible: false },
    });
    const root = node({
      name: 'Coin',
      type: 'Area3D',
      properties: { transform: 'ROOT_XFORM', visible: true },
    });

    const merged = mergeInstanceRoot(instanceNode, { nodes: [root] });

    expect(merged!.properties.transform).toBe('INSTANCE_XFORM');
    expect((merged!.properties as Record<string, unknown>).visible).toBe(false);
  });

  it('renders the root children first, then any children the host added under the instance', () => {
    const instanceNode = node({
      name: 'Coin1',
      type: 'Node',
      instance: 'ExtResource("2_chew2")',
      children: [node({ name: 'AddedMarker', type: 'Marker3D' })],
    });
    const root = node({
      name: 'Coin',
      type: 'Area3D',
      children: [node({ name: 'Circle', type: 'MeshInstance3D' })],
    });

    const merged = mergeInstanceRoot(instanceNode, { nodes: [root] });

    expect(merged!.children.map((c) => c.name)).toEqual(['Circle', 'AddedMarker']);
  });

  it('consumes the instance node ref so a plain root yields a non-instance merged node', () => {
    const instanceNode = node({
      name: 'Coin1',
      type: 'Node',
      instance: 'ExtResource("2_chew2")',
    });
    const root = node({ name: 'Coin', type: 'Area3D' });

    const merged = mergeInstanceRoot(instanceNode, { nodes: [root] });

    // The instance node's own ref is consumed by the merge; a plain root
    // leaves the merged node with no instance ref, so it dispatches as an
    // ordinary node (no re-load loop). Tree affordances use the originating
    // ref held in the caller's scope, not this field.
    expect(merged!.instance).toBeUndefined();
  });

  it('adopts the root instance ref when the root is itself an instance (nested-root)', () => {
    const instanceNode = node({
      name: 'TopRoot',
      type: 'Node',
      instance: 'ExtResource("middle_ref")',
    });
    const root = node({
      name: 'MiddleWrapper',
      type: 'Node3D',
      instance: 'ExtResource("leaf_ref")',
    });

    const merged = mergeInstanceRoot(instanceNode, { nodes: [root] });

    // Re-dispatch must continue collapsing the next level, so the merged node
    // carries the root's own instance ref, not the consumed top-level one.
    expect(merged!.instance).toBe('ExtResource("leaf_ref")');
  });

  it('falls back (returns null) when the loaded scene has multiple top-level nodes', () => {
    const instanceNode = node({
      name: 'Multi',
      type: 'Node',
      instance: 'ExtResource("multi")',
    });
    const scene = {
      nodes: [node({ name: 'RootA', type: 'Node3D' }), node({ name: 'RootB', type: 'Node3D' })],
    };

    expect(mergeInstanceRoot(instanceNode, scene)).toBeNull();
  });

  // ---- type-specific overrides on a type-less instance node ----
  //
  // An instance node (`instance=ExtResource(...)`, no `type=`) is parsed by the
  // base Node parser, which only extracts name/parent/transform/index — so a
  // type-specific override like a GridMap `data` or a Camera3D `fov` never
  // reaches the merged node's parsed properties. The fix retains the raw
  // override map on `instanceNode.rawProperties`, and (once the root type is
  // known here) re-parses `{ ...root.rawProperties, ...instanceNode.rawProperties }`
  // ONCE with the root type's parser — so the override layers onto the root at
  // the RAW level and is parsed with the correct type, rather than being lost.

  it('re-parses a type-specific GridMap `data` override against the root GridMap type', () => {
    // stage.tscn instances grid_map.tscn and overrides its cell layout.
    const instanceNode = node({
      name: 'GridMap',
      type: 'Node', // type-less instance → base Node parser → no `cells`
      instance: 'ExtResource("1_t0f53")',
      properties: {}, // base parser dropped the `data` key
      rawProperties: { data: '{ "cells": PackedInt32Array(9, 8, 7) }' },
    });
    const root = node({
      name: 'GridMap',
      type: 'GridMap',
      // Parsed root props carry the BASE layout — the fix must NOT spread these;
      // it must re-parse the raw override so the override layout wins.
      properties: { cells: 'BASE_CELLS', meshLibrary: 'ExtResource("ml")' },
      rawProperties: {
        mesh_library: 'ExtResource("ml")',
        data: '{ "cells": PackedInt32Array(0, 0, 0) }',
      },
    });

    const merged = mergeInstanceRoot(instanceNode, { nodes: [root] });

    expect(merged!.type).toBe('GridMap');
    const props = merged!.properties as GridMapProperties;
    expect(props.cells).toBe('9, 8, 7'); // the OVERRIDE layout, not BASE
    expect(props.meshLibrary).toBe('ExtResource("ml")'); // root-only prop survives
  });

  it('re-parses a non-GridMap type-specific override (Camera3D `fov`) — proves generality', () => {
    const instanceNode = node({
      name: 'Cam',
      type: 'Node',
      instance: 'ExtResource("cam_scene")',
      properties: {},
      rawProperties: { fov: '42.5' }, // type-specific override
    });
    const root = node({
      name: 'Camera',
      type: 'Camera3D',
      properties: { fov: 99, current: true },
      rawProperties: { fov: '70.0', current: 'true' },
    });

    const merged = mergeInstanceRoot(instanceNode, { nodes: [root] });

    expect(merged!.type).toBe('Camera3D');
    const props = merged!.properties as Camera3DProperties;
    expect(props.fov).toBe(42.5); // the override, re-parsed with the Camera3D parser
    expect(props.current).toBe(true); // root-only prop survives
  });

  it('falls back (returns null) for a synthetic GLBSceneRoot so GLB overrides survive', () => {
    const instanceNode = node({
      name: 'Lamp',
      type: 'Node',
      instance: 'ExtResource("lamp_glb")',
    });
    const scene = {
      nodes: [node({ name: 'lamp', type: 'GLBSceneRoot', properties: { glbPath: 'res://lamp.glb' } })],
    };

    expect(mergeInstanceRoot(instanceNode, scene)).toBeNull();
  });
});
