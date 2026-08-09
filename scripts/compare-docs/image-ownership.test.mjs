/**
 * One image, one owner.
 *
 * `recapture.mjs` and `capture-complex.mjs` both write
 * `docs/comparison/images/<image>-godot.png`, and they render differently: a
 * complex scene needs per-scene settings (`frame`, `sceneCamera`, a named
 * `oursCamera`, a forced 2D/3D mode) that live in COMPLEX_SCENES and that a
 * sheet's frontmatter cannot express. When `recapture` rendered one of those
 * with its own defaults it produced a WRONG frame that silently replaced the
 * right one — the town shot from the editor orbit ends up under the terrain —
 * and nothing failed, because a picture is still a picture.
 *
 * That is a bug you can only find by looking at the image, which is why it
 * survived. These tests make the overlap a failing assertion instead.
 */
import { describe, it, expect } from 'vitest';
import { COMPLEX_SCENES } from './capture-complex.mjs';
import { partitionTargets } from './recapture/targets.mjs';

const COMPLEX_SLUGS = COMPLEX_SCENES.map((c) => c.slug);

function targetsOf(...images) {
  return images.map((image) => ({ image, fixture: `${image}.tscn` }));
}

describe('comparison image ownership', () => {
  it('never renders a capture-complex slug through recapture defaults', () => {
    const { own, delegated } = partitionTargets(targetsOf(...COMPLEX_SLUGS));
    expect(own).toEqual([]);
    expect(delegated.map((t) => t.image).sort()).toEqual([...COMPLEX_SLUGS].sort());
  });

  it('keeps ordinary sheet images for recapture itself', () => {
    const { own, delegated } = partitionTargets(targetsOf('unit-rigidbody3d', 'unit-decal'));
    expect(own.map((t) => t.image)).toEqual(['unit-rigidbody3d', 'unit-decal']);
    expect(delegated).toEqual([]);
  });

  it('splits a mixed batch rather than dropping either side', () => {
    const mixed = targetsOf('unit-decal', COMPLEX_SLUGS[0], 'unit-rigidbody3d');
    const { own, delegated } = partitionTargets(mixed);
    expect(own.map((t) => t.image)).toEqual(['unit-decal', 'unit-rigidbody3d']);
    expect(delegated.map((t) => t.image)).toEqual([COMPLEX_SLUGS[0]]);
    expect(own.length + delegated.length).toBe(mixed.length);
  });

  it('gives every complex scene a distinct slug, so ownership is unambiguous', () => {
    expect(new Set(COMPLEX_SLUGS).size).toBe(COMPLEX_SLUGS.length);
  });
});
