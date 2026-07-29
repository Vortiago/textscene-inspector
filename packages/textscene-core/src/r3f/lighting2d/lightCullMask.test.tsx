/**
 * Godot's 2D light culling, end to end through the real dispatcher.
 *
 * A light reaches an item when its cull mask shares a bit with the item's
 * `light_mask`, the item's accumulated `z_final` is inside the light's z window,
 * and the item's CANVAS layer is inside the light's layer window. Lights
 * therefore partition into classes by that whole tuple, and each class
 * accumulates into its own buffer. What these pin is the wiring that makes that
 * true: the class a light's quad is sorted into (its camera LAYER), and the
 * class slots each item is allowed to read (its per-slot WEIGHT). The rule
 * itself is pinned by `lightCullKey.test.ts`.
 *
 * The weights are read back through `onBeforeCompile`, which is where the
 * uniform objects are handed to three. Happy-dom has no GPU, so the shader is
 * never compiled and the injection is the only place the binding is observable.
 * The pixels are measured against the engine instead, by
 * `unit-pointlight2d-cull-mask`.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import { NodeDispatcher } from '../NodeDispatcher';
import { CanvasWorkspaceProvider } from '../contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import {
  CanvasLighting2DProvider,
  LIGHT_LAYER,
  LIGHT_SEED_LAYER,
  LIGHT_UNCLASSED_LAYER,
  SHADOW_TINT_LAYER,
  MAX_LIGHT_CLASSES,
} from './CanvasLighting2D';
import { lightClassSampler } from './canvasItemLighting';
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
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={parsed.internalResources}
          externalResources={parsed.externalResources}
        >
          <SelectionProvider>
            <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
              <NodeDispatcher nodes={parsed.nodes} />
            </CanvasLighting2DProvider>
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  return renderer;
}

type Rendered = Awaited<ReturnType<typeof render>>;

function meshes(renderer: Rendered): THREE.Mesh[] {
  return renderer.scene.findAllByType('Mesh').map((o) => o.instance as THREE.Mesh);
}

function onLayer(mesh: THREE.Mesh, layer: number): boolean {
  const probe = new THREE.Layers();
  probe.set(layer);
  return mesh.layers.test(probe);
}

/** The cookie quads, in the scene's own order, with the layer each landed on. */
function lightQuadLayers(renderer: Rendered): number[] {
  return meshes(renderer)
    .filter((mesh) => {
      const material = mesh.material as THREE.ShaderMaterial;
      return !!material.uniforms?.uCookie;
    })
    .map((mesh) => {
      for (let layer = 0; layer < 32; layer += 1) if (onLayer(mesh, layer)) return layer;
      return -1;
    });
}

/**
 * The class-slot weights bound to the item named `name`: `1` where the item's
 * `light_mask` selects that class, `0` where the light is culled from it.
 */
