/**
 * Cyclic instancing in the viewport: an instance of a scene that already encloses
 * it renders the magenta placeholder of a failed load, as Godot's loader refuses
 * it, and the render ends instead of adding a level per load.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnExternalResource, TscnNode, TscnScene } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SceneStack } from './testing/SceneStack';
import { createFakeResourceLoader } from '../resources/testing/createFakeResourceLoader';
import { setLogAdapter, type LogAdapter } from '../logger';

import './nodes/index';
// The Instance root merge parses a sub-scene root with the Node parser when its type has none.
import '../nodes/node/index';

function makeNode(name: string, type: string, overrides: Partial<TscnNode> = {}): TscnNode {
  return {
    rawProperties: {},
    name,
    type,
    children: [],
    properties: { name } as Record<string, unknown>,
    ...overrides,
  };
}

function ext(id: string, path: string): TscnExternalResource {
  return { id, path, type: 'PackedScene' };
}

async function render(scene: TscnScene, seeded: Record<string, TscnScene>) {
  const fake = createFakeResourceLoader();
  for (const [path, value] of Object.entries(seeded)) fake.scenes.seed(path, value);
  return ReactThreeTestRenderer.create(
    <SceneStack loader={fake.loader} scene={scene}>
      <NodeDispatcher nodes={scene.nodes} />
    </SceneStack>
  );
}

type Renderer = Awaited<ReturnType<typeof render>>;

function groupNames(renderer: Renderer): string[] {
  return renderer.scene.findAllByType('Group').map((g) => g.instance.name);
}

function magentaCount(renderer: Renderer): number {
  return renderer.scene.findAllByType('Mesh').filter((m) => {
    const color = ((m.instance as THREE.Mesh).material as { color?: THREE.Color }).color;
    return color !== undefined && color.r > 0.9 && color.g < 0.1 && color.b > 0.9;
  }).length;
}

/** `res://a.tscn`: a root with two children that each instance `res://a.tscn`. */
const SELF_SCENE: TscnScene = {
  nodes: [
    makeNode('Root', 'Node3D', {
      children: [
        makeNode('A', 'Node3D', { instance: 'ExtResource("1")' }),
        makeNode('B', 'Node3D', { instance: 'ExtResource("1")' }),
      ],
    }),
  ],
  externalResources: [ext('1', 'res://a.tscn')],
  internalResources: [],
};

/** A one-box scene with no instances. */
const LEAF_SCENE: TscnScene = {
  nodes: [
    makeNode('LeafRoot', 'Node3D', {
      children: [
        makeNode('Body', 'MeshInstance3D', {
          properties: {
            name: 'Body',
            mesh: 'SubResource("Box_1")',
            surfaceMaterialOverrides: new Map(),
          } as Record<string, unknown>,
        }),
      ],
    }),
  ],
  externalResources: [],
  internalResources: [{ id: 'Box_1', type: 'BoxMesh', data: { size: 'Vector3(1, 1, 1)' } }],
};

describe('<NodeDispatcher> cyclic instancing', () => {
  afterEach(() => setLogAdapter(null));

  it('renders a placeholder for each instance of the scene inside its own content', async () => {
    const renderer = await render(SELF_SCENE, { 'res://a.tscn': SELF_SCENE });
    // Root/A and Root/B load a.tscn once each. Their own A and B stop there.
    expect(groupNames(renderer).filter((name) => name === 'A' || name === 'B')).toHaveLength(6);
    expect(magentaCount(renderer)).toBe(4);
  });

  it('stops an indirect cycle at the instance that names a scene already above it', async () => {
    const aScene: TscnScene = {
      nodes: [
        makeNode('ARoot', 'Node3D', {
          children: [makeNode('ToB', 'Node3D', { instance: 'ExtResource("1")' })],
        }),
      ],
      externalResources: [ext('1', 'res://b.tscn')],
      internalResources: [],
    };
    const bScene: TscnScene = {
      nodes: [
        makeNode('BRoot', 'Node3D', {
          children: [makeNode('ToA', 'Node3D', { instance: 'ExtResource("2")' })],
        }),
      ],
      externalResources: [ext('2', 'res://a.tscn')],
      internalResources: [],
    };

    const renderer = await render(aScene, { 'res://a.tscn': aScene, 'res://b.tscn': bScene });
    expect(groupNames(renderer).filter((name) => name === 'ToB')).toHaveLength(2);
    expect(magentaCount(renderer)).toBe(1);
  });

  it('stops a root that instances its own scene after one merge', async () => {
    const loop: TscnScene = {
      nodes: [makeNode('Loop', 'Node3D', { instance: 'ExtResource("1")' })],
      externalResources: [ext('1', 'res://loop.tscn')],
      internalResources: [],
    };
    const host: TscnScene = {
      nodes: [makeNode('L', 'Node3D', { instance: 'ExtResource("1")' })],
      externalResources: [ext('1', 'res://loop.tscn')],
      internalResources: [],
    };

    const renderer = await render(host, { 'res://loop.tscn': loop });
    expect(magentaCount(renderer)).toBe(1);
  });

  it('renders a host child that instances the scene it is grafted into, since that is no cycle', async () => {
    const host: TscnScene = {
      nodes: [
        makeNode('Gun', 'Node3D', {
          instance: 'ExtResource("1")',
          children: [makeNode('Spare', 'Node3D', { instance: 'ExtResource("1")' })],
        }),
      ],
      externalResources: [ext('1', 'res://leaf.tscn')],
      internalResources: [],
    };

    const renderer = await render(host, { 'res://leaf.tscn': LEAF_SCENE });
    expect(renderer.scene.findAllByType('Mesh').filter((m) => m.instance.name === 'Body')).toHaveLength(2);
    expect(magentaCount(renderer)).toBe(0);
  });

  it('warns once per stopped instance, naming its path and the scene', async () => {
    const adapter: LogAdapter = {
      trace: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    setLogAdapter(adapter);

    await render(SELF_SCENE, { 'res://a.tscn': SELF_SCENE });
    const messages = vi.mocked(adapter.warn).mock.calls.map(([message]) => message);
    expect(messages.filter((m) => m.includes('res://a.tscn'))).toHaveLength(4);
    expect(messages.some((m) => m.includes('"Root/A/B"'))).toBe(true);
  });
});
