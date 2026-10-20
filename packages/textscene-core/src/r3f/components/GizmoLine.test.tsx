/** <GizmoLine> draws its segments, and nothing when a vertex is non-finite. */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GizmoLine } from './GizmoLine';

async function lineCount(positions: number[]): Promise<number> {
  const renderer = await ReactThreeTestRenderer.create(<GizmoLine positions={new Float32Array(positions)} />);
  return renderer.scene.findAllByType('LineSegments').length;
}

describe('<GizmoLine>', () => {
  it('draws a segment with finite vertices', async () => {
    expect(await lineCount([0, 0, 0, 0, 0, 4])).toBe(1);
  });

  it.each([
    ['an infinite', Infinity],
    ['a negative infinite', -Infinity],
    ['a NaN', NaN],
  ])('draws nothing for %s vertex', async (_label, bad) => {
    expect(await lineCount([0, 0, 0, 0, 0, bad])).toBe(0);
  });
});
