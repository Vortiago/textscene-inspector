/**
 * Godot's 2D light culling through the real dispatcher: the list buffer each item reads, and the
 * lights the pass draws into it. `itemLightList.test.ts` pins the rule. Happy-dom has no GPU, so
 * `lightPassProbe` reads the bindings and records the draws, and `unit-pointlight2d-cull-mask`
 * measures the pixels against the engine.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import { NodeDispatcher } from '../NodeDispatcher';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { CanvasLighting2DProvider } from './CanvasLighting2D';
import { itemUniforms, lightsIn, recordLightPass } from './testing/lightPassProbe';
import { SceneStack } from '../testing/SceneStack';
import '../nodes'; // side-effect: registers every node's r3f component

const COOKIE = 'res://light.png';

/** Every scene here shares one resolvable cookie, so every light registers. */
function scene(body: string, subResources = ''): string {
  return `[gd_scene format=3]
[ext_resource type="Texture2D" path="${COOKIE}" id="1"]
${subResources}
[node name="Root" type="Node2D"]
${body}`;
}

const LIGHT_ONLY_MATERIAL = `
[sub_resource type="CanvasItemMaterial" id="lightonly"]
light_mode = 2
`;

function panel(name: string, lightMask: string | null, x: number, material = ''): string {
  return `
[node name="${name}" type="Polygon2D" parent="."]
${lightMask === null ? '' : `light_mask = ${lightMask}\n`}${material}color = Color(0.7, 0.7, 0.7, 1)
polygon = PackedVector2Array(${x}, 0, ${x + 100}, 0, ${x + 100}, 100, ${x}, 100)`;
}

function light(name: string, cullMask: string | null, x: number): string {
  return `
[node name="${name}" type="PointLight2D" parent="."]
position = Vector2(${x}, 50)
${cullMask === null ? '' : `range_item_cull_mask = ${cullMask}\n`}texture = ExtResource("1")`;
}

async function render(tscn: string) {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const cookie = new THREE.Texture();
  (cookie as unknown as { image: { width: number; height: number } }).image = {
    width: 64,
    height: 64,
  };
  fake.textures.seed(COOKIE, cookie);

  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
        <NodeDispatcher nodes={parsed.nodes} />
      </CanvasLighting2DProvider>
    </SceneStack>
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  return renderer;
}

type Rendered = Awaited<ReturnType<typeof render>>;

/** The buffer the item named `name` reads. */
function bufferOf(renderer: Rendered, name: string): THREE.Texture {
  return itemUniforms(renderer, name).uLightList!.value as THREE.Texture;
}

function isLit(renderer: Rendered, name: string): boolean {
  return itemUniforms(renderer, name).uLit!.value === 1;
}

/** The lights the pass draws into the buffer the item named `name` reads, or none while unlit. */
async function lightsOn(renderer: Rendered, name: string): Promise<string[]> {
  if (!isLit(renderer, name)) return [];
  return lightsIn(await recordLightPass(renderer), bufferOf(renderer, name));
}

