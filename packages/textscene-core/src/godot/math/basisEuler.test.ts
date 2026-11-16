import { describe, expect, it } from 'vitest';
import { IDENTITY_BASIS, type BasisComponents } from './basis.js';
import { basisFromEuler, basisGetEuler, EulerOrder } from './basisEuler.js';

const f = Math.fround;

describe('basisGetEuler', () => {
  it.each(Object.entries(EulerOrder))('gives no turn for the identity in order %s', (_name, order) => {
    const { x, y, z } = basisGetEuler(IDENTITY_BASIS, order);

    expect([x, y, z].map(Math.abs)).toEqual([0, 0, 0]);
  });

  it('gives a quarter turn about X at the YXZ pole', () => {
    const quarterTurnAboutX: BasisComponents = [1, 0, 0, 0, 0, -1, 0, 1, 0];

    expect(basisGetEuler(quarterTurnAboutX, EulerOrder.YXZ)).toEqual({ x: f(Math.PI / 2), y: 0, z: 0 });
  });

  it('gives the zero vector for an order outside the enum', () => {
    expect(basisGetEuler([0, -1, 0, 1, 0, 0, 0, 0, 1], 6)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('basisFromEuler', () => {
  const angles = { x: f(0.3), y: f(-0.4), z: f(0.5) };

  it.each(Object.entries(EulerOrder))(
    'builds a basis that reads back its angles in order %s',
    (_name, order) => {
      const { x, y, z } = basisGetEuler(basisFromEuler(angles, order), order);

      expect([x, y, z].map((angle) => angle.toFixed(5))).toEqual(['0.30000', '-0.40000', '0.50000']);
    }
  );

  it('gives the identity for an order outside the enum', () => {
    expect(basisFromEuler(angles, -1)).toBe(IDENTITY_BASIS);
  });
});
