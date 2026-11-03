import * as THREE from 'three';
import { WebGLRenderList } from 'three/src/renderers/webgl/WebGLRenderLists.js';
import { describe, expect, it } from 'vitest';
import { createFirstOpaqueSentinel, createLastOpaqueSentinel } from './opaqueSentinel';
import { nearestGroupOrder } from './testing/paintOrder';

const CAMERA = new THREE.PerspectiveCamera();

/** three's own list as its JavaScript has it: its types lack the camera `push` takes (`WebGLRenderLists.js:122`). */
interface RenderList {
  init(): void;
  push(
    ...item: [THREE.Object3D, THREE.BufferGeometry, THREE.Material, number, number, null, THREE.Camera]
  ): void;
  sort(customOpaqueSort: null, customTransparentSort: null): void;
  readonly opaque: readonly { object: THREE.Object3D }[];
}

/** The opaque list three draws for `scene`, sorted. */
function sortedOpaqueList(scene: THREE.Scene): THREE.Object3D[] {
  const list = new (WebGLRenderList as unknown as new () => RenderList)();
  list.init();
  scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    list.push(mesh, mesh.geometry, mesh.material as THREE.Material, nearestGroupOrder(mesh), 0, null, CAMERA);
  });
  list.sort(null, null);
  return list.opaque.map((item) => item.object);
}

function groupOf(renderOrder: number, child: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.renderOrder = renderOrder;
  group.add(child);
  return group;
}

const surface = () => new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());

/** The sentinels and the order three sorts them in among a surface below them and one above. */
function sortedAround(belowGroupOrder: number, aboveGroupOrder: number) {
  const first = createFirstOpaqueSentinel('First', () => {});
  const last = createLastOpaqueSentinel('Last', () => {});
  const below = surface();
  const above = surface();
  const scene = new THREE.Scene();
  scene.add(groupOf(belowGroupOrder, below), first, last, groupOf(aboveGroupOrder, above));
  return { sorted: sortedOpaqueList(scene), expected: [first.mesh, below, above, last.mesh] };
}

describe('the opaque sentinels', () => {
  it("draw at the ends of the opaque list, past any Group's renderOrder", () => {
    const { sorted, expected } = sortedAround(-1000, 1000);
    expect(sorted).toEqual(expected);
  });

  it('draw at the ends past a Group at their own group order, as a gizmo Group has (edge case)', () => {
    const { sorted, expected } = sortedAround(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    expect(sorted).toEqual(expected);
  });

  it('are never culled, take no pick and leave no mark of their own (edge case)', () => {
    const { mesh } = createFirstOpaqueSentinel('First', () => {});
    const hits: THREE.Intersection[] = [];
    mesh.raycast(new THREE.Raycaster(), hits);
    expect(hits).toEqual([]);
    expect(mesh.frustumCulled).toBe(false);
    expect(mesh.material).toMatchObject({ colorWrite: false, depthWrite: false });
    expect(mesh.castShadow).toBe(false);
  });
});
