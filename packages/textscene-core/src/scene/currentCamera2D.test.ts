import { describe, expect, it, vi } from 'vitest';
import '../r3f/sceneLiveTree.js';
import { openScene } from './openScene';
import type { ResourceProvider } from '../resources/ResourceProvider';
import * as logger from '../logger';

const provider: ResourceProvider = { loadResource: async () => null };

const camera = (name: string, extra = '') => `\n[node name="${name}" type="Camera2D" parent="."]\n${extra}`;

function sceneOf(cameras: string) {
  return openScene({
    source: `[gd_scene format=3]\n\n[node name="Main" type="Node2D"]\n${cameras}`,
    provider,
  });
}

async function currentOf(scene: ReturnType<typeof sceneOf>): Promise<string | null> {
  const current = await scene.getNode('/root').call('get_camera_2d');
  return current === null ? null : (current as { path: string }).path;
}

describe('the current Camera2D of a viewport', () => {
  it('is the first enabled camera to enter (camera_2d.cpp:353-355)', async () => {
    const scene = sceneOf(camera('A', 'enabled = false') + camera('B') + camera('C'));
    expect(await currentOf(scene)).toBe('/root/Main/B');
  });

  it('moves to the camera that calls make_current', async () => {
    const scene = sceneOf(camera('A') + camera('B'));
    await scene.getNode('B').call('make_current');
    expect(await currentOf(scene)).toBe('/root/Main/B');
  });

  it('stays where it is when a camera that is not enabled calls make_current', async () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const scene = sceneOf(camera('A') + camera('B', 'enabled = false'));
    await scene.getNode('B').call('make_current');
    expect(await currentOf(scene)).toBe('/root/Main/A');
  });

  it('passes to the next enabled camera when the current one is disabled', async () => {
    const scene = sceneOf(camera('A') + camera('B', 'enabled = false') + camera('C'));
    await scene.getNode('A').set('enabled', false);
    expect(await currentOf(scene)).toBe('/root/Main/C');
  });

  it('claims a viewport with no camera when a camera is enabled', async () => {
    const scene = sceneOf(camera('A', 'enabled = false'));
    await scene.getNode('A').set('enabled', true);
    expect(await currentOf(scene)).toBe('/root/Main/A');
  });

  it('leaves the current camera when another camera is enabled', async () => {
    const scene = sceneOf(camera('A') + camera('B', 'enabled = false'));
    await scene.getNode('B').set('enabled', true);
    expect(await currentOf(scene)).toBe('/root/Main/A');
  });

  it('answers is_current from the viewport', async () => {
    const scene = sceneOf(camera('A') + camera('B'));
    await scene.getNode('B').call('make_current');
    expect(await scene.getNode('A').call('is_current')).toBe(false);
  });

  it('writes enabled through set_enabled, as get reads it', async () => {
    const scene = sceneOf(camera('A'));
    await scene.getNode('A').call('set_enabled', false);
    expect(await scene.getNode('A').get('enabled')).toBe(false);
  });
});
