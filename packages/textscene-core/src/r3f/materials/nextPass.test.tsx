/**
 * The pure helpers of the next_pass seam: the drawn element and the visited set. The chain walk and its owners carry the behaviour through their own
 * tests (`Component.next-pass.test.tsx` beside every owner); these pin each helper's
 * contract in isolation.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { NOTHING_DRAWN, drawnElementOf, visitedWith } from './nextPass';
import { resolveMaterialSource } from './materialSource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';

function sourceOf(
  reference: string,
  tables: {
    internalResources: readonly TscnInternalResource[];
    externalResources: readonly TscnExternalResource[];
  } = {
    internalResources: [],
    externalResources: [],
  }
) {
  return resolveMaterialSource(reference, tables)!;
}

describe('drawnElementOf', () => {
  const skeleton = new THREE.Skeleton([new THREE.Bone()]);

  it('skins a triangles draw by the given skeleton, detached, in mesh space', () => {
    const { Drawn, skin } = drawnElementOf(false, skeleton);
    expect(Drawn).toBe('skinnedMesh');
    expect(skin).toEqual({ skeleton, bindMode: THREE.DetachedBindMode });
  });

  it('skins a points draw by nothing: a point skinned is not a point draw', () => {
    const { Drawn, skin } = drawnElementOf(true, skeleton);
    expect(Drawn).toBe('points');
    expect(skin).toEqual({});
  });

  it('draws an unskinned triangles surface as a mesh', () => {
    expect(drawnElementOf(false, null).Drawn).toBe('mesh');
    expect(drawnElementOf(false, undefined).Drawn).toBe('mesh');
  });
});

describe('visitedWith', () => {
  const declared = (reference: string) =>
    sourceOf(reference, {
      internalResources: [{ id: 'A', type: 'StandardMaterial3D', data: {} }],
      externalResources: [],
    });
  const inline = declared('SubResource("A")');

  it('keeps the seed for a starting pass, which decides its own fate on recursion', () => {
    expect(visitedWith(NOTHING_DRAWN, undefined)).toBe(NOTHING_DRAWN);
  });

  it('adds a pass that has not drawn, and never mutates the set it walks with', () => {
    const added = visitedWith(NOTHING_DRAWN, inline);
    expect(added).not.toBe(NOTHING_DRAWN);
    expect(added.has('inline:scene:A')).toBe(true);
    expect(NOTHING_DRAWN.size).toBe(0);
  });

  it('keeps the same set for a pass whose material already drew: the cycle cuts here', () => {
    const once = visitedWith(NOTHING_DRAWN, inline);
    expect(visitedWith(once, inline)).toBe(once);
  });

  it('keys an inline material apart from a file material of the same name', () => {
    const file = sourceOf('ExtResource("A")', {
      internalResources: [],
      externalResources: [{ id: 'A', path: 'res://a.tres', type: 'StandardMaterial3D' }],
    });
    const both = visitedWith(visitedWith(NOTHING_DRAWN, inline), file);
    expect(both.size).toBe(2);
  });
});
