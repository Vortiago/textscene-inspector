/**
 * The one direct-child type test the semantic rules share. The generic subtree walk it replaced
 * was deleted for answering a question Godot never asks, and its copies drifted before that, so a
 * guard keeps every child-presence rule on this function.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type { TscnNode } from '../parser/types.js';
import { hasChildOfType } from './childType.js';
import { allSourceFiles, srcRoot } from './testing/ruleNameScrape.js';

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
  });
});

describe('the one direct-child type test', () => {
  /** `children.some((child) => … descendsFrom(child.type …` in any spacing: a hand-rolled copy. */
  const HAND_ROLLED = /children\s*\.\s*some\(\s*\(?(\w+)\)?\s*=>[^;]*?descendsFrom\(\s*\1\.type/;

  it('detects the copies the rules used to carry', () => {
    expect(
      HAND_ROLLED.test('!node.children.some((child) => isTypeOpaque(child) || descendsFrom(child.type, wheelType))')
    ).toBe(true);
    expect(
      HAND_ROLLED.test("if (children.some((c) =>\n  descendsFrom(c.type, 'Joint2D'))) return 'present';")
    ).toBe(true);
    expect(HAND_ROLLED.test('children.some(isTypeUnknowable)')).toBe(false);
  });

  it('lives only in childType.ts', () => {
    const copies = allSourceFiles()
      .filter((file) => HAND_ROLLED.test(readFileSync(file, 'utf8')))
      .map((file) => relative(srcRoot, file).replaceAll('\\', '/'));
    expect(copies).toEqual(['linter/childType.ts']);
  });
});
