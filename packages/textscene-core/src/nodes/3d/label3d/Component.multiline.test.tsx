/**
 * Label3D text layout: newlines and the authored `font_size`.
 *
 * Godot lays Label3D text out with TextServer paragraph shaping — `\n` starts
 * a new line, lines stack vertically, and the quad's width is the WIDEST line,
 * not the concatenation. Canvas2D `fillText` does none of that: it draws the
 * whole string on one baseline and silently ignores `\n`, so every multi-line
 * label in scenes/demos/3d/sprites/3d_sprites.tscn rendered as one very wide
 * strip. The parser also never emitted `font_size`, so the world sizing was
 * pinned to a constant regardless of what the scene authored.
 *
 * The existing tests stub `measureText` at a constant width, which cannot see
 * a line-splitting bug at all; this file's stub makes width proportional to
 * the measured string so the widest-line rule is observable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Label3D } from './Component';
import { parseLabel3D } from './parser';
import type { TscnNode } from '../../../parser/types';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import { findMesh } from '../testing/reactThreeTestInstance';

const CHAR_WIDTH = 10;

beforeEach(() => {
  const mockContext = {
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    measureText: vi.fn((s: string) => ({ width: s.length * CHAR_WIDTH })),
    fillText: vi.fn(),
    strokeText: vi.fn(),
  };
  HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
    if (type === '2d') return mockContext as unknown as CanvasRenderingContext2D;
    return null;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

/** Build the node through the real parser so defaults come from one place. */
function makeNode(properties: Record<string, string>): TscnNode {
  const parsed = parseLabel3D(
    { type: 'node', attributes: { name: 'Label', type: 'Label3D', parent: '.' } },
    properties
  );
  return { name: 'Label', type: 'Label3D', children: [], properties: parsed };
}

async function quad(properties: Record<string, string>) {
  const renderer = await ReactThreeTestRenderer.create(
    <ViewportModeProvider initialShowLabels>
      <Label3D node={makeNode(properties)} />
    </ViewportModeProvider>
  );
  const geometry = findMesh(renderer.scene).geometry as unknown as {
    parameters: { width: number; height: number };
  };
  return geometry.parameters;
}

describe('<Label3D> multi-line text', () => {
  it('sizes the quad from the widest line, not the concatenated string', async () => {
    const oneLine = await quad({ text: '"ABCDEFG"' });
    const twoLines = await quad({ text: '"AB\\nCDEFG"' });

    // "AB\nCDEFG" concatenates to 7 glyphs — exactly `oneLine`'s width — so a
    // single-fillText implementation returns the same width here.
    expect(twoLines.width).toBeLessThan(oneLine.width);
  });

  it('grows the quad by one line height per newline', async () => {
    const one = await quad({ text: '"A"' });
    const two = await quad({ text: '"A\\nB"' });
    const three = await quad({ text: '"A\\nB\\nC"' });

    const step = two.height - one.height;
    expect(step).toBeGreaterThan(0);
    expect(three.height - two.height).toBeCloseTo(step, 6);
  });

  it('counts a trailing newline as an empty final line, like Godot', async () => {
    const plain = await quad({ text: '"A"' });
    const trailing = await quad({ text: '"A\\n"' });

    expect(trailing.height).toBeGreaterThan(plain.height);
  });

  it('scales the quad with the authored font_size', async () => {
    const small = await quad({ text: '"Hello"', font_size: '32' });
    const large = await quad({ text: '"Hello"', font_size: '64' });

    expect(large.height).toBeCloseTo(small.height * 2, 6);
    expect(large.width).toBeCloseTo(small.width * 2, 6);
  });

  it('defaults font_size to Godot 32 when the scene omits it', async () => {
    const implicit = await quad({ text: '"Hello"' });
    const explicit = await quad({ text: '"Hello"', font_size: '32' });

    expect(implicit.height).toBeCloseTo(explicit.height, 6);
  });
});
