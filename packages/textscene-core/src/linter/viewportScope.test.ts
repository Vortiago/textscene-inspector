/**
 * `viewportScopeOf`: which current-camera slot a node contends. The three answers are
 * the three things a camera rule must not confuse, so each is pinned on its own.
 */

import { describe, expect, it } from 'vitest';
import { node, scene, instanced, packedScene } from './testing/testkit';
import { byName } from './testing/sceneNodes.js';
import { StrictTscnParser } from './StrictTscnParser.js';
import { viewportScopeOf } from './viewportScope.js';

/** The scope of the node named `name` in `source`, read off the parsed tree. */
function scopeOf(source: string, name: string) {
  const parsed = new StrictTscnParser().parse(source).scene;
  if (!parsed) throw new Error('the scanner produced no scene');
  return viewportScopeOf(parsed, byName(parsed.nodes, name));
}

describe('viewportScopeOf', () => {
  it('is null for a node with no Viewport ancestor, the scene drawing into its own', () => {
    const source = scene(
      node('Node3D', {}, { name: 'Root' }),
      node('Camera3D', {}, { name: 'Camera', parent: '.' })
    );
    expect(scopeOf(source, 'Camera')).toBe(null);
  });

  // `get_viewport()` is the nearest Viewport ancestor (node.cpp:345-347), so the
  // innermost of two nested Viewports owns the slot the camera contends.
  it('is the nearest SubViewport when Viewports nest', () => {
    const source = scene(
      node('Node3D', {}, { name: 'Root' }),
      node('SubViewport', {}, { name: 'Outer', parent: '.' }),
      node('Node3D', {}, { name: 'Middle', parent: 'Outer' }),
      node('SubViewport', {}, { name: 'Inner', parent: 'Outer/Middle' }),
      node('Camera3D', {}, { name: 'Camera', parent: 'Outer/Middle/Inner' })
    );
    expect(scopeOf(source, 'Camera')?.name).toBe('Inner');
  });

  // `Window` is a Viewport (window.h:43), so the scope comes off the base chain, and
  // `ConfirmationDialog` three hops below it scopes unnamed just the same.
  for (const type of ['Window', 'ConfirmationDialog']) {
    it(`is the ${type} ancestor, a Viewport found through the base chain`, () => {
      const source = scene(
        node('Node3D', {}, { name: 'Root' }),
        node(type, {}, { name: 'Holder', parent: '.' }),
        node('Camera3D', {}, { name: 'Camera', parent: 'Holder' })
      );
      expect(scopeOf(source, 'Camera')?.name).toBe('Holder');
    });
  }

  // An instanced ancestor may itself be a Viewport, so the slot is not knowable from
  // this file: pooling the camera into the outer scope is the false positive prevented.
  it('is undefined when an instanced ancestor ends the walk', () => {
    const source = scene(
      packedScene,
      node('Node3D', {}, { name: 'Root' }),
      instanced('Instance', { parent: '.' }),
      node('Camera3D', {}, { name: 'Camera', parent: 'Instance' })
    );
    expect(scopeOf(source, 'Camera')).toBe(undefined);
  });
});
