import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { heading } from '../../parser/testing/parserKit';
import { parseDecal } from '../../nodes/3d/decal/parser';
import { holdDecalTexture, releaseDecalTexture } from '../../nodes/3d/decal/decalAtlas';
import { testRenderer } from '../../testing/recordingWebGL';
import { fireSceneRender, fireSceneRenderEnd } from '../testing/fireSceneRender';
import { renderWithMipmapBias } from '../materials/godotMipmapBias';
import { markEditorHelper } from '../editorHelpers';
import { instanceLayers } from '../instanceLayers/instanceLayersChunk';
import { visualLayersOf } from '../visualLayers';
import { GODOT_DEFAULT_VISUAL_LAYERS, GODOT_EDITOR_GIZMO_LAYERS } from '../../godot/scene/visualLayers';
import { DecalObject } from './decalObject';
import { DecalRows } from './decalRows';
import { SceneDecals } from './sceneDecals';
import { SHOWN_COUNT, SHOWN_MIPMAP_BIAS, shownDecals } from './decalSlots';

const held: THREE.Texture[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  shownDecals.fill(0);
  for (const texture of held.splice(0)) releaseDecalTexture(texture);
});

function texture(): THREE.Texture {
  const data = new Uint8Array(16 * 16 * 4).fill(255);
  const albedo = new THREE.DataTexture(data, 16, 16, THREE.RGBAFormat);
  albedo.needsUpdate = true;
  holdDecalTexture(albedo);
  held.push(albedo);
  return albedo;
}

function decalObject(properties: Record<string, string> = {}, treeOrder = [0]): DecalObject {
  const object = new DecalObject();
  object.look = parseDecal(heading('Decal', { name: 'Decal' }), properties);
  object.albedo = texture();
  object.treeOrder = treeOrder;
  return object;
}

async function sceneWith(...decals: DecalObject[]) {
  const { renderer } = await testRenderer();
  // The stand-in context reports no `MAX_TEXTURE_SIZE`.
  renderer.capabilities.maxTextureSize = 4096;
  const scene = new THREE.Scene();
  scene.add(...decals);
  const sceneDecals = new SceneDecals(renderer, scene);
  const camera = new THREE.PerspectiveCamera();
  camera.updateMatrixWorld();
  /** One render of the scene, which shows the decals before it draws and none after. */
  const render = () => {
    scene.updateMatrixWorld();
    fireSceneRender(scene, camera);
  };
  const endRender = () => fireSceneRenderEnd(scene, camera);
  return { renderer, scene, sceneDecals, camera, render, endRender };
}

