/**
 * The surfaced mesh drawer at a buffer of instances: each part one instanced draw, and one more
 * for each `next_pass` link and for the overlay, all reading one set of instance matrices.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { ShadowCastingSetting } from '../../godot/rendering/rendering';
import { nextPassRenderOrder } from '../materials/passOrder';
import { shadowCastingEffects } from '../shadowCasting';
import { instancesAt, type MeshInstances } from './meshInstances';
import { SurfacedMeshDrawer } from './SurfacedMeshDrawer';
import {
  BLUE,
  GREEN,
  RED,
  YELLOW,
  albedos,
  boxOf,
  drawn,
  renderUnderInstance,
  underMaterials,
  useParts,
  type UnresolvedPart,
} from './testing/drawerHost';

const BOX = new THREE.BoxGeometry(1, 1, 1);

const TWO_PLACES = instancesAt([
  new THREE.Matrix4().makeTranslation(1, 0, 0),
  new THREE.Matrix4().makeTranslation(5, 0, 0),
]);

function AtInstances({ parts, instances }: { parts: readonly UnresolvedPart[]; instances: MeshInstances }) {
  return <SurfacedMeshDrawer parts={useParts(parts)} instances={instances} />;
}

async function boxesWith(materialId: string, properties: Parameters<typeof renderUnderInstance>[1] = {}) {
  const renderer = await renderUnderInstance(
    <AtInstances parts={[boxOf(BOX, materialId)]} instances={TWO_PLACES} />,
    properties
  );
  return drawn<THREE.InstancedMesh>(renderer);
}

/** The translation of instance `place` of `mesh`. */
function placeOf(mesh: THREE.InstancedMesh, place: number): number[] {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(place, matrix);
  return new THREE.Vector3().setFromMatrixPosition(matrix).toArray();
}

/** A box of two draw groups, one for each of two surfaces. */
function twoSurfaceBox(): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.clearGroups();
  geometry.addGroup(0, 18, 0);
  geometry.addGroup(18, 18, 1);
  return geometry;
}

/** One point, as `godotSurfacesGeometry` marks a points surface. */
function onePoint(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  geometry.userData = { godotDrawsPoints: true };
  return geometry;
}

