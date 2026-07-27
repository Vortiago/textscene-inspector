/**
 * PointLight2D slice behavioral contract — written RED before the slice shipped.
 *
 * Godot 2D lighting: PointLight2D (a Light2D) contributes a light "cookie"
 * texture, tinted by `color` and scaled by `energy`, to the canvas light pass —
 * the isometric dungeon's 23 torches. The previewer had NO PointLight2D, so a
 * scene using it rendered the node as an inert group (GenericNodeFallback) and the
 * torches did not glow. This slice adds the vertical: parse (typed Light2D /
 * PointLight2D props + Godot property-absent defaults) + register + render (the
 * cookie quad the light pass accumulates) + a lint-clean fixture + the property
 * validators.
 *
 * SCOPE. Occluder shadow-casting (LightOccluder2D / OccluderPolygon2D),
 * normal-mapped specular, and the light masks (`light_mask`,
 * `range_item_cull_mask`) are OUT of scope (tracked follow-ups) — do NOT pin
 * them here.
 *
 * WHAT THE MESH IS. A Godot light paints nothing on the canvas: it is applied to
 * every lit item's albedo. So the quad this slice renders lives on a dedicated
 * camera LAYER that only the accumulation pre-pass looks at, and the pins below
 * assert what that quad feeds into the pass — its blend, and the light term its
 * shader emits. An earlier revision pinned a `DstColorFactor` blend on the
 * visible canvas, which is the single-quad approximation this slice has since
 * replaced; a light that reaches the canvas directly would now be the bug.
 *
 * COLOUR SPACE. `color` reaches the shader in sRGB, deliberately NOT converted to
 * linear. Godot's 2D canvas has no linear working space (`Viewport.hdr_2d`
 * defaults false), so `color × energy` is an sRGB-space product; converting first
 * would leave `energy` scaling the result by only energy^(1/2.2) once the frame is
 * re-encoded. Measured against Godot 4.6.3 — an ADD torch at energy 2 over a grey
 * surface lands within 1/255 of the engine this way.
 *
 * RED-lever notes (this repo's own hard-won lessons):
 *  - An UNREGISTERED type already parses to a node with type === 'PointLight2D'
 *    (base-Node fallback), so type-presence alone is NOT a valid failing lever.
 *    These pins key off what the fallback CANNOT satisfy: the registry entries, the
 *    TYPED light props (with Godot property-ABSENT defaults — .tscn OMITS default
 *    values, so the omitted case is the COMMON case), the emitted MESH, and the
 *    property validators.
 *  - Assert on the RENDERED MESH (its layer, material blend and uniforms), never a
 *    wrapper group. The previewer's y-sort feature shipped green with a feature-
 *    breaking bug precisely because its contract asserted on a proxy and its visual
 *    golden was baked from the code under test.
 *  - Linter validator registration is a KNOWN blind spot: with no validator an
 *    invalid property value passes silently and NO gate catches it. Pinned here as a
 *    lint-error DELTA (invalid value => strictly more errors than the valid value),
 *    which stays robust to any baseline (e.g. unresolved-resource) errors.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene, TscnNode } from '../../parser/types';
import { nodeRegistry } from '../../core/NodeRegistry';
import { Linter } from '../../linter/Linter';
import { nodeComponentRegistry } from '../../r3f/NodeComponentRegistry';
import { NodeDispatcher } from '../../r3f/NodeDispatcher';
import { CanvasWorkspaceProvider } from '../../r3f/contexts/CanvasWorkspaceContext';
import { SelectionProvider } from '../../r3f/contexts/SelectionContext';
import { SceneResourcesProvider } from '../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { godotColorToLinear } from '../../r3f/godotColor';
import { LIGHT_LAYER } from '../../r3f/lighting2d/CanvasLighting2D';
import '../../r3f/nodes'; // side-effect: registers every node's r3f component
import '../../linter/index'; // side-effect: registers every node's linter validators

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = dirname(dir);
  }
  throw new Error('repo root (pnpm-workspace.yaml) not found above this test');
}

function flatten(scene: TscnScene): TscnNode[] {
  const out: TscnNode[] = [];
  const walk = (n: TscnNode): void => {
    out.push(n);
    n.children.forEach(walk);
  };
  scene.nodes.forEach(walk);
  return out;
}

function parseLightNode(tscn: string): TscnNode {
  const light = flatten(new TscnParser().parse(tscn)).find((n) => n.type === 'PointLight2D');
  expect(light, 'scene should contain a PointLight2D node').toBeDefined();
  return light as TscnNode;
}

/** A PointLight2D scene with a resolvable light texture (ExtResource id 1). */
function litScene(extra: string): string {
  return `[gd_scene format=3]
[ext_resource type="Texture2D" path="res://light.png" id="1"]

[node name="Root" type="Node2D"]

[node name="Light" type="PointLight2D" parent="."]
texture = ExtResource("1")
${extra}`;
}

