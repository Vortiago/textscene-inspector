/**
 * The quads a DirectionalLight2D feeds the light accumulation pre-pass, through the real
 * dispatcher: the items it reaches, the term it adds and the shadow it samples. The
 * `directionallight2d-*` goldens pin the pixels.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { CanvasLighting2DProvider } from '../../../r3f/lighting2d/CanvasLighting2D';
import { LIGHT_PASS_LAYER, directionalRenderOrder } from '../../../r3f/lighting2d/lightPassLayers';
import { itemUniforms, ownerName, recordLightPass } from '../../../r3f/lighting2d/testing/lightPassProbe';
import { SHADOW_MAP_FAR } from '../../../r3f/lighting2d/shadowPolarMap';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { HierarchyProvider } from '../../../r3f/contexts/HierarchyContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph';
import '../../../r3f/nodes'; // side-effect: registers every node's r3f component

/** A bar 200 px wide, 100 px above the origin, which the test camera centres on. */
const BAR = `
[sub_resource type="OccluderPolygon2D" id="bar"]
closed = false
polygon = PackedVector2Array(-100, -100, 100, -100)
`;

function scene(body: string): string {
  return `[gd_scene format=3]
${BAR}
[node name="Root" type="Node2D"]
${body}`;
}

function sun(extra = '', name = 'Sun', parent = '.'): string {
  return `
[node name="${name}" type="DirectionalLight2D" parent="${parent}"]
${extra}`;
}

function panel(name: string, extra = '', parent = '.'): string {
  return `
[node name="${name}" type="Polygon2D" parent="${parent}"]
${extra}polygon = PackedVector2Array(0, 0, 10, 0, 10, 10)
`;
}

const CASTER = `
[node name="Caster" type="LightOccluder2D" parent="."]
occluder = SubResource("bar")
`;

async function render(tscn: string) {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      {/* The live tree the directional list is walked from. */}
      <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene(parsed), panelId: 'p' }}>
        <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
          <NodeDispatcher nodes={parsed.nodes} />
        </CanvasLighting2DProvider>
      </HierarchyProvider>
    </SceneStack>,
    // An orthographic view of the canvas around the origin, as the 2D stage has.
    { orthographic: true, camera: { position: [0, 0, 10] } }
  );
  await new Promise<void>((resolve) => setTimeout(resolve, 10));
  return renderer;
}

type Rendered = Awaited<ReturnType<typeof render>>;

function isLit(renderer: Rendered, name: string): boolean {
  return itemUniforms(renderer, name).uLit!.value === 1;
}

/** The meshes carrying a directional light term. */
function lightQuads(renderer: Rendered): THREE.Mesh[] {
  return renderer.scene
    .findAllByType('Mesh')
    .map((o) => o.instance as THREE.Mesh)
    .filter((mesh) => !!(mesh.material as THREE.ShaderMaterial).uniforms?.uAlpha);
}

function onlyQuad(renderer: Rendered): THREE.Mesh {
  const quads = lightQuads(renderer);
  expect(quads).toHaveLength(1);
  return quads[0]!;
}

function uniformsOf(mesh: THREE.Mesh): Record<string, THREE.IUniform> {
  return (mesh.material as THREE.ShaderMaterial).uniforms;
}

