/**
 * The one direct-child type test the semantic rules share. Godot attaches a shape, a wheel or a
 * camera through `get_parent()` alone, so the test reads direct children and never a subtree. A
 * guard keeps every child-presence rule on this function, since a copy drifts.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { TscnNode } from '../parser/types.js';
import { hasChildOfType } from './childType.js';
import { allSourceFiles, srcLabel } from './testing/ruleNameScrape.js';

/** The smallest node shape the rules walk. */
function node(type: string, children: TscnNode[] = []): TscnNode {
  return { type, name: type, properties: {}, children } as unknown as TscnNode;
}

describe('hasChildOfType', () => {
  it('finds a direct child of any listed type', () => {
    const body = node('RigidBody2D', [node('Sprite2D'), node('CollisionPolygon2D')]);
    expect(hasChildOfType(body, ['CollisionShape2D', 'CollisionPolygon2D'])).toBe(true);
  });

  it('counts a subclass, as the engine cast does', () => {
    // `cast_to<SubViewport>` accepts a subclass, and `descendsFrom` is reflexive.
    expect(hasChildOfType(node('Container', [node('SubViewport')]), ['Viewport'])).toBe(true);
  });

  it('answers false for no children, other types, or a match one level deeper', () => {
    expect(hasChildOfType(node('VehicleBody3D'), ['VehicleWheel3D'])).toBe(false);
    expect(hasChildOfType(node('VehicleBody3D', [node('MeshInstance3D')]), ['VehicleWheel3D'])).toBe(false);
    const nested = node('VehicleBody3D', [node('Node3D', [node('VehicleWheel3D')])]);
    expect(hasChildOfType(nested, ['VehicleWheel3D'])).toBe(false);
  });

  it('counts a child whose class this file cannot state', () => {
    const instanced = { ...node('ExtResource("1")'), instance: 'ExtResource("1")' } as TscnNode;
    expect(hasChildOfType(node('SubViewportContainer', [instanced]), ['SubViewport'])).toBe(true);
    // A GDExtension class the pinned catalog does not list may subclass the wanted type.
    expect(hasChildOfType(node('RetargetModifier3D', [node('MyExtensionSkeleton')]), ['Skeleton3D'])).toBe(
      true
    );
  });

  it('matches nothing for an empty type list unless a child is opaque', () => {
    expect(hasChildOfType(node('Body', [node('Sprite2D')]), [])).toBe(false);
    expect(hasChildOfType(node('Body', [node('MyExtensionNode')]), [])).toBe(true);
  });
});

describe('the one direct-child type test', () => {
  /** `children.some((child) => … descendsFrom(child.type …` in any spacing. */
  const SOME_COPY = /children\s*\.\s*some\(\s*\(?(\w+)\)?\s*=>[^;]*?descendsFrom\(\s*\1\.type/;
  /** `for (const child of node.children)` with `descendsFrom(child.type …` in its body. */
  const LOOP_COPY =
    /for\s*\(\s*const\s+(\w+)\s+of\s+[\w.?]*children\s*\)[\s\S]{0,600}?descendsFrom\(\s*\1\.type/;
  const isHandRolled = (source: string) => SOME_COPY.test(source) || LOOP_COPY.test(source);

  it('detects a hand-rolled copy in the `.some` and the loop spelling', () => {
    expect(
      isHandRolled('!node.children.some((child) => isTypeOpaque(child) || descendsFrom(child.type, wheelType))')
    ).toBe(true);
    expect(isHandRolled("if (children.some((c) =>\n  descendsFrom(c.type, 'Joint2D'))) return 'present';")).toBe(
      true
    );
    const loop = [
      'for (const child of node.children) {',
      '  if (isTypeUnknowable(child)) continue;',
      "  if (descendsFrom(child.type, 'XRCamera3D')) return 'satisfied';",
      '}',
    ].join('\n');
    expect(isHandRolled(loop)).toBe(true);
    expect(isHandRolled('children.some(isTypeUnknowable)')).toBe(false);
    expect(isHandRolled('for (const child of node.children) walk(child);')).toBe(false);
  });

  it('lives only in childType.ts', () => {
    const copies = allSourceFiles()
      .filter((file) => isHandRolled(readFileSync(file, 'utf8')))
      .map(srcLabel);
    expect(copies).toEqual(['linter/childType.ts']);
  });
});