function classWeights(renderer: Rendered, name: string): number[] {
  const group = renderer.scene.findAll((o) => o.props.name === name)[0];
  expect(group, `scene should contain an item named ${name}`).toBeDefined();
  const mesh = group!
    .findAllByType('Mesh')
    .map((o) => o.instance as THREE.Mesh)
    .find((m) => !!(m.material as THREE.Material).onBeforeCompile);
  expect(mesh, `${name} should render a lit mesh`).toBeDefined();

  const shader = {
    vertexShader: '',
    fragmentShader: 'void main() {\n#include <colorspace_fragment>\n}',
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  (mesh!.material as THREE.Material).onBeforeCompile(
    shader as unknown as THREE.WebGLProgramParametersWithUniforms,
    null as unknown as THREE.WebGLRenderer
  );
  return [...(shader.uniforms.uLightClassWeight!.value as number[])];
}

/** The accumulator textures the item is actually pointed at, per slot. */
function classBuffers(renderer: Rendered, name: string): (THREE.Texture | null)[] {
  const group = renderer.scene.findAll((o) => o.props.name === name)[0]!;
  const mesh = group
    .findAllByType('Mesh')
    .map((o) => o.instance as THREE.Mesh)
    .find((m) => !!(m.material as THREE.Material).onBeforeCompile)!;
  const shader = {
    vertexShader: '',
    fragmentShader: 'void main() {\n#include <colorspace_fragment>\n}',
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  (mesh.material as THREE.Material).onBeforeCompile(
    shader as unknown as THREE.WebGLProgramParametersWithUniforms,
    null as unknown as THREE.WebGLRenderer
  );
  return Array.from(
    { length: MAX_LIGHT_CLASSES },
    (_unused, slot) => (shader.uniforms[lightClassSampler(slot)]!.value as THREE.Texture) ?? null
  );
}

describe('2D light cull masks, through the dispatcher', () => {
  it('gives every light the SAME class when they share a cull mask', async () => {
    const renderer = await render(scene(`${panel('P', null, 0)}${light('A', null, 40)}${light('B', null, 90)}`));
    expect(lightQuadLayers(renderer)).toEqual([LIGHT_LAYER, LIGHT_LAYER]);
    // One class, and the item reads it.
    expect(classWeights(renderer, 'P')).toEqual([1, 0, 0, 0]);
  });

  it('splits lights of different cull masks into separate class layers', async () => {
    const renderer = await render(
      scene(`${panel('P', null, 0)}${light('Warm', null, 40)}${light('Cool', '2', 90)}`)
    );
    // Classes are ordered by mask ascending, 1 then 2, so the layers are
    // stable however the lights are authored.
    expect(lightQuadLayers(renderer)).toEqual([LIGHT_LAYER, LIGHT_LAYER + 1]);
  });

  it('points an item at only the classes its light_mask selects', async () => {
    const renderer = await render(
      scene(
        `${panel('OnlyWarm', null, 0)}${panel('OnlyCool', '2', 200)}${panel('Both', '3', 400)}` +
          `${panel('Neither', '512', 600)}${light('Warm', null, 40)}${light('Cool', '2', 240)}`
      )
    );
    expect(classWeights(renderer, 'OnlyWarm')).toEqual([1, 0, 0, 0]);
    expect(classWeights(renderer, 'OnlyCool')).toEqual([0, 1, 0, 0]);
    expect(classWeights(renderer, 'Both')).toEqual([1, 1, 0, 0]);
    // The dungeon's painted shadow polygons: lit by nothing, so the shader falls
    // back to the seed and the item keeps its authored colour under the tint.
    expect(classWeights(renderer, 'Neither')).toEqual([0, 0, 0, 0]);
  });

  it('binds a culled slot to a stand-in texture rather than another class buffer', async () => {
    const renderer = await render(
      scene(`${panel('OnlyCool', '2', 0)}${light('Warm', null, 40)}${light('Cool', '2', 90)}`)
    );
    const buffers = classBuffers(renderer, 'OnlyCool');
    const selected = classBuffers(renderer, 'OnlyCool')[1];
    expect(selected).toBeInstanceOf(THREE.Texture);
    // Slot 0 is the warm class this item is culled from; it must not be pointed
    // at that accumulation, or a weight bug would light it anyway.
    expect(buffers[0]).not.toBe(selected);
    expect(buffers[2]).toBe(buffers[0]);
    expect(buffers[3]).toBe(buffers[0]);
  });

  it('gives a Light Only item the unmodulated buffer of the class it selects', async () => {
    // Two accumulations per class once a Light Only item exists, and the item
    // has to land on its OWN class's unmodulated one. A single-class scene
    // cannot tell a per-class index apart from a constant 0.
    const renderer = await render(
      scene(
        `${panel('Ordinary', '2', 0)}${panel('Masked', '2', 200, 'material = SubResource("lightonly")\n')}` +
          `${light('Warm', null, 40)}${light('Cool', '2', 240)}`,
        LIGHT_ONLY_MATERIAL
      )
    );
    expect(classWeights(renderer, 'Masked')).toEqual([0, 1, 0, 0]);
    // Its buffer is the Light Only accumulation, which is a DIFFERENT texture
    // from the one the ordinary item beside it reads out of the same class.
    const lightOnlyBuffer = classBuffers(renderer, 'Masked')[1];
    const ordinaryBuffer = classBuffers(renderer, 'Ordinary')[1];
    expect(lightOnlyBuffer).toBeInstanceOf(THREE.Texture);
    expect(lightOnlyBuffer).not.toBe(ordinaryBuffer);
  });

  it('keeps the item unlit while the canvas holds no light at all', async () => {
    const renderer = await render(scene(panel('P', null, 0)));
    expect(classWeights(renderer, 'P')).toEqual([0, 0, 0, 0]);
    expect(lightQuadLayers(renderer)).toEqual([]);
  });

  it('draws a light nowhere once its class does not fit', async () => {
    const overflow = Array.from({ length: MAX_LIGHT_CLASSES + 1 }, (_unused, index) =>
      light(`L${index}`, String(1 << index), index * 40)
    ).join('');
    const renderer = await render(scene(`${panel('P', null, 0)}${overflow}`));
    const layers = lightQuadLayers(renderer);
    expect(layers.slice(0, MAX_LIGHT_CLASSES)).toEqual(
      Array.from({ length: MAX_LIGHT_CLASSES }, (_unused, index) => LIGHT_LAYER + index)
    );
    // No pass enables this layer, so the fifth class is dropped rather than
    // folded into someone else's accumulation.
    expect(layers[MAX_LIGHT_CLASSES]).toBe(LIGHT_UNCLASSED_LAYER);
  });

  it('gives every light layer a number of its own', async () => {
    // The layers are derived from each other, so a new band inserted in the
    // middle silently overlaps an existing one and that light starts drawing
    // into someone else's pass. Enumerate them and assert the whole set is
    // distinct rather than spot-checking one pair.
    const assigned = [
      ...Array.from({ length: MAX_LIGHT_CLASSES }, (_unused, index) => LIGHT_LAYER + index),
      LIGHT_SEED_LAYER,
      ...Array.from({ length: MAX_LIGHT_CLASSES }, (_unused, index) => SHADOW_TINT_LAYER + index),
      LIGHT_UNCLASSED_LAYER,
    ];
    expect(new Set(assigned).size).toBe(assigned.length);
    // three packs layers into a 32-bit mask, so the highest must still fit.
    expect(Math.max(...assigned)).toBeLessThan(32);
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
 * The z and layer windows, through the dispatcher.
 *
 * Measured against Godot 4.6.3 by `unit-pointlight2d-range-z.tscn` and
 * `unit-pointlight2d-range-layer.tscn`: a `range_z_max = 4` light leaves a
 * z_index-5 panel at the bare canvas tint, and a default light leaves a panel
 * inside a bare CanvasLayer at its raw albedo.
 */
describe('2D light range windows, through the dispatcher', () => {
  it('culls an item whose z sits above the light\'s window', async () => {
    const renderer = await render(
      scene(
        `${windowPanel('Inside', '')}${windowPanel('Above', 'z_index = 5\n')}` +
          windowLight('Torch', 'range_z_max = 4\n')
      )
    );
    expect(classWeights(renderer, 'Inside')).toEqual([1, 0, 0, 0]);
    expect(classWeights(renderer, 'Above')).toEqual([0, 0, 0, 0]);
  });

  it('holds the window at its bounds, which are inclusive', async () => {
    const renderer = await render(
      scene(
        `${windowPanel('AtMax', 'z_index = 4\n')}${windowPanel('AtMin', 'z_index = -2\n')}` +
          `${windowPanel('BelowMin', 'z_index = -3\n')}` +
          windowLight('Torch', 'range_z_min = -2\nrange_z_max = 4\n')
      )
    );
    expect(classWeights(renderer, 'AtMax')).toEqual([1, 0, 0, 0]);
    expect(classWeights(renderer, 'AtMin')).toEqual([1, 0, 0, 0]);
    expect(classWeights(renderer, 'BelowMin')).toEqual([0, 0, 0, 0]);
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
    expect(classWeights(renderer, 'Rel1')).toEqual([1, 0, 0, 0]);
    expect(classWeights(renderer, 'Rel3')).toEqual([0, 0, 0, 0]);
    // z_as_relative = false discards the parent's contribution entirely.
    expect(classWeights(renderer, 'Abs3')).toEqual([1, 0, 0, 0]);
  });

  it('withholds a default light from a default CanvasLayer', async () => {
    // A CanvasLayer is its own canvas at `layer` 1, and Godot's default light
    // window is 0..0 — so the HUD keeps its raw albedo while the world lights.
    const renderer = await render(
      scene(
        `${windowPanel('WorldPanel', '')}\n[node name="Hud" type="CanvasLayer" parent="."]\n` +
          `${windowPanel('HudPanel', '', 'Hud')}` +
          windowLight('Torch')
      )
    );
    expect(classWeights(renderer, 'WorldPanel')).toEqual([1, 0, 0, 0]);
    expect(classWeights(renderer, 'HudPanel')).toEqual([0, 0, 0, 0]);
  });

  it('reaches a CanvasLayer once the light\'s layer window includes it', async () => {
    const renderer = await render(
      scene(
        `${windowPanel('WorldPanel', '')}\n[node name="Hud" type="CanvasLayer" parent="."]\nlayer = 3\n` +
          `${windowPanel('HudPanel', '', 'Hud')}` +
          windowLight('Torch', 'range_layer_min = 3\nrange_layer_max = 3\n')
      )
    );
    // The window moved off the world canvas, so the two swap.
    expect(classWeights(renderer, 'WorldPanel')).toEqual([0, 0, 0, 0]);
    expect(classWeights(renderer, 'HudPanel')).toEqual([1, 0, 0, 0]);
  });

  it('splits two lights of one cull mask into classes when their windows differ', async () => {
    // The accumulation is a screen-space sum, so a light that reaches fewer
    // items than its pass-mate cannot be excluded per fragment afterwards.
    const renderer = await render(
      scene(
        `${windowPanel('P', '')}${windowLight('Wide')}${windowLight('Narrow', 'range_z_max = 4\n')}`
      )
    );
    // Ordered by the tuple: both masks are 1, so the narrower zMax sorts first.
    expect(lightQuadLayers(renderer)).toEqual([LIGHT_LAYER + 1, LIGHT_LAYER]);
    // The panel is at z 0, inside both windows, so it reads both classes.
    expect(classWeights(renderer, 'P')).toEqual([1, 1, 0, 0]);
  });

  it('keeps every default light in ONE class, so no existing scene gains one', async () => {
    const renderer = await render(
      scene(`${windowPanel('P', '')}${windowLight('A')}${windowLight('B')}${windowLight('C')}`)
    );
    expect(lightQuadLayers(renderer)).toEqual([LIGHT_LAYER, LIGHT_LAYER, LIGHT_LAYER]);
    expect(classWeights(renderer, 'P')).toEqual([1, 0, 0, 0]);
  });
});
