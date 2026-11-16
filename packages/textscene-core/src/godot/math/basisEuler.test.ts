import { describe, expect, it } from 'vitest';
import { IDENTITY_BASIS, type BasisComponents } from './basis.js';
import { basisGetEuler, EulerOrder } from './basisEuler.js';

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
