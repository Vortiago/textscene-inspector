/**
 * Re-homing an override's references into the scope of the node it overrides. Ids are per
 * file, so the outer scene's `1` and the sub-scene's `1` name different resources, and a
 * hand-written scene numbers from 1, so the two collide readily.
 */

import { describe, expect, it } from 'vitest';
import { rehomeOverride } from './rehomeOverride';
import { findExtResource, findSubResource } from './SubResourceResolver';
import { extResourcePathOf } from './testing/extResourcePathOf';
import type { SceneScope } from '../parser/types';

const outer: SceneScope = {
  externalResources: [{ id: '1', type: 'Texture2D', path: 'res://outer.png' }],
  internalResources: [
    { id: 'mat', type: 'StandardMaterial3D', data: { albedo_texture: 'ExtResource("1")' } },
  ],
};

const inner: SceneScope = {
  externalResources: [{ id: '1', type: 'Texture2D', path: 'res://inner.png' }],
  internalResources: [],
  instancedScenePaths: ['res://inner.tscn'],
};

describe('rehomeOverride', () => {
  it('resolves a colliding ExtResource to the outer resource and keeps the inner one', () => {
    const { raw, scope } = rehomeOverride({ texture: 'ExtResource("1")' }, outer, inner);

    expect(extResourcePathOf(raw.texture, scope)).toBe('res://outer.png');
    expect(findExtResource(scope.externalResources, '1')?.path).toBe('res://inner.png');
  });

  it('keeps an id the inner scope does not hold', () => {
    const { raw } = rehomeOverride({ material: 'SubResource("mat")' }, outer, inner);

    expect(raw.material).toBe('SubResource("mat")');
  });

  it('copies a reached SubResource with its own references re-homed', () => {
    const { raw, scope } = rehomeOverride({ material: 'SubResource("mat")' }, outer, inner);

    const id = /SubResource\("([^"]+)"\)/.exec(raw.material!)![1]!;
    const material = findSubResource(scope.internalResources, id)!;
    expect(extResourcePathOf(material.data.albedo_texture, scope)).toBe('res://outer.png');
  });

  it('resolves an id the outer scope lacks to nothing, not to the inner resource', () => {
    const { raw, scope } = rehomeOverride(
      { texture: 'ExtResource("1")' },
      { ...outer, externalResources: [] },
      inner
    );

    expect(extResourcePathOf(raw.texture, scope)).toBeUndefined();
  });

  it('keeps the inner scene paths, since the node sits inside the inner scene', () => {
    const { scope } = rehomeOverride({ texture: 'ExtResource("1")' }, outer, inner);

    expect(scope.instancedScenePaths).toEqual(['res://inner.tscn']);
  });

  it('returns the inner scope itself for an override that names no resource', () => {
    const { raw, scope } = rehomeOverride({ visible: 'false' }, outer, inner);

    expect(raw).toEqual({ visible: 'false' });
    expect(scope).toBe(inner);
  });
});
