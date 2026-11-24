import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneProvider } from './TscnSceneProvider';
import { TscnSceneContents } from './TscnCanvas';
import { openScene, type Scene } from '../scene/openScene';
import { visibleInTree } from './visibleInTree';
import { ControlCanvasLayer } from './controls/native/ControlCanvasLayer';
import { settleLoads } from './testing/settleLoads';
import './nodes/index';
import './controls/index';

const CSG_SCENE = `[gd_scene format=3]

[node name="Root" type="CSGCombiner3D"]

[node name="Kept" type="CSGBox3D" parent="."]
size = Vector3(1, 1, 1)

[node name="Far" type="CSGBox3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0)
size = Vector3(4, 4, 4)
`;

const CONTAINER_SCENE = `[gd_scene format=3]

[node name="Column" type="VBoxContainer"]
offset_right = 100.0
offset_bottom = 200.0

[node name="First" type="ColorRect" parent="."]
custom_minimum_size = Vector2(0, 40)

[node name="Second" type="ColorRect" parent="."]
custom_minimum_size = Vector2(0, 40)
`;

const TABS_SCENE = `[gd_scene format=3]

[node name="Tabs" type="TabContainer"]
offset_right = 200.0
offset_bottom = 200.0

[node name="First" type="ColorRect" parent="."]

[node name="Second" type="ColorRect" parent="."]
`;

type Drawn = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

async function draw(scene: Scene): Promise<Drawn> {
  const renderer = await ReactThreeTestRenderer.create(
    <TscnSceneProvider scene={scene}>
      <TscnSceneContents />
    </TscnSceneProvider>
  );
  await settleLoads();
  return renderer;
}

async function hide(scene: Scene, path: string): Promise<void> {
  await ReactThreeTestRenderer.act(async () => {
    await scene.getNode(path).set('visible', false);
    await settleLoads();
  });
}

/** The written scene's Controls, as the 2D view's Control layer lays them out. */
async function drawControls(scene: Scene): Promise<Drawn> {
  const graph = scene.written()!;
  const nodes = graph.scenes.get(graph.rootScene)!.nodes;
  return ReactThreeTestRenderer.create(<ControlCanvasLayer nodes={nodes} />);
}

/** The box of every mesh the view draws, in world space. */
function drawnBounds(renderer: Drawn): THREE.Box3 {
  const bounds = new THREE.Box3();
  renderer.scene.instance.updateMatrixWorld(true);
  renderer.scene.instance.traverse((object) => {
    if (object instanceof THREE.Mesh && visibleInTree(object)) bounds.expandByObject(object);
  });
  return bounds;
}

function groupNamed(renderer: Drawn, name: string): THREE.Object3D {
  const found = renderer.scene.instance.getObjectByName(name);
  if (!found) throw new Error(`expected an object named ${name}, found none`);
  return found;
}

describe("a host's visible = false", () => {
  it("takes a CSG child out of its parent's result", async () => {
    const scene = openScene({ source: CSG_SCENE, provider: { loadResource: async () => null } });
    const renderer = await draw(scene);
    expect(drawnBounds(renderer).max.x).toBeCloseTo(10, 5);

    await hide(scene, '/root/Root/Far');

    expect(drawnBounds(renderer).max.x).toBeCloseTo(0.5, 5);
  });

  it('hides a root Control', async () => {
    const scene = openScene({ source: CONTAINER_SCENE, provider: { loadResource: async () => null } });

    await scene.getNode('/root/Column').set('visible', false);

    expect(groupNamed(await drawControls(scene), 'VBoxContainer:Column').visible).toBe(false);
  });

  it('takes a Container child out of its slot', async () => {
    const scene = openScene({ source: CONTAINER_SCENE, provider: { loadResource: async () => null } });
    const firstSlot = groupNamed(await drawControls(scene), 'ColorRect:First').position.clone();

    await scene.getNode('/root/Column/First').set('visible', false);

    expect(groupNamed(await drawControls(scene), 'ColorRect:Second').position).toEqual(firstSlot);
  });

  it('draws the TabContainer page it shows, not the page before (tab_container.cpp:619-620)', async () => {
    const scene = openScene({ source: TABS_SCENE, provider: { loadResource: async () => null } });

    await scene.getNode('/root/Tabs/Second').set('visible', true);

    const drawn = await drawControls(scene);
    expect(groupNamed(drawn, 'ColorRect:Second').visible).toBe(true);
    expect(groupNamed(drawn, 'ColorRect:First').visible).toBe(false);
  });
});
