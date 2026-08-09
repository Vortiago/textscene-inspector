import { describe, expect, it } from 'vitest';
import { findRowValue } from './inspector.mjs';

const SECTIONS = [
  { title: 'Text', rows: [{ label: 'Text', value: 'BoxMesh Test' }, { label: 'Pixel Size', value: '0.0080' }] },
  { title: 'Position', rows: [{ label: 'X', value: '0.000' }, { label: 'Y', value: '2.500' }] },
];

describe('findRowValue', () => {
  it('returns the value for a known section + row', () => {
    expect(findRowValue(SECTIONS, 'Text', 'Text')).toBe('BoxMesh Test');
    expect(findRowValue(SECTIONS, 'Position', 'Y')).toBe('2.500');
  });

  it('returns undefined for a row that exists in a different section', () => {
    expect(findRowValue(SECTIONS, 'Text', 'Y')).toBeUndefined();
  });

  it('returns undefined for an unknown section', () => {
    expect(findRowValue(SECTIONS, 'Nope', 'Text')).toBeUndefined();
  });

  it('returns undefined for null/empty sections (panel never rendered)', () => {
    expect(findRowValue(null, 'Text', 'Text')).toBeUndefined();
    expect(findRowValue([], 'Text', 'Text')).toBeUndefined();
  });
});
