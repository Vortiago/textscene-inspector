/** `instanceLightmap`: the lightmap of one instance, which both draw adapters read. */
import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { LightmapUser } from '../../resources/lightmapgidata/types';
import { instanceLightmap } from './instanceLightmap';
import { assignedUsers, LightmapInstance, lightmapsOf } from './sceneLightmaps';

const FLOOR = 'Root/Floor';
const GRID = 'Root/Grid';

function user(path: string, subInstance = -1): LightmapUser {
  return { path, uvScale: { x: 0, y: 0, width: 1, height: 1 }, sliceIndex: 0, subInstance };
}

/** A LightmapGI at `Root/Lightmap` whose data names `users`. */
function lightmapNaming(...users: LightmapUser[]): LightmapInstance {
  const lightmap = new LightmapInstance(new THREE.Object3D());
  lightmap.users = assignedUsers('Root/Lightmap', users, undefined);
  return lightmap;
}

describe('instanceLightmap', () => {
  it('reads the assignment of the LightmapGI that names the node', () => {
    const scene = new THREE.Scene();
    const floor = user('../Floor');
    const lightmap = lightmapNaming(floor);
    lightmapsOf(scene).add(lightmap);

    expect(instanceLightmap(scene, FLOOR).read()).toEqual({ lightmap, user: floor });
  });

  it('reads none for a node no LightmapGI names', () => {
    const scene = new THREE.Scene();
    lightmapsOf(scene).add(lightmapNaming(user('../Floor')));

    expect(instanceLightmap(scene, 'Root/Wall').read()).toBeNull();
  });

  it('reads none for an instance with no path, which nothing can name', () => {
    const scene = new THREE.Scene();
    lightmapsOf(scene).add(lightmapNaming(user('../Floor')));

    expect(instanceLightmap(scene, null).read()).toBeNull();
  });

  it('reads the assignment of a baked mesh by its index, apart from its node', () => {
    const scene = new THREE.Scene();
    const second = user('../Grid', 1);
    lightmapsOf(scene).add(lightmapNaming(second));

    expect(instanceLightmap(scene, GRID, 1).read()?.user).toBe(second);
    expect(instanceLightmap(scene, GRID).read()).toBeNull();
  });

  it('tells its reader when a LightmapGI enters, until the reader leaves', () => {
    const scene = new THREE.Scene();
    const floor = instanceLightmap(scene, FLOOR);
    const onChange = vi.fn();
    const leave = floor.subscribe(onChange);

    const remove = lightmapsOf(scene).add(lightmapNaming(user('../Floor')));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(floor.read()).not.toBeNull();

    leave();
    remove();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