describe('DirectionalLight2D Component', () => {
  it('draws its term on the light pass layer alone, which the visible pass never renders', async () => {
    expect(onlyQuad(await render(scene(sun()))).layers.mask).toBe(1 << LIGHT_PASS_LAYER);
  });

  it('carries its colour and `color.a × energy`', async () => {
    const quad = onlyQuad(await render(scene(sun('color = Color(1, 0.5, 0.25, 0.5)\nenergy = 3.0'))));
    const color = uniformsOf(quad).uColor!.value as THREE.Vector3;
    expect([color.x, color.y, color.z]).toEqual([1, 0.5, 0.25]);
    expect(uniformsOf(quad).uAlpha!.value).toBe(1.5);
  });

  it('reaches an item on its layers whatever its light_mask or z', async () => {
    const renderer = await render(scene(sun() + panel('Masked', 'light_mask = 0\nz_index = 4096\n')));
    expect(isLit(renderer, 'Masked')).toBe(true);
  });

  it('leaves an item on a canvas layer outside its window unlit', async () => {
    const renderer = await render(
      scene(`${sun()}\n[node name="Hud" type="CanvasLayer" parent="."]\n${panel('HudPanel', '', 'Hud')}`)
    );
    expect(isLit(renderer, 'HudPanel')).toBe(false);
  });

  it('draws two lights in tree order, below every positional light', async () => {
    // `canvas.glsl:727` runs the directional loop before the positional one at `:768`.
    const renderer = await render(scene(sun('', 'A') + sun('', 'B')));
    expect(lightQuads(renderer).map((quad) => quad.renderOrder)).toEqual([
      directionalRenderOrder(0),
      directionalRenderOrder(1),
    ]);
    expect(directionalRenderOrder(1)).toBeLessThan(0);
  });

  it('draws nothing while disabled, and its children still draw', async () => {
    const renderer = await render(
      scene(`${sun('enabled = false')}
[node name="Child" type="Polygon2D" parent="Sun"]
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10)
`)
    );
    expect(lightQuads(renderer)).toHaveLength(0);
    expect(renderer.scene.findAll((node) => node.props.name === 'Child')).not.toHaveLength(0);
  });

  it('lights no item on the main canvas from inside a SubViewport, whose World2D is its own', async () => {
    const renderer = await render(
      scene(`${panel('Outside')}
[node name="View" type="SubViewport" parent="."]

[node name="Pane" type="Polygon2D" parent="View"]
polygon = PackedVector2Array(0, 0, 10, 0, 10, 10)
${sun('', 'Sun', 'View')}`)
    );
    expect(isLit(renderer, 'Outside')).toBe(false);
  });

  it('lights no item while disabled', async () => {
    expect(isLit(await render(scene(sun('enabled = false') + panel('P'))), 'P')).toBe(false);
  });

  it('samples no shadow map until shadow_enabled is set', async () => {
    const quad = onlyQuad(await render(scene(sun() + CASTER)));
    expect(uniformsOf(quad).uShadowMap).toBeUndefined();
  });

  it('builds its map from the occluders in view and samples it', async () => {
    const quad = onlyQuad(await render(scene(sun('shadow_enabled = true\nshadow_filter = 1') + CASTER)));
    const map = uniformsOf(quad).uShadowMap!.value as THREE.DataTexture;
    const bins = map.image.data as Float32Array;
    expect(bins.some((depth) => depth < SHADOW_MAP_FAR)).toBe(true);
    expect((quad.material as THREE.ShaderMaterial).defines?.SHADOW_FILTER).toBe(1);
  });

  it('leaves an occluder outside shadow_item_cull_mask out of the map', async () => {
    const quad = onlyQuad(
      await render(scene(sun('shadow_enabled = true\nshadow_item_cull_mask = 2') + CASTER))
    );
    expect(uniformsOf(quad).uShadowMap).toBeUndefined();
  });

  it('draws a contributing shadow_color into the shadow_color buffer of the items it lights', async () => {
    const renderer = await render(
      scene(sun('shadow_enabled = true\nshadow_color = Color(0, 0, 1, 0.5)') + CASTER + panel('P'))
    );
    const tintBuffer = itemUniforms(renderer, 'P').uShadowTint!.value as THREE.Texture;
    const draw = (await recordLightPass(renderer)).find((recorded) => recorded.texture === tintBuffer);
    const tint = draw!.drawn.filter((mesh) => !uniformsOf(mesh).uSeed);
    expect(tint).toHaveLength(1);
    const color = uniformsOf(tint[0]!).uShadowColor!.value as THREE.Vector4;
    expect([color.x, color.y, color.z, color.w]).toEqual([0, 0, 1, 0.5]);
  });

  describe('a MIX light over a tinted shadow', () => {
    // MIX scales the colour under it by its alpha, the `shadow_color` under it included.
    const TINTING = sun('shadow_enabled = true\nshadow_color = Color(0, 0, 1, 0.5)', 'Tinting');

    async function tintDrawsOf(renderer: Rendered, owner: string): Promise<THREE.Mesh[]> {
      const tintBuffer = itemUniforms(renderer, 'P').uShadowTint!.value as THREE.Texture;
      const draw = (await recordLightPass(renderer)).find((recorded) => recorded.texture === tintBuffer);
      return draw!.drawn.filter((mesh) => ownerName(mesh) === owner);
    }

    it('scales it by the alpha alone when the MIX light casts nothing', async () => {
      const renderer = await render(
        scene(TINTING + sun('blend_mode = 2\nenergy = 0.5') + CASTER + panel('P'))
      );
      const [fade, ...rest] = await tintDrawsOf(renderer, 'Sun');
      expect(rest).toHaveLength(0);
      expect((fade!.material as THREE.ShaderMaterial).fragmentShader).toContain(
        'vec4(0.0, 0.0, 0.0, uAlpha)'
      );
      expect(uniformsOf(fade!).uAlpha!.value).toBe(0.5);
    });

    it('scales it through its own tint quad when the MIX light casts, untinted', async () => {
      const renderer = await render(
        scene(TINTING + sun('blend_mode = 2\nshadow_enabled = true') + CASTER + panel('P'))
      );
      const drawn = await tintDrawsOf(renderer, 'Sun');
      expect(drawn).toHaveLength(1);
      expect(uniformsOf(drawn[0]!).uShadowMap).toBeDefined();
    });

    it('draws no quad of an ADD light into the tint buffer', async () => {
      const renderer = await render(scene(TINTING + sun() + CASTER + panel('P')));
      expect(await tintDrawsOf(renderer, 'Sun')).toHaveLength(0);
    });
  });
});