describe('SceneDecals', () => {
  it('shows the number of decals to a render of the scene', async () => {
    const { render } = await sceneWith(decalObject(), decalObject({}, [1]));

    render();

    expect(shownDecals[SHOWN_COUNT]).toBe(2);
  });

  it('shows no decal once the render ends, so another scene draws none', async () => {
    const { render, endRender } = await sceneWith(decalObject());
    render();

    endRender();

    expect(shownDecals[SHOWN_COUNT]).toBe(0);
  });

  it('shows no decal that is hidden, or under a hidden node', async () => {
    const hidden = decalObject();
    hidden.visible = false;
    const under = decalObject({}, [1]);
    const group = new THREE.Group();
    group.visible = false;
    group.add(under);
    const { scene, render } = await sceneWith(hidden);
    scene.add(group);

    render();

    expect(shownDecals[SHOWN_COUNT]).toBe(0);
  });

  it('shows no decal whose texture has not loaded', async () => {
    const unloaded = decalObject();
    unloaded.albedo = null;
    const { render } = await sceneWith(unloaded);

    render();

    expect(shownDecals[SHOWN_COUNT]).toBe(0);
  });

  it('reads the decal where it stands at each render, with no change to its props', async () => {
    const decal = decalObject();
    const { render } = await sceneWith(decal);
    const pack = vi.spyOn(DecalRows.prototype, 'pack');
    render();
    decal.position.x = 4;

    render();

    const [drawn] = pack.mock.calls[1]![0];
    expect(drawn!.matrixWorld.elements[12]).toBe(4);
  });

  it('packs the decals in tree order, whatever order they mount in', async () => {
    const second = decalObject({}, [1]);
    second.position.x = 2;
    const first = decalObject({}, [0]);
    first.position.x = 1;
    const { render } = await sceneWith(second, first);
    const pack = vi.spyOn(DecalRows.prototype, 'pack');

    render();

    expect(pack.mock.calls[0]![0].map((drawn) => drawn.matrixWorld.elements[12])).toEqual([1, 2]);
  });

  it('packs each decal with its place in the decal atlas', async () => {
    const { render } = await sceneWith(decalObject());
    const pack = vi.spyOn(DecalRows.prototype, 'pack');

    render();

    expect(pack.mock.calls[0]![0][0]!.albedoRect).toMatchObject({ width: expect.any(Number) });
  });

  it('packs the view of the camera that renders the scene', async () => {
    const { render, camera } = await sceneWith(decalObject());
    const pack = vi.spyOn(DecalRows.prototype, 'pack');
    camera.position.set(3, 0, 0);
    camera.updateMatrixWorld();

    render();

    expect(pack.mock.calls[0]![1].elements[12]).toBe(3);
  });

  it('shows the mipmap bias of the render', async () => {
    const { render } = await sceneWith(decalObject());

    renderWithMipmapBias(-1.5, render);

    expect(shownDecals[SHOWN_MIPMAP_BIAS]).toBe(-1.5);
  });

  it('packs nothing once it is disposed', async () => {
    const { render, sceneDecals } = await sceneWith(decalObject());
    const pack = vi.spyOn(DecalRows.prototype, 'pack');

    sceneDecals.dispose();
    render();

    expect(pack).not.toHaveBeenCalled();
  });
});

describe('SceneDecals editor chrome', () => {
  function chromeMesh(): THREE.Mesh {
    const chrome = new THREE.Group();
    markEditorHelper(chrome);
    const mesh = new THREE.Mesh();
    chrome.add(mesh);
    return mesh;
  }

  /** Runs `draw`, a draw of `mesh` as three runs it. */
  function drawn(mesh: THREE.Mesh, renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const args = [renderer, scene, camera, mesh.geometry, mesh.material, null] as unknown as Parameters<
      THREE.Object3D['onBeforeRender']
    >;
    mesh.onBeforeRender(...args);
    const layersDuringDraw = instanceLayers[0];
    mesh.onAfterRender(...args);
    return layersDuringDraw;
  }

  it("draws the chrome on Godot's gizmo layer, which no decal mask meets", async () => {
    const mesh = chromeMesh();
    const { scene, render, renderer } = await sceneWith(decalObject());
    scene.add(mesh.parent!);

    render();

    expect(drawn(mesh, renderer, scene, new THREE.PerspectiveCamera())).toBe(GODOT_EDITOR_GIZMO_LAYERS);
  });

  it('puts the default layers back after the chrome draws', async () => {
    const mesh = chromeMesh();
    const { scene, render, renderer } = await sceneWith(decalObject());
    scene.add(mesh.parent!);
    render();

    drawn(mesh, renderer, scene, new THREE.PerspectiveCamera());

    expect(instanceLayers[0]).toBe(GODOT_DEFAULT_VISUAL_LAYERS);
  });

  it('keeps the hooks the chrome had', async () => {
    const mesh = chromeMesh();
    const earlier = vi.fn();
    mesh.onBeforeRender = earlier;
    const { scene, render, renderer } = await sceneWith(decalObject());
    scene.add(mesh.parent!);
    render();

    drawn(mesh, renderer, scene, new THREE.PerspectiveCamera());

    expect(earlier).toHaveBeenCalledOnce();
  });

  it('leaves a surface on the layers its node gave it', async () => {
    const surface = new THREE.Mesh();
    const { scene, render } = await sceneWith(decalObject());
    scene.add(surface);

    render();

    expect(visualLayersOf(surface)).toBe(GODOT_DEFAULT_VISUAL_LAYERS);
  });
});
