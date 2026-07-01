/**
 * #126 (AreaLight3D slice) behavioral contract — RED until the slice ships.
 *
 * Godot 4.7 adds AreaLight3D, a rectangular real-time area light. The previewer
 * implements DirectionalLight3D / OmniLight3D / SpotLight3D under
 * nodes/3d/lights/ but has NO AreaLight3D — a 4.7 scene using it silently
 * renders no light. This slice, carved from umbrella #126 (item 1, "highest
 * value"), adds the full node slice: parse + register + render (three.js
 * RectAreaLight) + a lint-clean fixture.
 *
 * This is a WRITE slice (the behaviour does NOT yet ship), so unlike a
 * test-writing slice these are REAL behavioural witnesses through STABLE public
 * APIs (TscnParser, nodeRegistry, nodeComponentRegistry, Linter) — not
 * substring/coverage pins. They fail today and pass once the slice is built.
 *
 * RED-lever note: an UNREGISTERED type already parses to a node with
 * type === 'AreaLight3D' (base-Node fallback), so type-presence alone is NOT a
 * valid failing lever. These pins key off what the fallback canNOT satisfy: the
 * registry entries, the TYPED light properties, the RectAreaLight render, and a
 * fixture the linter passes. The exact Godot property mapping for the rectangle
 * size/extents and the assertion quality of the shipped co-located tests are
 * judged at /code-review, not pinned here.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createElement } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import type { TscnScene, TscnNode } from '../../parser/types';
import { nodeRegistry } from '../../core/NodeRegistry';
import { Linter } from '../../linter/Linter';
import { nodeComponentRegistry } from '../../r3f/NodeComponentRegistry';
import '../../r3f/nodes'; // side-effect: registers every node's r3f component

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

// A minimal 4.7-style scene using an AreaLight3D with base-light properties set.
const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Area" type="AreaLight3D" parent="."]
light_color = Color(0.5, 0.6, 0.7, 1)
light_energy = 4.0
shadow_enabled = true
`;

function parseAreaNode(): TscnNode {
  const scene = new TscnParser().parse(SCENE);
  const area = flatten(scene).find((n) => n.type === 'AreaLight3D');
  expect(area, 'scene should contain an AreaLight3D node').toBeDefined();
  return area as TscnNode;
}

describe('#126 AreaLight3D slice — behavioral contract (RED until shipped)', () => {
  it('registers AreaLight3D in the node (parser) registry', () => {
    expect(nodeRegistry.getRegistration('AreaLight3D')).toBeTruthy();
  });

  it('parses AreaLight3D base-light properties into typed values', () => {
    const area = parseAreaNode();
    const p = area.properties as Record<string, unknown>;
    // The base-Node fallback yields none of these typed light props → RED now.
    expect(p.light_energy).toBe(4.0); // parsed float, not a raw string / undefined
    expect(p.shadow_enabled).toBe(true); // parsed boolean
    expect(typeof p.light_color).toBe('string');
    expect(p.light_color as string).toContain('0.5'); // Color(...) preserved
  });

  it('registers an AreaLight3D r3f component', () => {
    expect(nodeComponentRegistry.get('AreaLight3D')).toBeDefined();
  });

  it('renders AreaLight3D as a three.js RectAreaLight', async () => {
    const Comp = nodeComponentRegistry.get('AreaLight3D');
    expect(Comp, 'AreaLight3D r3f component must be registered before it can render').toBeDefined();
    if (!Comp) return; // RED short-circuit: never touches the renderer until GREEN
    const area = parseAreaNode();
    const renderer = await ReactThreeTestRenderer.create(createElement(Comp, { node: area }));
    expect(
      renderer.scene.findAllByType('RectAreaLight').length,
      'AreaLight3D should render a three.js RectAreaLight',
    ).toBeGreaterThan(0);
  });

  it('ships a fixture containing an AreaLight3D that the linter passes', () => {
    const dir = resolve(repoRoot(), 'scenes/fixtures');
    const withArea = readdirSync(dir)
      .filter((f) => f.endsWith('.tscn'))
      .filter((f) => readFileSync(resolve(dir, f), 'utf8').includes('type="AreaLight3D"'));
    expect(withArea.length, 'a scenes/fixtures/*.tscn must use AreaLight3D').toBeGreaterThan(0);
    const raw = readFileSync(resolve(dir, withArea[0] as string), 'utf8');
    expect(flatten(new TscnParser().parse(raw)).some((n) => n.type === 'AreaLight3D')).toBe(true);
    const errors = new Linter().lint(raw).filter((d) => d.severity === 'error');
    expect(errors, `fixture ${withArea[0]} lints with errors: ${JSON.stringify(errors)}`).toHaveLength(0);
  });

  it('ships co-located parser + r3f render tests for the slice', () => {
    const slice = resolve(repoRoot(), 'packages/textscene-core/src/nodes/3d/lights/arealight3d');
    expect(existsSync(resolve(slice, 'parser.test.ts')), 'arealight3d/parser.test.ts missing').toBe(true);
    expect(existsSync(resolve(slice, 'Component.test.tsx')), 'arealight3d/Component.test.tsx missing').toBe(true);
  });
});
