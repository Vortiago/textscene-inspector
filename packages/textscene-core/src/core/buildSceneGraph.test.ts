/**
 * Tests for buildSceneGraph: immutability (Object.freeze) and single-scene node flattening.
 * The live scene tree composes PackedScene instances (ADR-0013), not this function.
 */
import { describe, it, expect } from 'vitest';
import { buildSceneGraph } from './SceneGraph';
import type { ParsedScene, SceneNode } from './SceneGraph';
import type { TscnNode, ExtResource } from '../parser/types';

const node = (name: string, overrides: Partial<TscnNode> = {}): TscnNode => ({
  name,
  type: 'Node3D',
  children: [],
  properties: {},
  ...overrides,
});

const scene = (
  path: string,
  nodes: TscnNode[],
  externalResources: ExtResource[] = []
): ParsedScene => ({
  path,
  nodes,
  externalScenes: [],
  internalResources: [],
  externalResources,
});

describe('buildSceneGraph', () => {
  it('produces a frozen graph: top-level object, flattenedNodes, and scenes map are Object.frozen', () => {
    const graph = buildSceneGraph(scene('res://a.tscn', [node('A')]));

    expect(Object.isFrozen(graph)).toBe(true);
    expect(Object.isFrozen(graph.flattenedNodes)).toBe(true);
    expect(Object.isFrozen(graph.scenes)).toBe(true);

    // Strict-mode mutation attempts throw on frozen objects.
    expect(() => {
      (graph as unknown as { rootScene: string }).rootScene = 'res://mutated.tscn';
    }).toThrow(TypeError);
    expect(() => {
      (graph.flattenedNodes as SceneNode[]).push({
        path: 'X',
        name: 'X',
        data: node('X'),
        source: 'res://a.tscn',
        parent: null,
      });
    }).toThrow(TypeError);
  });

  it('keys the scenes map by the root scene path', () => {
    const graph = buildSceneGraph(scene('res://a.tscn', [node('A')]));

    expect(graph.rootScene).toBe('res://a.tscn');
    expect(graph.scenes.get('res://a.tscn')?.nodes[0]?.name).toBe('A');
  });

  describe('flattening', () => {
    it('flattens nested children and multiple roots with full paths and parent links', () => {
      const root = node('Main', {
        children: [node('Hallway', { children: [node('Door')] })],
      });
      const sibling = node('Lights');
      const graph = buildSceneGraph(scene('res://main.tscn', [root, sibling]));

      expect(graph.flattenedNodes.map((n) => n.path)).toEqual([
        'Main',
        'Main/Hallway',
        'Main/Hallway/Door',
        'Lights',
      ]);
      const door = graph.flattenedNodes[2]!;
      expect(door.name).toBe('Door');
      expect(door.parent).toBe('Main/Hallway');
      expect(door.source).toBe('res://main.tscn');
      expect(graph.flattenedNodes[0]!.parent).toBeNull();
    });

    it('does not fold PackedScene instances into flattenedNodes (the live tree owns that)', () => {
      const main = scene(
        'res://main.tscn',
        [node('Main', { children: [node('Door', { instance: 'ExtResource("1_door")' })] })],
        [{ id: '1_door', path: 'res://door.tscn', type: 'PackedScene' }]
      );

      const graph = buildSceneGraph(main);

      // Only the authored inline nodes: the instance node is present, but its sub-scene is not
      // injected here (ADR-0013, r3f/liveSceneTree.ts).
      expect(graph.flattenedNodes.map((n) => n.path)).toEqual(['Main', 'Main/Door']);
    });
  });
});
