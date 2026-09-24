/**
 * Every diagnostic `Linter` hands back carries the `Diagnostic` surface and nothing else. A file diagnostic is a
 * `RuleArm`, one spread away from leaking its `grounding`, so this checks the output where a second conversion beside
 * `armDiagnostic` would show. The observed-name assertion keeps the key check from passing over an empty set.
 */

import { describe, expect, it } from 'vitest';
import { lint, node, scene } from './testing/testkit.js';
import './index.js';

const DIAGNOSTIC_KEYS = ['location', 'message', 'nodeName', 'nodeType', 'ruleName', 'severity'];

/** One source per diagnostic `Linter` stamps itself, plus a rule and a validator. */
const SOURCES: Record<string, string> = {
  'legacy-format-version': '[gd_scene format=2]\n\n[node name="Root" type="Node2D"]\n',
  'unresolved-parent-path': scene(
    node('Node2D', {}, { name: 'Root' }),
    node('Node2D', {}, { name: 'Body', parent: 'NoSuchNode' })
  ),
  'node-without-parent': scene(
    node('Node2D', {}, { name: 'Root' }),
    node('Node2D', {}, { name: 'Stray' })
  ),
  'root-declares-parent': scene(node('Node2D', {}, { name: 'A', parent: '.' })),
  'empty-parent-path': scene(
    node('Node2D', {}, { name: 'Root' }),
    node('Node2D', {}, { name: 'B', parent: '' })
  ),
  'collisionobject2d-needs-collision-shape': scene(node('StaticBody2D', {}, { name: 'Root' })),
  'strict-parser': scene(node('Node2D', { position: 'Vector2(nope)' }, { name: 'Root' })),
  // A rule that hand-builds its diagnostic rather than taking one from an arm:
  // its `nodeName` came off the typed property bag, which carries no `name`
  // (the heading's attribute is not a property), so every report named `undefined`.
  'valid-node3d-visibility': scene(
    node('Node3D', { visibility_parent: 'NodePath("Nope")' }, { name: 'Root' })
  ),
};

describe('a reported diagnostic', () => {
  it('carries no key the Diagnostic surface does not declare', () => {
    const stray: string[] = [];
    for (const source of Object.values(SOURCES)) {
      for (const diagnostic of lint(source)) {
        for (const key of Object.keys(diagnostic)) {
          if (!DIAGNOSTIC_KEYS.includes(key)) stray.push(`${diagnostic.ruleName}: ${key}`);
        }
      }
    }
    expect([...new Set(stray)].sort()).toEqual([]);
  });

  it('names its node with a string, not with a property the bag never carried', () => {
    // Not "non-empty": a heading may legitimately declare no `name=`, and the
    // diagnostic about it then carries the empty name Godot read.
    const untyped: string[] = [];
    for (const source of Object.values(SOURCES)) {
      for (const d of lint(source)) {
        for (const field of ['message', 'nodeName', 'nodeType', 'ruleName', 'severity'] as const) {
          if (typeof d[field] !== 'string') untyped.push(`${d.ruleName}: ${field}=${d[field]}`);
        }
      }
    }
    expect([...new Set(untyped)].sort()).toEqual([]);
  });

  it('is actually produced by each source above, so the sweep has subjects', () => {
    const missing = Object.entries(SOURCES)
      .filter(([ruleName, source]) => !lint(source).some((d) => d.ruleName === ruleName))
      .map(([ruleName]) => ruleName);
    expect(missing).toEqual([]);
  });
});
