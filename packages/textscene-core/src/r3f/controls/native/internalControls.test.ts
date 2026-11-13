/** The internal Controls module: what a class registers, built once for each parent and theme. */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from './nativeTheme';
import { controlNode, solveNode } from './testing/solveNode';
import type { SolveNode } from './solveTree';
import { internalControlsOf, registerInternalControls, syntheticPath } from './internalControls';

const THEME = nativeTheme(1);

registerInternalControls(
  'HostWithInternals',
  () => [
    { mode: 'front', spec: { type: 'Label', name: 'Front', properties: { name: 'Front' } } },
    {
      mode: 'back',
      spec: {
        type: 'HBoxContainer',
        name: 'Row',
        properties: { name: 'Row' },
        children: [{ type: 'Button', name: 'Ok', properties: { name: 'Ok' } }],
      },
    },
  ],
  () => new Map()
);

function host(type: string): SolveNode {
  return { ...solveNode(), path: 'Root/Host', node: controlNode('Host', type) };
}

describe('internalControlsOf', () => {
  it('builds one list for each parent and theme', () => {
    const parent = host('HostWithInternals');
    expect(internalControlsOf(parent, THEME)).toBe(internalControlsOf(parent, THEME));
    expect(internalControlsOf(parent, nativeTheme(2))).not.toBe(internalControlsOf(parent, THEME));
  });

  it('gives a class that registers none an empty list', () => {
    expect(internalControlsOf(host('Panel'), THEME)).toEqual([]);
  });

  it('keeps the mode each entry is registered with', () => {
    const modes = internalControlsOf(host('HostWithInternals'), THEME).map(({ mode }) => mode);
    expect(modes).toEqual(['front', 'back']);
  });

  it('puts each internal Control at its parent path, then @ and its name', () => {
    const [, row] = internalControlsOf(host('HostWithInternals'), THEME);
    expect(row!.node.path).toBe('Root/Host/@Row');
    expect(row!.node.children.map((child) => child.path)).toEqual(['Root/Host/@Row/@Ok']);
    expect(syntheticPath('Root/Host', 'Row')).toBe('Root/Host/@Row');
  });
});
