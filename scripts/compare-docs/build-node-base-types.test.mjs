/**
 * The derived base-type table, and the guard that the committed artifact is
 * current.
 *
 * `nodeBaseTypes.generated.ts` is checked in because CI has no Godot, so
 * nothing regenerates it there. That makes it exactly the kind of file that
 * rots: the catalog gains a node, nobody re-runs the generator, and the new
 * type's chain is missing while every test still passes. The last case below
 * closes that by re-deriving from the same committed catalog and comparing.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  deriveBaseTypes,
  OUT,
  RESOURCE_BASES,
  RESOURCE_OUT,
  renderFromCatalog,
  renderFromResourceBases,
} from './build-node-base-types.mjs';
import { RESOURCE_CLASSES } from './build-node-catalog/extraClasses.mjs';

describe('deriveBaseTypes', () => {
  it('emits one entry per hop, not just the leaf', () => {
    const table = deriveBaseTypes([
      { name: 'HSlider', chain: ['Slider', 'Range', 'Control', 'CanvasItem', 'Node', 'Object'] },
    ]);
    expect(table).toEqual({
      HSlider: 'Slider',
      Slider: 'Range',
      Range: 'Control',
      Control: 'CanvasItem',
      CanvasItem: 'Node',
    });
  });

  it('stops at Node and never emits Object', () => {
    const table = deriveBaseTypes([{ name: 'Timer', chain: ['Node', 'Object'] }]);
    expect(table).toEqual({ Timer: 'Node' });
  });

  it('tolerates a node whose chain is absent', () => {
    expect(deriveBaseTypes([{ name: 'Orphan' }])).toEqual({});
  });

  it('throws when two chains disagree about a class parent', () => {
    expect(() =>
      deriveBaseTypes([
        { name: 'A', chain: ['Mid', 'Node', 'Object'] },
        { name: 'C', chain: ['Mid', 'Other', 'Node', 'Object'] },
      ])
    ).toThrow(/Mid has two different bases/);
  });

  it('sorts keys so regenerating produces a stable diff', () => {
    const table = deriveBaseTypes([
      { name: 'Zebra', chain: ['Node', 'Object'] },
      { name: 'Alpha', chain: ['Node', 'Object'] },
    ]);
    expect(Object.keys(table)).toEqual(['Alpha', 'Zebra']);
  });

  it('the committed nodeBaseTypes.generated.ts matches the committed catalog', () => {
    expect(readFileSync(OUT, 'utf8')).toBe(renderFromCatalog());
  });

  it('the committed resourceBaseTypes.generated.ts matches the captured bases', () => {
    expect(readFileSync(RESOURCE_OUT, 'utf8')).toBe(renderFromResourceBases());
  });

  it('the gallery hand-writes no resource chain the capture disagrees with', () => {
    // RESOURCE_CLASSES predates the capture and spells its ancestry by hand.
    // The capture can now answer, so the two are compared rather than one of
    // them being trusted.
    const bases = JSON.parse(readFileSync(RESOURCE_BASES, 'utf8'));
    const derived = (name) => {
      const chain = [];
      for (let c = bases[name]; c !== undefined; c = bases[c]) chain.push(c);
      return chain;
    };
    for (const { name, chain } of RESOURCE_CLASSES) {
      expect(chain, `${name}`).toEqual(derived(name));
    }
  });
});
