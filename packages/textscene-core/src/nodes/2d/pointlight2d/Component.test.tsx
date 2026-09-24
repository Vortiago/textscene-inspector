/**
 * Tests the quad a PointLight2D feeds the light accumulation pre-pass: its camera
 * layer, its blend and its shader's light term. The light draws nothing on the
 * visible canvas.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { parsePointLight2D } from './parser';
import { PointLight2D } from './Component';
import { CanvasWorkspaceProvider } from '../../../r3f/contexts/CanvasWorkspaceContext';
import { SceneResourcesProvider } from '../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import type { TscnNode } from '../../../parser/types';
import {
  CanvasLighting2DProvider,
  LIGHT_LAYER,
  LIGHT_SEED_LAYER,
} from '../../../r3f/lighting2d/CanvasLighting2D';

const nodeHeading = { type: 'node' as const, attributes: { type: 'PointLight2D', name: 'Light' } };

const TEX = 'res://light.png';

function node(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Light',
    type: 'PointLight2D',
    children: [],
    properties: parsePointLight2D(nodeHeading, { texture: 'ExtResource("1")', ...raw }),
  };
}

async function render(rootNode: TscnNode) {
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 64 };
  fake.textures.seed(TEX, tex);

  // The lighting provider is mounted because the light's camera layer is the
  // layer of its cull-mask class, which only the provider can assign: an
  // unclassified light deliberately draws nowhere.
  return ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={[]}
          externalResources={[{ id: '1', type: 'Texture2D', path: TEX }]}
        >
          <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
            <PointLight2D node={rootNode} />
          </CanvasLighting2DProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
}

type Rendered = Awaited<ReturnType<typeof render>>;

/** The cookie quad, skipping the accumulator's own seed quad. */
function lightMesh(r: Rendered): THREE.Mesh | undefined {
  const seedLayer = new THREE.Layers();
  seedLayer.set(LIGHT_SEED_LAYER);
  return r.scene
    .findAllByType('Mesh')
    .map((o) => o.instance as THREE.Mesh)
    .find((m) => !m.layers.test(seedLayer));
}

function lightMaterial(r: Rendered): THREE.ShaderMaterial {
  const mesh = lightMesh(r);
  expect(mesh, 'an enabled PointLight2D with a texture should render its cookie quad').toBeDefined();
  return mesh!.material as THREE.ShaderMaterial;
}

describe('PointLight2D Component', () => {
  it('emits the cookie quad on the light layer, so the visible pass never draws it', async () => {
    const r = await render(node());
    const mesh = lightMesh(r);
    expect(mesh).toBeDefined();
    // A camera whose mask is the default layer 0 cannot see it; only the
    // accumulation pre-pass, which points the camera at this layer alone, can.
    expect(mesh!.layers.test(new THREE.Layers())).toBe(false);
    const lightOnly = new THREE.Layers();
    lightOnly.set(LIGHT_LAYER);
    expect(mesh!.layers.test(lightOnly)).toBe(true);
  });

  it('accumulates ADD as src×srcAlpha + dst, matching light_blend_compute', async () => {
    const mat = lightMaterial(await render(node()));
    expect(mat.blending).toBe(THREE.CustomBlending);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneFactor);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
  });

  it('accumulates SUB by reverse-subtracting the same term', async () => {
    const mat = lightMaterial(await render(node({ blend_mode: '1' })));
    expect(mat.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneFactor);
    // Alpha still sums: light_only_alpha is a plain sum whatever the rgb mode.
    expect(mat.blendEquationAlpha).toBe(THREE.AddEquation);
    expect(mat.blendSrcAlpha).toBe(THREE.OneFactor);
    expect(mat.blendDstAlpha).toBe(THREE.OneFactor);
  });

  it('accumulates MIX by interpolating toward the light, not by adding it', async () => {
    const mat = lightMaterial(await render(node({ blend_mode: '2' })));
    // mix(dst, src, srcAlpha) is src×srcAlpha + dst×(1−srcAlpha). ADD's OneFactor
    // here would render MIX identically to ADD.
    expect(mat.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mat.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(mat.blendEquation).toBe(THREE.AddEquation);
  });

  it('sorts with the transparent list, so MIX lights replay in canvas order', async () => {
    // The opaque list sorts nearest-first, which reverses canvas order, and MIX
    // is the one mode whose result depends on that order.
    expect(lightMaterial(await render(node({ blend_mode: '2' }))).transparent).toBe(true);
  });

  it('returns null (no mesh) when enabled=false', async () => {
    const r = await render(node({ enabled: 'false' }));
    expect(r.scene.findAllByType('Mesh').length).toBe(0);
  });

  it('applies texture_scale to quad dimensions', async () => {
    const r = await render(node({ texture_scale: '2.0' }));
    const geom = lightMesh(r)!.geometry as THREE.PlaneGeometry;
    expect(geom.parameters.width).toBeCloseTo(128, 5); // 64 * 2
    expect(geom.parameters.height).toBeCloseTo(128, 5); // 64 * 2
  });

  it('offsets the quad by `offset`, with Godot\'s Y pointing down', async () => {
    const r = await render(node({ offset: 'Vector2(10, 4)' }));
    expect(lightMesh(r)!.position.x).toBeCloseTo(10, 5);
    expect(lightMesh(r)!.position.y).toBeCloseTo(-4, 5);
  });

  it('hands the shader its colour in sRGB, NOT converted to linear', async () => {
    // Godot scales the light in the canvas' own sRGB space (`hdr_2d` off), and
    // the quad's shader does the whole light term there. Converting here would
    // dim `energy` to energy^(1/2.2) once the frame is re-encoded.
    const mat = lightMaterial(await render(node({ color: 'Color(0.5, 0.5, 0.5, 1)' })));
    const color = mat.uniforms.uColor!.value as THREE.Vector3;
    expect(color.x).toBeCloseTo(0.5, 5);
    expect(color.x).not.toBeCloseTo(0.2140, 3); // godotColorToLinear(0.5)
  });

  it('carries energy as its own multiplier rather than folding it into the colour', async () => {
    const mat = lightMaterial(await render(node({ color: 'Color(0.5, 0.5, 0.5, 1)', energy: '2.0' })));
    expect(mat.uniforms.uEnergy!.value).toBeCloseTo(2, 5);
    expect((mat.uniforms.uColor!.value as THREE.Vector3).x).toBeCloseTo(0.5, 5);
  });

  it('feeds the resolved texture to the cookie sampler', async () => {
    const mat = lightMaterial(await render(node()));
    expect(mat.uniforms.uCookie!.value).toBeInstanceOf(THREE.Texture);
  });

  it('shows missing resource placeholder when no texture resolves', async () => {
    // No texture property, so the placeholder shows.
    const r = await render(node({ texture: 'ExtResource("missing")' }));
    const groups = r.scene.findAllByType('Group');
    expect(groups.length).toBeGreaterThan(0);
  });
});
