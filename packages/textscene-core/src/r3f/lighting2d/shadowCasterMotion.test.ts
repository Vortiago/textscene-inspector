/**
 * The occluder motion watch: a still scene reads as unchanged, so the stage skips the flatten, and
 * every change the flatten can see (a move, an ancestor's move, a visibility flip, a caster added
 * or withdrawn) reads as changed.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCasterMotionWatch } from './shadowCasterMotion';
import { createShadowCasterRegistry, type ShadowCaster } from './shadowCasterRegistry';
import { OCCLUDER_CULL_DISABLED } from './shadowVolumes';

function caster(object: THREE.Object3D): ShadowCaster {
  return {
    segments: new Float32Array([0, 0, 0, 10, 0, 0]),
    cullMode: OCCLUDER_CULL_DISABLED,
    occluderLightMask: 1,
    object,
  };
}

/** A registry holding one caster under a parent group, looked at once already. */
function watched() {
  const registry = createShadowCasterRegistry();
  const parent = new THREE.Group();
  const object = new THREE.Group();
  parent.add(object);
  registry.add(caster(object));
  const watch = createCasterMotionWatch();
  expect(watch.changed(registry)).toBe(true);
  return { registry, parent, object, watch };
}

describe('createCasterMotionWatch', () => {
  it('answers changed on the first look, even with no casters', () => {
    expect(createCasterMotionWatch().changed(createShadowCasterRegistry())).toBe(true);
  });

  it('answers unchanged while nothing moves, frame after frame', () => {
    const { registry, watch } = watched();
    for (let frame = 0; frame < 10; frame += 1) expect(watch.changed(registry)).toBe(false);
  });

  it('answers changed once for a move, then unchanged again', () => {
    const { registry, object, watch } = watched();
    object.position.set(7, 0, 0);
    expect(watch.changed(registry)).toBe(true);
    expect(watch.changed(registry)).toBe(false);
  });

  it('sees an ancestor move, which only the world matrix carries', () => {
    const { registry, parent, watch } = watched();
    parent.rotation.z = Math.PI / 2;
    expect(watch.changed(registry)).toBe(true);
  });

  it('refreshes the world matrix it reads, as the flatten does', () => {
    const { registry, parent, object, watch } = watched();
    parent.position.set(3, 4, 0);
    watch.changed(registry);
    expect(object.matrixWorld.elements[12]).toBe(3);
    expect(object.matrixWorld.elements[13]).toBe(4);
  });

  it('sees a visibility flip on an ancestor in both directions', () => {
    const { registry, parent, watch } = watched();
    parent.visible = false;
    expect(watch.changed(registry)).toBe(true);
    expect(watch.changed(registry)).toBe(false);
    parent.visible = true;
    expect(watch.changed(registry)).toBe(true);
  });

  it('ignores a hidden caster moving, since it casts nothing', () => {
    const { registry, object, watch } = watched();
    object.visible = false;
    watch.changed(registry);
    object.position.set(50, 50, 0);
    expect(watch.changed(registry)).toBe(false);
  });

  it('sees a caster added and one withdrawn, whose count the buffers follow', () => {
    const { registry, watch } = watched();
    const withdraw = registry.add(caster(new THREE.Group()));
    expect(watch.changed(registry)).toBe(true);
    expect(watch.changed(registry)).toBe(false);
    withdraw();
    expect(watch.changed(registry)).toBe(true);
    expect(watch.changed(registry)).toBe(false);
  });

  it('sees a caster replaced by a new one at the same place (edge case)', () => {
    // Same count and same matrix: only the version tells the snapshots apart.
    const registry = createShadowCasterRegistry();
    const object = new THREE.Group();
    const withdraw = registry.add(caster(object));
    const watch = createCasterMotionWatch();
    watch.changed(registry);
    withdraw();
    registry.add(caster(object));
    expect(watch.changed(registry)).toBe(true);
  });

  it('keeps answering changed while a matrix holds NaN, as the flatten would republish', () => {
    const { registry, object, watch } = watched();
    object.position.set(Number.NaN, 0, 0);
    expect(watch.changed(registry)).toBe(true);
    expect(watch.changed(registry)).toBe(true);
  });
});
