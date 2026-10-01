/** The shared frame-key arms: each class gives the prefix and setter cites, and `spriteFrameGrid.ts` fixes the severities. */
import { describe, it, expect } from 'vitest';
import type { TscnNode } from '../parser/types.js';
import { spriteFrameArms, spriteFrameDiagnostics } from './spriteFrameGrid.js';

const node = { name: 'Hero', type: 'Sprite2D' } as TscnNode;
const arms = spriteFrameArms('sprite2d', {
  frame: 'sprite_2d.cpp:296',
  frameCoords: 'sprite_2d.cpp:312',
  remap: 'sprite_2d.cpp:358',
});

describe('spriteFrameArms', () => {
  it('declares a refused write as an error and a remapped one as a warning, under the prefix', () => {
    expect(arms).toEqual({
      frameRange: {
        severity: 'error',
        ruleName: 'sprite2d-frame-range',
        grounding: { kind: 'engine', at: 'sprite_2d.cpp:296' },
      },
      frameCoordsRange: {
        severity: 'error',
        ruleName: 'sprite2d-frame-coords-range',
        grounding: { kind: 'engine', at: 'sprite_2d.cpp:312' },
      },
      frameRemapped: {
        severity: 'warning',
        ruleName: 'sprite2d-frame-remapped',
        grounding: { kind: 'engine', at: 'sprite_2d.cpp:358' },
      },
    });
  });
});

describe('spriteFrameDiagnostics', () => {
  it('reports a refused frame through the frame-range arm', () => {
    const [diagnostic] = spriteFrameDiagnostics(node, { hframes: '2', frame: '5' }, arms);
    expect(diagnostic).toBeAtTier('error');
    expect(diagnostic).toMatchObject({
      ruleName: 'sprite2d-frame-range',
      nodeName: 'Hero',
      nodeType: 'Sprite2D',
    });
  });

  it('reports nothing for a frame the grid holds', () => {
    expect(spriteFrameDiagnostics(node, { hframes: '2', frame: '1' }, arms)).toEqual([]);
  });
});
