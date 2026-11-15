/**
 * `poseInstances` and `particleQuad`: the frozen pose as the MultiMesh Godot fills, which
 * `canvasInstancesGeometry` merges into each particle's quad, in pose order.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { canvasInstancesGeometry } from '../../../r3f/meshes/canvasMeshInstances';
import { flipbookCell, type ParticlesFlipbook } from '../../../r3f/particlesFlipbook';
import { TRANSFORM2D_IDENTITY } from '../../../godot/math/transform2d.js';
import { particleQuad, poseInstances } from './poseInstances';
import type { RenderedParticle } from './simulate';

function particle(overrides: Partial<RenderedParticle> = {}): RenderedParticle {
  return {
    transform: { ...TRANSFORM2D_IDENTITY, tx: 12, ty: -7 },
    color: { r: 1, g: 0.5, b: 0.25, a: 1 },
    anim: 0,
    age: 0,
    index: 0,
    ...overrides,
  };
}

const ROTATED_90 = { a: 0, b: 1, c: -1, d: 0, tx: 30, ty: 40 };
const MIRRORED = { a: -1, b: 0, c: 0, d: 1, tx: -5, ty: 9 };
const SHEET: ParticlesFlipbook = { hFrames: 2, vFrames: 2, loop: false };

function merged(pose: RenderedParticle[], width: number, height: number, flipbook: ParticlesFlipbook | null) {
  return canvasInstancesGeometry(particleQuad(width, height), poseInstances(pose), flipbook);
}

function values(geometry: THREE.BufferGeometry, name: string): number[] {
  return Array.from(geometry.getAttribute(name).array as Float32Array);
}

/** Godot's quad corners and their UVs, in `_update_mesh_texture`'s order (`cpu_particles_2d.cpp:207-226`). */
const CORNERS = [
  { x: -0.5, y: -0.5, u: 0, v: 0 },
  { x: 0.5, y: -0.5, u: 1, v: 0 },
  { x: 0.5, y: 0.5, u: 1, v: 1 },
  { x: -0.5, y: 0.5, u: 0, v: 1 },
];

/**
 * Each particle's quad as Godot draws it: the corner shrunk to the flipbook cell, under the
 * particle's Transform2D, with Y negated for three, and the UV windowed to the cell with V up.
 */
function expectedQuads(
  pose: readonly RenderedParticle[],
  width: number,
  height: number,
  flipbook: ParticlesFlipbook | null
) {
  const position: number[] = [];
  const uv: number[] = [];
  const color: number[] = [];
  for (const { transform: t, color: c, anim } of pose) {
    const cell = flipbookCell(flipbook, anim);
    for (const corner of CORNERS) {
      const x = (corner.x * width) / cell.hFrames;
      const y = (corner.y * height) / cell.vFrames;
      position.push(t.a * x + t.c * y + t.tx, -(t.b * x + t.d * y + t.ty), 0);
      uv.push(corner.u / cell.hFrames + cell.uOffset, 1 - (corner.v / cell.vFrames + cell.vOffset));
      color.push(c.r, c.g, c.b, c.a);
    }
  }
  const index = pose.flatMap((_, i) => [0, 1, 2, 2, 3, 0].map((corner) => i * 4 + corner));
  return { position, uv, color, index };
}

function expectClose(found: number[], expected: number[]) {
  expect(found).toHaveLength(expected.length);
  found.forEach((value, i) => expect(value).toBeCloseTo(expected[i]!, 4));
}

describe('poseInstances', () => {
  it('maps a Transform2D to the 2D buffer row [a, c, 0, tx, b, d, 0, ty]', () => {
    const [instance] = poseInstances([particle({ transform: ROTATED_90 })]);
    expect(Array.from(instance!.transform)).toEqual([0, -1, 0, 30, 1, 0, 0, 40]);
  });

  it('carries the colour as stored and anim in the z of the custom data', () => {
    const [instance] = poseInstances([particle({ color: { r: 0.2, g: 0.4, b: 0.6, a: 0.5 }, anim: 0.75 })]);
    expectClose(Array.from(instance!.color!), [0.2, 0.4, 0.6, 0.5]);
    expectClose(Array.from(instance!.customData!), [0, 0, 0.75, 0]);
  });

  it('gives no instance for an empty pose', () => {
    expect(poseInstances([])).toEqual([]);
  });
});

describe('the merged particle geometry', () => {
  it.each([
    ['an identity particle', [particle({ transform: { ...TRANSFORM2D_IDENTITY } })], 8, 8, null],
    ['a particle rotated 90 degrees', [particle({ transform: ROTATED_90 })], 10, 4, null],
    ['a mirrored particle', [particle({ transform: MIRRORED })], 10, 4, null],
    ['a particle with alpha 0.5', [particle({ color: { r: 1, g: 1, b: 1, a: 0.5 } })], 8, 8, null],
    [
      'a 2 by 2 flipbook at anim 0 and 0.75',
      [particle(), particle({ anim: 0.75, transform: MIRRORED })],
      16,
      16,
      SHEET,
    ],
    ['no texture, a 1 by 1 quad', [particle(), particle({ transform: ROTATED_90 })], 1, 1, null],
  ] as const)('draws the quad Godot draws for %s', (_case, pose, width, height, flipbook) => {
    const found = merged([...pose], width, height, flipbook);
    const expected = expectedQuads(pose, width, height, flipbook);

    expectClose(values(found, 'position'), expected.position);
    expectClose(values(found, 'uv'), expected.uv);
    expectClose(values(found, 'color'), expected.color);
    expect(Array.from(found.getIndex()!.array)).toEqual(expected.index);
  });
});
