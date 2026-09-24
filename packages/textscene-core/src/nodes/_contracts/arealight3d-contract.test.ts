/**
 * AreaLight3D contract, a Godot 4.7 rectangular area light, through stable public APIs (TscnParser,
 * nodeRegistry, nodeComponentRegistry, Linter). An unregistered type already parses with its type
 * name through the base-Node fallback, so these pins key off what the fallback cannot satisfy: the
 * registry entries, the typed light properties, the RectAreaLight render and a lint-clean fixture.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';

import { TscnParser } from '../../parser/TscnParser';
import type { TscnNode } from '../../parser/types';
import { fixturesDir, flatten, repoRoot } from '../../parser/testing/parserKit';
import { nodeRegistry } from '../../core/NodeRegistry';
import { Linter } from '../../linter/Linter';
import { nodeComponentRegistry } from '../../r3f/NodeComponentRegistry';
import '../../r3f/nodes'; // side-effect: registers every node's r3f component

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
    const dir = fixturesDir();
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