describe('2D light cull masks, through the dispatcher', () => {
  it('draws every light of a shared cull mask into one buffer', async () => {
    const renderer = await render(
      scene(`${panel('P', null, 0)}${light('A', null, 40)}${light('B', null, 90)}`)
    );
    expect(await lightsOn(renderer, 'P')).toEqual(['A', 'B']);
  });

  it('draws lights of different cull masks into one buffer for an item both reach', async () => {
    // A MIX light mixes toward its colour from what the lights before it left, so the lights on
    // one item cannot be summed from separate buffers (`canvas.glsl:768-830`).
    const renderer = await render(
      scene(`${panel('Both', '3', 0)}${light('Warm', null, 40)}${light('Cool', '2', 90)}`)
    );
    expect(await lightsOn(renderer, 'Both')).toEqual(['Warm', 'Cool']);
  });

  it('gives an item only the lights its light_mask selects', async () => {
    const renderer = await render(
      scene(
        `${panel('OnlyWarm', null, 0)}${panel('OnlyCool', '2', 200)}` +
          `${light('Warm', null, 40)}${light('Cool', '2', 240)}`
      )
    );
    expect(await lightsOn(renderer, 'OnlyWarm')).toEqual(['Warm']);
    expect(await lightsOn(renderer, 'OnlyCool')).toEqual(['Cool']);
  });

  it('leaves an item no light reaches unlit', async () => {
    // The dungeon's painted shadow polygons: lit by nothing, so the shader falls back to the seed
    // and the item keeps its authored colour under the tint.
    const renderer = await render(scene(`${panel('Neither', '512', 0)}${light('Warm', null, 40)}`));
    expect(isLit(renderer, 'Neither')).toBe(false);
  });

  it('shares one buffer between two items with the same list', async () => {
    const renderer = await render(
      scene(`${panel('Left', null, 0)}${panel('Right', null, 200)}${light('Warm', null, 40)}`)
    );
    expect(bufferOf(renderer, 'Left')).toBe(bufferOf(renderer, 'Right'));
  });

  it('gives a Light Only item the unmodulated buffer of its list', async () => {
    const renderer = await render(
      scene(
        `${panel('Ordinary', '2', 0)}${panel('Masked', '2', 200, 'material = SubResource("lightonly")\n')}` +
          `${light('Warm', null, 40)}${light('Cool', '2', 240)}`,
        LIGHT_ONLY_MATERIAL
      )
    );
    expect(bufferOf(renderer, 'Masked')).not.toBe(bufferOf(renderer, 'Ordinary'));
    expect(await lightsOn(renderer, 'Masked')).toEqual(['Cool']);
  });

  it('keeps the item unlit while the canvas holds no light at all', async () => {
    const renderer = await render(scene(panel('P', null, 0)));
    expect(isLit(renderer, 'P')).toBe(false);
    expect(await recordLightPass(renderer)).toEqual([]);
  });

  it('draws every light, however many cull masks the canvas holds', async () => {
    const names = Array.from({ length: 9 }, (_unused, index) => `L${index}`);
    const lights = names.map((name, index) => light(name, String(1 << index), index * 40)).join('');
    const renderer = await render(scene(`${panel('P', '511', 0)}${lights}`));
    expect(await lightsOn(renderer, 'P')).toEqual(names);
  });
});

/** A lit panel with arbitrary extra property lines, under `parent`. */
function windowPanel(name: string, properties: string, parent = '.'): string {
  return `
[node name="${name}" type="Polygon2D" parent="${parent}"]
${properties}color = Color(0.7, 0.7, 0.7, 1)
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100, 0, 100)`;
}

/** A light covering the whole scene, with arbitrary extra property lines. */
function windowLight(name: string, properties = ''): string {
  return `
[node name="${name}" type="PointLight2D" parent="."]
position = Vector2(50, 50)
${properties}texture = ExtResource("1")`;
}

/**
 * The z and layer windows, through the dispatcher. On Godot 4.6.3 (`unit-pointlight2d-range-z.tscn`,
 * `unit-pointlight2d-range-layer.tscn`) a `range_z_max = 4` light leaves a z_index-5 panel at the
 * bare canvas tint, and a default light leaves a panel in a bare CanvasLayer at its raw albedo.
 */
