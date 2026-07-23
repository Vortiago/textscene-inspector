/**
 * CanvasModulate slice behavioral contract — written RED before the slice shipped.
 *
 * Godot: CanvasModulate (a Node2D) multiplies the color of the CanvasItems it
 * governs by its `color` (default white). The isometric dungeon uses one to set a
 * cool ambient tint. The previewer had NO CanvasModulate, so the node rendered as
 * an inert group and its descendants were untinted. This slice adds the vertical:
 * parse (typed `color` + Godot default) + register + render (fold `color` into the
 * inherited Modulate2DContext so descendant CanvasItems are tinted) + a lint-clean
 * fixture + the property validator.
 *
 * DIVERGENCE (intended): Godot's CanvasModulate tints the WHOLE canvas; the
 * previewer models it as a SUBTREE modulate (it tints its descendants). So this
 * contract asserts only on a DESCENDANT CanvasItem — never a sibling.
 *
 * RED-lever notes (this repo's own lessons):
 *  - An UNREGISTERED type already parses to type === 'CanvasModulate' (base-Node
 *    fallback), so type-presence is NOT a valid failing lever. These pins key off
 *    the registry entries, the TYPED `color` prop + its Godot property-ABSENT
 *    default (white), the descendant MESH tint, and the property validator.
 *  - Assert on the RENDERED descendant MESH's material.color, not a proxy. The base
 *    Node2D already provides Modulate2DContext with `parent × modulate` but NEVER
 *    folds in `color`, so a CanvasModulate implemented as a plain Node2D passthrough
 *    renders the descendant UNTINTED — the tint assertion is what distinguishes the
 *    real implementation from that plausible-wrong one.
 *  - The modulate multiply happens in sRGB space; the single sRGB→linear conversion
 *    is at the leaf (`godotColorToLinear`), so a descendant under CanvasModulate(C)
 *    with a white own-color renders material.color === godotColorToLinear(C).
 *  - Linter validator registration is a KNOWN blind spot — pinned as a lint-error
 *    DELTA (invalid `color` value => strictly more errors than a valid one).
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

function parseCMNode(tscn: string): TscnNode {
  const cm = flatten(new TscnParser().parse(tscn)).find((n) => n.type === 'CanvasModulate');
  expect(cm, 'scene should contain a CanvasModulate node').toBeDefined();
  return cm as TscnNode;
}

/** A CanvasModulate(color=extra) governing a WHITE Polygon2D descendant. */
function tintScene(colorLine: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node2D"]

[node name="CM" type="CanvasModulate" parent="."]
${colorLine}

[node name="Poly" type="Polygon2D" parent="CM"]
polygon = PackedVector2Array(0, 0, 8, 0, 8, 8)
`;
}

/** Render a .tscn through the real NodeDispatcher in the 2D workspace. */
async function renderScene(tscn: string) {
  const scene = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
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

/** The MeshBasicMaterial of the first rendered mesh (the descendant Polygon2D). */
function firstMeshMaterial(renderer: TestRenderer): THREE.MeshBasicMaterial | undefined {
  const meshes = renderer.scene.findAllByType('Mesh');
  return meshes[0] ? ((meshes[0].instance as THREE.Mesh).material as THREE.MeshBasicMaterial) : undefined;
}

function lintErrorCount(raw: string): number {
  return new Linter().lint(raw).filter((d) => d.severity === 'error').length;
}

function requireComp(): boolean {
  const Comp = nodeComponentRegistry.get('CanvasModulate');
  expect(Comp, 'CanvasModulate r3f component must be registered before it can render').toBeDefined();
  return !!Comp;
}

describe('CanvasModulate slice — behavioral contract (RED until shipped)', () => {
  it('registers CanvasModulate in the node (parser) registry', () => {
    expect(nodeRegistry.getRegistration('CanvasModulate')).toBeTruthy();
  });

  it('parses the CanvasModulate color into a typed {r,g,b,a}', () => {
    // The base-Node fallback keeps `color` as a raw string → RED now.
    const p = parseCMNode(tintScene('color = Color(0.4, 0.6, 0.9, 1)')).properties as Record<
      string,
      unknown
    >;
    const c = p.color as { r: number; g: number; b: number; a: number };
    expect(c?.r).toBeCloseTo(0.4, 5);
    expect(c?.g).toBeCloseTo(0.6, 5);
    expect(c?.b).toBeCloseTo(0.9, 5);
  });

  it('applies the Godot property-ABSENT default (color = white)', () => {
    // .tscn OMITS default-valued props; an omitted color must be white (a no-op tint).
    const p = parseCMNode(tintScene('')).properties as Record<string, unknown>;
    const c = p.color as { r: number; g: number; b: number; a: number };
    expect(c?.r).toBe(1);
    expect(c?.g).toBe(1);
    expect(c?.b).toBe(1);
  });

  it('registers a CanvasModulate r3f component', () => {
    expect(nodeComponentRegistry.get('CanvasModulate')).toBeDefined();
  });

  it('tints a DESCENDANT CanvasItem by its color (sRGB→linear), not a plain Node2D passthrough', async () => {
    if (!requireComp()) return;
    const mat = firstMeshMaterial(await renderScene(tintScene('color = Color(0.4, 0.6, 0.9, 1)')));
    expect(mat, 'a descendant Polygon2D mesh should render under CanvasModulate').toBeDefined();
    const lin = godotColorToLinear({ r: 0.4, g: 0.6, b: 0.9 });
    // Node2D passthrough (ignores color) would leave the white descendant at 1,1,1 → RED.
    expect(mat!.color.r).toBeCloseTo(lin.r, 3);
    expect(mat!.color.g).toBeCloseTo(lin.g, 3);
    expect(mat!.color.b).toBeCloseTo(lin.b, 3);
    expect(mat!.color.r).not.toBeCloseTo(1, 2);
  });

  it('a white (default) CanvasModulate is a no-op tint on its descendant', async () => {
    if (!requireComp()) return;
    const mat = firstMeshMaterial(await renderScene(tintScene('')));
    expect(mat).toBeDefined();
    expect(mat!.color.r).toBeCloseTo(1, 3);
    expect(mat!.color.g).toBeCloseTo(1, 3);
    expect(mat!.color.b).toBeCloseTo(1, 3);
  });

  it('registers a linter validator that REJECTS an invalid color', () => {
    // No validator → an invalid color passes silently and NO gate catches it. Delta
    // isolates the validator from any baseline errors.
    expect(lintErrorCount(tintScene('color = 3'))).toBeGreaterThan(
      lintErrorCount(tintScene('color = Color(1, 1, 1, 1)'))
    );
  });

  it('ships a fixture containing a CanvasModulate that the linter passes', () => {
    const dir = resolve(repoRoot(), 'scenes/fixtures');
    const withCM = readdirSync(dir)
      .filter((f) => f.endsWith('.tscn'))
      .filter((f) => readFileSync(resolve(dir, f), 'utf8').includes('type="CanvasModulate"'));
    expect(withCM.length, 'a scenes/fixtures/*.tscn must use CanvasModulate').toBeGreaterThan(0);
    const raw = readFileSync(resolve(dir, withCM[0] as string), 'utf8');
    expect(flatten(new TscnParser().parse(raw)).some((n) => n.type === 'CanvasModulate')).toBe(true);
    const errors = new Linter().lint(raw).filter((d) => d.severity === 'error');
    expect(errors, `fixture ${withCM[0]} lints with errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  it('ships co-located parser + Component render tests for the slice', () => {
    const slice = resolve(repoRoot(), 'packages/textscene-core/src/nodes/2d/canvasmodulate');
    expect(existsSync(resolve(slice, 'parser.test.ts')), 'canvasmodulate/parser.test.ts missing').toBe(true);
    expect(existsSync(resolve(slice, 'Component.test.tsx')), 'canvasmodulate/Component.test.tsx missing').toBe(true);
  });
});
