/**
 * LightOccluder2D slice behavioral contract — written RED before the slice shipped.
 *
 * Godot: LightOccluder2D (a Node2D) references an OccluderPolygon2D resource (a
 * `polygon` of points, `closed` default true). It is INVISIBLE at runtime and cast
 * shadows for 2D lights; the editor shows its polygon as an outline gizmo. The
 * previewer had NO LightOccluder2D, so the isometric dungeon's 7 occluders rendered
 * as inert groups. This slice adds the vertical: parse (LightOccluder2D props + the
 * OccluderPolygon2D SubResource) + register + render the occluder polygon as a
 * selection-gated LineSegments OUTLINE (editor-parity gizmo, ADR-0018) + a lint-clean
 * fixture + property validators.
 *
 * SCOPE — the occluder-outline VISUALIZATION only. Shadow-CASTING (the actual light
 * effect) is OUT of scope (a tracked follow-up); this slice adds an inspection
 * outline that shows when the node is selected, and adds NOTHING to the default
 * dungeon render. Do NOT implement shadows here.
 *
 * RED-lever notes (this repo's own lessons):
 *  - An UNREGISTERED type already parses to type === 'LightOccluder2D' (base-Node
 *    fallback), so type-presence is NOT a valid failing lever. These pins key off
 *    the registry entries, the TYPED props + Godot property-ABSENT defaults, the
 *    rendered LineSegments TOPOLOGY, the selection gate, and the property validators.
 *  - Assert on the rendered GEOMETRY's TOPOLOGY (LineSegments `position.count`), not
 *    a bbox — a closed N-gon → N segments → 2N positions; an OPEN path → 2(N-1). The
 *    `closed` property-absent default (true) is coupled to that count, so one pair of
 *    fixtures (closed vs open) locks resource parse + the `closed` default + topology
 *    + the actual render, and catches a naive always-closing loop builder.
 *  - The occluder gizmo is SELECTION-gated (useGizmoVisible): it renders only when
 *    its node is the selected node. So the render pins select the node's path and a
 *    guardrail pin asserts NOTHING renders unselected.
 *  - Linter validator registration is a KNOWN blind spot — pinned as a lint-error
 *    DELTA (an invalid `sdf_collision` => strictly more errors than a valid one).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { useEffect } from 'react';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene, TscnNode } from '../../parser/types';
import { nodeRegistry } from '../../core/NodeRegistry';
import { Linter } from '../../linter/Linter';
import { nodeComponentRegistry } from '../../r3f/NodeComponentRegistry';
import { NodeDispatcher } from '../../r3f/NodeDispatcher';
import { CanvasWorkspaceProvider } from '../../r3f/contexts/CanvasWorkspaceContext';
import { SelectionProvider, useSelection } from '../../r3f/contexts/SelectionContext';
import { SceneResourcesProvider } from '../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../resources/testing/createFakeResourceLoader';
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

function parseOccNode(tscn: string): TscnNode {
  const occ = flatten(new TscnParser().parse(tscn)).find((n) => n.type === 'LightOccluder2D');
  expect(occ, 'scene should contain a LightOccluder2D node').toBeDefined();
  return occ as TscnNode;
}

/**
 * A scene with `Root` (Node2D) > `Occ` (LightOccluder2D) referencing a 4-point
 * OccluderPolygon2D SubResource. `closedLine`='' → default (closed loop);
 * occluder:false → omit the resource; nodeProps → extra LightOccluder2D props.
 * The occluder's NodeDispatcher path is "Root/Occ".
 */
function occScene(opts: { closedLine?: string; occluder?: boolean; nodeProps?: string }): string {
  const sub =
    opts.occluder === false
      ? ''
      : `[sub_resource type="OccluderPolygon2D" id="1"]
polygon = PackedVector2Array(0, 0, 16, 0, 16, 16, 0, 16)
${opts.closedLine ?? ''}
`;
  const occLine = opts.occluder === false ? '' : 'occluder = SubResource("1")';
  return `[gd_scene format=3]

${sub}
[node name="Root" type="Node2D"]

[node name="Occ" type="LightOccluder2D" parent="."]
${occLine}
${opts.nodeProps ?? ''}
`;
}

/** Sets the selected node path from inside SelectionProvider (gizmo gate). */
function SelectSeeder({ path }: { path: string }) {
  const { setSelectedNodePath } = useSelection();
  useEffect(() => {
    setSelectedNodePath(path);
  }, [path, setSelectedNodePath]);
  return null;
}

/** Render a .tscn through NodeDispatcher (2D workspace), optionally selecting a node. */
async function renderOcc(tscn: string, selectPath?: string) {
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
            {selectPath ? <SelectSeeder path={selectPath} /> : null}
            <NodeDispatcher nodes={scene.nodes} />
          </SelectionProvider>
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    </CanvasWorkspaceProvider>
  );
  await new Promise<void>((r) => setTimeout(r, 10));
  return renderer;
}