describe('2D light range windows, through the dispatcher', () => {
  it("culls an item whose z sits above the light's window", async () => {
    const renderer = await render(
      scene(
        `${windowPanel('Inside', '')}${windowPanel('Above', 'z_index = 5\n')}` +
          windowLight('Torch', 'range_z_max = 4\n')
      )
    );
    expect(isLit(renderer, 'Inside')).toBe(true);
    expect(isLit(renderer, 'Above')).toBe(false);
  });

  it('holds the window at its bounds, which are inclusive', async () => {
    const renderer = await render(
      scene(
        `${windowPanel('AtMax', 'z_index = 4\n')}${windowPanel('AtMin', 'z_index = -2\n')}` +
          `${windowPanel('BelowMin', 'z_index = -3\n')}` +
          windowLight('Torch', 'range_z_min = -2\nrange_z_max = 4\n')
      )
    );
    expect(isLit(renderer, 'AtMax')).toBe(true);
    expect(isLit(renderer, 'AtMin')).toBe(true);
    expect(isLit(renderer, 'BelowMin')).toBe(false);
  });

  it('accumulates z down the tree, the way _cull_canvas_item does', async () => {
    // `renderer_canvas_cull.cpp:816-820`, and measured: under a Node2D at
    // z_index 2 and a light at range_z_max = 4, a child at z_index 1 is lit and
    // one at z_index 3 is not.
    const renderer = await render(
      scene(
        `\n[node name="ZParent" type="Node2D" parent="."]\nz_index = 2\n` +
          `${windowPanel('Rel1', 'z_index = 1\n', 'ZParent')}` +
          `${windowPanel('Rel3', 'z_index = 3\n', 'ZParent')}` +
          `${windowPanel('Abs3', 'z_index = 3\nz_as_relative = false\n', 'ZParent')}` +
          windowLight('Torch', 'range_z_max = 4\n')
      )
    );
    expect(isLit(renderer, 'Rel1')).toBe(true);
    expect(isLit(renderer, 'Rel3')).toBe(false);
    // z_as_relative = false discards the parent's contribution entirely.
    expect(isLit(renderer, 'Abs3')).toBe(true);
  });

  it('withholds a default light from a default CanvasLayer', async () => {
    // A CanvasLayer is its own canvas at `layer` 1, and Godot's default light window is 0..0, so
    // the HUD keeps its raw albedo while the world lights.
    const renderer = await render(
      scene(
        `${windowPanel('WorldPanel', '')}\n[node name="Hud" type="CanvasLayer" parent="."]\n` +
          `${windowPanel('HudPanel', '', 'Hud')}` +
          windowLight('Torch')
      )
    );
    expect(isLit(renderer, 'WorldPanel')).toBe(true);
    expect(isLit(renderer, 'HudPanel')).toBe(false);
  });

  it("reaches a CanvasLayer once the light's layer window includes it", async () => {
    const renderer = await render(
      scene(
        `${windowPanel('WorldPanel', '')}\n[node name="Hud" type="CanvasLayer" parent="."]\nlayer = 3\n` +
          `${windowPanel('HudPanel', '', 'Hud')}` +
          windowLight('Torch', 'range_layer_min = 3\nrange_layer_max = 3\n')
      )
    );
    // The window moved off the world canvas, so the two swap.
    expect(isLit(renderer, 'WorldPanel')).toBe(false);
    expect(isLit(renderer, 'HudPanel')).toBe(true);
  });

  it('lists a narrower light only for the items inside its window', async () => {
    // The accumulation is a screen-space sum, so a light that reaches fewer items than its
    // neighbour cannot be excluded per fragment afterwards: the items take different lists.
    const renderer = await render(
      scene(
        `${windowPanel('Low', '')}${windowPanel('High', 'z_index = 5\n')}` +
          `${windowLight('Wide')}${windowLight('Narrow', 'range_z_max = 4\n')}`
      )
    );
    expect(await lightsOn(renderer, 'Low')).toEqual(['Wide', 'Narrow']);
    expect(await lightsOn(renderer, 'High')).toEqual(['Wide']);
  });

  it('keeps every default light on ONE list, so no existing scene gains a buffer', async () => {
    const renderer = await render(
      scene(
        `${windowPanel('P', '')}${windowPanel('Q', 'z_index = 3\n')}${windowLight('A')}${windowLight('B')}${windowLight('C')}`
      )
    );
    expect(bufferOf(renderer, 'P')).toBe(bufferOf(renderer, 'Q'));
    expect(await lightsOn(renderer, 'P')).toEqual(['A', 'B', 'C']);
  });
});