/** Render a .tscn through the real NodeDispatcher with a seeded light texture. */
async function renderScene(tscn: string) {
  const scene = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const tex = new THREE.Texture();
  (tex as unknown as { image: { width: number; height: number } }).image = { width: 64, height: 64 };
  fake.textures.seed('res://light.png', tex);
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace="2d">
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider
          internalResources={scene.internalResources}
          externalResources={scene.externalResources}
        >
          <SelectionProvider>
            <NodeDispatcher nodes={scene.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  return renderer;
}

type TestRenderer = Awaited<ReturnType<typeof renderScene>>;

/**
 * Every mesh emitted as a LIGHT: one that sits on the light layer, so the
 * visible pass cannot draw it and the accumulation pre-pass sees nothing else.
 * That layer is the whole difference between a light and a sprite.
 */
function lightMeshes(renderer: TestRenderer): THREE.Mesh[] {
  const lightLayer = new THREE.Layers();
  lightLayer.set(LIGHT_LAYER);
  return renderer.scene
    .findAllByType('Mesh')
    .map((o) => o.instance as THREE.Mesh)
    .filter((m) => m.layers.test(lightLayer));
}

/** The cookie-quad materials of those meshes. */
function lightMaterials(renderer: TestRenderer): THREE.ShaderMaterial[] {
  return lightMeshes(renderer).map((m) => m.material as THREE.ShaderMaterial);
}

function lintErrorCount(raw: string): number {
  return new Linter().lint(raw).filter((d) => d.severity === 'error').length;
}

/** Assert the r3f component is registered; false (short-circuit) until GREEN. */
function requireComp(): boolean {
  const Comp = nodeComponentRegistry.get('PointLight2D');
  expect(Comp, 'PointLight2D r3f component must be registered before it can render').toBeDefined();
  return !!Comp;
}

describe('PointLight2D slice — behavioral contract (RED until shipped)', () => {
  it('registers PointLight2D in the node (parser) registry', () => {
    expect(nodeRegistry.getRegistration('PointLight2D')).toBeTruthy();
  });

  it('parses Light2D/PointLight2D properties into typed values', () => {
    // The base-Node fallback yields raw strings / undefined, not these typed values → RED now.
    const p = parseLightNode(
      `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Light" type="PointLight2D" parent="."]
energy = 2.0
blend_mode = 2
texture_scale = 3.0
enabled = false
`
    ).properties as Record<string, unknown>;
    expect(p.energy).toBe(2);
    expect(p.blend_mode).toBe(2);
    expect(p.texture_scale).toBe(3);
    expect(p.enabled).toBe(false);
  });

  it('applies Godot property-ABSENT defaults (energy 1, blend_mode 0=ADD, texture_scale 1, enabled true)', () => {
    // .tscn OMITS default-valued props, so the omitted case is the COMMON case.
    const p = parseLightNode(
      `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="Light" type="PointLight2D" parent="."]
`
    ).properties as Record<string, unknown>;
    expect(p.energy).toBe(1);
    expect(p.blend_mode).toBe(0);
    expect(p.texture_scale).toBe(1);
    expect(p.enabled).toBe(true);
  });

  it('registers a PointLight2D r3f component', () => {
    expect(nodeComponentRegistry.get('PointLight2D')).toBeDefined();
  });

  it('emits a cookie quad on the light layer when blend_mode is omitted (default ADD)', async () => {
    if (!requireComp()) return;
    const mats = lightMaterials(await renderScene(litScene('')));
    expect(mats.length, 'PointLight2D should emit a mesh on the light layer').toBeGreaterThan(0);
    expect(
      mats[0]!.uniforms.uCookie?.value,
      'the light quad should sample its light texture'
    ).toBeTruthy();
    // Godot's ADD: color += light_color.rgb * light_color.a.
    expect(mats[0]!.blending).toBe(THREE.CustomBlending);
    expect(mats[0]!.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(mats[0]!.blendDst).toBe(THREE.OneFactor);
    expect(mats[0]!.blendEquation).toBe(THREE.AddEquation);
  });

  it('hands the shader its color in the canvas\' sRGB space, unconverted', async () => {
    if (!requireComp()) return;
    const mats = lightMaterials(await renderScene(litScene('color = Color(0.5, 0.5, 0.5, 1)')));
    expect(mats.length).toBeGreaterThan(0);
    const color = mats[0]!.uniforms.uColor!.value as THREE.Vector3;
    expect(color.x).toBeCloseTo(0.5, 5);
    // Linearizing here (≈0.214) is what leaves `energy` scaling by energy^(1/2.2).
    expect(color.x).not.toBeCloseTo(godotColorToLinear({ r: 0.5, g: 0.5, b: 0.5 }).r, 2);
  });

  it('scales the emitted brightness by energy', async () => {
    if (!requireComp()) return;
    const dim = lightMaterials(await renderScene(litScene('color = Color(0.5, 0.5, 0.5, 1)')));
    const bright = lightMaterials(
      await renderScene(litScene('color = Color(0.5, 0.5, 0.5, 1)\nenergy = 2.0'))
    );
    expect(dim.length).toBeGreaterThan(0);
    expect(bright.length).toBeGreaterThan(0);
    // energy MUST meaningfully brighten the light (ignoring it → equal → RED).
    expect(bright[0]!.uniforms.uEnergy!.value).toBeGreaterThan(
      (dim[0]!.uniforms.uEnergy!.value as number) * 1.5
    );
  });

  it('applies each Light2D.BlendMode as its own accumulation, ADD apart from MIX', async () => {
    if (!requireComp()) return;
    const sub = lightMaterials(await renderScene(litScene('blend_mode = 1')));
    const mix = lightMaterials(await renderScene(litScene('blend_mode = 2')));
    expect(sub.length).toBeGreaterThan(0);
    expect(mix.length).toBeGreaterThan(0);
    // SUB subtracts the same term ADD adds.
    expect(sub[0]!.blendEquation).toBe(THREE.ReverseSubtractEquation);
    expect(sub[0]!.blendDst).toBe(THREE.OneFactor);
    // MIX interpolates toward the light instead: mix(dst, src, srcAlpha).
    // Leaving it on ADD's OneFactor renders MIX identically to ADD.
    expect(mix[0]!.blendEquation).toBe(THREE.AddEquation);
    expect(mix[0]!.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
  });

  it('emits no light mesh when the light is disabled (enabled=false)', async () => {
    if (!requireComp()) return;
    expect(lightMeshes(await renderScene(litScene('enabled = false'))).length).toBe(0);
  });

  it('registers a linter validator that REJECTS an invalid blend_mode', () => {
    // With no validator an invalid value passes silently and NO gate catches it (the
    // profile blind spot). The delta isolates the validator from any baseline errors.
    expect(lintErrorCount(litScene('blend_mode = 9'))).toBeGreaterThan(
      lintErrorCount(litScene('blend_mode = 0'))
    );
  });

  it('registers a linter validator that REJECTS a non-boolean enabled', () => {
    expect(lintErrorCount(litScene('enabled = "yes"'))).toBeGreaterThan(
      lintErrorCount(litScene('enabled = true'))
    );
  });

  it('ships a fixture containing a PointLight2D that the linter passes', () => {
    const dir = resolve(repoRoot(), 'scenes/fixtures');
    const withLight = readdirSync(dir)
      .filter((f) => f.endsWith('.tscn'))
      .filter((f) => readFileSync(resolve(dir, f), 'utf8').includes('type="PointLight2D"'));
    expect(withLight.length, 'a scenes/fixtures/*.tscn must use PointLight2D').toBeGreaterThan(0);
    const raw = readFileSync(resolve(dir, withLight[0] as string), 'utf8');
    expect(flatten(new TscnParser().parse(raw)).some((n) => n.type === 'PointLight2D')).toBe(true);
    const errors = new Linter().lint(raw).filter((d) => d.severity === 'error');
    expect(errors, `fixture ${withLight[0]} lints with errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  it('ships co-located parser + Component render tests for the slice', () => {
    const slice = resolve(repoRoot(), 'packages/textscene-core/src/nodes/2d/pointlight2d');
    expect(existsSync(resolve(slice, 'parser.test.ts')), 'pointlight2d/parser.test.ts missing').toBe(true);
    expect(existsSync(resolve(slice, 'Component.test.tsx')), 'pointlight2d/Component.test.tsx missing').toBe(true);
  });
});
