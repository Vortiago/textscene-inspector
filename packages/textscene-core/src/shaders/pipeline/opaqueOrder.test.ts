import * as THREE from 'three';
import { WebGLRenderList } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import type { RenderItem } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import { describe, expect, it } from 'vitest';
import { installGodotOpaqueOrder } from './opaqueOrder';
import { createFirstOpaqueSentinel, createLastOpaqueSentinel } from './opaqueSentinel';
import { nearestGroupOrder } from '../../r3f/testing/paintOrder';

const CAMERA = new THREE.PerspectiveCamera();

type OpaqueOrder = (a: RenderItem, b: RenderItem) => number;

/** The sort `installGodotOpaqueOrder` gives a renderer. */
function godotOpaqueOrder(): OpaqueOrder {
  let order: OpaqueOrder | null = null;
  installGodotOpaqueOrder({
    setOpaqueSort: (given: OpaqueOrder) => (order = given),
  } as unknown as THREE.WebGLRenderer);
  return order!;
}

/** three's list as its JavaScript has it: its types lack the camera of `push` (`WebGLRenderLists.js:122`). */
interface RenderList {
  init(): void;
  push(
    ...item: [THREE.Object3D, THREE.BufferGeometry, THREE.Material, number, number, null, THREE.Camera]
  ): void;
  sort(
    customOpaqueSort: ((a: RenderItem, b: RenderItem) => number) | null,
    customTransparentSort: null
  ): void;
  readonly opaque: readonly { object: THREE.Object3D }[];
}

/** The opaque list three draws for `scene`, sorted by `order`, or by three's own sort for null. */
function sortedOpaqueList(scene: THREE.Scene, order: OpaqueOrder | null): THREE.Object3D[] {
  const list = new (WebGLRenderList as unknown as new () => RenderList)();
  list.init();
  scene.updateMatrixWorld();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const z = new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).z;
    list.push(
      mesh,
      mesh.geometry,
      mesh.material as THREE.Material,
      nearestGroupOrder(mesh),
      -z,
      null,
      CAMERA
    );
  });
  list.sort(order, null);
  return list.opaque.map((item) => item.object);
}

/** A mesh at `z` and `renderOrder`, whose material tests the stencil when `testsStencil` holds. */
function surface({ renderOrder = 0, z = 0, testsStencil = false, material = new THREE.MeshBasicMaterial() }) {
  material.stencilWrite = testsStencil;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
  mesh.renderOrder = renderOrder;
  mesh.position.z = z;
  return mesh;
}

describe('Godot’s opaque order', () => {
  it('draws a surface that tests the stencil after one that does not, whatever their render orders', () => {
    const stencil = surface({ renderOrder: -5, testsStencil: true });
    const plain = surface({ renderOrder: 5 });
    expect(sortedOpaqueList(new THREE.Scene().add(stencil, plain), godotOpaqueOrder())).toEqual([
      plain,
      stencil,
    ]);
  });

  it('keeps the sentinels at the ends of the list around a stencil surface', () => {
    const first = createFirstOpaqueSentinel('First', () => {});
    const last = createLastOpaqueSentinel('Last', () => {});
    const stencil = surface({ testsStencil: true });
    const scene = new THREE.Scene().add(last, stencil, first);
    expect(sortedOpaqueList(scene, godotOpaqueOrder())).toEqual([first.mesh, stencil, last.mesh]);
  });

  it('sorts as three does when no surface tests the stencil', () => {
    const shared = new THREE.MeshBasicMaterial();
    const scene = new THREE.Scene().add(
      surface({ renderOrder: 2, z: -1 }),
      surface({ z: -3, material: shared }),
      surface({ z: -2, material: shared }),
      surface({ renderOrder: -1, z: 1 }),
      surface({ z: 0 })
    );
    expect(sortedOpaqueList(scene, godotOpaqueOrder())).toEqual(sortedOpaqueList(scene, null));
  });
});
