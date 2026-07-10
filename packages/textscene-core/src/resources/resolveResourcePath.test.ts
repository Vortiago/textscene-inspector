/**
 * Tests for `resolveResourcePath` — the helper that lets node components
 * pass a raw TSCN property string (either an already-resolved `res://`
 * path or an `ExtResource("id")` reference) through to `useResource`
 * without duplicating the id → path lookup.
 */
import { describe, it, expect } from 'vitest';
import { resolveResourcePath } from './useResource';
import { ResourceLoader } from './ResourceLoader';
import type { TscnScene } from '../parser/types';

function sceneWithLoader(loader?: ResourceLoader): TscnScene {
  return {
    nodes: [],
    externalResources: [],
    internalResources: [],
    resourceLoader: loader,
  };
}

describe('resolveResourcePath', () => {
  it('returns a res:// path unchanged without consulting the loader', () => {
    const scene = sceneWithLoader(undefined);
    expect(resolveResourcePath(scene, 'res://textures/wood.png')).toBe(
      'res://textures/wood.png'
    );
  });

  it('resolves ExtResource("id") to the registered path via the scene loader metadata', () => {
    const loader = new ResourceLoader();
    loader.register({ id: '1_tex', path: 'res://textures/wood.png', type: 'Texture2D' });
    const scene = sceneWithLoader(loader);

    expect(resolveResourcePath(scene, 'ExtResource("1_tex")')).toBe(
      'res://textures/wood.png'
    );
  });

  it('tolerates extra whitespace inside the ExtResource(...) call', () => {
    const loader = new ResourceLoader();
    loader.register({ id: '2_mat', path: 'res://materials/metal.tres', type: 'StandardMaterial3D' });
    const scene = sceneWithLoader(loader);

    expect(resolveResourcePath(scene, 'ExtResource(  "2_mat"  )')).toBe(
      'res://materials/metal.tres'
    );
  });

  it('returns null when the ExtResource id is unknown to the loader', () => {
    const loader = new ResourceLoader();
    const scene = sceneWithLoader(loader);

    expect(resolveResourcePath(scene, 'ExtResource("missing_id")')).toBeNull();
  });

  it('returns null when the scene has no resourceLoader attached', () => {
    const scene = sceneWithLoader(undefined);
    expect(resolveResourcePath(scene, 'ExtResource("1_tex")')).toBeNull();
  });

  it('returns null for a string that matches neither grammar (garbage input)', () => {
    const loader = new ResourceLoader();
    const scene = sceneWithLoader(loader);

    expect(resolveResourcePath(scene, 'SubResource("1")')).toBeNull();
    expect(resolveResourcePath(scene, 'not a resource reference at all')).toBeNull();
    expect(resolveResourcePath(scene, '')).toBeNull();
  });

  it('returns null when the ExtResource id is present but empty', () => {
    const loader = new ResourceLoader();
    const scene = sceneWithLoader(loader);

    expect(resolveResourcePath(scene, 'ExtResource("")')).toBeNull();
  });
});
