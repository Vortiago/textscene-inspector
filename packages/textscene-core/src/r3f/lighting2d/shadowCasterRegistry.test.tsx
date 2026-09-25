import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import * as THREE from 'three';
import {
  createShadowCasterRegistry,
  ShadowCasterProvider,
  useShadowCaster,
  useShadowCasterRegistry,
  visibleInTree,
  worldShadowCasters,
  type ShadowCaster,
  type ShadowCasterRegistry,
} from './shadowCasterRegistry';
import { OCCLUDER_CULL_CLOCKWISE, OCCLUDER_CULL_DISABLED } from './shadowVolumes';

/** A caster whose local segments run from (0,0) to (10,0), under `object`. */
function caster(object: THREE.Object3D, overrides: Partial<ShadowCaster> = {}): ShadowCaster {
  return {
    segments: new Float32Array([0, 0, 0, 10, 0, 0]),
    cullMode: OCCLUDER_CULL_DISABLED,
    occluderLightMask: 1,
    object,
    ...overrides,
  };
}

function parented(): THREE.Group {
  const root = new THREE.Group();
  const child = new THREE.Group();
  root.add(child);
  return child;
}

describe('createShadowCasterRegistry', () => {
  it('starts empty at version 0', () => {
    const registry = createShadowCasterRegistry();
    expect(registry.casters()).toEqual([]);
    expect(registry.version()).toBe(0);
  });

  it('lists what was added and bumps the version', () => {
    const registry = createShadowCasterRegistry();
    const one = caster(new THREE.Group());
    registry.add(one);
    expect(registry.casters()).toEqual([one]);
    expect(registry.version()).toBe(1);
  });

  it('withdraws through the returned disposer', () => {
    const registry = createShadowCasterRegistry();
    const remove = registry.add(caster(new THREE.Group()));
    remove();
    expect(registry.casters()).toEqual([]);
    expect(registry.version()).toBe(2);
  });

  it('does not bump the version when a disposer runs twice', () => {
    const registry = createShadowCasterRegistry();
    const remove = registry.add(caster(new THREE.Group()));
    remove();
    remove();
    expect(registry.version()).toBe(2);
  });

  it('hands back a snapshot, not the live set', () => {
    const registry = createShadowCasterRegistry();
    registry.add(caster(new THREE.Group()));
    const snapshot = registry.casters();
    registry.add(caster(new THREE.Group()));
    expect(snapshot).toHaveLength(1);
    expect(registry.casters()).toHaveLength(2);
  });

  it('hands back the same snapshot until an add or a withdrawal, so a frame allocates none', () => {
    const registry = createShadowCasterRegistry();
    const withdraw = registry.add(caster(new THREE.Group()));
    const snapshot = registry.casters();
    expect(registry.casters()).toBe(snapshot);

    withdraw();
    const afterWithdrawal = registry.casters();
    expect(afterWithdrawal).not.toBe(snapshot);
    expect(afterWithdrawal).toEqual([]);
    expect(registry.casters()).toBe(afterWithdrawal);
  });

  it('notifies and then stops notifying subscribers', () => {
    const registry = createShadowCasterRegistry();
    const listener = vi.fn();
    const unsubscribe = registry.subscribe(listener);
    const remove = registry.add(caster(new THREE.Group()));
    remove();
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    registry.add(caster(new THREE.Group()));
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('visibleInTree', () => {
  it('is true for a visible object under a visible parent', () => {
    expect(visibleInTree(parented())).toBe(true);
  });

  it('is false when the object itself is hidden', () => {
    const child = parented();
    child.visible = false;
    expect(visibleInTree(child)).toBe(false);
  });

  it('is false when an ancestor is hidden', () => {
    const child = parented();
    child.parent!.visible = false;
    expect(visibleInTree(child)).toBe(false);
  });
});

describe('worldShadowCasters', () => {
  it('is empty without a registry', () => {
    expect(worldShadowCasters(null, 1)).toEqual([]);
  });

  it('flattens xyz local segments to world-space xy pairs', () => {
    const registry = createShadowCasterRegistry();
    const group = new THREE.Group();
    group.position.set(100, -50, 0);
    registry.add(caster(group));

    const [entry] = worldShadowCasters(registry, 1);
    expect(Array.from(entry!.segments)).toEqual([100, -50, 110, -50]);
  });

  it('picks up a transform applied after registration', () => {
    const registry = createShadowCasterRegistry();
    const group = new THREE.Group();
    registry.add(caster(group));
    group.position.set(5, 5, 0);

    const [entry] = worldShadowCasters(registry, 1);
    expect(Array.from(entry!.segments)).toEqual([5, 5, 15, 5]);
  });

  it('composes an ancestor transform the occluder sits under', () => {
    const registry = createShadowCasterRegistry();
    const child = parented();
    child.parent!.scale.set(2, 2, 1);
    child.position.set(3, 0, 0);
    registry.add(caster(child));

    const [entry] = worldShadowCasters(registry, 1);
    expect(Array.from(entry!.segments)).toEqual([6, 0, 26, 0]);
  });

  it('carries the cull mode through', () => {
    const registry = createShadowCasterRegistry();
    registry.add(caster(new THREE.Group(), { cullMode: OCCLUDER_CULL_CLOCKWISE }));
    expect(worldShadowCasters(registry, 1)[0]!.cullMode).toBe(OCCLUDER_CULL_CLOCKWISE);
  });

  it('keeps every mask, and carries it through, when no mask is given', () => {
    const registry = createShadowCasterRegistry();
    registry.add(caster(new THREE.Group(), { occluderLightMask: 2 }));
    registry.add(caster(new THREE.Group(), { occluderLightMask: 4 }));
    expect(worldShadowCasters(registry).map((c) => c.occluderLightMask).sort()).toEqual([2, 4]);
  });

  it('drops a caster whose occluder_light_mask misses the light', () => {
    const registry = createShadowCasterRegistry();
    registry.add(caster(new THREE.Group(), { occluderLightMask: 2 }));
    expect(worldShadowCasters(registry, 1)).toEqual([]);
    expect(worldShadowCasters(registry, 2)).toHaveLength(1);
    expect(worldShadowCasters(registry, 3)).toHaveLength(1);
  });

  it('matches on the top mask bit without tripping over signed 32-bit maths', () => {
    const registry = createShadowCasterRegistry();
    registry.add(caster(new THREE.Group(), { occluderLightMask: 0x80000000 }));
    expect(worldShadowCasters(registry, 0x80000000)).toHaveLength(1);
    expect(worldShadowCasters(registry, 0x7fffffff)).toEqual([]);
  });

  it('drops a caster with mask 0, which no light can select', () => {
    const registry = createShadowCasterRegistry();
    registry.add(caster(new THREE.Group(), { occluderLightMask: 0 }));
    expect(worldShadowCasters(registry, 0xffffffff)).toEqual([]);
  });

  it('drops a hidden caster', () => {
    const registry = createShadowCasterRegistry();
    const child = parented();
    child.parent!.visible = false;
    registry.add(caster(child));
    expect(worldShadowCasters(registry, 1)).toEqual([]);
  });

  it('drops a caster with fewer than two points', () => {
    const registry = createShadowCasterRegistry();
    registry.add(caster(new THREE.Group(), { segments: new Float32Array([0, 0, 0]) }));
    expect(worldShadowCasters(registry, 1)).toEqual([]);
  });
});

describe('useShadowCaster', () => {
  function Publisher({ value }: { value: ShadowCaster | null }) {
    useShadowCaster(value);
    return null;
  }

  it('is a silent no-op with no provider above it', () => {
    expect(() => render(<Publisher value={caster(new THREE.Group())} />)).not.toThrow();
  });

  it('publishes while mounted and withdraws on unmount', () => {
    const registry = createShadowCasterRegistry();
    const view = render(
      <ShadowCasterProvider registry={registry}>
        <Publisher value={caster(new THREE.Group())} />
      </ShadowCasterProvider>
    );
    expect(registry.casters()).toHaveLength(1);
    view.unmount();
    expect(registry.casters()).toEqual([]);
  });

  it('publishes nothing for a null caster', () => {
    const registry = createShadowCasterRegistry();
    render(
      <ShadowCasterProvider registry={registry}>
        <Publisher value={null} />
      </ShadowCasterProvider>
    );
    expect(registry.casters()).toEqual([]);
  });

  it('replaces rather than duplicates when the caster changes', () => {
    const registry = createShadowCasterRegistry();
    const next = caster(new THREE.Group(), { occluderLightMask: 8 });
    const view = render(
      <ShadowCasterProvider registry={registry}>
        <Publisher value={caster(new THREE.Group())} />
      </ShadowCasterProvider>
    );
    view.rerender(
      <ShadowCasterProvider registry={registry}>
        <Publisher value={next} />
      </ShadowCasterProvider>
    );
    expect(registry.casters()).toEqual([next]);
  });
});

describe('ShadowCasterProvider', () => {
  function Probe({ onRegistry }: { onRegistry: (r: ShadowCasterRegistry | null) => void }) {
    onRegistry(useShadowCasterRegistry());
    return null;
  }

  it('exposes null outside any provider', () => {
    const seen: (ShadowCasterRegistry | null)[] = [];
    render(<Probe onRegistry={(r) => seen.push(r)} />);
    expect(seen[0]).toBeNull();
  });

  it('shares the registry it was handed', () => {
    const registry = createShadowCasterRegistry();
    const seen: (ShadowCasterRegistry | null)[] = [];
    render(
      <ShadowCasterProvider registry={registry}>
        <Probe onRegistry={(r) => seen.push(r)} />
      </ShadowCasterProvider>
    );
    expect(seen[0]).toBe(registry);
  });

  it('creates its own registry when handed none', () => {
    const seen: (ShadowCasterRegistry | null)[] = [];
    render(
      <ShadowCasterProvider>
        <Probe onRegistry={(r) => seen.push(r)} />
      </ShadowCasterProvider>
    );
    expect(seen[0]).not.toBeNull();
  });
});
