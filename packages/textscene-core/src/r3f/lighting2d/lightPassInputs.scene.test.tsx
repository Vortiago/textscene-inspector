import { beforeAll, describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../resources/testing/createFakeResourceLoader';
import { loadSimulate } from '../../nodes/2d/cpuparticles2d/simulateModule';
import { ownerName, recordFrameDraws, rendererOf } from './testing/lightPassProbe';
import { DispatchedScene } from '../testing/DispatchedScene';
import { underWhiteCanvasLighting } from './testing/whiteCanvasLighting';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph.testkit';
import { settleLoads } from '../testing/settleLoads';
import '../nodes';

const COOKIE = 'res://light.png';
const LATE_COOKIE = 'res://late.png';

/** One more than the 15 positional lights an item takes, so an item they all meet gets a capped list. */
const CROWDING_LIGHTS = 16;

/** 1024 px square, so each lamp's reach covers the whole canvas. */
function cookie(): THREE.Texture {
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = { width: 1024, height: 1024 };
  return texture;
}

function loaderWith(texture: THREE.Texture): FakeResourceLoader {
  const fake = createFakeResourceLoader();
  fake.textures.seed(COOKIE, texture);
  return fake;
}

function lamps(count: number): string {
  return Array.from(
    { length: count },
    (_, at) => `
[node name="Lamp${at}" type="PointLight2D" parent="."]
position = Vector2(${300 + at * 30}, 324)
texture = ExtResource("1")
range_item_cull_mask = 3`
  ).join('');
}

/** An item on light mask 2, so its list is its own and the cap clips the list to its rect. */
const PATCH = `
[node name="Patch" type="Polygon2D" parent="."]
position = Vector2(576, 324)
light_mask = 2
polygon = PackedVector2Array(-20, -20, 20, -20, 20, 20, -20, 20)`;

/** An emitter under the lamps, an item whose pixels its own draw makes. */
const SPARKS = `
[node name="Sparks" type="CPUParticles2D" parent="."]
position = Vector2(576, 324)
texture = ExtResource("1")
amount = 4`;

/** A lit item under every lamp, so the pass has a list to fill. */
const SURFACE = `
[node name="Surface" type="Polygon2D" parent="."]
polygon = PackedVector2Array(0, 0, 1152, 0, 1152, 648, 0, 648)`;

/** A lamp whose cookie loads after the first drawn frame: a PointLight2D with no texture draws nothing. */
const LATE_LAMP = `
[node name="LateLamp" type="PointLight2D" parent="."]
position = Vector2(576, 324)
texture = ExtResource("2")`;

function scene(body: string): string {
  return `[gd_scene format=3]
[ext_resource type="Texture2D" path="${COOKIE}" id="1"]
[ext_resource type="Texture2D" path="${LATE_COOKIE}" id="2"]
[node name="Root" type="Node2D"]
${body}`;
}

async function render(tscn: string, fake = loaderWith(cookie())) {
  const renderer = await ReactThreeTestRenderer.create(
    <DispatchedScene
      sceneGraph={createSceneGraphFromTscnScene(new TscnParser().parse(tscn))}
      loader={fake.loader}
      workspace="2d"
      around={underWhiteCanvasLighting}
    />
  );
  await settleLoads();
  return renderer;
}

type Rendered = Awaited<ReturnType<typeof render>>;

/** Runs one frame and lets React commit what it set, as the next browser task would. */
async function recordSettledFrameDraws(renderer: Rendered) {
  const draws = await recordFrameDraws(renderer);
  await ReactThreeTestRenderer.act(async () => {});
  return draws;
}

/** Runs frames until the pass keeps its buffers, so a test starts from a settled frame. */
async function settleLightPass(renderer: Rendered): Promise<void> {
  for (let frame = 0; frame < 4; frame += 1) await recordSettledFrameDraws(renderer);
  expect(await recordSettledFrameDraws(renderer)).toEqual([]);
}

/** The mesh the item named `name` draws, its node's own or a child's. */
function meshOf(renderer: Rendered, name: string): THREE.Mesh {
  const meshes = renderer.scene.findAllByType('Mesh').map((o) => o.instance as THREE.Mesh);
  const mesh = meshes.find((candidate) => ownerName(candidate).startsWith(name));
  if (!mesh) throw new Error(`expected ${name} to draw a mesh, found ${meshes.map(ownerName).join(', ')}`);
  return mesh;
}

beforeAll(loadSimulate);

describe('an item that changes with no property write', () => {
  it('draws again when the item grows the window of its capped list', async () => {
    const renderer = await render(scene(`${lamps(CROWDING_LIGHTS)}${PATCH}`));
    await settleLightPass(renderer);

    meshOf(renderer, 'Patch').scale.set(2, 2, 1);

    expect((await recordFrameDraws(renderer)).length).toBeGreaterThan(0);
  });

  it('never reaches the buffers itself, so its own pixels change none of them', async () => {
    const renderer = await render(scene(`${SURFACE}${lamps(1)}${SPARKS}`));
    const sparks = meshOf(renderer, 'Sparks');

    const drawn = (await recordFrameDraws(renderer)).flatMap((draw) => draw.drawn);

    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn).not.toContain(sparks);
  });
});

describe('a cookie that changes with no property write', () => {
  it('draws again when a second lamp joins once its cookie loads', async () => {
    const fake = loaderWith(cookie());
    fake.textures.setRequestImpl(() => {});
    const renderer = await render(scene(`${SURFACE}${lamps(1)}${LATE_LAMP}`), fake);
    await settleLightPass(renderer);

    await ReactThreeTestRenderer.act(async () => fake.textures._resolve(LATE_COOKIE, cookie()));

    expect((await recordFrameDraws(renderer)).length).toBeGreaterThan(0);
  });

  it('draws again when the loaded cookie refills its texels', async () => {
    const texture = cookie();
    const renderer = await render(scene(`${SURFACE}${lamps(1)}`), loaderWith(texture));
    await settleLightPass(renderer);

    texture.needsUpdate = true;

    expect((await recordFrameDraws(renderer)).length).toBeGreaterThan(0);
  });
});

describe('a canvas that changes under a settled frame', () => {
  it('draws again when the pixel ratio changes the drawing buffer size', async () => {
    const renderer = await render(scene(`${SURFACE}${lamps(1)}`));
    await settleLightPass(renderer);

    rendererOf(renderer).setPixelRatio(2);

    expect((await recordFrameDraws(renderer)).length).toBeGreaterThan(0);
  });

  it('draws again after the context is restored, whose targets hold nothing', async () => {
    const renderer = await render(scene(`${SURFACE}${lamps(1)}`));
    await settleLightPass(renderer);

    rendererOf(renderer).domElement.dispatchEvent(new Event('webglcontextrestored'));

    expect((await recordFrameDraws(renderer)).length).toBeGreaterThan(0);
  });
});
