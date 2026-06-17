import { describe, it, expect } from 'vitest';
import { mergeInstanceRoot } from './mergeInstanceRoot';
import type { TscnNode } from '../parser/types';

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