type TestRenderer = Awaited<ReturnType<typeof renderOcc>>;

/** `position.count` of every rendered LineSegments (the occluder outline geometry). */
function lineSegmentCounts(renderer: TestRenderer): number[] {
  return renderer.scene
    .findAllByType('LineSegments')
    .map((o) => (o.instance as THREE.LineSegments).geometry.getAttribute('position').count);
}

function lintErrorCount(raw: string): number {
  return new Linter().lint(raw).filter((d) => d.severity === 'error').length;
}

function requireComp(): boolean {
  const Comp = nodeComponentRegistry.get('LightOccluder2D');
  expect(Comp, 'LightOccluder2D r3f component must be registered before it can render').toBeDefined();
  return !!Comp;
}

describe('LightOccluder2D slice — behavioral contract (RED until shipped)', () => {
  it('registers LightOccluder2D in the node (parser) registry', () => {
    expect(nodeRegistry.getRegistration('LightOccluder2D')).toBeTruthy();
  });

  it('parses LightOccluder2D properties into typed values', () => {
    const p = parseOccNode(occScene({ nodeProps: 'light_mask = 2\nsdf_collision = false' }))
      .properties as Record<string, unknown>;
    expect(p.light_mask).toBe(2);
    expect(p.sdf_collision).toBe(false);
  });

  it('applies Godot property-ABSENT defaults (light_mask 1, sdf_collision true)', () => {
    const p = parseOccNode(occScene({})).properties as Record<string, unknown>;
    expect(p.light_mask).toBe(1);
    expect(p.sdf_collision).toBe(true);
  });

  it('registers a LightOccluder2D r3f component', () => {
    expect(nodeComponentRegistry.get('LightOccluder2D')).toBeDefined();
  });

  it('renders the occluder polygon as a LineSegments outline when the node is selected', async () => {
    if (!requireComp()) return;
    const counts = lineSegmentCounts(await renderOcc(occScene({}), 'Root/Occ'));
    expect(counts.length, 'a selected LightOccluder2D should render exactly one occluder outline').toBe(1);
    // 4 points, closed loop (default) → 4 segments → 8 positions.
    expect(counts[0]).toBe(8);
  });

  it('couples OccluderPolygon2D `closed` to the rendered topology (absent=closed loop, false=open path)', async () => {
    if (!requireComp()) return;
    const closed = lineSegmentCounts(await renderOcc(occScene({}), 'Root/Occ'));
    const open = lineSegmentCounts(await renderOcc(occScene({ closedLine: 'closed = false' }), 'Root/Occ'));
    expect(closed[0]).toBe(8); // 4 pts closed → 4 segments → 8 positions
    expect(open[0]).toBe(6); // 4 pts open → 3 segments → 6 positions (naive always-close builder → RED)
  });

  it('renders NO occluder outline when the node is NOT selected (gizmo gate)', async () => {
    if (!requireComp()) return;
    expect(lineSegmentCounts(await renderOcc(occScene({}))).length).toBe(0);
  });

  it('renders no outline when the LightOccluder2D has no occluder resource', async () => {
    if (!requireComp()) return;
    expect(lineSegmentCounts(await renderOcc(occScene({ occluder: false }), 'Root/Occ')).length).toBe(0);
  });

  it('registers a linter validator that REJECTS a non-boolean sdf_collision', () => {
    // No validator → an invalid value passes silently and NO gate catches it. Delta
    // isolates the validator from any baseline (e.g. sub-resource) errors.
    expect(lintErrorCount(occScene({ nodeProps: 'sdf_collision = "maybe"' }))).toBeGreaterThan(
      lintErrorCount(occScene({ nodeProps: 'sdf_collision = true' }))
    );
  });

  it('ships a fixture containing a LightOccluder2D that the linter passes', () => {
    const dir = resolve(repoRoot(), 'scenes/fixtures');
    const withOcc = readdirSync(dir)
      .filter((f) => f.endsWith('.tscn'))
      .filter((f) => readFileSync(resolve(dir, f), 'utf8').includes('type="LightOccluder2D"'));
    expect(withOcc.length, 'a scenes/fixtures/*.tscn must use LightOccluder2D').toBeGreaterThan(0);
    const raw = readFileSync(resolve(dir, withOcc[0] as string), 'utf8');
    expect(flatten(new TscnParser().parse(raw)).some((n) => n.type === 'LightOccluder2D')).toBe(true);
    const errors = new Linter().lint(raw).filter((d) => d.severity === 'error');
    expect(errors, `fixture ${withOcc[0]} lints with errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  it('ships co-located parser + Component render tests for the slice', () => {
    const slice = resolve(repoRoot(), 'packages/textscene-core/src/nodes/2d/lightoccluder2d');
    expect(existsSync(resolve(slice, 'parser.test.ts')), 'lightoccluder2d/parser.test.ts missing').toBe(true);
    expect(existsSync(resolve(slice, 'Component.test.tsx')), 'lightoccluder2d/Component.test.tsx missing').toBe(true);
  });
});
