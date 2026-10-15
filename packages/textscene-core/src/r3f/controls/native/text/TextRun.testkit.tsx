/** Reads the merged glyph quads `<TextRun>` uploads for a layout, for tests that pin glyph placement. */
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TextRun } from './TextRun';
import type { TextLayoutResult } from './textLayout';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };

/** Four vertices per quad, in the order TL, TR, BL, BR, each `(x, -y, 0)` in local Godot px. */
export interface RenderedGlyphQuads {
  positions: Float32Array;
  indices: ArrayLike<number>;
}

/** The position and index buffers of the one mesh `<TextRun>` mounts for `layout`. */
export async function renderedGlyphQuads(
  layout: TextLayoutResult,
  fontSizePx: number,
  skew = 0
): Promise<RenderedGlyphQuads> {
  const renderer = await ReactThreeTestRenderer.create(
    <TextRun layout={layout} fontSizePx={fontSizePx} tint={WHITE} skew={skew} />
  );
  const geometry = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry;
  const quads = {
    positions: Float32Array.from(geometry.getAttribute('position').array),
    indices: Array.from(geometry.getIndex()?.array ?? []),
  };
  await renderer.unmount();
  return quads;
}
