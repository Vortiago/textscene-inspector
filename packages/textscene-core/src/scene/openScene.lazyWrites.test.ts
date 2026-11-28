import { expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree';
import { openScene } from './openScene';

const replay = vi.hoisted(() => ({ loads: 0 }));
vi.mock('./writtenScene', async (original) => {
  replay.loads++;
  return original<typeof import('./writtenScene')>();
});

it('loads replay on first property access and keeps write order across a rejected setter', async () => {
  const source = '[gd_scene format=3]\n[node name="Root" type="Node2D"]';
  const scene = openScene({ source, provider: { loadResource: async () => null } });
  const parsed = scene.parse().sceneGraph;
  const node = scene.getNode('.');
  expect(scene.written()).toBe(parsed);
  expect(replay.loads).toBe(0);

  const writes = [node.set('z_index', 3), node.set('name', 'Refused'), node.set('z_index', 7)];
  expect(scene.written()).toBe(parsed);
  const outcomes = await Promise.allSettled(writes);
  expect(outcomes.map(({ status }) => status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
  expect(replay.loads).toBe(1);
  const written = scene.written()!;
  const root = written.scenes.get(written.rootScene)!.nodes[0]!;
  expect(root.rawProperties?.z_index).toBe('7');

  scene.setSource(source + '\n');
  expect(scene.written()).toBe(scene.parse().sceneGraph);
  expect(root.rawProperties?.z_index).toBe('7');
});
