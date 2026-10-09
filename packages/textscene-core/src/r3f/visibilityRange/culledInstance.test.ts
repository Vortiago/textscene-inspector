import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CulledInstance } from './culledInstance';
import { UNPLACED, type InstancePlacement } from './placements';
import {
  GEOMETRY_INSTANCE_DEFAULTS,
  type GeometryInstance3DProperties,
} from '../../nodes/3d/geometryinstance3d/types';
import { NO_VISIBILITY_RANGE } from '../../godot/visibilityRange';
import { EMPTY_AABB, type Aabb } from '../../godot/aabb';

const UNIT_BOX: Aabb = { position: { x: -0.5, y: -0.5, z: -0.5 }, size: { x: 1, y: 1, z: 1 } };
const PLACE = { path: 'Root/Box', parentPath: null, order: [0] };

/** A placement at `offset` whose own box is `box`, or one with no box yet for null. */
function placedAt(offset: THREE.Vector3, box: Aabb | null): InstancePlacement {
  return {
    nodeMatrixWorld: (target) => (target.makeTranslation(offset), true),
    ownAabb(target) {
      if (box)
        target.setFromCenterAndSize(
          new THREE.Vector3(),
          new THREE.Vector3(box.size.x, box.size.y, box.size.z)
        );
      return box !== null;
    },
    isVisibleInTree: () => true,
  };
}

function properties(overrides: Partial<GeometryInstance3DProperties> = {}): GeometryInstance3DProperties {
  return { ...GEOMETRY_INSTANCE_DEFAULTS, ...overrides } as GeometryInstance3DProperties;
}

function instanceWith(placement: InstancePlacement, overrides: Partial<GeometryInstance3DProperties> = {}) {
  const instance = new CulledInstance();
  instance.update(PLACE, properties(overrides));
  instance.hasBase = true;
  instance.placement = placement;
  return instance;
}

describe('CulledInstance.isPlaced', () => {
  it('is placed once its pose and its box are known', () => {
    expect(instanceWith(placedAt(new THREE.Vector3(), UNIT_BOX)).isPlaced).toBe(true);
  });

  it('is not placed before its drawer places it (error case)', () => {
    expect(instanceWith(UNPLACED).isPlaced).toBe(false);
  });

  it('is not placed before its geometry exists', () => {
    expect(instanceWith(placedAt(new THREE.Vector3(), null)).isPlaced).toBe(false);
  });

  it('is placed by its custom_aabb before its geometry exists (edge case)', () => {
    const instance = instanceWith(placedAt(new THREE.Vector3(), null), { customAabb: UNIT_BOX });
    expect(instance.isPlaced).toBe(true);
  });
});

describe('CulledInstance.worldBox', () => {
  it('moves its own box by the node pose', () => {
    const box = new THREE.Box3();
    instanceWith(placedAt(new THREE.Vector3(3, 0, 0), UNIT_BOX)).worldBox(box);
    expect(box.getCenter(new THREE.Vector3())).toEqual(new THREE.Vector3(3, 0, 0));
  });

  it('takes custom_aabb in place of its own box', () => {
    const custom: Aabb = { position: { x: 0, y: 0, z: 0 }, size: { x: 2, y: 2, z: 2 } };
    const box = new THREE.Box3();
    instanceWith(placedAt(new THREE.Vector3(3, 0, 0), UNIT_BOX), { customAabb: custom }).worldBox(box);
    expect(box.getCenter(new THREE.Vector3())).toEqual(new THREE.Vector3(4, 1, 1));
  });

  it('writes an empty box while it has no box, whatever the target held (edge case)', () => {
    const box = new THREE.Box3(new THREE.Vector3(1, 1, 1), new THREE.Vector3(2, 2, 2));
    instanceWith(placedAt(new THREE.Vector3(), null)).worldBox(box);
    expect(box.isEmpty()).toBe(true);
  });

  it('keeps a box with no surface a point at the node (edge case)', () => {
    const box = new THREE.Box3();
    instanceWith(placedAt(new THREE.Vector3(0, 2, 0), EMPTY_AABB)).worldBox(box);
    expect([box.min, box.max]).toEqual([new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, 2, 0)]);
  });
});

describe('CulledInstance.isIndexed', () => {
  it('indexes a base whose box has a surface', () => {
    expect(instanceWith(placedAt(new THREE.Vector3(), UNIT_BOX)).isIndexed).toBe(true);
  });

  it('does not index an instance with no geometry base (error case)', () => {
    const instance = instanceWith(placedAt(new THREE.Vector3(), UNIT_BOX));
    instance.hasBase = false;
    expect(instance.isIndexed).toBe(false);
  });

  it('does not index an instance hidden in the tree, which Godot unpairs (error case)', () => {
    const instance = instanceWith({
      ...placedAt(new THREE.Vector3(), UNIT_BOX),
      isVisibleInTree: () => false,
    });
    expect(instance.isIndexed).toBe(false);
  });

  it('does not index a base whose box has no surface (edge case)', () => {
    // `renderer_scene_cull.cpp:1675-1681`.
    expect(instanceWith(placedAt(new THREE.Vector3(), EMPTY_AABB)).isIndexed).toBe(false);
  });
});

describe('CulledInstance.apply', () => {
  it('fades each surface its drawer adds by the range fade and transparency', () => {
    const instance = instanceWith(placedAt(new THREE.Vector3(), UNIT_BOX), { transparency: 0.5 });
    const fades: number[] = [];
    instance.add({ applyFade: (fade) => fades.push(fade) });

    instance.apply(true, 0.5);

    expect([instance.isVisible, fades]).toEqual([true, [0.25]]);
  });

  it('stops fading a surface its drawer removes (edge case)', () => {
    const instance = instanceWith(placedAt(new THREE.Vector3(), UNIT_BOX));
    const fades: number[] = [];
    instance.add({ applyFade: (fade) => fades.push(fade) })();

    instance.apply(true, 1);

    expect(fades).toEqual([]);
  });
});

describe('CulledInstance.update', () => {
  it('takes the range, transparency and custom_aabb of the node', () => {
    const instance = instanceWith(UNPLACED, { transparency: 0.3, customAabb: UNIT_BOX });
    expect([instance.transparency, instance.customAabb]).toEqual([0.3, UNIT_BOX]);
  });

  it('keeps its links object while the links hold', () => {
    const instance = instanceWith(UNPLACED);
    const links = instance.links;
    instance.update({ ...PLACE, order: [0] }, properties());
    expect(instance.links).toBe(links);
  });

  it('hands the cull new links when a range appears (edge case)', () => {
    const instance = instanceWith(UNPLACED);
    instance.update(PLACE, properties({ visibilityRange: { ...NO_VISIBILITY_RANGE, end: 10 } }));
    expect(instance.links.hasRange).toBe(true);
  });
});
