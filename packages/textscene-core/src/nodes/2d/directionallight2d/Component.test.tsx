/**
 * The quads a DirectionalLight2D feeds the light accumulation pre-pass, through the real
 * dispatcher: the class it lands in, the term it adds and the shadow it samples. The
 * `directionallight2d-*` goldens pin the pixels.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { ReactNode } from 'react';

import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import {
  CanvasLighting2DProvider,
  LIGHT_LAYER,
  SHADOW_TINT_LAYER,
  useCanvasLighting2D,
  type CanvasLightClass,
} from '../../../r3f/lighting2d/CanvasLighting2D';
import { lightReachesItem } from '../../../r3f/lighting2d/lightCullKey';
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

const CASTER = `
[node name="Caster" type="LightOccluder2D" parent="."]
occluder = SubResource("bar")
`;

async function render(tscn: string, probe?: ReactNode) {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      {/* The live tree the directional list is walked from. */}
      <HierarchyProvider value={{ sceneGraph: createSceneGraphFromTscnScene(parsed), panelId: 'p' }}>
        <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
          <NodeDispatcher nodes={parsed.nodes} />
          {probe}
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

async function renderClasses(tscn: string): Promise<readonly CanvasLightClass[]> {
  let latest: readonly CanvasLightClass[] = [];
  function Probe() {
    latest = useCanvasLighting2D().classes;
    return null;
  }
  await render(tscn, <Probe />);
  return latest;
}

function onLayer(layer: number) {
  return (mesh: THREE.Mesh) => {
    const layers = new THREE.Layers();
    layers.set(layer);
    return mesh.layers.test(layers);
  };
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
  it('draws its term on its class layer, which the visible pass never renders', async () => {
    const quad = onlyQuad(await render(scene(sun())));
    expect(onLayer(LIGHT_LAYER)(quad)).toBe(true);
    expect(quad.layers.test(new THREE.Layers())).toBe(false);
  });

  it('carries its colour and `color.a × energy`', async () => {
    const quad = onlyQuad(await render(scene(sun('color = Color(1, 0.5, 0.25, 0.5)\nenergy = 3.0'))));
    const color = uniformsOf(quad).uColor!.value as THREE.Vector3;
    expect([color.x, color.y, color.z]).toEqual([1, 0.5, 0.25]);
    expect(uniformsOf(quad).uAlpha!.value).toBe(1.5);
  });

  it('opens a class that reaches every item on its layers, whatever its light_mask or z', async () => {
    const classes = await renderClasses(scene(sun()));
    expect(classes).toHaveLength(1);
    expect(lightReachesItem(classes[0]!.key, 0, 4096, 0)).toBe(true);
    expect(lightReachesItem(classes[0]!.key, 1, 0, 1)).toBe(false);
  });

  it('shares one class between two lights on one layer window, drawn in tree order', async () => {
    const renderer = await render(scene(sun('', 'A') + sun('', 'B')));
    expect(lightQuads(renderer).map((quad) => quad.renderOrder)).toEqual([0, 1]);
    expect(lightQuads(renderer).every(onLayer(LIGHT_LAYER))).toBe(true);
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

  it('opens no class while disabled', async () => {
    expect(await renderClasses(scene(sun('enabled = false')))).toHaveLength(0);
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

  it('draws a contributing shadow_color on its class tint layer', async () => {
    const renderer = await render(
      scene(sun('shadow_enabled = true\nshadow_color = Color(0, 0, 1, 0.5)') + CASTER)
    );
    const tint = renderer.scene
      .findAllByType('Mesh')
      .map((o) => o.instance as THREE.Mesh)
      .filter(onLayer(SHADOW_TINT_LAYER));
    expect(tint).toHaveLength(1);
    const color = uniformsOf(tint[0]!).uShadowColor!.value as THREE.Vector4;
    expect([color.x, color.y, color.z, color.w]).toEqual([0, 0, 1, 0.5]);
  });
});
