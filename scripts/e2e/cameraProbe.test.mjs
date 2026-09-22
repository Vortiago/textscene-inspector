import { describe, expect, it } from 'vitest';
import { formatMatrix, matricesEqual } from './cameraProbe.mjs';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const TRANSLATED = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 0, 0, 1];

describe('matricesEqual', () => {
  it('is true for two clones of the same 16 values', () => {
    expect(matricesEqual(IDENTITY, [...IDENTITY])).toBe(true);
  });

  it('is false when one value differs (the camera moved)', () => {
    expect(matricesEqual(IDENTITY, TRANSLATED)).toBe(false);
  });

  it('is false when either side is not a captured matrix (probe never fired)', () => {
    expect(matricesEqual(null, IDENTITY)).toBe(false);
    expect(matricesEqual(IDENTITY, null)).toBe(false);
    expect(matricesEqual(undefined, undefined)).toBe(false);
  });

  it('is false for the wrong length (a corrupt or partial capture)', () => {
    expect(matricesEqual(IDENTITY.slice(0, 15), IDENTITY.slice(0, 15))).toBe(false);
    expect(matricesEqual(IDENTITY, [...IDENTITY, 1])).toBe(false);
  });

  it('distinguishes 0 from -0 (Object.is, not ==)', () => {
    const withNegativeZero = [...IDENTITY];
    withNegativeZero[0] = -0;
    expect(matricesEqual(IDENTITY, withNegativeZero)).toBe(false);
  });
});

describe('formatMatrix', () => {
  it('renders 16 fixed-precision values', () => {
    const formatted = formatMatrix(IDENTITY);
    expect(formatted).toBe(
      '[1.000000, 0.000000, 0.000000, 0.000000, 0.000000, 1.000000, 0.000000, 0.000000, ' +
        '0.000000, 0.000000, 1.000000, 0.000000, 0.000000, 0.000000, 0.000000, 1.000000]'
    );
  });

  it('falls back to String() for a non-array (a null capture)', () => {
    expect(formatMatrix(null)).toBe('null');
  });
});
