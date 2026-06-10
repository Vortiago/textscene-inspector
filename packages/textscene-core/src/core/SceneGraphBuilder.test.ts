/**
 * Tests for SceneGraphBuilder — immutability (Object.freeze), Copy-on-Write
 * rebuilds, node flattening, and external PackedScene instance injection.
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
        (graph as unknown as { version: number }).version = 999;
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
      expect(builder.hasScene('res://later.tscn')).toBe(true);
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

    it('injects PackedScene instance nodes from added external scenes', () => {
      const main = scene(
        'res://main.tscn',
        [node('Main', { children: [node('Door', { instance: 'ExtResource("1_door")' })] })],
        [{ id: '1_door', path: 'res://door.tscn', type: 'PackedScene' }]
      );
      const door = scene('res://door.tscn', [node('Panel', { children: [node('Handle')] })]);

      const graph = new SceneGraphBuilder()
        .setRootScene('res://main.tscn')
        .addScene(main)
        .addScene(door)
        .build();

      expect(graph.flattenedNodes.map((n) => n.path)).toEqual([
        'Main',
        'Main/Door',
        'Main/Door/Panel',
        'Main/Door/Panel/Handle',
      ]);
      // Injected nodes carry their defining scene as source.
      expect(graph.flattenedNodes[2]!.source).toBe('res://door.tscn');
      expect(graph.flattenedNodes[1]!.source).toBe('res://main.tscn');
    });

    it('does not inject non-PackedScene instance refs (e.g. GLB)', () => {
      const main = scene(
        'res://main.tscn',
        [node('Rock', { instance: 'ExtResource("1_glb")' })],
        [{ id: '1_glb', path: 'res://rock.glb', type: 'GLB' }]
      );

      const graph = new SceneGraphBuilder()
        .setRootScene('res://main.tscn')
        .addScene(main)
        .build();

      expect(graph.flattenedNodes).toHaveLength(1);
      expect(graph.flattenedNodes[0]!.path).toBe('Rock');
    });

    it('keeps just the instance node when the referenced scene is unknown or not added', () => {
      const main = scene(
        'res://main.tscn',
        [
          node('MissingScene', { instance: 'ExtResource("1_door")' }),
          node('UnknownId', { instance: 'ExtResource("9_nope")' }),
        ],
        [{ id: '1_door', path: 'res://door.tscn', type: 'PackedScene' }]
      );

      const graph = new SceneGraphBuilder()
        .setRootScene('res://main.tscn')
        .addScene(main) // res://door.tscn never added
        .build();

      expect(graph.flattenedNodes.map((n) => n.path)).toEqual(['MissingScene', 'UnknownId']);
    });

    it('survives circular scene references without infinite recursion', () => {
      const sceneA = scene(
        'res://a.tscn',
        [node('RootA', { instance: 'ExtResource("1_b")' })],
        [{ id: '1_b', path: 'res://b.tscn', type: 'PackedScene' }]
      );
      const sceneB = scene(
        'res://b.tscn',
        [node('RootB', { instance: 'ExtResource("1_a")' })],
        [{ id: '1_a', path: 'res://a.tscn', type: 'PackedScene' }]
      );

      const graph = new SceneGraphBuilder()
        .setRootScene('res://a.tscn')
        .addScene(sceneA)
        .addScene(sceneB)
        .build();

      // A injects B; B's back-reference to A is skipped (already visited).
      expect(graph.flattenedNodes.map((n) => n.path)).toEqual(['RootA', 'RootA/RootB']);
    });
  });

  describe('Copy-on-Write rebuilds', () => {
    it('from() + updateScene() creates a new graph without mutating the previous one', () => {
      const original = scene('res://main.tscn', [node('Main')]);
      const graph1 = new SceneGraphBuilder()
        .setRootScene('res://main.tscn')
        .addScene(original)
        .build();

      const updated = scene('res://main.tscn', [node('Main', { children: [node('Added')] })]);
      const graph2 = new SceneGraphBuilder().from(graph1).updateScene('res://main.tscn', updated).build();

      // Old graph untouched (shares unchanged data, never mutated).
      expect(graph1.flattenedNodes.map((n) => n.path)).toEqual(['Main']);
      expect(graph1.scenes.get('res://main.tscn')).toBe(original);

      // New graph reflects the update with an incremented version.
      expect(graph2.flattenedNodes.map((n) => n.path)).toEqual(['Main', 'Main/Added']);
      expect(graph2.scenes.get('res://main.tscn')).toBe(updated);
      expect(graph2.rootScene).toBe(graph1.rootScene);
      expect(graph2.version).toBe(graph1.version + 1);
    });

    it('updateScene() throws for a path that was never added', () => {
      const builder = new SceneGraphBuilder().setRootScene('res://main.tscn');

      expect(() => builder.updateScene('res://nope.tscn', scene('res://nope.tscn', []))).toThrow(
        'Scene not found: res://nope.tscn'
      );
    });

    it('removeScene() drops an injected sub-scene from the next build', () => {
      const main = scene(
        'res://main.tscn',
        [node('Main', { children: [node('Door', { instance: 'ExtResource("1_door")' })] })],
        [{ id: '1_door', path: 'res://door.tscn', type: 'PackedScene' }]
      );
      const door = scene('res://door.tscn', [node('Panel')]);
      const graph1 = new SceneGraphBuilder()
        .setRootScene('res://main.tscn')
        .addScene(main)
        .addScene(door)
        .build();
      expect(graph1.flattenedNodes).toHaveLength(3);

      const graph2 = new SceneGraphBuilder().from(graph1).removeScene('res://door.tscn').build();

      expect(graph2.flattenedNodes.map((n) => n.path)).toEqual(['Main', 'Main/Door']);
      // graph1 still has the injected nodes (no mutation).
      expect(graph1.flattenedNodes).toHaveLength(3);
    });
  });

  describe('builder introspection', () => {
    it('getSceneCount() and hasScene() reflect builder state', () => {
      const builder = new SceneGraphBuilder();
      expect(builder.getSceneCount()).toBe(0);
      expect(builder.hasScene('res://a.tscn')).toBe(false);

      builder.addScene(scene('res://a.tscn', []));
      builder.addScene(scene('res://b.tscn', []));

      expect(builder.getSceneCount()).toBe(2);
      expect(builder.hasScene('res://a.tscn')).toBe(true);

      builder.removeScene('res://a.tscn');
      expect(builder.getSceneCount()).toBe(1);
      expect(builder.hasScene('res://a.tscn')).toBe(false);
    });
  });
});
