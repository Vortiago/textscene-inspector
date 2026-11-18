import { describe, expect, it } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene } from './openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';

const provider: ResourceProvider = { loadResource: async () => null };

function sceneOf(cameras: string): ReturnType<typeof openScene> {
  return openScene({
    source: `[gd_scene format=3]\n\n[node name="Main" type="Node3D"]\n${cameras}`,
    provider,
  });
}

const camera = (name: string, extra = '') => `\n[node name="${name}" type="Camera3D" parent="."]\n${extra}`;

async function currentOf(scene: ReturnType<typeof openScene>, viewport = '/root'): Promise<string | null> {
  const current = await scene.getNode(viewport).call('get_camera_3d');
  return current === null ? null : (current as { path: string }).path;
}

describe('the current Camera3D of a viewport', () => {
  it('is the first camera to enter when none is current (camera_3d.cpp:189-191)', async () => {
    expect(await currentOf(sceneOf(camera('A') + camera('B')))).toBe('/root/Main/A');
  });

  it('is the last current camera to enter, since each claim replaces the last', async () => {
    const both = sceneOf(camera('A', 'current = true') + camera('B', 'current = true'));
    expect(await currentOf(both)).toBe('/root/Main/B');
  });

  it('moves by call order, not by tree order', async () => {
    const scene = sceneOf(camera('A') + camera('B') + camera('C'));
    await scene.getNode('C').call('make_current');
    await scene.getNode('A').call('make_current');
    expect(await currentOf(scene)).toBe('/root/Main/A');
  });

  it('passes to the next camera of the viewport after clear_current', async () => {
    const scene = sceneOf(camera('A') + camera('B') + camera('C'));
    await scene.getNode('B').call('make_current');
    await scene.getNode('B').call('clear_current');
    expect(await currentOf(scene)).toBe('/root/Main/A');
  });

  it('leaves the viewport with no camera after clear_current(false)', async () => {
    const scene = sceneOf(camera('A') + camera('B'));
    await scene.getNode('A').call('clear_current', false);
    expect(await currentOf(scene)).toBeNull();
  });

  it('keeps the current camera when another camera calls clear_current', async () => {
    const scene = sceneOf(camera('A') + camera('B'));
    await scene.getNode('B').call('clear_current');
    expect(await currentOf(scene)).toBe('/root/Main/A');
  });

  it('answers is_current from the viewport, not from the property', async () => {
    const scene = sceneOf(camera('A', 'current = true') + camera('B'));
    await scene.getNode('B').call('make_current');
    expect(await scene.getNode('A').call('is_current')).toBe(false);
  });

  it('runs make_current for set("current", true)', async () => {
    const scene = sceneOf(camera('A') + camera('B'));
    await scene.getNode('B').set('current', true);
    expect(await currentOf(scene)).toBe('/root/Main/B');
  });

  it('runs clear_current for set("current", false)', async () => {
    const scene = sceneOf(camera('A') + camera('B'));
    await scene.getNode('A').set('current', false);
    expect(await currentOf(scene)).toBe('/root/Main/B');
  });

  it('answers get("current") from the viewport', async () => {
    const scene = sceneOf(camera('A', 'current = true') + camera('B'));
    await scene.getNode('B').call('make_current');
    expect(await scene.getNode('A').get('current')).toBe(false);
  });

  it('keeps a camera inside a SubViewport to its own viewport', async () => {
    const scene = sceneOf(
      camera('A') +
        '\n[node name="Sub" type="SubViewport" parent="."]\n' +
        '\n[node name="Inner" type="Camera3D" parent="Sub"]\n'
    );
    await scene.getNode('Sub/Inner').call('make_current');
    expect([await currentOf(scene), await currentOf(scene, 'Sub')]).toEqual([
      '/root/Main/A',
      '/root/Main/Sub/Inner',
    ]);
  });

  it('fills again from the enter rule after a new text', async () => {
    const scene = sceneOf(camera('A') + camera('B'));
    await scene.getNode('B').call('make_current');
    scene.setSource(
      `[gd_scene format=3]\n\n[node name="Main" type="Node3D"]\n${camera('A')}${camera('B')}${camera('C')}`
    );
    expect(await currentOf(scene)).toBe('/root/Main/A');
  });
});
