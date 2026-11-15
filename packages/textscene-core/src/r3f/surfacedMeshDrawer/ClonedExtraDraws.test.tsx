/**
 * The surfaced mesh drawer's adapter for a cloned object: each `next_pass` link and the overlay
 * mount as a sibling draw of the surface they cover, and leave the clone as it was on release.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { surfaceSlotsUnder } from '../../resources/formats/glb/surfaceMaterials';
import { nodeMaterial } from '../materials/materialReference';
import { OVERLAY_ORDINAL_PAST_CHAINS, nextPassRenderOrder } from '../materials/passOrder';
import { GLTF_SURFACE } from '../materials/surfaceTextures';
import { useSurfaceMaterial } from '../materials/useSurfaceMaterial';
import { useSceneResources } from '../SceneResourcesContext';
import { setVisualLayers } from '../visualLayers';
import { ClonedChain, ClonedOverlay, isClonedExtraDraw } from './ClonedExtraDraws';
import { BLUE, MAGENTA, RED, YELLOW, albedos, underMaterials } from './testing/drawerHost';

/** A clone of one mesh named `road` under a root, as a GLB arrives. */
function cloneOf(road: THREE.Object3D): THREE.Object3D {
  const root = new THREE.Group();
  road.name = 'road';
  root.add(road);
  return root;
}

function boxMesh(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
}

/** The draws beside the road, in the order of their passes. */
function extraDrawsOf(clone: THREE.Object3D): THREE.Mesh[] {
  return (clone.children.filter((child) => child.name !== 'road') as THREE.Mesh[]).sort(
    (a, b) => a.renderOrder - b.renderOrder
  );
}

/** The chain of the material `id` names, which a caller drew on every surface of the clone. */
function Chain({ clone, id }: { clone: THREE.Object3D; id: string }) {
  const source = nodeMaterial(`SubResource("${id}")`, useSceneResources());
  const drawn = useSurfaceMaterial(source, GLTF_SURFACE);
  return source ? <ClonedChain covered={surfaceSlotsUnder(clone)} source={source} drawn={drawn} /> : null;
}

function Overlay({ clone, id }: { clone: THREE.Object3D; id: string }) {
  const source = nodeMaterial(`SubResource("${id}")`, useSceneResources());
  return source ? <ClonedOverlay slots={surfaceSlotsUnder(clone)} source={source} /> : null;
}

describe('the extra draws of a cloned mesh', () => {
  it('mounts each link as a sibling of the surface it covers, over the same geometry', async () => {
    const road = boxMesh();
    const clone = cloneOf(road);

    await ReactThreeTestRenderer.create(underMaterials(<Chain clone={clone} id="GreenThenBlueThenYellow" />));

    const [first, second] = extraDrawsOf(clone);
    expect(extraDrawsOf(clone).map(albedos)).toEqual([[BLUE], [YELLOW]]);
    expect(first!.geometry).toBe(road.geometry);
    expect([first!.renderOrder, second!.renderOrder]).toEqual([
      nextPassRenderOrder(1),
      nextPassRenderOrder(2),
    ]);
    expect(isClonedExtraDraw(first!)).toBe(true);
    expect(isClonedExtraDraw(road)).toBe(false);
  });

  it('takes the settings of an extra draw: it is picked nowhere and receives shadows', async () => {
    const clone = cloneOf(boxMesh());

    await ReactThreeTestRenderer.create(underMaterials(<Chain clone={clone} id="GreenThenBlue" />));

    const [link] = extraDrawsOf(clone);
    clone.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(link!)).toEqual([]);
    expect(link!.receiveShadow).toBe(true);
  });

  it('draws each material of a hand-written cyclic chain once', async () => {
    const clone = cloneOf(boxMesh());

    await ReactThreeTestRenderer.create(underMaterials(<Chain clone={clone} id="OrangeThenMagenta" />));

    expect(extraDrawsOf(clone).map(albedos)).toEqual([[MAGENTA]]);
  });

  it('draws an instanced surface again at the instances and with the draw state of its holder', async () => {
    // The gpu-instancing of a glTF arrives as an InstancedMesh.
    const road = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial(), 2);
    setVisualLayers(road, 4);
    road.frustumCulled = false;
    road.onBeforeRender = () => undefined;
    const clone = cloneOf(road);

    await ReactThreeTestRenderer.create(underMaterials(<Chain clone={clone} id="GreenThenBlue" />));

    const [link] = extraDrawsOf(clone) as THREE.InstancedMesh[];
    expect(link!.count).toBe(2);
    expect(link!.instanceMatrix).toBe(road.instanceMatrix);
    expect(link!.frustumCulled).toBe(false);
    expect(link!.userData.godotLayers).toBe(4);
    expect(link!.onBeforeRender).toBe(road.onBeforeRender);
  });

  it('draws the overlay once over each holder, with the chain of the overlay after it', async () => {
    const clone = cloneOf(boxMesh());

    await ReactThreeTestRenderer.create(underMaterials(<Overlay clone={clone} id="ClearRedThenBlue" />));

    const draws = extraDrawsOf(clone);
    expect(draws.map(albedos).sort()).toEqual([[BLUE], [RED]].sort());
    const overlay = draws.find((draw) => albedos(draw)[0] === RED);
    const link = draws.find((draw) => albedos(draw)[0] === BLUE);
    // The overlay is in the alpha pass, where a later draw of the instance draws first (`passOrder.ts`).
    expect(overlay!.renderOrder).toBe(-nextPassRenderOrder(OVERLAY_ORDINAL_PAST_CHAINS));
    expect(link!.renderOrder).toBe(nextPassRenderOrder(OVERLAY_ORDINAL_PAST_CHAINS + 1));
  });

  it('leaves the clone as it was when the chain unmounts', async () => {
    const clone = cloneOf(boxMesh());
    const renderer = await ReactThreeTestRenderer.create(
      underMaterials(<Chain clone={clone} id="GreenThenBlue" />)
    );
    const [link] = extraDrawsOf(clone);

    await renderer.unmount();

    expect(clone.children.map((child) => child.name)).toEqual(['road']);
    expect(isClonedExtraDraw(link!)).toBe(false);
  });
});
