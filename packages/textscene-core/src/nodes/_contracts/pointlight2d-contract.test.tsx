/**
 * PointLight2D slice behavioral contract — written RED before the slice shipped.
 *
 * Godot 2D lighting: PointLight2D (a Light2D) renders a light "cookie" texture,
 * tinted by `color` and scaled by `energy`, ADDITIVELY blended onto the canvas —
 * the isometric dungeon's 23 torches. The previewer had NO PointLight2D, so a
 * scene using it rendered the node as an inert group (GenericNodeFallback) and the
 * torches did not glow. This slice adds the vertical: parse (typed Light2D /
 * PointLight2D props + Godot property-absent defaults) + register + render (an
 * additive textured quad, like Sprite2D but blended ADD and tinted color × energy)
 * + a lint-clean fixture + the property validators.
 *
 * SCOPE — the additive-glow approximation ONLY. Occluder shadow-casting
 * (LightOccluder2D / OccluderPolygon2D), normal-mapped specular, and CanvasModulate
 * ambient are OUT of scope (tracked follow-ups) — do NOT pin them here.
 *
 * RED-lever notes (this repo's own hard-won lessons):
 *  - An UNREGISTERED type already parses to a node with type === 'PointLight2D'
 *    (base-Node fallback), so type-presence alone is NOT a valid failing lever.
 *    These pins key off what the fallback CANNOT satisfy: the registry entries, the
 *    TYPED light props (with Godot property-ABSENT defaults — .tscn OMITS default
 *    values, so the omitted case is the COMMON case), the additive MESH, and the
 *    property validators.
 *  - Assert on the RENDERED MESH (material.blending / .color / .map), never a
 *    wrapper group. The previewer's y-sort feature shipped green with a feature-
 *    breaking bug precisely because its contract asserted on a proxy and its visual
 *    golden was baked from the code under test. There is NO Godot 2D oracle in this
 *    repo,
 *    so THIS unit contract is the lock; any visual golden is a regression guard only.
 *  - Linter validator registration is a KNOWN blind spot: with no validator an
 *    invalid property value passes silently and NO gate catches it. Pinned here as a
 *    lint-error DELTA (invalid value => strictly more errors than the valid value),
 *    which stays robust to any baseline (e.g. unresolved-resource) errors.
 *
 * The exact energy photometry and the assertion QUALITY of the shipped co-located
 * tests are judged at /code-review, not over-pinned here.
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
 * The MeshBasicMaterials of every mesh drawn as a LIGHT — one applied against
 * the surface under it rather than painted over it. Godot's ADD light leaves
 * `albedo x (1 + light)`, which `DstColorFactor` reproduces exactly; plain
 * AdditiveBlending would give `albedo + light` and wash the surface out.
 */
function additiveMaterials(renderer: TestRenderer): THREE.MeshBasicMaterial[] {
  return renderer.scene
    .findAllByType('Mesh')
    .map((o) => (o.instance as THREE.Mesh).material as THREE.MeshBasicMaterial)
    .filter(
      (m) =>
        m.blending === THREE.CustomBlending &&
        m.blendSrc === THREE.DstColorFactor &&
        m.blendDst === THREE.OneFactor &&
        m.blendEquation === THREE.AddEquation
    );
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

  it('renders a surface-modulating textured quad when blend_mode is omitted (default ADD)', async () => {
    if (!requireComp()) return;
    const mats = additiveMaterials(await renderScene(litScene('')));
    expect(mats.length, 'PointLight2D should render an additively-blended mesh').toBeGreaterThan(0);
    expect(mats[0]!.map, 'the light quad should use its light texture').toBeTruthy();
  });

  it('tints the light by its color converted sRGB→linear', async () => {
    if (!requireComp()) return;
    const mats = additiveMaterials(await renderScene(litScene('color = Color(0.5, 0.5, 0.5, 1)')));
    expect(mats.length).toBeGreaterThan(0);
    const linHalf = godotColorToLinear({ r: 0.5, g: 0.5, b: 0.5 }).r; // ≈0.214, NOT 0.5
    expect(mats[0]!.color.r).toBeCloseTo(linHalf, 3);
    // Raw-sRGB (0.5) or the 3D parseColorToHex path (no linearization) would be WRONG.
    expect(mats[0]!.color.r).not.toBeCloseTo(0.5, 2);
  });

  it('scales the emitted brightness by energy', async () => {
    if (!requireComp()) return;
    const dim = additiveMaterials(await renderScene(litScene('color = Color(0.5, 0.5, 0.5, 1)')));
    const bright = additiveMaterials(
      await renderScene(litScene('color = Color(0.5, 0.5, 0.5, 1)\nenergy = 2.0'))
    );
    expect(dim.length).toBeGreaterThan(0);
    expect(bright.length).toBeGreaterThan(0);
    // energy MUST meaningfully brighten the light (ignoring it → equal → RED).
    expect(bright[0]!.color.r).toBeGreaterThan(dim[0]!.color.r * 1.5);
  });

  it('renders no additive light mesh when the light is disabled (enabled=false)', async () => {
    if (!requireComp()) return;
    expect(additiveMaterials(await renderScene(litScene('enabled = false'))).length).toBe(0);
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
