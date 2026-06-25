/**
 * Tests for SceneGraphBuilder — immutability (Object.freeze), per-build copy,
 * and single-scene node flattening. PackedScene instance composition lives in
 * the live scene tree (ADR-0013), not the builder.
 */
import { describe, it, expect } from 'vitest';
import { SceneGraphBuilder } from './SceneGraphBuilder';
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

describe('SceneGraphBuilder', () => {
  describe('build()', () => {
    it('throws when the root scene is not set', () => {
      const builder = new SceneGraphBuilder();
      builder.addScene(scene('res://a.tscn', [node('A')]));

      expect(() => builder.build()).toThrow('Root scene not set');
    });

    it('produces a frozen graph: top-level object, flattenedNodes, and scenes map are Object.frozen', () => {
      const graph = new SceneGraphBuilder()
        .setRootScene('res://a.tscn')
        .addScene(scene('res://a.tscn', [node('A')]))
        .build();

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

    it('copies the scenes map per build: mutating the builder afterwards does not affect the built graph', () => {
      const builder = new SceneGraphBuilder()
        .setRootScene('res://a.tscn')
        .addScene(scene('res://a.tscn', [node('A')]));
      const graph = builder.build();

      builder.addScene(scene('res://later.tscn', [node('Later')]));

      // Object.freeze on a Map does not block .set(), so the real
      // protection is the per-build copy — pin that.
      expect(graph.scenes.has('res://later.tscn')).toBe(false);
    });
  });

  describe('flattening', () => {
    it('flattens nested children and multiple roots with full paths and parent links', () => {
      const root = node('Main', {
        children: [node('Hallway', { children: [node('Door')] })],
      });
      const sibling = node('Lights');
      const graph = new SceneGraphBuilder()
        .setRootScene('res://main.tscn')
        .addScene(scene('res://main.tscn', [root, sibling]))
        .build();

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

      const graph = new SceneGraphBuilder()
        .setRootScene('res://main.tscn')
        .addScene(main)
        .build();

      // Only the authored inline nodes — the instance node is present but its
      // sub-scene is NOT injected here (see ADR-0013, r3f/liveSceneTree.ts).
      expect(graph.flattenedNodes.map((n) => n.path)).toEqual(['Main', 'Main/Door']);
    });
  });
});
