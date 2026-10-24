/**
 * <GizmoLine> draws its segments. A segment with a non-finite vertex draws nothing, and its finite
 * neighbours still draw, as in Godot: 6 of 8 lines of a mesh with two NaN lines (measured, 4.6.3).
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { GizmoVariant } from '../gizmo/gizmoVariant';
import { GizmoPartScene } from '../testing/GizmoScene';
import { GizmoLine } from './GizmoLine';

/** Without a `variant` the line is no plugin material, so it draws outside every `PluginGizmo`. */
async function render(positions: number[], colors?: number[], opacity?: number, variant?: GizmoVariant) {
  const line = (
    <GizmoLine
      positions={new Float32Array(positions)}
      colors={colors && new Float32Array(colors)}
      opacity={opacity}
    />
  );
  return ReactThreeTestRenderer.create(
    variant === undefined ? line : <GizmoPartScene variant={variant}>{line}</GizmoPartScene>
  );
}

async function lineCount(positions: number[]): Promise<number> {
  return (await render(positions)).scene.findAllByType('LineSegments').length;
}

/** The vertices and the colours the first line object draws. */
async function drawn(positions: number[], colors?: number[]) {
  const renderer = await render(positions, colors);
  const geometry = (renderer.scene.findByType('LineSegments').instance as THREE.LineSegments).geometry;
  return {
    positions: Array.from(geometry.getAttribute('position').array),
    colors: geometry.getAttribute('color') && Array.from(geometry.getAttribute('color').array),
  };
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

  it('draws the finite segments beside one with a non-finite vertex', async () => {
    const { positions } = await drawn([0, 0, 0, 0, 0, 4, 0, 1, 0, NaN, 1, 0, 0, 2, 0, 0, 2, 4]);
    expect(positions).toEqual([0, 0, 0, 0, 0, 4, 0, 2, 0, 0, 2, 4]);
  });

  it('drops the colours of a dropped segment with it', async () => {
    const { colors } = await drawn(
      [0, 0, 0, 1, 0, 0, 0, 1, 0, Infinity, 1, 0],
      [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0]
    );
    expect(colors).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it('draws at full opacity unless it is given one', async () => {
    const renderer = await render([0, 0, 0, 0, 0, 4]);
    const line = renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
    expect((line.material as THREE.LineBasicMaterial).opacity).toBe(1);
  });

  it('draws at the opacity given, blended over the scene', async () => {
    const renderer = await render([0, 0, 0, 0, 0, 4], undefined, 0.02);
    const line = renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
    const material = line.material as THREE.LineBasicMaterial;
    expect([material.opacity, material.transparent]).toEqual([0.02, true]);
  });

  it('draws the unselected variant at 0.3 of the opacity given', async () => {
    const renderer = await render([0, 0, 0, 0, 0, 4], undefined, 0.5, 'unselected');
    const line = renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
    expect((line.material as THREE.LineBasicMaterial).opacity).toBeCloseTo(0.15, 10);
  });

  it('draws the unselected variant of an opaque colour at 0.3', async () => {
    const renderer = await render([0, 0, 0, 0, 0, 4], undefined, undefined, 'unselected');
    const line = renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
    expect((line.material as THREE.LineBasicMaterial).opacity).toBe(0.3);
  });

  it('draws the selected variant at the opacity given', async () => {
    const renderer = await render([0, 0, 0, 0, 0, 4], undefined, 0.5, 'selected');
    const line = renderer.scene.findByType('LineSegments').instance as THREE.LineSegments;
    expect((line.material as THREE.LineBasicMaterial).opacity).toBe(0.5);
  });
});