describe('<SurfacedMeshDrawer> at instances', () => {
  it('draws a part once at every instance, over the geometry of the part', async () => {
    const [boxes] = await boxesWith('Green');

    expect(boxes!.isInstancedMesh).toBe(true);
    expect(boxes!.count).toBe(2);
    expect([placeOf(boxes!, 0), placeOf(boxes!, 1)]).toEqual([
      [1, 0, 0],
      [5, 0, 0],
    ]);
    expect(boxes!.geometry.getAttribute('position')).toBe(BOX.getAttribute('position'));
    expect(albedos(boxes!)).toEqual([GREEN]);
  });

  it('draws every surface of a part in one draw, each with its own material', async () => {
    const renderer = await renderUnderInstance(
      <AtInstances parts={[boxOf(twoSurfaceBox(), 'Green', 'Blue')]} instances={TWO_PLACES} />
    );

    expect(drawn(renderer).map(albedos)).toEqual([[GREEN, BLUE]]);
  });

  it('draws a points part as points at every instance, picked at each one', async () => {
    const renderer = await renderUnderInstance(
      <AtInstances parts={[boxOf(onePoint(), 'Green')]} instances={TWO_PLACES} />
    );

    const [points] = drawn<THREE.Points>(renderer, 'Points');
    expect((points!.geometry as THREE.InstancedBufferGeometry).instanceCount).toBe(2);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(5, 0, 10), new THREE.Vector3(0, 0, -1));
    points!.updateMatrixWorld();
    expect(raycaster.intersectObject(points!).map((hit) => hit.instanceId)).toEqual([1]);
  });

  it('draws a chain link as one more instanced draw that reads the same instances', async () => {
    const [own, link] = await boxesWith('GreenThenBlue');

    expect(albedos(link!)).toEqual([BLUE]);
    expect(link!.geometry).toBe(own!.geometry);
    expect(link!.count).toBe(2);
    // One write places both.
    expect(link!.instanceMatrix).toBe(own!.instanceMatrix);
    expect(link!.renderOrder).toBe(nextPassRenderOrder(1));
  });

  it('draws the link of each surface in the draw group of that surface alone', async () => {
    const renderer = await renderUnderInstance(
      <AtInstances
        parts={[boxOf(twoSurfaceBox(), 'GreenThenBlue', 'RedThenYellow')]}
        instances={TWO_PLACES}
      />
    );

    const [own, firstLink, secondLink] = drawn<THREE.InstancedMesh>(renderer);
    expect(albedos(own!)).toEqual([GREEN, RED]);
    expect(albedos(firstLink!)).toEqual([BLUE]);
    expect(albedos(secondLink!)).toEqual([YELLOW]);
    expect((firstLink!.material as THREE.Material[])[1]!.visible).toBe(false);
    expect((secondLink!.material as THREE.Material[])[0]!.visible).toBe(false);
    expect([firstLink!.renderOrder, secondLink!.renderOrder]).toEqual([
      nextPassRenderOrder(1),
      nextPassRenderOrder(1),
    ]);
  });

  it('draws the instance materials at every instance: the override, then the overlay and its chain', async () => {
    const draws = await boxesWith('GreenThenBlue', {
      layers: 2,
      materialOverride: 'SubResource("RedThenYellow")',
      materialOverlay: 'SubResource("ClearRedThenBlue")',
    });

    expect(draws.map(albedos)).toEqual([[RED], [YELLOW], [RED], [BLUE]]);
    const [own, , overlay] = draws;
    expect(overlay!.instanceMatrix).toBe(own!.instanceMatrix);
    // The overlay is a surface drawn again: it keeps the layers and receives shadows, and casts none.
    expect(draws.map((draw) => draw.userData.godotLayers)).toEqual([2, 2, 2, 2]);
    expect(overlay!.receiveShadow).toBe(true);
    expect(overlay!.castShadow).toBe(false);
  });

  it('culls and frames by the bounds of every instance, on each draw', async () => {
    const [own, link] = await boxesWith('GreenThenBlue');

    for (const draw of [own!, link!]) {
      expect(draw.frustumCulled).toBe(true);
      expect(draw.boundingBox!.min.toArray()).toEqual([0.5, -0.5, -0.5]);
      expect(draw.boundingBox!.max.toArray()).toEqual([5.5, 0.5, 0.5]);
    }
  });

  it('leaves the culling of a buffer with no bounds to the scene cull', async () => {
    const unbounded: MeshInstances = { ...TWO_PLACES, boundsOver: () => null };
    const renderer = await renderUnderInstance(
      <AtInstances parts={[boxOf(BOX, 'GreenThenBlue')]} instances={unbounded} />
    );

    for (const draw of drawn(renderer)) {
      expect(draw.frustumCulled).toBe(false);
      expect(draw.userData).toMatchObject({ godotBoxless: true });
    }
  });

  it('writes a new buffer of the same count into the draws it has, and builds each draw again for another count', async () => {
    const renderer = await ReactThreeTestRenderer.create(tile(TWO_PLACES));
    const [first] = drawn<THREE.InstancedMesh>(renderer);

    await renderer.update(
      tile(instancesAt([new THREE.Matrix4().makeTranslation(0, 7, 0), new THREE.Matrix4()]))
    );
    const [moved] = drawn<THREE.InstancedMesh>(renderer);
    expect(moved).toBe(first);
    expect(placeOf(moved!, 0)).toEqual([0, 7, 0]);
    expect(moved!.boundingBox!.max.y).toBe(7.5);

    await renderer.update(tile(instancesAt([new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()])));
    const [grown] = drawn<THREE.InstancedMesh>(renderer);
    expect(grown).not.toBe(first);
    expect(grown!.count).toBe(3);
  });

  it('draws for an owner under no GeometryInstance3D, with the shadow hooks and layers of that owner', async () => {
    const renderer = await ReactThreeTestRenderer.create(tile(TWO_PLACES));

    const [own, link] = drawn<THREE.InstancedMesh>(renderer);
    expect(own!.castShadow).toBe(false);
    expect([own!.userData.godotLayers, link!.userData.godotLayers]).toEqual([4, 4]);
  });
});

const TILE_OWNER = { shadow: shadowCastingEffects(ShadowCastingSetting.OFF), layers: 4 };

/** A chained box at `instances`, drawn by an owner that is no GeometryInstance3D, as a GridMap tile is. */
function Tile({ instances }: { instances: MeshInstances }) {
  return (
    <SurfacedMeshDrawer
      parts={useParts([boxOf(BOX, 'GreenThenBlue')])}
      instances={instances}
      owner={TILE_OWNER}
    />
  );
}

function tile(instances: MeshInstances) {
  return underMaterials(<Tile instances={instances} />);
}
