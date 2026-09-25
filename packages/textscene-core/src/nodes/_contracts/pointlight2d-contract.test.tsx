/**
 * PointLight2D contract. A Godot light paints nothing on the canvas: it lights every item's albedo.
 * So the cookie quad lives on a camera layer only the accumulation pre-pass reads, and these pins
 * assert on that mesh's layer, blend and uniforms, never on a wrapper group. Occluder shadows,
 * normal-mapped specular and the light masks are out of scope.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';
import { fixturesDir, flatten, repoRoot } from '../../parser/testing/parserKit';
import { nodeRegistry } from '../../core/NodeRegistry';
import { Linter } from '../../linter/Linter';
import { nodeComponentRegistry } from '../../r3f/NodeComponentRegistry';
import { NodeDispatcher } from '../../r3f/NodeDispatcher';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
import { godotColorToLinear } from '../../r3f/godotColor';
import { CanvasLighting2DProvider, LIGHT_LAYER } from '../../r3f/lighting2d/CanvasLighting2D';
import { SceneStack } from '../../r3f/testing/SceneStack';
import '../../r3f/nodes'; // side-effect: registers every node's r3f component
import '../../linter/index'; // side-effect: registers every node's linter validators

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
    <SceneStack workspace="2d" loader={fake.loader} scene={scene}>
      {/* The light's camera layer is its cull-mask class's layer, and only
          the provider assigns one. Mounted here so the quad these pins
          look for lands where the real 2D stage puts it. */}
      <CanvasLighting2DProvider canvasModulate={{ r: 1, g: 1, b: 1, a: 1 }}>
        <NodeDispatcher nodes={scene.nodes} />
      </CanvasLighting2DProvider>
    </SceneStack>
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

/**
 * Any diagnostic, whatever its severity. A range violation is a warning when
 * only Godot's hint states the bound (ADR-0032), so a contract asserting that a
 * validator EXISTS must not also assume it errors.
 */
function lintDiagnosticCount(raw: string): number {
  return new Linter().lint(raw).length;
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
    // Godot's 2D canvas has no linear working space (`Viewport.hdr_2d` defaults false), so
    // `color × energy` is an sRGB product. Linearizing here (≈0.214) leaves `energy` scaling by
    // energy^(1/2.2). This way an ADD light at energy 2 lands within 1/255 of Godot 4.6.3.
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

  it('registers a linter validator that CATCHES an invalid blend_mode', () => {
    // With no validator an invalid value passes silently and NO gate catches it (the
    // profile blind spot). The delta isolates the validator from any baseline
    // diagnostics. Counted at any severity: light_2d.cpp:307 states the enum
    // through its hint and set_blend_mode bare-assigns, so 9 is a warning.
    expect(lintDiagnosticCount(litScene('blend_mode = 9'))).toBeGreaterThan(
      lintDiagnosticCount(litScene('blend_mode = 0'))
    );
  });

  it('registers a linter validator that REJECTS a non-boolean enabled', () => {
    expect(lintErrorCount(litScene('enabled = "yes"'))).toBeGreaterThan(
      lintErrorCount(litScene('enabled = true'))
    );
  });

  it('ships a fixture containing a PointLight2D that the linter passes', () => {
    const dir = fixturesDir();
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
